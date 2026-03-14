import { computeAnalytics } from '$lib/analytics';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { account } = await parent();
	const supabase = locals.supabase;
	const profile = locals.profile;

	if (!account || !profile) {
		return { analytics: null, strategyReport: [], tradingScore: null, runningPnL: [], allDailyStats: [] };
	}

	// Fetch all trades with tags
	const [allTradesRes, allStatsRes, latestStatsRes] = await Promise.allSettled([
		supabase.from('trades')
			.select('*, trade_tag_assignments(tag_id, trade_tags(id, name, color, category))')
			.eq('client_account_id', account.id)
			.order('close_time', { ascending: true }),

		supabase.from('daily_stats')
			.select('date, balance, equity, profit')
			.eq('client_account_id', account.id)
			.order('date', { ascending: true }),

		supabase.from('daily_stats')
			.select('*')
			.eq('client_account_id', account.id)
			.order('date', { ascending: false })
			.limit(1)
			.single()
	]);

	const getValue = (res: PromiseSettledResult<any>) =>
		res.status === 'fulfilled' ? res.value.data : null;

	const allTrades = getValue(allTradesRes) || [];
	const allStatsData = getValue(allStatsRes) || [];
	const latestStats = getValue(latestStatsRes);

	// Compute standard analytics
	const dailyStatsForAnalytics = allStatsData
		.map((d: any) => ({ date: d.date, balance: d.balance || d.equity || 0, profit: d.profit || 0 }))
		.filter((d: any) => d.balance > 0);

	const tradesForAnalytics = allTrades.map((t: any) => ({
		closeTime: t.close_time, openTime: t.open_time, profit: t.profit || 0, lot: t.lot_size || 0
	}));

	const analytics = (dailyStatsForAnalytics.length >= 2 || tradesForAnalytics.length > 0)
		? computeAnalytics(dailyStatsForAnalytics, tradesForAnalytics, latestStats?.profit || 0, latestStats?.max_drawdown || 0)
		: null;

	// Build strategy report (group by setup tags)
	const strategyReport = buildStrategyReport(allTrades);

	// Compute trading score
	const tradingScore = computeTradingScore(allTrades, latestStats, allStatsData);

	// Build running P/L (cumulative trade-by-trade)
	const runningPnL = allTrades.map((t: any, i: number) => ({
		time: t.close_time,
		profit: t.profit,
		cumulative: allTrades.slice(0, i + 1).reduce((sum: number, tr: any) => sum + (tr.profit || 0), 0)
	}));

	return {
		analytics,
		strategyReport,
		tradingScore,
		runningPnL,
		allDailyStats: allStatsData
	};
};

function buildStrategyReport(trades: any[]) {
	const strategyMap = new Map<string, { name: string; color: string; trades: any[] }>();

	// Group trades by setup tags
	for (const trade of trades) {
		const setupTags = (trade.trade_tag_assignments || [])
			.filter((a: any) => a.trade_tags?.category === 'setup')
			.map((a: any) => a.trade_tags);

		if (setupTags.length === 0) {
			// "No Strategy" bucket
			if (!strategyMap.has('_none')) {
				strategyMap.set('_none', { name: 'ไม่มี Tag', color: '#6b7280', trades: [] });
			}
			strategyMap.get('_none')!.trades.push(trade);
		} else {
			for (const tag of setupTags) {
				if (!strategyMap.has(tag.id)) {
					strategyMap.set(tag.id, { name: tag.name, color: tag.color, trades: [] });
				}
				strategyMap.get(tag.id)!.trades.push(trade);
			}
		}
	}

	return Array.from(strategyMap.entries()).map(([id, data]) => {
		const wins = data.trades.filter((t: any) => t.profit > 0);
		const losses = data.trades.filter((t: any) => t.profit < 0);
		const totalProfit = data.trades.reduce((s: number, t: any) => s + (t.profit || 0), 0);
		const avgWin = wins.length > 0 ? wins.reduce((s: number, t: any) => s + t.profit, 0) / wins.length : 0;
		const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s: number, t: any) => s + t.profit, 0) / losses.length) : 0;
		const grossLoss = losses.reduce((s: number, t: any) => s + Math.abs(t.profit || 0), 0);
		const grossWin = wins.reduce((s: number, t: any) => s + (t.profit || 0), 0);

		return {
			id,
			name: data.name,
			color: data.color,
			totalTrades: data.trades.length,
			winRate: data.trades.length > 0 ? (wins.length / data.trades.length) * 100 : 0,
			profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
			totalProfit,
			avgWin,
			avgLoss,
			expectancy: data.trades.length > 0 ? totalProfit / data.trades.length : 0
		};
	}).sort((a, b) => b.totalProfit - a.totalProfit);
}

function computeTradingScore(trades: any[], latestStats: any, allStats: any[]) {
	if (!trades.length || !latestStats) return null;

	// Performance (25 pts)
	const winRate = latestStats.win_rate || 0;
	const profitFactor = latestStats.profit_factor || 0;
	const performanceScore = Math.min(25,
		(winRate >= 50 ? 10 : winRate / 50 * 10) +
		(profitFactor >= 1.5 ? 10 : profitFactor / 1.5 * 10) +
		(latestStats.profit > 0 ? 5 : 0)
	);

	// Risk Management (25 pts)
	const maxDrawdown = Math.abs(latestStats.max_drawdown || 0);
	const hasSL = trades.filter((t: any) => t.sl != null).length / trades.length;
	const riskScore = Math.min(25,
		(maxDrawdown < 5 ? 10 : maxDrawdown < 10 ? 7 : maxDrawdown < 20 ? 4 : 1) +
		(hasSL * 10) +
		(latestStats.worst_trade && Math.abs(latestStats.worst_trade) < latestStats.balance * 0.02 ? 5 : 2)
	);

	// Consistency (25 pts)
	const tradingDays = allStats.filter((s: any) => s.profit !== 0).length;
	const totalDays = allStats.length || 1;
	const consistency = tradingDays / totalDays;
	const profitableDays = allStats.filter((s: any) => s.profit > 0).length;
	const profitableDayRate = totalDays > 0 ? profitableDays / totalDays : 0;
	const consistencyScore = Math.min(25,
		(consistency >= 0.6 ? 10 : consistency * 10 / 0.6) +
		(profitableDayRate >= 0.55 ? 10 : profitableDayRate * 10 / 0.55) +
		(latestStats.max_consecutive_losses != null && latestStats.max_consecutive_losses <= 3 ? 5 : 2)
	);

	// Discipline (25 pts)
	const mistakeTags = trades.filter((t: any) =>
		(t.trade_tag_assignments || []).some((a: any) => a.trade_tags?.category === 'mistake')
	).length;
	const mistakeRate = trades.length > 0 ? mistakeTags / trades.length : 0;
	const avgLotConsistency = (() => {
		const lots = trades.map((t: any) => t.lot_size);
		if (lots.length < 2) return 1;
		const avg = lots.reduce((s: number, l: number) => s + l, 0) / lots.length;
		const variance = lots.reduce((s: number, l: number) => s + Math.pow(l - avg, 2), 0) / lots.length;
		const cv = Math.sqrt(variance) / (avg || 1);
		return Math.max(0, 1 - cv);
	})();

	const disciplineScore = Math.min(25,
		(mistakeRate < 0.1 ? 10 : mistakeRate < 0.3 ? 6 : 2) +
		(avgLotConsistency * 10) +
		5  // base discipline points
	);

	const total = Math.round(performanceScore + riskScore + consistencyScore + disciplineScore);

	return {
		total,
		performance: Math.round(performanceScore),
		risk: Math.round(riskScore),
		consistency: Math.round(consistencyScore),
		discipline: Math.round(disciplineScore)
	};
}
