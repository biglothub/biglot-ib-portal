import { computeAnalytics } from '$lib/analytics';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const supabase = locals.supabase;
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
	const ninetyDaysAgo = new Date();
	ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

	// Client sees only their own account(s) via RLS
	const { data: account } = await supabase
		.from('client_accounts')
		.select('id, client_name, mt5_account_id, mt5_server, status, last_synced_at')
		.eq('status', 'approved')
		.maybeSingle();

	if (!account) {
		return { account: null, latestStats: null, equityData: [], openPositions: [], recentTrades: [], analytics: null, dailyHistory: [], equityCurve: [], equitySnapshots: [] };
	}

	const [statsRes, equityRes, positionsRes, tradesRes, allStatsRes, allTradesRes, allTradesFullRes] = await Promise.allSettled([
		// Latest daily stats
		supabase.from('daily_stats')
			.select('*')
			.eq('client_account_id', account.id)
			.order('date', { ascending: false })
			.limit(1)
			.single(),

		// Equity snapshots (30 days) for detailed chart
		supabase.from('equity_snapshots')
			.select('timestamp, balance, equity, floating_pl')
			.eq('client_account_id', account.id)
			.gte('timestamp', thirtyDaysAgo.toISOString())
			.order('timestamp', { ascending: true }),

		// Open positions
		supabase.from('open_positions')
			.select('*')
			.eq('client_account_id', account.id)
			.order('open_time', { ascending: false }),

		// Recent trades (50)
		supabase.from('trades')
			.select('*')
			.eq('client_account_id', account.id)
			.order('close_time', { ascending: false })
			.limit(50),

		// All daily stats history (for equity curve & analytics)
		supabase.from('daily_stats')
			.select('date, balance, equity, profit')
			.eq('client_account_id', account.id)
			.order('date', { ascending: true }),

		// All trades from last 90 days (for calendar)
		supabase.from('trades')
			.select('close_time, profit')
			.eq('client_account_id', account.id)
			.gte('close_time', ninetyDaysAgo.toISOString())
			.order('close_time', { ascending: true }),

		// All trades full data (for analytics)
		supabase.from('trades')
			.select('close_time, open_time, profit, lot_size, symbol, type')
			.eq('client_account_id', account.id)
			.order('close_time', { ascending: true })
	]);

	const getValue = (res: PromiseSettledResult<any>) =>
		res.status === 'fulfilled' ? res.value.data : null;

	const latestStats = getValue(statsRes);
	const equityData = getValue(equityRes) || [];
	const openPositions = getValue(positionsRes) || [];
	const recentTrades = getValue(tradesRes) || [];
	const allStatsData = getValue(allStatsRes) || [];
	const allTrades = getValue(allTradesRes) || [];
	const allTradesFull = getValue(allTradesFullRes) || [];

	// Build equity curve from daily stats
	const equityCurve = allStatsData.map((d: any) => d.equity as number);

	// Build equity snapshots for chart
	const equitySnapshots = equityData.map((s: any) => ({
		time: Math.floor(new Date(s.timestamp).getTime() / 1000),
		balance: s.balance,
		equity: s.equity,
		floatingPL: s.floating_pl || 0
	}));

	// Build daily history from trades (for calendar & rhythm card)
	const THAILAND_OFFSET_MS = 7 * 60 * 60 * 1000;
	const dailyHistory = (() => {
		if (!allTrades || allTrades.length === 0) return [];

		const dailyMap = new Map<string, { profit: number; trades: number[] }>();

		for (const trade of allTrades) {
			const closeTime = new Date(trade.close_time);
			const thaiTime = new Date(closeTime.getTime() + THAILAND_OFFSET_MS);
			const dateKey = thaiTime.toISOString().split('T')[0];

			if (!dailyMap.has(dateKey)) {
				dailyMap.set(dateKey, { profit: 0, trades: [] });
			}
			const day = dailyMap.get(dateKey)!;
			day.profit += trade.profit || 0;
			day.trades.push(trade.profit || 0);
		}

		return Array.from(dailyMap.entries()).map(([date, data]) => {
			const wins = data.trades.filter(p => p > 0);
			const losses = data.trades.filter(p => p < 0);
			return {
				date,
				profit: data.profit,
				totalTrades: data.trades.length,
				winRate: data.trades.length > 0 ? (wins.length / data.trades.length) * 100 : 0,
				bestTrade: wins.length > 0 ? Math.max(...wins) : 0,
				worstTrade: losses.length > 0 ? Math.min(...losses) : 0
			};
		}).sort((a, b) => a.date.localeCompare(b.date));
	})();

	// Compute analytics
	const analytics = (() => {
		const dailyStatsForAnalytics = (allStatsData || [])
			.map((d: any) => ({
				date: d.date,
				balance: d.balance || d.equity || 0,
				profit: d.profit || 0
			}))
			.filter((d: any) => d.balance > 0);

		const tradesForAnalytics = (allTradesFull || []).map((t: any) => ({
			closeTime: t.close_time,
			openTime: t.open_time,
			profit: t.profit || 0,
			lot: t.lot_size || 0
		}));

		if (dailyStatsForAnalytics.length < 2 && tradesForAnalytics.length === 0) return null;

		return computeAnalytics(
			dailyStatsForAnalytics,
			tradesForAnalytics,
			latestStats?.profit || 0,
			latestStats?.max_drawdown || 0
		);
	})();

	return {
		account,
		latestStats,
		equityData,
		openPositions,
		recentTrades,
		analytics,
		dailyHistory,
		equityCurve,
		equitySnapshots
	};
};
