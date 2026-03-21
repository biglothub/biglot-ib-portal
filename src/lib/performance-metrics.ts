interface DailyEntry { date: string; profit: number; totalTrades: number; winRate?: number }

type MetricKey = 'net_pnl_cumulative' | 'net_pnl' | 'win_rate' | 'profit_factor' | 'trade_count' | 'avg_win_loss';
type Timeframe = 'day' | 'week' | 'month';

/**
 * Build a time series for a given metric + timeframe combination
 */
export function buildPerformanceMetricSeries(
	dailyHistory: DailyEntry[],
	metric: MetricKey,
	timeframe: Timeframe
): Array<{ date: string; value: number }> {
	if (!dailyHistory || dailyHistory.length === 0) return [];

	// Group by timeframe
	const groups = groupByTimeframe(dailyHistory, timeframe);

	// Calculate metric for each group
	return groups.map(group => {
		const value = calculateMetric(group.entries, metric);
		return { date: group.label, value };
	});
}

function groupByTimeframe(entries: DailyEntry[], timeframe: Timeframe) {
	if (timeframe === 'day') {
		return entries.map(e => ({ label: e.date, entries: [e] }));
	}

	const map = new Map<string, DailyEntry[]>();

	for (const entry of entries) {
		let key: string;
		if (timeframe === 'week') {
			const d = new Date(entry.date + 'T00:00:00');
			const dayOfWeek = d.getDay();
			const weekStart = new Date(d);
			weekStart.setDate(weekStart.getDate() - dayOfWeek);
			key = weekStart.toISOString().split('T')[0];
		} else {
			key = entry.date.substring(0, 7); // YYYY-MM
		}

		if (!map.has(key)) map.set(key, []);
		map.get(key)!.push(entry);
	}

	return [...map.entries()]
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([label, entries]) => ({ label, entries }));
}

function calculateMetric(entries: DailyEntry[], metric: MetricKey): number {
	const totalPnl = entries.reduce((s, e) => s + e.profit, 0);
	const totalTrades = entries.reduce((s, e) => s + e.totalTrades, 0);

	switch (metric) {
		case 'net_pnl_cumulative':
			// For cumulative, we return the running total — handled at the caller level
			return totalPnl;

		case 'net_pnl':
			return totalPnl;

		case 'win_rate': {
			const winDays = entries.filter(e => e.profit > 0).length;
			return entries.length > 0 ? (winDays / entries.length) * 100 : 0;
		}

		case 'profit_factor': {
			const winning = entries.filter(e => e.profit > 0).reduce((s, e) => s + e.profit, 0);
			const losing = Math.abs(entries.filter(e => e.profit < 0).reduce((s, e) => s + e.profit, 0));
			return losing > 0 ? winning / losing : 0;
		}

		case 'trade_count':
			return totalTrades;

		case 'avg_win_loss': {
			const wins = entries.filter(e => e.profit > 0);
			const losses = entries.filter(e => e.profit < 0);
			const avgWin = wins.length > 0 ? wins.reduce((s, e) => s + e.profit, 0) / wins.length : 0;
			const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, e) => s + e.profit, 0)) / losses.length : 0;
			return avgLoss > 0 ? avgWin / avgLoss : 0;
		}

		default:
			return 0;
	}
}

/**
 * Build cumulative version of a metric series
 */
export function makeCumulative(series: Array<{ date: string; value: number }>): Array<{ date: string; value: number }> {
	let cum = 0;
	return series.map(s => {
		cum += s.value;
		return { date: s.date, value: cum };
	});
}

/** Available metrics for the dropdown */
export const AVAILABLE_METRICS = [
	{ key: 'net_pnl_cumulative', label: 'กำไรสุทธิ (สะสม)', chartType: 'area' as const },
	{ key: 'net_pnl', label: 'กำไรสุทธิ', chartType: 'histogram' as const },
	{ key: 'win_rate', label: 'อัตราชนะ %', chartType: 'area' as const },
	{ key: 'profit_factor', label: 'Profit Factor', chartType: 'area' as const },
	{ key: 'trade_count', label: 'จำนวนเทรด', chartType: 'histogram' as const },
	{ key: 'avg_win_loss', label: 'เฉลี่ย ชนะ/แพ้', chartType: 'histogram' as const },
];
