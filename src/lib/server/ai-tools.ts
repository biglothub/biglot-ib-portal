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
			description: 'ดึง daily journal entries ของลูกค้า (pre/post-market notes, mood 1-5)',
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
			name: 'get_equity_snapshots',
			description: 'ดึงข้อมูล equity curve (snapshots ทุก 5 นาที) สำหรับวิเคราะห์ drawdown และ volatility',
			parameters: {
				type: 'object',
				properties: {
					days: { type: 'number', description: 'Number of days to look back (default 7)' }
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
		case 'get_equity_snapshots':
			return getEquitySnapshots(supabase, clientAccountId, params);
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
		.select('symbol, type, lot_size, open_price, close_price, open_time, close_time, profit, sl, tp, pips, commission, swap, trade_tag_assignments(tag_id, trade_tags(name, category)), trade_notes(content, rating)')
		.eq('client_account_id', accountId)
		.gte('close_time', since.toISOString())
		.order('close_time', { ascending: false })
		.limit(limit);

	if (params.symbol) {
		query = query.eq('symbol', params.symbol as string);
	}

	const { data, error } = await query;
	if (error) return JSON.stringify({ error: error.message });

	const trades = (data || []).map((t: any) => ({
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
		tags: (t.trade_tag_assignments || []).map((a: any) => ({
			name: a.trade_tags?.name,
			category: a.trade_tags?.category
		})),
		note: t.trade_notes?.[0]?.content || null,
		rating: t.trade_notes?.[0]?.rating || null
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

	const stats = (data || []).map((d: any) => ({
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

	const positions = (data || []).map((p: any) => ({
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

	const getValue = (res: PromiseSettledResult<any>) =>
		res.status === 'fulfilled' ? res.value.data : null;

	const allStats = getValue(statsRes) || [];
	const allTrades = getValue(tradesRes) || [];
	const latest = getValue(latestRes);

	const dailyStatsForAnalytics = allStats
		.map((d: any) => ({ date: d.date, balance: d.balance || d.equity || 0, profit: d.profit || 0 }))
		.filter((d: any) => d.balance > 0);

	const tradesForAnalytics = allTrades.map((t: any) => ({
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
		.select('date, pre_market_notes, post_market_notes, mood')
		.eq('client_account_id', accountId)
		.eq('user_id', userId)
		.gte('date', since.toISOString().split('T')[0])
		.order('date', { ascending: false });

	if (error) return JSON.stringify({ error: error.message });

	return JSON.stringify({ totalEntries: (data || []).length, days, entries: data || [] });
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
		snapshots = snapshots.filter((_: any, i: number) => i % step === 0);
	}

	return JSON.stringify({ totalSnapshots: snapshots.length, days, snapshots });
}
