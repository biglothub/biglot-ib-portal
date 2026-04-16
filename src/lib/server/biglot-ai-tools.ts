import { computeAnalytics } from '$lib/analytics';
import type { BigLotAiMode, BigLotAiScope } from '$lib/types';
import { getCache, setCache } from '$lib/server/cache';
import { getXauusdPrice } from '$lib/server/gold-price';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';

interface ToolParams extends Record<string, unknown> {
	days?: number;
	limit?: number;
	symbol?: string;
	trade_id?: string;
	query?: string;
}

export interface BigLotAiToolExecutionResult {
	content: string;
	dataSources: string[];
	citations: Array<{ label: string; source: string }>;
	rowCount: number | null;
	summary: string;
	cached: boolean;
}

interface ToolContext {
	supabase: SupabaseClient;
	scope: BigLotAiScope;
	mode: BigLotAiMode;
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
	const parsed = Number(value);
	if (Number.isNaN(parsed)) return fallback;
	return Math.min(Math.max(parsed, min), max);
}

async function getCachedToolValue<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<{ value: T; cached: boolean }> {
	const cached = await getCache<T>(key);
	if (cached) return { value: cached, cached: true };
	const value = await loader();
	await setCache(key, value, ttlSeconds);
	return { value, cached: false };
}

function serialize(result: unknown): string {
	return JSON.stringify(result);
}

function buildResult(
	payload: unknown,
	options: Pick<BigLotAiToolExecutionResult, 'dataSources' | 'citations' | 'rowCount' | 'summary' | 'cached'>
): BigLotAiToolExecutionResult {
	return {
		content: serialize(payload),
		...options
	};
}

function commonTools(): ChatCompletionTool[] {
	return [
		{
			type: 'function',
			function: {
				name: 'get_account_snapshot',
				description: 'สรุปสถานะล่าสุดของพอร์ต เช่น balance, equity, total trades, sync time, และจำนวน position เปิด',
				parameters: { type: 'object', properties: {} }
			}
		},
		{
			type: 'function',
			function: {
				name: 'get_trade_history',
				description: 'ดึงประวัติเทรดของ account ปัจจุบัน สามารถ filter ตาม symbol, days และ limit',
				parameters: {
					type: 'object',
					properties: {
						symbol: { type: 'string' },
						days: { type: 'number' },
						limit: { type: 'number' }
					}
				}
			}
		},
		{
			type: 'function',
			function: {
				name: 'get_trade_detail',
				description: 'ดึงรายละเอียด trade หนึ่งรายการจาก trade_id',
				parameters: {
					type: 'object',
					properties: {
						trade_id: { type: 'string' }
					},
					required: ['trade_id']
				}
			}
		},
		{
			type: 'function',
			function: {
				name: 'get_daily_stats',
				description: 'ดึงสถิติรายวันของพอร์ต เช่น balance, equity, profit, win rate, profit factor',
				parameters: {
					type: 'object',
					properties: {
						days: { type: 'number' }
					}
				}
			}
		},
		{
			type: 'function',
			function: {
				name: 'get_open_positions',
				description: 'ดึง positions ที่เปิดอยู่ของ account ปัจจุบัน',
				parameters: { type: 'object', properties: {} }
			}
		},
		{
			type: 'function',
			function: {
				name: 'get_journal_entries',
				description: 'ดึง daily journal ล่าสุดของผู้ใช้ใน account ปัจจุบัน',
				parameters: {
					type: 'object',
					properties: {
						days: { type: 'number' },
						limit: { type: 'number' }
					}
				}
			}
		},
		{
			type: 'function',
			function: {
				name: 'get_playbooks',
				description: 'ดึง playbooks ของผู้ใช้ใน account ปัจจุบัน',
				parameters: { type: 'object', properties: {} }
			}
		},
		{
			type: 'function',
			function: {
				name: 'get_review_context',
				description: 'ดึง review context, broken rules และ lessons จากเทรดล่าสุด',
				parameters: {
					type: 'object',
					properties: {
						days: { type: 'number' },
						limit: { type: 'number' }
					}
				}
			}
		},
		{
			type: 'function',
			function: {
				name: 'get_progress_summary',
				description: 'ดึง progress goals ที่ active และเทียบกับสถิติล่าสุด',
				parameters: { type: 'object', properties: {} }
			}
		},
		{
			type: 'function',
			function: {
				name: 'get_saved_report_context',
				description: 'ดึง saved report views และ filter presets ที่ผู้ใช้เคยบันทึกไว้',
				parameters: { type: 'object', properties: {} }
			}
		},
		{
			type: 'function',
			function: {
				name: 'get_market_news',
				description: 'ดึงข่าวตลาดล่าสุดที่เกี่ยวข้องกับการเทรด',
				parameters: {
					type: 'object',
					properties: {
						limit: { type: 'number' },
						symbol: { type: 'string' }
					}
				}
			}
		},
		{
			type: 'function',
			function: {
				name: 'get_gold_market_context',
				description: 'ดึงราคาทองปัจจุบัน, ข่าวเกี่ยวข้อง, และ context XAUUSD ล่าสุดสำหรับโหมดวิเคราะห์ทอง',
				parameters: { type: 'object', properties: {} }
			}
		},
		{
			type: 'function',
			function: {
				name: 'search_memory',
				description: 'ค้นหา memory summary ของผู้ใช้ใน account ปัจจุบัน',
				parameters: {
					type: 'object',
					properties: {
						query: { type: 'string' },
						limit: { type: 'number' }
					}
				}
			}
		}
	];
}

export function getBigLotAiTools(mode: BigLotAiMode): ChatCompletionTool[] {
	const tools = commonTools();
	if (mode === 'gold') {
		return tools.filter((tool) => tool.type === 'function' && (
			tool.function.name === 'get_account_snapshot' ||
			tool.function.name === 'get_trade_history' ||
			tool.function.name === 'get_open_positions' ||
			tool.function.name === 'get_journal_entries' ||
			tool.function.name === 'get_playbooks' ||
			tool.function.name === 'get_market_news' ||
			tool.function.name === 'get_gold_market_context' ||
			tool.function.name === 'search_memory'
		));
	}

	return tools;
}

async function getAccountSnapshot({ supabase, scope }: ToolContext): Promise<BigLotAiToolExecutionResult> {
	const cacheKey = `biglot-ai:tool:account:${scope.clientAccountId}`;
	const { value, cached } = await getCachedToolValue(cacheKey, 60, async () => {
		const [statsRes, positionsRes] = await Promise.all([
			supabase
				.from('daily_stats')
				.select('date, balance, equity, profit, floating_pl, win_rate, profit_factor, max_drawdown, total_trades')
				.eq('client_account_id', scope.clientAccountId)
				.order('date', { ascending: false })
				.limit(1)
				.maybeSingle(),
			supabase
				.from('open_positions')
				.select('id', { count: 'exact', head: true })
				.eq('client_account_id', scope.clientAccountId)
		]);

		return {
			account: scope.account,
			latestStats: statsRes.data,
			openPositionCount: positionsRes.count ?? 0
		};
	});

	return buildResult(value, {
		dataSources: ['client_accounts', 'daily_stats', 'open_positions'],
		citations: [
			{ label: 'Account snapshot', source: 'client_accounts' },
			{ label: 'Latest stats', source: 'daily_stats' }
		],
		rowCount: value.latestStats ? 1 : 0,
		summary: 'Loaded latest account snapshot',
		cached
	});
}

async function getTradeHistory(context: ToolContext, params: ToolParams): Promise<BigLotAiToolExecutionResult> {
	const days = clamp(params.days, 30, 1, 365);
	const limit = clamp(params.limit, 30, 1, 100);
	const symbol = typeof params.symbol === 'string' ? params.symbol.trim().toUpperCase() : '';
	const since = new Date();
	since.setDate(since.getDate() - days);
	const cacheKey = `biglot-ai:tool:trades:${context.scope.clientAccountId}:${symbol || 'all'}:${days}:${limit}`;

	const { value, cached } = await getCachedToolValue(cacheKey, 180, async () => {
		let query = context.supabase
			.from('trades')
			.select('id, symbol, type, lot_size, open_price, close_price, open_time, close_time, profit, pips, commission, swap')
			.eq('client_account_id', context.scope.clientAccountId)
			.gte('close_time', since.toISOString())
			.order('close_time', { ascending: false })
			.limit(limit);

		if (symbol) query = query.eq('symbol', symbol);
		const { data } = await query;
		return data ?? [];
	});

	return buildResult(
		{ days, symbol: symbol || null, trades: value },
		{
			dataSources: ['trades'],
			citations: [{ label: 'Trade history', source: 'trades' }],
			rowCount: value.length,
			summary: 'Loaded scoped trade history',
			cached
		}
	);
}

async function getTradeDetail(context: ToolContext, params: ToolParams): Promise<BigLotAiToolExecutionResult> {
	const tradeId = typeof params.trade_id === 'string' ? params.trade_id.trim() : '';
	if (!tradeId) {
		return buildResult({ error: 'trade_id is required' }, {
			dataSources: ['trades'],
			citations: [{ label: 'Trade detail', source: 'trades' }],
			rowCount: 0,
			summary: 'Missing trade id',
			cached: false
		});
	}

	const { data } = await context.supabase
		.from('trades')
		.select(`
			id, symbol, type, lot_size, open_price, close_price, open_time, close_time, profit, pips, commission, swap, sl, tp,
			trade_reviews(review_status, broken_rules, lesson_summary, followed_plan, playbook_id),
			trade_notes(content, rating),
			trade_tag_assignments(trade_tags(name, category, color))
		`)
		.eq('client_account_id', context.scope.clientAccountId)
		.eq('id', tradeId)
		.maybeSingle();

	return buildResult(
		{ trade: data ?? null },
		{
			dataSources: ['trades', 'trade_reviews', 'trade_notes', 'trade_tags'],
			citations: [{ label: 'Trade detail', source: 'trades' }],
			rowCount: data ? 1 : 0,
			summary: 'Loaded scoped trade detail',
			cached: false
		}
	);
}

async function getDailyStats(context: ToolContext, params: ToolParams): Promise<BigLotAiToolExecutionResult> {
	const days = clamp(params.days, 30, 1, 180);
	const since = new Date();
	since.setDate(since.getDate() - days);
	const cacheKey = `biglot-ai:tool:daily-stats:${context.scope.clientAccountId}:${days}`;

	const { value, cached } = await getCachedToolValue(cacheKey, 180, async () => {
		const { data } = await context.supabase
			.from('daily_stats')
			.select('date, balance, equity, profit, floating_pl, win_rate, profit_factor, max_drawdown, total_trades, avg_win, avg_loss')
			.eq('client_account_id', context.scope.clientAccountId)
			.gte('date', since.toISOString().split('T')[0])
			.order('date', { ascending: false });

		return data ?? [];
	});

	return buildResult(
		{ days, stats: value },
		{
			dataSources: ['daily_stats'],
			citations: [{ label: 'Daily stats', source: 'daily_stats' }],
			rowCount: value.length,
			summary: 'Loaded daily stats',
			cached
		}
	);
}

async function getOpenPositions(context: ToolContext): Promise<BigLotAiToolExecutionResult> {
	const { data } = await context.supabase
		.from('open_positions')
		.select('id, symbol, type, lot_size, open_price, current_price, current_profit, sl, tp, open_time')
		.eq('client_account_id', context.scope.clientAccountId)
		.order('open_time', { ascending: false });

	return buildResult(
		{ positions: data ?? [] },
		{
			dataSources: ['open_positions'],
			citations: [{ label: 'Open positions', source: 'open_positions' }],
			rowCount: data?.length ?? 0,
			summary: 'Loaded open positions',
			cached: false
		}
	);
}

async function getJournalEntries(context: ToolContext, params: ToolParams): Promise<BigLotAiToolExecutionResult> {
	const days = clamp(params.days, 30, 1, 120);
	const limit = clamp(params.limit, 10, 1, 30);
	const since = new Date();
	since.setDate(since.getDate() - days);

	const { data } = await context.supabase
		.from('daily_journal')
		.select('id, date, market_bias, key_levels, session_plan, pre_market_notes, post_market_notes, lessons, tomorrow_focus, completion_status')
		.eq('client_account_id', context.scope.clientAccountId)
		.eq('user_id', context.scope.targetUserId)
		.gte('date', since.toISOString().split('T')[0])
		.order('date', { ascending: false })
		.limit(limit);

	return buildResult(
		{ journals: data ?? [] },
		{
			dataSources: ['daily_journal'],
			citations: [{ label: 'Daily journal', source: 'daily_journal' }],
			rowCount: data?.length ?? 0,
			summary: 'Loaded scoped journal entries',
			cached: false
		}
	);
}

async function getPlaybooks(context: ToolContext): Promise<BigLotAiToolExecutionResult> {
	const { data } = await context.supabase
		.from('playbooks')
		.select('id, name, description, entry_criteria, exit_criteria, risk_rules, mistakes_to_avoid, is_active, sort_order')
		.eq('client_account_id', context.scope.clientAccountId)
		.eq('user_id', context.scope.targetUserId)
		.order('sort_order', { ascending: true });

	return buildResult(
		{ playbooks: data ?? [] },
		{
			dataSources: ['playbooks'],
			citations: [{ label: 'Playbooks', source: 'playbooks' }],
			rowCount: data?.length ?? 0,
			summary: 'Loaded playbooks',
			cached: false
		}
	);
}

async function getReviewContext(context: ToolContext, params: ToolParams): Promise<BigLotAiToolExecutionResult> {
	const days = clamp(params.days, 30, 1, 180);
	const limit = clamp(params.limit, 20, 1, 50);
	const since = new Date();
	since.setDate(since.getDate() - days);

	const { data } = await context.supabase
		.from('trades')
		.select(`
			id, symbol, profit, close_time,
			trade_reviews(review_status, broken_rules, lesson_summary, mistake_summary, followed_plan, playbook_id)
		`)
		.eq('client_account_id', context.scope.clientAccountId)
		.gte('close_time', since.toISOString())
		.order('close_time', { ascending: false })
		.limit(limit);

	return buildResult(
		{ reviews: data ?? [] },
		{
			dataSources: ['trades', 'trade_reviews'],
			citations: [{ label: 'Trade reviews', source: 'trade_reviews' }],
			rowCount: data?.length ?? 0,
			summary: 'Loaded review context',
			cached: false
		}
	);
}

async function getProgressSummary(context: ToolContext): Promise<BigLotAiToolExecutionResult> {
	const [goalsRes, statsRes, tradesRes] = await Promise.all([
		context.supabase
			.from('progress_goals')
			.select('goal_type, target_value, period_days, is_active')
			.eq('client_account_id', context.scope.clientAccountId)
			.eq('user_id', context.scope.targetUserId)
			.eq('is_active', true),
		context.supabase
			.from('daily_stats')
			.select('date, balance, profit, max_drawdown')
			.eq('client_account_id', context.scope.clientAccountId)
			.order('date', { ascending: true })
			.limit(60),
		context.supabase
			.from('trades')
			.select('open_time, close_time, profit, pips, lot_size')
			.eq('client_account_id', context.scope.clientAccountId)
			.order('close_time', { ascending: false })
			.limit(200)
	]);

	const stats = (statsRes.data ?? []).map((day: Record<string, unknown>) => ({
		date: String(day.date),
		balance: Number(day.balance ?? 0),
		profit: Number(day.profit ?? 0)
	}));
	const trades = (tradesRes.data ?? []).map((trade: Record<string, unknown>) => ({
		closeTime: String(trade.close_time),
		openTime: String(trade.open_time),
		profit: Number(trade.profit ?? 0),
		lot: Number(trade.lot_size ?? 0)
	}));
	const maxDrawdown = Number((statsRes.data ?? [])[0]?.max_drawdown ?? 0);
	const analytics = stats.length > 1 || trades.length > 0 ? computeAnalytics(stats, trades, 0, maxDrawdown) : null;

	return buildResult(
		{ goals: goalsRes.data ?? [], analytics },
		{
			dataSources: ['progress_goals', 'daily_stats', 'trades'],
			citations: [{ label: 'Progress summary', source: 'progress_goals' }],
			rowCount: (goalsRes.data ?? []).length,
			summary: 'Loaded progress summary',
			cached: false
		}
	);
}

async function getSavedReportContext(context: ToolContext): Promise<BigLotAiToolExecutionResult> {
	const { data } = await context.supabase
		.from('portfolio_saved_views')
		.select('id, page, name, filters, created_at, updated_at')
		.eq('client_account_id', context.scope.clientAccountId)
		.eq('user_id', context.scope.targetUserId)
		.order('updated_at', { ascending: false });

	return buildResult(
		{ savedViews: data ?? [] },
		{
			dataSources: ['portfolio_saved_views'],
			citations: [{ label: 'Saved report context', source: 'portfolio_saved_views' }],
			rowCount: data?.length ?? 0,
			summary: 'Loaded saved report context',
			cached: false
		}
	);
}

async function getMarketNews(context: ToolContext, params: ToolParams): Promise<BigLotAiToolExecutionResult> {
	const limit = clamp(params.limit, 8, 1, 20);
	const symbol = typeof params.symbol === 'string' ? params.symbol.trim().toUpperCase() : '';
	const oneDayAgo = new Date();
	oneDayAgo.setDate(oneDayAgo.getDate() - 1);
	const cacheKey = `biglot-ai:tool:news:${symbol || 'all'}:${limit}`;

	const { value, cached } = await getCachedToolValue(cacheKey, 300, async () => {
		let query = context.supabase
			.from('market_news')
			.select('title_th, summary_th, category, symbols, published_at, relevance_score')
			.eq('ai_processed', true)
			.gte('published_at', oneDayAgo.toISOString())
			.order('relevance_score', { ascending: false })
			.order('published_at', { ascending: false })
			.limit(limit);

		if (symbol) {
			query = query.contains('symbols', [symbol]);
		}

		const { data } = await query;
		return data ?? [];
	});

	return buildResult(
		{ news: value },
		{
			dataSources: ['market_news'],
			citations: [{ label: 'Market news', source: 'market_news' }],
			rowCount: value.length,
			summary: 'Loaded market news',
			cached
		}
	);
}

async function getGoldMarketContext(context: ToolContext): Promise<BigLotAiToolExecutionResult> {
	const [price, newsRes, tradesRes, positionsRes] = await Promise.all([
		getXauusdPrice(),
		context.supabase
			.from('market_news')
			.select('title_th, summary_th, category, published_at, symbols')
			.eq('ai_processed', true)
			.contains('symbols', ['XAUUSD'])
			.order('published_at', { ascending: false })
			.limit(6),
		context.supabase
			.from('trades')
			.select('symbol, type, lot_size, close_time, profit')
			.eq('client_account_id', context.scope.clientAccountId)
			.eq('symbol', 'XAUUSD')
			.order('close_time', { ascending: false })
			.limit(10),
		context.supabase
			.from('open_positions')
			.select('symbol, type, lot_size, open_price, current_price, current_profit, sl, tp')
			.eq('client_account_id', context.scope.clientAccountId)
			.eq('symbol', 'XAUUSD')
	]);

	return buildResult(
		{
			currentPrice: price,
			news: newsRes.data ?? [],
			recentXauTrades: tradesRes.data ?? [],
			openXauPositions: positionsRes.data ?? []
		},
		{
			dataSources: ['market_news', 'trades', 'open_positions'],
			citations: [{ label: 'Gold context', source: 'market_news' }],
			rowCount: (newsRes.data?.length ?? 0) + (tradesRes.data?.length ?? 0),
			summary: 'Loaded gold market context',
			cached: false
		}
	);
}

async function searchMemory(context: ToolContext, params: ToolParams): Promise<BigLotAiToolExecutionResult> {
	const query = typeof params.query === 'string' ? params.query.trim().toLowerCase() : '';
	const limit = clamp(params.limit, 5, 1, 20);
	const { data } = await context.supabase
		.from('ai_memory')
		.select('memory_type, key, value, confidence, updated_at')
		.eq('owner_user_id', context.scope.targetUserId)
		.eq('client_account_id', context.scope.clientAccountId)
		.order('updated_at', { ascending: false })
		.limit(limit * 3);

	const memories = (data ?? []).filter((memory: Record<string, unknown>) => {
		if (!query) return true;
		const haystack = `${memory.memory_type ?? ''} ${memory.key ?? ''} ${JSON.stringify(memory.value ?? {})}`.toLowerCase();
		return haystack.includes(query);
	}).slice(0, limit);

	return buildResult(
		{ memories },
		{
			dataSources: ['ai_memory'],
			citations: [{ label: 'Memory summary', source: 'ai_memory' }],
			rowCount: memories.length,
			summary: 'Loaded scoped memory matches',
			cached: false
		}
	);
}

export async function executeBigLotAiTool(
	name: string,
	params: ToolParams,
	context: ToolContext
): Promise<BigLotAiToolExecutionResult> {
	switch (name) {
		case 'get_account_snapshot':
			return getAccountSnapshot(context);
		case 'get_trade_history':
			return getTradeHistory(context, params);
		case 'get_trade_detail':
			return getTradeDetail(context, params);
		case 'get_daily_stats':
			return getDailyStats(context, params);
		case 'get_open_positions':
			return getOpenPositions(context);
		case 'get_journal_entries':
			return getJournalEntries(context, params);
		case 'get_playbooks':
			return getPlaybooks(context);
		case 'get_review_context':
			return getReviewContext(context, params);
		case 'get_progress_summary':
			return getProgressSummary(context);
		case 'get_saved_report_context':
			return getSavedReportContext(context);
		case 'get_market_news':
			return getMarketNews(context, params);
		case 'get_gold_market_context':
			return getGoldMarketContext(context);
		case 'search_memory':
			return searchMemory(context, params);
		default:
			return buildResult(
				{ error: `Unknown tool: ${name}` },
				{
					dataSources: [],
					citations: [],
					rowCount: 0,
					summary: 'Unknown tool requested',
					cached: false
				}
			);
	}
}
