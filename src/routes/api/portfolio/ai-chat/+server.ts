import { env } from '$env/dynamic/private';
import { aiTools, executeTool } from '$lib/server/ai-tools';
import { rateLimit } from '$lib/server/rate-limit';
import { validateChatMessages } from '$lib/server/validation';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return new Response(JSON.stringify({ message: 'ไม่ได้รับอนุญาต' }), { status: 403 });
	}

	if (!(await rateLimit(`ai-chat:${profile.id}`, 20, 60_000))) {
		return new Response(JSON.stringify({ message: 'Rate limit exceeded' }), { status: 429 });
	}

	const body = await request.json();
	const result = validateChatMessages(body.messages);
	if (!result.valid) {
		return new Response(JSON.stringify({ message: result.error }), { status: result.status });
	}
	const userMessages = result.messages;

	const supabase = locals.supabase;
	const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

	// Fetch client account
	const { data: account } = await supabase
		.from('client_accounts')
		.select('id, client_name, mt5_account_id, mt5_server, last_synced_at')
		.eq('status', 'approved')
		.maybeSingle();

	if (!account) {
		return new Response(JSON.stringify({ message: 'No approved account' }), { status: 404 });
	}

	// Fetch latest stats for context
	const { data: latestStats } = await supabase
		.from('daily_stats')
		.select('date, balance, equity, profit, win_rate, profit_factor, max_drawdown, total_trades')
		.eq('client_account_id', account.id)
		.order('date', { ascending: false })
		.limit(1)
		.single();

	const systemPrompt = buildSystemPrompt(account, latestStats);

	const messages: ChatCompletionMessageParam[] = [
		{ role: 'system', content: systemPrompt },
		...userMessages.map(m => ({
			role: m.role as 'user' | 'assistant',
			content: m.content
		}))
	];

	// Streaming response with tool-use loop
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			const send = (data: Record<string, unknown>) => {
				controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
			};

			try {
				let currentMessages = [...messages];
				let iterations = 0;
				const MAX_ITERATIONS = 5;

				while (iterations < MAX_ITERATIONS) {
					iterations++;

					const response = await openai.chat.completions.create({
						model: 'gpt-4o-mini',
						max_tokens: 1024,
						messages: currentMessages,
						tools: aiTools
					});

					const choice = response.choices[0];
					if (!choice) break;

					const message = choice.message;

					// Stream text content
					if (message.content) {
						send({ type: 'text_delta', text: message.content });
					}

					// Handle tool calls
					if (message.tool_calls && message.tool_calls.length > 0) {
						const functionCalls = message.tool_calls.filter(
							(tc): tc is Extract<typeof tc, { type: 'function' }> => tc.type === 'function'
						);

						if (functionCalls.length > 0) {
							send({ type: 'tool_use', names: functionCalls.map(tc => tc.function.name) });

							// Add assistant message with tool calls
							currentMessages.push(message);

							// Execute all tool calls and add results
							for (const toolCall of functionCalls) {
								const args = JSON.parse(toolCall.function.arguments || '{}');
								const result = await executeTool(
									toolCall.function.name,
									args,
									supabase,
									account.id,
									profile.id
								);

								currentMessages.push({
									role: 'tool',
									tool_call_id: toolCall.id,
									content: result
								});
							}
						}

						// Continue loop to get final response
						continue;
					}

					// No tool calls — we're done
					break;
				}

				send({ type: 'done' });
			} catch (err: unknown) {
				send({ type: 'error', message: err instanceof Error ? err.message : 'AI error' });
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Transfer-Encoding': 'chunked',
			'Cache-Control': 'no-cache'
		}
	});
};

interface AccountContext {
	client_name: string;
	mt5_account_id: string;
	mt5_server: string;
}

interface StatsContext {
	date: string;
	balance: number | null;
	equity: number | null;
	profit: number | null;
	win_rate: number | null;
	profit_factor: number | null;
	max_drawdown: number | null;
	total_trades: number | null;
}

function buildSystemPrompt(account: AccountContext, stats: StatsContext | null): string {
	const statsContext = stats
		? `
ข้อมูลล่าสุด (วันที่ ${stats.date}):
- Balance: $${stats.balance?.toLocaleString()}
- Equity: $${stats.equity?.toLocaleString()}
- Profit รวม: $${stats.profit?.toLocaleString()}
- Win Rate: ${stats.win_rate ?? 'N/A'}%
- Profit Factor: ${stats.profit_factor ?? 'N/A'}
- Max Drawdown: ${stats.max_drawdown ?? 'N/A'}%
- จำนวนเทรดทั้งหมด: ${stats.total_trades ?? 'N/A'}`
		: 'ยังไม่มีข้อมูลสถิติ';

	return `คุณเป็นผู้ช่วย AI วิเคราะห์การเทรดของ IB Portal ตอบเป็นภาษาไทยเสมอ

ข้อมูลลูกค้า:
- ชื่อ: ${account.client_name}
- MT5 Account: ${account.mt5_account_id} @ ${account.mt5_server}

${statsContext}

คำแนะนำ:
1. ใช้ tools ดึงข้อมูลก่อนตอบคำถามเกี่ยวกับการเทรดเสมอ อย่าเดาข้อมูล
2. วิเคราะห์เชิงลึก ชี้จุดแข็ง จุดอ่อน และให้คำแนะนำที่นำไปปฏิบัติได้จริง
3. เมื่อมีข้อมูล review / journal / playbook ให้ใช้ประกอบการตอบเพื่อหากฎที่ถูกละเมิดและ recurring mistakes
4. ตอบกระชับแต่ครอบคลุม ใช้ตัวเลขประกอบการวิเคราะห์
5. เมื่อเปรียบเทียบข้อมูล ให้แสดงเป็นตารางหรือ bullet points
6. หากถูกถามเรื่องที่ไม่เกี่ยวกับการเทรด ให้ปฏิเสธสุภาพและแนะนำให้ถามเรื่องเทรด
7. ใช้ emoji sparingly เพื่อทำให้อ่านง่าย`;
}
