import { env } from '$env/dynamic/private';
import { buildAnalysisPrompt } from '$lib/server/analysis-prompt';
import { getBigLotAiTools, executeBigLotAiTool, type BigLotAiToolExecutionResult } from '$lib/server/biglot-ai-tools';
import { rateLimit } from '$lib/server/rate-limit';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import { inferBigLotAiTitle } from '$lib/server/validation';
import type {
	BigLotAiChat,
	BigLotAiMessage,
	BigLotAiMode,
	BigLotAiScope,
	BigLotAiSurfaceRole,
	BigLotAiRun,
	ClientAccount,
	UserRole
} from '$lib/types';
import OpenAI from 'openai';
import type { RequestEvent } from '@sveltejs/kit';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const BIGLOT_AI_MODEL = env.BIGLOT_AI_MODEL || 'gpt-4o-mini';
const MAX_HISTORY_MESSAGES = 18;
const MAX_TOOL_ITERATIONS = 4;

type ServiceAccount = Pick<ClientAccount, 'id' | 'user_id' | 'master_ib_id' | 'client_name' | 'mt5_account_id' | 'mt5_server' | 'status' | 'last_synced_at'>;

interface BigLotAiContextBundle {
	account: ServiceAccount;
	latestStats: Record<string, unknown> | null;
	journals: Record<string, unknown>[];
	playbooks: Record<string, unknown>[];
	reviews: Record<string, unknown>[];
	progressGoals: Record<string, unknown>[];
	memories: Record<string, unknown>[];
	marketNews: Record<string, unknown>[];
	goldContext: {
		currentPrice: { price: number; source: string; updatedAt: string } | null;
		news: Record<string, unknown>[];
		trades: Record<string, unknown>[];
		openPositions: Record<string, unknown>[];
	};
}

function compactJson(value: unknown): string {
	return JSON.stringify(value, null, 2);
}

function truncateText(value: string, max = 140): string {
	return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

async function getMasterIbId(userId: string): Promise<string | null> {
	const service = createSupabaseServiceClient();
	const { data } = await service
		.from('master_ibs')
		.select('id')
		.eq('user_id', userId)
		.maybeSingle();

	return data?.id ?? null;
}

async function getScopedServiceAccount(role: UserRole, actorUserId: string, requestedAccountId: string | null): Promise<ServiceAccount | null> {
	if (!requestedAccountId) return null;

	const service = createSupabaseServiceClient();
	let query = service
		.from('client_accounts')
		.select('id, user_id, master_ib_id, client_name, mt5_account_id, mt5_server, status, last_synced_at')
		.eq('id', requestedAccountId)
		.eq('status', 'approved');

	if (role === 'master_ib') {
		const ibId = await getMasterIbId(actorUserId);
		if (!ibId) return null;
		query = query.eq('master_ib_id', ibId);
	}

	const { data } = await query.maybeSingle();
	if (!data?.user_id) return null;
	return data as ServiceAccount;
}

async function getClientScopedAccount(userId: string, requestedAccountId: string | null, selectedAccountId: string | null): Promise<ServiceAccount | null> {
	const service = createSupabaseServiceClient();
	const candidateIds = [requestedAccountId, selectedAccountId].filter(Boolean) as string[];

	if (candidateIds.length > 0) {
		const { data } = await service
			.from('client_accounts')
			.select('id, user_id, master_ib_id, client_name, mt5_account_id, mt5_server, status, last_synced_at')
			.eq('user_id', userId)
			.eq('status', 'approved')
			.in('id', candidateIds)
			.order('created_at', { ascending: true })
			.limit(1);

		if (data?.[0]?.user_id) return data[0] as ServiceAccount;
	}

	const { data: fallback } = await service
		.from('client_accounts')
		.select('id, user_id, master_ib_id, client_name, mt5_account_id, mt5_server, status, last_synced_at')
		.eq('user_id', userId)
		.eq('status', 'approved')
		.order('created_at', { ascending: true })
		.limit(1);

	if (!fallback?.[0]?.user_id) return null;
	return fallback[0] as ServiceAccount;
}

export async function resolveBigLotAiScope(
	event: Pick<RequestEvent, 'locals' | 'url'>
): Promise<BigLotAiScope | null> {
	const profile = event.locals.profile;
	if (!profile) return null;

	const requestedAccountId = event.url.searchParams.get('account_id');

	if (profile.role === 'client') {
		const account = await getClientScopedAccount(profile.id, requestedAccountId, event.locals.selectedAccountId ?? null);
		if (!account?.user_id) return null;

		return {
			actorUserId: profile.id,
			actorRole: profile.role,
			targetUserId: account.user_id,
			clientAccountId: account.id,
			sourceSurface: 'portfolio',
			account
		};
	}

	const scopedAccount = await getScopedServiceAccount(profile.role, profile.id, requestedAccountId);
	if (!scopedAccount?.user_id) return null;

	return {
		actorUserId: profile.id,
		actorRole: profile.role,
		targetUserId: scopedAccount.user_id,
		clientAccountId: scopedAccount.id,
		sourceSurface: 'portfolio',
		account: scopedAccount
	};
}

function getRouteType(mode: BigLotAiMode, toolCallCount: number): BigLotAiRun['route_type'] {
	if (mode === 'gold') return 'gold_analysis';
	if (mode === 'coach') return 'coach_summary';
	return toolCallCount > 0 ? 'tool_augmented_answer' : 'direct_answer';
}

async function buildBigLotAiContext(scope: BigLotAiScope): Promise<BigLotAiContextBundle> {
	const service = createSupabaseServiceClient();
	const [latestStatsRes, journalsRes, playbooksRes, reviewsRes, progressRes, memoriesRes, marketNewsRes, xauPriceRes, xauNewsRes, xauTradesRes, xauPositionsRes] =
		await Promise.all([
			service
				.from('daily_stats')
				.select('date, balance, equity, profit, floating_pl, win_rate, profit_factor, max_drawdown, total_trades')
				.eq('client_account_id', scope.clientAccountId)
				.order('date', { ascending: false })
				.limit(1)
				.maybeSingle(),
			service
				.from('daily_journal')
				.select('date, market_bias, key_levels, session_plan, pre_market_notes, post_market_notes, lessons, completion_status')
				.eq('client_account_id', scope.clientAccountId)
				.eq('user_id', scope.targetUserId)
				.order('date', { ascending: false })
				.limit(5),
			service
				.from('playbooks')
				.select('name, description, entry_criteria, exit_criteria, risk_rules, mistakes_to_avoid, is_active, sort_order')
				.eq('client_account_id', scope.clientAccountId)
				.eq('user_id', scope.targetUserId)
				.eq('is_active', true)
				.order('sort_order', { ascending: true })
				.limit(5),
			service
				.from('trades')
				.select('symbol, close_time, profit, trade_reviews(review_status, broken_rules, lesson_summary, followed_plan)')
				.eq('client_account_id', scope.clientAccountId)
				.order('close_time', { ascending: false })
				.limit(8),
			service
				.from('progress_goals')
				.select('goal_type, target_value, period_days, is_active')
				.eq('client_account_id', scope.clientAccountId)
				.eq('user_id', scope.targetUserId)
				.eq('is_active', true)
				.limit(8),
			service
				.from('ai_memory')
				.select('memory_type, key, value, confidence, updated_at')
				.eq('owner_user_id', scope.targetUserId)
				.eq('client_account_id', scope.clientAccountId)
				.order('updated_at', { ascending: false })
				.limit(8),
			service
				.from('market_news')
				.select('title_th, summary_th, category, published_at, symbols')
				.eq('ai_processed', true)
				.order('published_at', { ascending: false })
				.limit(6),
			import('$lib/server/gold-price').then(({ getXauusdPrice }) => getXauusdPrice()),
			service
				.from('market_news')
				.select('title_th, summary_th, category, published_at, symbols')
				.eq('ai_processed', true)
				.contains('symbols', ['XAUUSD'])
				.order('published_at', { ascending: false })
				.limit(6),
			service
				.from('trades')
				.select('symbol, type, lot_size, profit, open_time, close_time')
				.eq('client_account_id', scope.clientAccountId)
				.eq('symbol', 'XAUUSD')
				.order('close_time', { ascending: false })
				.limit(10),
			service
				.from('open_positions')
				.select('symbol, type, lot_size, open_price, current_price, current_profit, sl, tp')
				.eq('client_account_id', scope.clientAccountId)
				.eq('symbol', 'XAUUSD')
		]);

	return {
		account: scope.account,
		latestStats: latestStatsRes.data ?? null,
		journals: journalsRes.data ?? [],
		playbooks: playbooksRes.data ?? [],
		reviews: reviewsRes.data ?? [],
		progressGoals: progressRes.data ?? [],
		memories: memoriesRes.data ?? [],
		marketNews: marketNewsRes.data ?? [],
		goldContext: {
			currentPrice: xauPriceRes,
			news: xauNewsRes.data ?? [],
			trades: xauTradesRes.data ?? [],
			openPositions: xauPositionsRes.data ?? []
		}
	};
}

function buildGeneralPrompt(scope: BigLotAiScope, context: BigLotAiContextBundle, mode: BigLotAiMode): string {
	const latestJournal = context.journals[0] ?? null;
	const memorySummary = context.memories.length > 0
		? context.memories.map((memory) => `- [${String(memory.memory_type)}] ${String(memory.key)}: ${truncateText(JSON.stringify(memory.value))}`).join('\n')
		: '- ยังไม่มี memory summary';

	return `คุณคือ TradePilot ผู้ช่วยเทรดหลักของระบบนี้ ตอบเป็นภาษาไทยเสมอ

บริบทสิทธิ์:
- actor role: ${scope.actorRole}
- target account owner: ${scope.account.client_name}
- account: ${scope.account.mt5_account_id} @ ${scope.account.mt5_server}
- ข้อมูลทุกอย่างต้องอ้างอิงเฉพาะ account นี้เท่านั้น

โหมดปัจจุบัน: ${mode}

ข้อมูลตั้งต้น:
- latest stats: ${compactJson(context.latestStats)}
- latest journal: ${compactJson(latestJournal)}
- active playbooks: ${compactJson(context.playbooks)}
- active progress goals: ${compactJson(context.progressGoals)}
- memory summary:
${memorySummary}

กติกาการตอบ:
1. ถ้าคำถามแตะ performance, trades, journal, playbook, reports, progress หรือ market context ของ account นี้ ให้ใช้ tools ก่อน
2. ถ้าเป็น general assistance ที่ไม่ต้องใช้ข้อมูลส่วนตัว สามารถตอบตรงได้
3. ห้ามเดาข้อมูลพอร์ต หากไม่แน่ใจต้องบอกว่าต้องใช้ tool เพิ่ม
4. คำตอบควรกระชับ ชัด และมีตัวเลขจริงเมื่ออ้างอิง performance
5. ถ้ามีการใช้ tools ให้สรุปสิ่งที่พบและเชื่อมกับคำถาม ไม่ dump raw JSON`;
}

function buildGoldPrompt(context: BigLotAiContextBundle): string {
	return buildAnalysisPrompt({
		news: context.goldContext.news.map((item) => ({
			title_th: String(item.title_th ?? ''),
			summary_th: String(item.summary_th ?? ''),
			category: String(item.category ?? ''),
			published_at: String(item.published_at ?? '')
		})),
		trades: context.goldContext.trades.map((trade) => ({
			symbol: String(trade.symbol ?? 'XAUUSD'),
			type: String(trade.type ?? ''),
			profit: Number(trade.profit ?? 0),
			open_time: String(trade.open_time ?? ''),
			close_time: String(trade.close_time ?? ''),
			lot_size: Number(trade.lot_size ?? 0)
		})),
		openPositions: context.goldContext.openPositions.map((position) => ({
			symbol: String(position.symbol ?? 'XAUUSD'),
			type: String(position.type ?? ''),
			lot_size: Number(position.lot_size ?? 0),
			open_price: Number(position.open_price ?? 0),
			current_price: Number(position.current_price ?? 0),
			current_profit: Number(position.current_profit ?? 0),
			sl: Number(position.sl ?? 0),
			tp: Number(position.tp ?? 0)
		})),
		journal: context.journals[0]
			? {
				date: String(context.journals[0].date ?? ''),
				market_bias: String(context.journals[0].market_bias ?? ''),
				key_levels: String(context.journals[0].key_levels ?? ''),
				session_plan: String(context.journals[0].session_plan ?? ''),
				pre_market_notes: String(context.journals[0].pre_market_notes ?? '')
			}
			: null,
		playbooks: context.playbooks.map((playbook) => ({
			name: String(playbook.name ?? ''),
			entry_criteria: JSON.stringify(playbook.entry_criteria ?? []),
			exit_criteria: JSON.stringify(playbook.exit_criteria ?? []),
			risk_rules: JSON.stringify(playbook.risk_rules ?? [])
		})),
		dailyStats: context.latestStats
			? [{
				date: String(context.latestStats.date ?? ''),
				balance: Number(context.latestStats.balance ?? 0),
				equity: Number(context.latestStats.equity ?? 0),
				profit: Number(context.latestStats.profit ?? 0),
				win_rate: Number(context.latestStats.win_rate ?? 0),
				profit_factor: Number(context.latestStats.profit_factor ?? 0),
				max_drawdown: Number(context.latestStats.max_drawdown ?? 0)
			}]
			: [],
		currentPrice: context.goldContext.currentPrice
	});
}

function buildSystemPrompt(scope: BigLotAiScope, context: BigLotAiContextBundle, mode: BigLotAiMode): string {
	if (mode === 'gold') {
		return `${buildGoldPrompt(context)}

เพิ่มเติม:
- คุณอยู่ในแชท TradePilot แบบต่อเนื่อง
- หากผู้ใช้ถาม follow-up เกี่ยวกับ XAUUSD หรือแผนเดิม ให้ตอบต่อเนื่องจากบริบทนี้
- ถ้าต้องอัปเดต context เพิ่ม ให้เรียก tools ที่เกี่ยวข้องก่อนตอบ`;
	}

	return buildGeneralPrompt(scope, context, mode);
}

async function ensureChatForScope(scope: BigLotAiScope, chatId: string | null, firstMessage: string): Promise<BigLotAiChat> {
	const service = createSupabaseServiceClient();

	if (chatId) {
		const { data: existing } = await service
			.from('ai_chats')
			.select('*')
			.eq('id', chatId)
			.eq('owner_user_id', scope.targetUserId)
			.eq('client_account_id', scope.clientAccountId)
			.is('archived_at', null)
			.maybeSingle();
		if (existing) return existing as BigLotAiChat;
	}

	const { data, error } = await service
		.from('ai_chats')
		.insert({
			owner_user_id: scope.targetUserId,
			client_account_id: scope.clientAccountId,
			surface_role: scope.actorRole as BigLotAiSurfaceRole,
			surface_context: scope.sourceSurface,
			title: inferBigLotAiTitle(firstMessage),
			last_message_at: new Date().toISOString()
		})
		.select('*')
		.single();

	if (error || !data) {
		throw new Error(error?.message || 'ไม่สามารถสร้าง chat ได้');
	}

	return data as BigLotAiChat;
}

async function getChatHistory(chatId: string): Promise<Array<Pick<BigLotAiMessage, 'role' | 'content' | 'mode'>>> {
	const service = createSupabaseServiceClient();
	const { data } = await service
		.from('ai_messages')
		.select('role, content, mode')
		.eq('chat_id', chatId)
		.order('created_at', { ascending: true })
		.limit(MAX_HISTORY_MESSAGES);

	return (data ?? []) as Array<Pick<BigLotAiMessage, 'role' | 'content' | 'mode'>>;
}

async function insertMessage(chatId: string, runId: string | null, role: 'user' | 'assistant', mode: BigLotAiMode, content: string, citations: Array<{ label: string; source: string }> | null, tokenUsage: Record<string, number> | null, status: BigLotAiMessage['status']): Promise<BigLotAiMessage | null> {
	const service = createSupabaseServiceClient();
	const { data } = await service
		.from('ai_messages')
		.insert({
			chat_id: chatId,
			run_id: runId,
			role,
			mode,
			content,
			citations,
			token_usage: tokenUsage,
			status
		})
		.select('*')
		.maybeSingle();

	return (data ?? null) as BigLotAiMessage | null;
}

async function createRun(scope: BigLotAiScope, chatId: string, mode: BigLotAiMode): Promise<BigLotAiRun> {
	const service = createSupabaseServiceClient();
	const { data, error } = await service
		.from('ai_runs')
		.insert({
			chat_id: chatId,
			actor_user_id: scope.actorUserId,
			actor_role: scope.actorRole,
			target_user_id: scope.targetUserId,
			client_account_id: scope.clientAccountId,
			mode,
			route_type: mode === 'gold' ? 'gold_analysis' : mode === 'coach' ? 'coach_summary' : 'direct_answer',
			provider: 'openai',
			model: BIGLOT_AI_MODEL,
			status: 'running'
		})
		.select('*')
		.single();

	if (error || !data) {
		throw new Error(error?.message || 'ไม่สามารถเริ่ม run ได้');
	}

	return data as BigLotAiRun;
}

async function completeRun(runId: string, values: Partial<BigLotAiRun>): Promise<void> {
	const service = createSupabaseServiceClient();
	await service
		.from('ai_runs')
		.update({
			...values,
			updated_at: new Date().toISOString()
		})
		.eq('id', runId);
}

async function persistToolCall(runId: string, toolName: string, args: Record<string, unknown>, result: BigLotAiToolExecutionResult): Promise<void> {
	const service = createSupabaseServiceClient();
	await service.from('ai_tool_calls').insert({
		run_id: runId,
		tool_name: toolName,
		tool_args: args,
		result_summary: result.summary,
		data_sources: result.dataSources,
		row_count: result.rowCount,
		cached: result.cached
	});
}

async function refreshChatTimestamp(chatId: string): Promise<void> {
	const service = createSupabaseServiceClient();
	await service
		.from('ai_chats')
		.update({ last_message_at: new Date().toISOString() })
		.eq('id', chatId);
}

export async function listBigLotAiChats(scope: BigLotAiScope): Promise<BigLotAiChat[]> {
	const service = createSupabaseServiceClient();
	const { data } = await service
		.from('ai_chats')
		.select('*')
		.eq('owner_user_id', scope.targetUserId)
		.eq('client_account_id', scope.clientAccountId)
		.is('archived_at', null)
		.order('last_message_at', { ascending: false });

	return (data ?? []) as BigLotAiChat[];
}

export async function createBigLotAiChat(scope: BigLotAiScope, title?: string): Promise<BigLotAiChat> {
	const service = createSupabaseServiceClient();
	const { data, error } = await service
		.from('ai_chats')
		.insert({
			owner_user_id: scope.targetUserId,
			client_account_id: scope.clientAccountId,
			surface_role: scope.actorRole,
			surface_context: scope.sourceSurface,
			title: title?.trim() || 'TradePilot',
			last_message_at: new Date().toISOString()
		})
		.select('*')
		.single();

	if (error || !data) {
		throw new Error(error?.message || 'ไม่สามารถสร้าง chat ได้');
	}

	return data as BigLotAiChat;
}

export async function archiveBigLotAiChat(scope: BigLotAiScope, chatId: string): Promise<boolean> {
	const service = createSupabaseServiceClient();
	const { error } = await service
		.from('ai_chats')
		.update({ archived_at: new Date().toISOString() })
		.eq('id', chatId)
		.eq('owner_user_id', scope.targetUserId)
		.eq('client_account_id', scope.clientAccountId);

	return !error;
}

export async function getBigLotAiMessages(scope: BigLotAiScope, chatId: string): Promise<BigLotAiMessage[]> {
	const service = createSupabaseServiceClient();
	const { data: chat } = await service
		.from('ai_chats')
		.select('id')
		.eq('id', chatId)
		.eq('owner_user_id', scope.targetUserId)
		.eq('client_account_id', scope.clientAccountId)
		.maybeSingle();

	if (!chat) {
		return [];
	}

	const { data } = await service
		.from('ai_messages')
		.select('*')
		.eq('chat_id', chatId)
		.order('created_at', { ascending: true });

	return (data ?? []) as BigLotAiMessage[];
}

async function upsertBigLotAiMemory(scope: BigLotAiScope, runId: string, userMessage: string, assistantMessage: string): Promise<void> {
	const service = createSupabaseServiceClient();
	const recentSummary = truncateText(`${userMessage} | ${assistantMessage}`, 500);
	await service
		.from('ai_memory')
		.upsert({
			owner_user_id: scope.targetUserId,
			client_account_id: scope.clientAccountId,
			memory_type: 'note',
			key: 'recent-summary',
			value: {
				summary: recentSummary,
				last_user_message: truncateText(userMessage, 180),
				last_assistant_message: truncateText(assistantMessage, 240)
			},
			confidence: 0.6,
			source_run_id: runId
		}, {
			onConflict: 'owner_user_id,client_account_id,memory_type,key'
		});
}

export async function runBigLotAiStream(
	event: RequestEvent,
	input: { chatId: string | null; mode: BigLotAiMode; message: string }
): Promise<Response> {
	const profile = event.locals.profile;
	if (!profile) {
		return new Response(JSON.stringify({ message: 'ไม่ได้รับอนุญาต' }), { status: 403 });
	}

	if (!(await rateLimit(`biglot-ai:${profile.id}`, 20, 60_000))) {
		return new Response(JSON.stringify({ message: 'ส่งข้อความเร็วเกินไป กรุณารอสักครู่' }), { status: 429 });
	}

	const scope = await resolveBigLotAiScope(event);
	if (!scope) {
		return new Response(JSON.stringify({ message: 'ไม่พบ account ที่อนุญาต' }), { status: 403 });
	}

	const chat = await ensureChatForScope(scope, input.chatId, input.message);
	const run = await createRun(scope, chat.id, input.mode);
	await insertMessage(chat.id, run.id, 'user', input.mode, input.message, null, null, 'completed');
	await refreshChatTimestamp(chat.id);

	const history = await getChatHistory(chat.id);
	const context = await buildBigLotAiContext(scope);
	const systemPrompt = buildSystemPrompt(scope, context, input.mode);
	const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

	const initialMessages: ChatCompletionMessageParam[] = [
		{ role: 'system', content: systemPrompt },
		...history.map((message) => ({
			role: message.role,
			content: message.content
		} as ChatCompletionMessageParam))
	];

	const tools = getBigLotAiTools(input.mode);

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			const send = (payload: Record<string, unknown>) => {
				controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
			};

			let currentMessages = [...initialMessages];
			let assistantText = '';
			let toolCallCount = 0;
			const citationMap = new Map<string, { label: string; source: string }>();
			const startedAt = Date.now();

			send({
				type: 'status',
				stage: 'run_started',
				chat: { id: chat.id, title: chat.title },
				run: { id: run.id, mode: input.mode }
			});

			try {
				for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
					const response = await openai.chat.completions.create({
						model: BIGLOT_AI_MODEL,
						max_tokens: input.mode === 'gold' ? 1600 : 900,
						messages: currentMessages,
						tools
					});

					const choice = response.choices[0];
					if (!choice) break;
					const message = choice.message;

					if (message.tool_calls?.length) {
						send({
							type: 'tool_use',
							tools: message.tool_calls.map((toolCall) => toolCall.type === 'function' ? toolCall.function.name : toolCall.type)
						});
						currentMessages.push(message as ChatCompletionMessageParam);

						for (const toolCall of message.tool_calls) {
							if (toolCall.type !== 'function') continue;
							const args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>;
							const result = await executeBigLotAiTool(toolCall.function.name, args, {
								supabase: createSupabaseServiceClient(),
								scope,
								mode: input.mode
							});
							toolCallCount++;
							await persistToolCall(run.id, toolCall.function.name, args, result);
							result.citations.forEach((citation) => citationMap.set(`${citation.source}:${citation.label}`, citation));
							send({
								type: 'citation',
								tool: toolCall.function.name,
								data_sources: result.dataSources,
								summary: result.summary
							});
							currentMessages.push({
								role: 'tool',
								tool_call_id: toolCall.id,
								content: result.content
							});
						}

						continue;
					}

					if (message.content) {
						assistantText += message.content;
						send({ type: 'text_delta', text: message.content });
					}

					break;
				}

				const citations = Array.from(citationMap.values());
				const assistantMessage = await insertMessage(
					chat.id,
					run.id,
					'assistant',
					input.mode,
					assistantText || 'ยังไม่มีคำตอบที่สมบูรณ์',
					citations,
					null,
					'completed'
				);

				await upsertBigLotAiMemory(scope, run.id, input.message, assistantText);
				await completeRun(run.id, {
					status: 'completed',
					route_type: getRouteType(input.mode, toolCallCount),
					tool_call_count: toolCallCount,
					latency_ms: Date.now() - startedAt,
					completed_at: new Date().toISOString()
				});
				await refreshChatTimestamp(chat.id);

				send({
					type: 'done',
					chat_id: chat.id,
					run_id: run.id,
					message_id: assistantMessage?.id ?? null,
					citations,
					tool_call_count: toolCallCount
				});
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : 'AI error';
				await completeRun(run.id, {
					status: 'failed',
					error_message: message,
					latency_ms: Date.now() - startedAt,
					completed_at: new Date().toISOString()
				});
				send({ type: 'error', message });
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'no-cache',
			'Transfer-Encoding': 'chunked'
		}
	});
}
