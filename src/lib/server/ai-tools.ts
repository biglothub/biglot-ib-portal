import { computeAnalytics } from '$lib/analytics';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const aiTools: ChatCompletionTool[] = [
	{
		type: 'function',
		function: {
			name: 'get_trade_history',
			description: 'ดึงประวัติการเทรดที่ปิดแล้ว สามารถ filter ตาม symbol, จำนวนวัน, หรือจำกัดจำนวนได้',
			parameters: {
				type: 'object',
				properties: {
					symbol: { type: 'string', description: 'Filter by trading symbol e.g. XAUUSD, EURUSD' },
					days: { type: 'number', description: 'Number of days to look back (default 30)' },
					limit: { type: 'number', description: 'Max trades to return (default 50)' }
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'get_daily_stats',
			description: 'ดึงสถิติรายวัน เช่น balance, equity, profit, win_rate, profit_factor, drawdown, session profits ฯลฯ',
			parameters: {
				type: 'object',
				properties: {
					days: { type: 'number', description: 'Number of days to look back (default 30)' }
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'get_open_positions',
			description: 'ดึง positions ที่เปิดอยู่ในปัจจุบัน พร้อม current profit/loss',
			parameters: {
				type: 'object',
				properties: {}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'get_analytics',
			description: 'คำนวณ risk-adjusted metrics: Sharpe ratio, Sortino ratio, Calmar ratio, day-of-week performance, lot distribution, holding time analysis',
			parameters: {
				type: 'object',
				properties: {}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'get_journal_entries',
			description: 'ดึง daily journal entries ของลูกค้า (pre/post-market notes, checklist, lessons, completion status)',
			parameters: {
				type: 'object',
				properties: {
					days: { type: 'number', description: 'Number of days to look back (default 30)' }
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'get_review_context',
			description: 'ดึง structured trade reviews, broken rules, playbook bindings และ attachment coverage ของเทรด',
			parameters: {
				type: 'object',
				properties: {
					days: { type: 'number', description: 'Number of days to look back (default 30)' },
					limit: { type: 'number', description: 'Max trades to return (default 25)' }
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'get_playbooks',
			description: 'ดึง playbooks พร้อมกฎ entry/exit/risk และจำนวน trades ที่ผูกอยู่กับแต่ละ playbook',
			parameters: {
				type: 'object',
				properties: {}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'get_equity_snapshots',
			description: 'ดึงข้อมูล equity curve (snapshots ทุก 5 นาที) สำหรับวิเคราะห์ drawdown และ volatility',
			parameters: {
				type: 'object',
				properties: {
					days: { type: 'number', description: 'Number of days to look back (default 7)' }
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'get_market_news',
			description: 'ดึงข่าวตลาดล่าสุดที่เกี่ยวข้องกับ forex/commodities พร้อมสรุปภาษาไทย',
			parameters: {
				type: 'object',
				properties: {
					category: { type: 'string', description: 'Filter by category: forex, commodities, central_bank, economic_data, geopolitical' },
					symbols: { type: 'string', description: 'Comma-separated symbols to filter e.g. XAUUSD,EURUSD' },
					limit: { type: 'number', description: 'Max articles to return (default 10)' }
				}
			}
		}
	}
];

type ToolParams = Record<string, unknown>;

export async function executeTool(
	name: string,
	params: ToolParams,
	supabase: SupabaseClient,
	clientAccountId: string,
	userId: string
): Promise<string> {
	// Sanitize common numeric params to prevent abuse
	if (params && typeof params === 'object') {
		if ('days' in params) params.days = Math.min(Math.max(Number(params.days) || 30, 1), 365);
		if ('limit' in params) params.limit = Math.min(Math.max(Number(params.limit) || 50, 1), 100);
	}

	switch (name) {
		case 'get_trade_history':
			return getTradeHistory(supabase, clientAccountId, params);
		case 'get_daily_stats':
			return getDailyStats(supabase, clientAccountId, params);
		case 'get_open_positions':
			return getOpenPositions(supabase, clientAccountId);
		case 'get_analytics':
			return getAnalytics(supabase, clientAccountId);
		case 'get_journal_entries':
			return getJournalEntries(supabase, clientAccountId, userId, params);
		case 'get_review_context':
			return getReviewContext(supabase, clientAccountId, params);
		case 'get_playbooks':
			return getPlaybooks(supabase, clientAccountId, userId);
		case 'get_equity_snapshots':
			return getEquitySnapshots(supabase, clientAccountId, params);
		case 'get_market_news':
			return getMarketNews(supabase, params);
		default:
			return JSON.stringify({ error: `Unknown tool: ${name}` });
	}
}

async function getTradeHistory(supabase: SupabaseClient, accountId: string, params: ToolParams): Promise<string> {
	const days = (params.days as number) || 30;
	const limit = (params.limit as number) || 50;
	const since = new Date();
	since.setDate(since.getDate() - days);

	let query = supabase
		.from('trades')
		.select('symbol, type, lot_size, open_price, close_price, open_time, close_time, profit, sl, tp, pips, commission, swap, trade_tag_assignments(tag_id, trade_tags(name, category)), trade_notes(content, rating), trade_reviews(review_status, playbook_id, mistake_summary, lesson_summary, broken_rules, followed_plan), trade_attachments(id, kind)')
		.eq('client_account_id', accountId)
		.gte('close_time', since.toISOString())
		.order('close_time', { ascending: false })
		.limit(limit);

	if (params.symbol) {
		query = query.eq('symbol', params.symbol as string);
	}

	const { data, error } = await query;
	if (error) return JSON.stringify({ error: error.message });

	type TradeRow = Record<string, unknown> & {
		trade_tag_assignments?: Array<{ trade_tags?: { name?: string; category?: string } }>;
		trade_notes?: Array<{ content?: string; rating?: number | null }>;
		trade_reviews?: Array<{ review_status?: string; playbook_id?: string | null; broken_rules?: string[]; followed_plan?: boolean | null }>;
		trade_attachments?: unknown[];
	};
	const trades = (data as TradeRow[] || []).map((t) => ({
		symbol: t.symbol,
		type: t.type,
		lot: t.lot_size,
		openPrice: t.open_price,
		closePrice: t.close_price,
		openTime: t.open_time,
		closeTime: t.close_time,
		profit: t.profit,
		pips: t.pips,
		sl: t.sl,
		tp: t.tp,
		commission: t.commission,
		swap: t.swap,
		tags: (t.trade_tag_assignments || []).map((a) => ({
			name: a.trade_tags?.name,
			category: a.trade_tags?.category
		})),
		note: t.trade_notes?.[0]?.content || null,
		rating: t.trade_notes?.[0]?.rating || null,
		reviewStatus: t.trade_reviews?.[0]?.review_status || 'unreviewed',
		playbookId: t.trade_reviews?.[0]?.playbook_id || null,
		brokenRules: t.trade_reviews?.[0]?.broken_rules || [],
		followedPlan: t.trade_reviews?.[0]?.followed_plan ?? null,
		attachments: (t.trade_attachments || []).length
	}));

	return JSON.stringify({ totalTrades: trades.length, days, trades });
}

async function getDailyStats(supabase: SupabaseClient, accountId: string, params: ToolParams): Promise<string> {
	const days = (params.days as number) || 30;
	const since = new Date();
	since.setDate(since.getDate() - days);

	const { data, error } = await supabase
		.from('daily_stats')
		.select('*')
		.eq('client_account_id', accountId)
		.gte('date', since.toISOString().split('T')[0])
		.order('date', { ascending: false });

	if (error) return JSON.stringify({ error: error.message });

	type DailyStatsRow = Record<string, unknown>;
	const stats = (data as DailyStatsRow[] || []).map((d) => ({
		date: d.date,
		balance: d.balance,
		equity: d.equity,
		profit: d.profit,
		floatingPL: d.floating_pl,
		totalTrades: d.total_trades,
		winRate: d.win_rate,
		profitFactor: d.profit_factor,
		maxDrawdown: d.max_drawdown,
		avgWin: d.avg_win,
		avgLoss: d.avg_loss,
		bestTrade: d.best_trade,
		worstTrade: d.worst_trade,
		winRateBuy: d.win_rate_buy,
		winRateSell: d.win_rate_sell,
		consecutiveWins: d.max_consecutive_wins,
		consecutiveLosses: d.max_consecutive_losses,
		sessionAsian: d.session_asian_profit,
		sessionLondon: d.session_london_profit,
		sessionNewYork: d.session_newyork_profit,
		tradingStyle: d.trading_style,
		favoritePair: d.favorite_pair
	}));

	return JSON.stringify({ totalDays: stats.length, days, stats });
}

async function getOpenPositions(supabase: SupabaseClient, accountId: string): Promise<string> {
	const { data, error } = await supabase
		.from('open_positions')
		.select('*')
		.eq('client_account_id', accountId)
		.order('open_time', { ascending: false });

	if (error) return JSON.stringify({ error: error.message });

	type PositionRow = Record<string, unknown>;
	const positions = (data as PositionRow[] || []).map((p) => ({
		symbol: p.symbol,
		type: p.type,
		lot: p.lot_size,
		openPrice: p.open_price,
		openTime: p.open_time,
		currentPrice: p.current_price,
		currentProfit: p.current_profit,
		sl: p.sl,
		tp: p.tp
	}));

	return JSON.stringify({ totalPositions: positions.length, positions });
}

async function getAnalytics(supabase: SupabaseClient, accountId: string): Promise<string> {
	const [statsRes, tradesRes, latestRes] = await Promise.allSettled([
		supabase.from('daily_stats')
			.select('date, balance, equity, profit')
			.eq('client_account_id', accountId)
			.order('date', { ascending: true }),
		supabase.from('trades')
			.select('close_time, open_time, profit, lot_size')
			.eq('client_account_id', accountId)
			.order('close_time', { ascending: true }),
		supabase.from('daily_stats')
			.select('profit, max_drawdown')
			.eq('client_account_id', accountId)
			.order('date', { ascending: false })
			.limit(1)
			.single()
	]);

	type QueryResult<T> = PromiseSettledResult<{ data: T | null; error: unknown }>;
	const getValue = <T>(res: QueryResult<T>): T | null =>
		res.status === 'fulfilled' ? res.value.data : null;

	type StatsRow = { date: string; balance: number; equity: number; profit: number };
	type TradeRow2 = { close_time: string; open_time: string; profit: number; lot_size: number };
	type LatestRow = { profit: number; max_drawdown: number };

	const allStats = getValue<StatsRow[]>(statsRes as QueryResult<StatsRow[]>) || [];
	const allTrades = getValue<TradeRow2[]>(tradesRes as QueryResult<TradeRow2[]>) || [];
	const latest = getValue<LatestRow>(latestRes as QueryResult<LatestRow>);

	const dailyStatsForAnalytics = allStats
		.map((d) => ({ date: d.date, balance: d.balance || d.equity || 0, profit: d.profit || 0 }))
		.filter((d) => d.balance > 0);

	const tradesForAnalytics = allTrades.map((t) => ({
		closeTime: t.close_time, openTime: t.open_time, profit: t.profit || 0, lot: t.lot_size || 0
	}));

	if (dailyStatsForAnalytics.length < 2 && tradesForAnalytics.length === 0) {
		return JSON.stringify({ error: 'Not enough data for analytics' });
	}

	const analytics = computeAnalytics(
		dailyStatsForAnalytics,
		tradesForAnalytics,
		latest?.profit || 0,
		latest?.max_drawdown || 0
	);

	return JSON.stringify(analytics);
}

async function getJournalEntries(supabase: SupabaseClient, accountId: string, userId: string, params: ToolParams): Promise<string> {
	const days = (params.days as number) || 30;
	const since = new Date();
	since.setDate(since.getDate() - days);

	const { data, error } = await supabase
		.from('daily_journal')
		.select('date, pre_market_notes, post_market_notes, session_plan, market_bias, checklist, mood, energy_score, discipline_score, confidence_score, lessons, tomorrow_focus, completion_status')
		.eq('client_account_id', accountId)
		.eq('user_id', userId)
		.gte('date', since.toISOString().split('T')[0])
		.order('date', { ascending: false });

	if (error) return JSON.stringify({ error: error.message });

	return JSON.stringify({ totalEntries: (data || []).length, days, entries: data || [] });
}

async function getReviewContext(supabase: SupabaseClient, accountId: string, params: ToolParams): Promise<string> {
	const days = (params.days as number) || 30;
	const limit = (params.limit as number) || 25;
	const since = new Date();
	since.setDate(since.getDate() - days);

	const { data, error } = await supabase
		.from('trades')
		.select('symbol, type, profit, close_time, trade_reviews(review_status, playbook_id, entry_reason, mistake_summary, lesson_summary, next_action, broken_rules, followed_plan), trade_attachments(id), trade_notes(id), trade_tag_assignments(tag_id, trade_tags(name, category))')
		.eq('client_account_id', accountId)
		.gte('close_time', since.toISOString())
		.order('close_time', { ascending: false })
		.limit(limit);

	if (error) return JSON.stringify({ error: error.message });

	type ReviewTradeRow = Record<string, unknown> & {
		trade_reviews?: Array<{ review_status?: string; playbook_id?: string | null; mistake_summary?: string | null; lesson_summary?: string | null; next_action?: string | null; broken_rules?: string[]; followed_plan?: boolean | null }>;
		trade_attachments?: unknown[];
		trade_notes?: unknown[];
		trade_tag_assignments?: Array<{ trade_tags?: { name?: string; category?: string } }>;
	};
	const reviews = (data as ReviewTradeRow[] || []).map((trade) => ({
		symbol: trade.symbol,
		type: trade.type,
		profit: trade.profit,
		closeTime: trade.close_time,
		reviewStatus: trade.trade_reviews?.[0]?.review_status || 'unreviewed',
		playbookId: trade.trade_reviews?.[0]?.playbook_id || null,
		mistakeSummary: trade.trade_reviews?.[0]?.mistake_summary || null,
		lessonSummary: trade.trade_reviews?.[0]?.lesson_summary || null,
		nextAction: trade.trade_reviews?.[0]?.next_action || null,
		brokenRules: trade.trade_reviews?.[0]?.broken_rules || [],
		followedPlan: trade.trade_reviews?.[0]?.followed_plan ?? null,
		attachments: (trade.trade_attachments || []).length,
		notes: (trade.trade_notes || []).length,
		tags: (trade.trade_tag_assignments || []).map((assignment) => ({
			name: assignment.trade_tags?.name,
			category: assignment.trade_tags?.category
		}))
	}));

	return JSON.stringify({ totalReviews: reviews.length, days, reviews });
}

async function getPlaybooks(supabase: SupabaseClient, accountId: string, userId: string): Promise<string> {
	const [playbooksRes, reviewsRes] = await Promise.allSettled([
		supabase
			.from('playbooks')
			.select('id, name, description, entry_criteria, exit_criteria, risk_rules, mistakes_to_avoid, is_active')
			.eq('client_account_id', accountId)
			.eq('user_id', userId)
			.order('sort_order', { ascending: true }),
		supabase
			.from('trade_reviews')
			.select('playbook_id, review_status')
			.eq('user_id', userId)
	]);

	const playbooks = playbooksRes.status === 'fulfilled' ? playbooksRes.value.data || [] : [];
	const reviews = reviewsRes.status === 'fulfilled' ? reviewsRes.value.data || [] : [];

	const playbookUsage = new Map<string, { totalTrades: number; reviewedTrades: number }>();
	for (const review of reviews) {
		if (!review.playbook_id) continue;
		const current = playbookUsage.get(review.playbook_id) || { totalTrades: 0, reviewedTrades: 0 };
		current.totalTrades += 1;
		if (review.review_status === 'reviewed') current.reviewedTrades += 1;
		playbookUsage.set(review.playbook_id, current);
	}

	return JSON.stringify({
		totalPlaybooks: playbooks.length,
		playbooks: (playbooks as Array<Record<string, unknown>>).map((playbook) => ({
			...playbook,
			usage: playbookUsage.get(playbook.id as string) || { totalTrades: 0, reviewedTrades: 0 }
		}))
	});
}

async function getEquitySnapshots(supabase: SupabaseClient, accountId: string, params: ToolParams): Promise<string> {
	const days = (params.days as number) || 7;
	const since = new Date();
	since.setDate(since.getDate() - days);

	const { data, error } = await supabase
		.from('equity_snapshots')
		.select('timestamp, balance, equity, floating_pl, margin_level')
		.eq('client_account_id', accountId)
		.gte('timestamp', since.toISOString())
		.order('timestamp', { ascending: true });

	if (error) return JSON.stringify({ error: error.message });

	// Downsample if too many points (keep max ~200 points)
	let snapshots = data || [];
	if (snapshots.length > 200) {
		const step = Math.ceil(snapshots.length / 200);
		snapshots = snapshots.filter((_: unknown, i: number) => i % step === 0);
	}

	return JSON.stringify({ totalSnapshots: snapshots.length, days, snapshots });
}

async function getMarketNews(supabase: SupabaseClient, params: ToolParams): Promise<string> {
	const limit = (params.limit as number) || 10;
	const oneDayAgo = new Date();
	oneDayAgo.setDate(oneDayAgo.getDate() - 1);

	let query = supabase
		.from('market_news')
		.select('title_th, summary_th, category, symbols, relevance_score, published_at, source')
		.eq('ai_processed', true)
		.gte('published_at', oneDayAgo.toISOString())
		.order('relevance_score', { ascending: false })
		.order('published_at', { ascending: false })
		.limit(limit);

	const validCategories = ['forex', 'commodities', 'central_bank', 'economic_data', 'geopolitical'];
	if (params.category && validCategories.includes(params.category as string)) {
		query = query.eq('category', params.category as string);
	}

	if (params.symbols) {
		const symbolList = (params.symbols as string).split(',').map(s => s.trim()).slice(0, 10);
		query = query.overlaps('symbols', symbolList);
	}

	const { data, error } = await query;
	if (error) return JSON.stringify({ error: error.message });

	type NewsRow = Record<string, unknown>;
	const articles = (data as NewsRow[] || []).map((a) => ({
		title: a.title_th || 'N/A',
		summary: a.summary_th || 'N/A',
		category: a.category,
		symbols: a.symbols,
		relevance: a.relevance_score,
		publishedAt: a.published_at,
		source: a.source
	}));

	return JSON.stringify({ totalArticles: articles.length, articles });
}
