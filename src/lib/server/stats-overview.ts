import type { Trade } from '$lib/types';

interface DailyHistoryEntry {
	date: string;
	profit: number;
	totalTrades: number;
}

interface StatsSection {
	title: string;
	rows: Array<{ label: string; value: string; color?: string }>;
}

/**
 * Build comprehensive stats overview (30+ metrics) for the Reports Overview tab
 */
export function buildStatsOverview(
	trades: Trade[],
	dailyHistory: DailyHistoryEntry[],
	analytics?: { sharpeRatio?: number; sortinoRatio?: number; calmarRatio?: number } | null
): StatsSection[] {
	if (!trades || trades.length === 0) {
		return [{ title: 'No Data', rows: [{ label: 'Import trades to see your stats', value: '—' }] }];
	}

	const profits = trades.map(t => Number(t.profit || 0));
	const wins = profits.filter(p => p > 0);
	const losses = profits.filter(p => p < 0);
	const netPnl = profits.reduce((a, b) => a + b, 0);

	// Consecutive streaks (chronological order)
	const sortedProfits = [...trades]
		.sort((a, b) => new Date(a.close_time).getTime() - new Date(b.close_time).getTime())
		.map(t => Number(t.profit || 0));

	let maxConsecWins = 0, maxConsecLosses = 0, curWins = 0, curLosses = 0;
	for (const p of sortedProfits) {
		if (p > 0) { curWins++; curLosses = 0; maxConsecWins = Math.max(maxConsecWins, curWins); }
		else if (p < 0) { curLosses++; curWins = 0; maxConsecLosses = Math.max(maxConsecLosses, curLosses); }
		else { curWins = 0; curLosses = 0; }
	}

	// Monthly breakdown
	const monthlyMap = new Map<string, number>();
	for (const d of dailyHistory) {
		const month = d.date.substring(0, 7); // YYYY-MM
		monthlyMap.set(month, (monthlyMap.get(month) || 0) + d.profit);
	}
	const monthlyPnls = [...monthlyMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
	const bestMonth = monthlyPnls.length > 0 ? monthlyPnls.reduce((a, b) => a[1] > b[1] ? a : b) : null;
	const worstMonth = monthlyPnls.length > 0 ? monthlyPnls.reduce((a, b) => a[1] < b[1] ? a : b) : null;
	const avgMonthly = monthlyPnls.length > 0 ? monthlyPnls.reduce((s, m) => s + m[1], 0) / monthlyPnls.length : 0;

	// Daily stats
	const winDays = dailyHistory.filter(d => d.profit > 0);
	const lossDays = dailyHistory.filter(d => d.profit < 0);
	const beDays = dailyHistory.filter(d => d.profit === 0 && d.totalTrades > 0);
	const bestDay = dailyHistory.length > 0 ? dailyHistory.reduce((a, b) => a.profit > b.profit ? a : b) : null;
	const worstDay = dailyHistory.length > 0 ? dailyHistory.reduce((a, b) => a.profit < b.profit ? a : b) : null;
	const avgDaily = dailyHistory.length > 0 ? dailyHistory.reduce((s, d) => s + d.profit, 0) / dailyHistory.length : 0;

	// Daily volume
	const avgDailyVolume = dailyHistory.length > 0
		? trades.reduce((s, t) => s + Number(t.lot_size || 0), 0) / dailyHistory.length
		: 0;

	// Holding time
	const holdTimes = trades.map(t =>
		(new Date(t.close_time).getTime() - new Date(t.open_time).getTime()) / 60000
	);
	const avgHold = holdTimes.length > 0 ? holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length : 0;

	// Commissions/Swap
	const totalCommissions = trades.reduce((s, t) => s + Math.abs(Number((t as any).commission || 0)), 0);
	const totalSwap = trades.reduce((s, t) => s + Number((t as any).swap || 0), 0);

	// Profit factor
	const totalWinning = wins.reduce((a, b) => a + b, 0);
	const totalLosing = Math.abs(losses.reduce((a, b) => a + b, 0));
	const profitFactor = totalLosing > 0 ? totalWinning / totalLosing : 0;

	const fmt = (n: number) => `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
	const fmtPct = (n: number) => `${n.toFixed(1)}%`;
	const fmtNum = (n: number) => n.toFixed(2);
	const pnlColor = (n: number) => n >= 0 ? 'text-green-400' : 'text-red-400';

	function formatDuration(mins: number) {
		if (mins < 60) return `${Math.round(mins)}m`;
		const h = Math.floor(mins / 60);
		const m = Math.round(mins % 60);
		if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
		const d = Math.floor(h / 24);
		return `${d}d ${h % 24}h`;
	}

	return [
		{
			title: 'Trade Statistics',
			rows: [
				{ label: 'Total P&L', value: fmt(netPnl), color: pnlColor(netPnl) },
				{ label: 'Total Trades', value: String(trades.length) },
				{ label: 'Winning Trades', value: String(wins.length), color: 'text-green-400' },
				{ label: 'Losing Trades', value: String(losses.length), color: 'text-red-400' },
				{ label: 'Breakeven Trades', value: String(trades.length - wins.length - losses.length) },
				{ label: 'Win Rate', value: fmtPct((wins.length / trades.length) * 100) },
				{ label: 'Profit Factor', value: fmtNum(profitFactor) },
				{ label: 'Expectancy', value: fmt(netPnl / trades.length), color: pnlColor(netPnl) },
				{ label: 'Avg Winning Trade', value: fmt(wins.length > 0 ? totalWinning / wins.length : 0), color: 'text-green-400' },
				{ label: 'Avg Losing Trade', value: fmt(losses.length > 0 ? -(totalLosing / losses.length) : 0), color: 'text-red-400' },
				{ label: 'Largest Win', value: fmt(wins.length > 0 ? wins.reduce((m, v) => v > m ? v : m, -Infinity) : 0), color: 'text-green-400' },
				{ label: 'Largest Loss', value: fmt(losses.length > 0 ? losses.reduce((m, v) => v < m ? v : m, Infinity) : 0), color: 'text-red-400' },
				{ label: 'Max Consecutive Wins', value: String(maxConsecWins) },
				{ label: 'Max Consecutive Losses', value: String(maxConsecLosses) },
				{ label: 'Avg Daily Volume', value: fmtNum(avgDailyVolume) },
				{ label: 'Avg Holding Time', value: formatDuration(avgHold) },
				{ label: 'Total Commissions', value: fmt(totalCommissions) },
				{ label: 'Total Swap', value: fmt(totalSwap), color: pnlColor(totalSwap) },
			]
		},
		{
			title: 'Daily Performance',
			rows: [
				{ label: 'Total Trading Days', value: String(dailyHistory.length) },
				{ label: 'Winning Days', value: String(winDays.length), color: 'text-green-400' },
				{ label: 'Losing Days', value: String(lossDays.length), color: 'text-red-400' },
				{ label: 'Breakeven Days', value: String(beDays.length) },
				{ label: 'Day Win Rate', value: fmtPct(dailyHistory.length > 0 ? (winDays.length / dailyHistory.length) * 100 : 0) },
				{ label: 'Avg Daily P&L', value: fmt(avgDaily), color: pnlColor(avgDaily) },
				{ label: 'Best Day P&L', value: bestDay ? fmt(bestDay.profit) : '—', color: 'text-green-400' },
				{ label: 'Worst Day P&L', value: worstDay ? fmt(worstDay.profit) : '—', color: 'text-red-400' },
			]
		},
		{
			title: 'Monthly Performance',
			rows: [
				{ label: 'Best Month', value: bestMonth ? `${fmt(bestMonth[1])} (${bestMonth[0]})` : '—', color: 'text-green-400' },
				{ label: 'Worst Month', value: worstMonth ? `${fmt(worstMonth[1])} (${worstMonth[0]})` : '—', color: 'text-red-400' },
				{ label: 'Avg Monthly P&L', value: fmt(avgMonthly), color: pnlColor(avgMonthly) },
			]
		},
		{
			title: 'Risk Metrics',
			rows: [
				{ label: 'Sharpe Ratio', value: fmtNum(analytics?.sharpeRatio || 0) },
				{ label: 'Sortino Ratio', value: fmtNum(analytics?.sortinoRatio || 0) },
				{ label: 'Calmar Ratio', value: fmtNum(analytics?.calmarRatio || 0) },
			]
		}
	];
}
