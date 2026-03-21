import { env } from '$env/dynamic/private';
import { buildAnalysisPrompt } from '$lib/server/analysis-prompt';
import { getXauusdPrice } from '$lib/server/gold-price';
import { refreshNews } from '$lib/server/news';
import { rateLimit } from '$lib/server/rate-limit';
import { getBangkokToday, THAILAND_OFFSET_MS } from '$lib/utils';
import OpenAI from 'openai';
import type { RequestHandler } from './$types';

const SECTIONS = ['MARKET_BIAS', 'LIQUIDITY_MAP', 'SETUP', 'SCENARIO', 'KEY_LEVELS', 'TRADE_PLAN'] as const;
const SECTION_REGEX = /<<<(MARKET_BIAS|LIQUIDITY_MAP|SETUP|SCENARIO|KEY_LEVELS|TRADE_PLAN)>>>/;

export const POST: RequestHandler = async ({ locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return new Response(JSON.stringify({ message: 'ไม่ได้รับอนุญาต' }), { status: 403 });
	}

	if (!rateLimit(`analysis:${profile.id}`, 5, 3_600_000)) {
		return new Response(JSON.stringify({ message: 'Rate limit exceeded' }), { status: 429 });
	}

	const supabase = locals.supabase;

	// Fetch approved account
	const { data: account } = await supabase
		.from('client_accounts')
		.select('id, client_name, mt5_account_id')
		.eq('status', 'approved')
		.maybeSingle();

	if (!account) {
		return new Response(JSON.stringify({ message: 'No approved account' }), { status: 404 });
	}

	// Refresh market news in background (if stale)
	refreshNews().catch(() => {});

	// Gather all context data in parallel
	const since30d = new Date();
	since30d.setDate(since30d.getDate() - 30);
	const since24h = new Date();
	since24h.setHours(since24h.getHours() - 24);
	const since7d = new Date();
	since7d.setDate(since7d.getDate() - 7);

	const [newsRes, tradesRes, positionsRes, journalRes, playbooksRes, statsRes] =
		await Promise.allSettled([
			// Market news (24h, gold-related)
			supabase
				.from('market_news')
				.select('title_th, summary_th, category, symbols, published_at')
				.eq('ai_processed', true)
				.gte('published_at', since24h.toISOString())
				.or('symbols.cs.{XAUUSD},symbols.cs.{DXY},category.eq.commodities,category.eq.central_bank,category.eq.economic_data')
				.order('relevance_score', { ascending: false })
				.limit(10),

			// Recent XAUUSD trades
			supabase
				.from('trades')
				.select('symbol, type, profit, open_time, close_time, lot_size')
				.eq('client_account_id', account.id)
				.eq('symbol', 'XAUUSD')
				.gte('close_time', since30d.toISOString())
				.order('close_time', { ascending: false })
				.limit(20),

			// Open XAUUSD positions
			supabase
				.from('open_positions')
				.select('symbol, type, lot_size, open_price, current_price, current_profit, sl, tp')
				.eq('client_account_id', account.id)
				.eq('symbol', 'XAUUSD'),

			// Latest journal entry
			supabase
				.from('daily_journal')
				.select('date, market_bias, key_levels, session_plan, pre_market_notes')
				.eq('client_account_id', account.id)
				.eq('user_id', profile.id)
				.order('date', { ascending: false })
				.limit(1)
				.maybeSingle(),

			// Active playbooks
			supabase
				.from('playbooks')
				.select('name, entry_criteria, exit_criteria, risk_rules')
				.eq('client_account_id', account.id)
				.eq('user_id', profile.id)
				.eq('is_active', true)
				.order('sort_order', { ascending: true }),

			// Daily stats (7 days)
			supabase
				.from('daily_stats')
				.select('date, balance, equity, profit, win_rate, profit_factor, max_drawdown')
				.eq('client_account_id', account.id)
				.gte('date', new Date(since7d.getTime() + THAILAND_OFFSET_MS).toISOString().split('T')[0])
				.order('date', { ascending: false })
		]);

	const getValue = (res: PromiseSettledResult<any>) =>
		res.status === 'fulfilled' ? res.value.data : null;

	// Fetch current gold price (independent, can run after DB queries)
	const currentPrice = await getXauusdPrice();

	const context = {
		news: getValue(newsRes) || [],
		trades: getValue(tradesRes) || [],
		openPositions: getValue(positionsRes) || [],
		journal: getValue(journalRes) || null,
		playbooks: getValue(playbooksRes) || [],
		dailyStats: getValue(statsRes) || [],
		currentPrice
	};

	const systemPrompt = buildAnalysisPrompt(context);
	const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

	// Streaming response
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			const send = (data: Record<string, unknown>) => {
				controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
			};

			try {
				const response = await openai.chat.completions.create({
					model: 'gpt-4o',
					max_tokens: 4096,
					stream: true,
					messages: [
						{ role: 'system', content: systemPrompt },
						{ role: 'user', content: 'วิเคราะห์ตลาดทองคำ XAUUSD ประจำวันนี้' }
					]
				});

				let buffer = '';
				let currentSection = '';
				const sectionContents: Record<string, string> = {};

				for await (const chunk of response) {
					const text = chunk.choices[0]?.delta?.content;
					if (!text) continue;

					buffer += text;

					// Check for section delimiters in buffer
					while (true) {
						const match = buffer.match(SECTION_REGEX);
						if (!match) break;

						const delimiterIndex = match.index!;
						const sectionName = match[1].toLowerCase();

						// Emit any text before the delimiter as part of current section
						if (currentSection && delimiterIndex > 0) {
							const beforeText = buffer.substring(0, delimiterIndex).trim();
							if (beforeText) {
								send({ type: 'text_delta', text: beforeText });
								sectionContents[currentSection] = (sectionContents[currentSection] || '') + beforeText;
							}
							send({ type: 'section_end', section: currentSection });
						}

						// Start new section
						currentSection = sectionName;
						send({ type: 'section_start', section: sectionName });
						sectionContents[sectionName] = '';

						// Remove processed part from buffer
						buffer = buffer.substring(delimiterIndex + match[0].length);
					}

					// Emit buffered text for current section (keep last 50 chars in buffer for delimiter detection)
					if (currentSection && buffer.length > 50) {
						const emitText = buffer.substring(0, buffer.length - 50);
						if (emitText) {
							send({ type: 'text_delta', text: emitText });
							sectionContents[currentSection] = (sectionContents[currentSection] || '') + emitText;
						}
						buffer = buffer.substring(buffer.length - 50);
					}
				}

				// Flush remaining buffer
				if (currentSection && buffer.trim()) {
					send({ type: 'text_delta', text: buffer.trim() });
					sectionContents[currentSection] = (sectionContents[currentSection] || '') + buffer.trim();
					send({ type: 'section_end', section: currentSection });
				}

				// Save analysis to database
				const today = getBangkokToday();
				await supabase
					.from('market_analyses')
					.upsert(
						{
							user_id: profile.id,
							client_account_id: account.id,
							symbol: 'XAUUSD',
							analysis_date: today,
							sections: sectionContents,
							model: 'gpt-4o'
						},
						{ onConflict: 'user_id,client_account_id,symbol,analysis_date' }
					);

				send({ type: 'done' });
			} catch (err: any) {
				send({ type: 'error', message: err.message || 'AI error' });
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
