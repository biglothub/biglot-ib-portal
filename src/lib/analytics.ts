// Risk-adjusted performance analytics

export interface DailyReturn {
	date: string;
	balance: number;
	profit: number;
}

export interface AnalyticsResult {
	sharpeRatio: number;
	sortinoRatio: number;
	calmarRatio: number;
	avgDailyReturn: number;
	dailyVolatility: number;
	totalPips: number;
	pipsPerTrade: number;
	dayOfWeekPnL: { day: string; profit: number; trades: number; winRate: number }[];
	lotDistribution: { range: string; count: number }[];
	holdingTimeAnalysis: { range: string; count: number; avgProfit: number }[];
}

function mean(arr: number[]): number {
	if (arr.length === 0) return 0;
	return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
	if (arr.length < 2) return 0;
	const m = mean(arr);
	const variance = arr.reduce((sum, x) => sum + (x - m) ** 2, 0) / (arr.length - 1);
	return Math.sqrt(variance);
}

export function calcSharpeRatio(dailyReturns: number[], riskFreeRate = 0): number {
	if (dailyReturns.length < 2) return 0;
	const excessReturns = dailyReturns.map(r => r - riskFreeRate / 252);
	const avg = mean(excessReturns);
	const std = stdDev(excessReturns);
	if (std === 0) return 0;
	return (avg / std) * Math.sqrt(252);
}

export function calcSortinoRatio(dailyReturns: number[], riskFreeRate = 0): number {
	if (dailyReturns.length < 2) return 0;
	const excessReturns = dailyReturns.map(r => r - riskFreeRate / 252);
	const avg = mean(excessReturns);
	const downsideReturns = excessReturns.filter(r => r < 0);
	if (downsideReturns.length === 0) return avg > 0 ? 99.99 : 0;
	const downsideDev = Math.sqrt(mean(downsideReturns.map(r => r ** 2)));
	if (downsideDev === 0) return 0;
	return (avg / downsideDev) * Math.sqrt(252);
}

export function calcCalmarRatio(dailyReturns: number[], maxDrawdownPct: number): number {
	if (maxDrawdownPct === 0 || dailyReturns.length < 2) return 0;
	const totalReturn = dailyReturns.reduce((a, b) => a + b, 0);
	const annualizedReturnPct = (totalReturn / dailyReturns.length) * 252 * 100;
	return annualizedReturnPct / Math.abs(maxDrawdownPct);
}

export function calcDayOfWeekPerformance(trades: { closeTime: string; profit: number }[]): AnalyticsResult['dayOfWeekPnL'] {
	const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const dayMap = new Map<number, { profit: number; trades: number; wins: number }>();

	for (const trade of trades) {
		const day = new Date(trade.closeTime).getDay();
		const entry = dayMap.get(day) || { profit: 0, trades: 0, wins: 0 };
		entry.profit += trade.profit;
		entry.trades++;
		if (trade.profit > 0) entry.wins++;
		dayMap.set(day, entry);
	}

	return days.map((name, i) => {
		const entry = dayMap.get(i) || { profit: 0, trades: 0, wins: 0 };
		return {
			day: name,
			profit: entry.profit,
			trades: entry.trades,
			winRate: entry.trades > 0 ? (entry.wins / entry.trades) * 100 : 0
		};
	}).filter(d => d.trades > 0);
}

export function calcLotDistribution(trades: { lot: number }[]): AnalyticsResult['lotDistribution'] {
	const ranges = [
		{ range: '0.01', min: 0, max: 0.015 },
		{ range: '0.02-0.05', min: 0.015, max: 0.055 },
		{ range: '0.06-0.10', min: 0.055, max: 0.105 },
		{ range: '0.11-0.50', min: 0.105, max: 0.505 },
		{ range: '0.51+', min: 0.505, max: Infinity }
	];

	return ranges.map(r => ({
		range: r.range,
		count: trades.filter(t => t.lot >= r.min && t.lot < r.max).length
	})).filter(r => r.count > 0);
}

export function calcHoldingTimeAnalysis(trades: { openTime: string; closeTime: string; profit: number }[]): AnalyticsResult['holdingTimeAnalysis'] {
	const ranges = [
		{ range: '<5m', min: 0, max: 5 },
		{ range: '5-30m', min: 5, max: 30 },
		{ range: '30m-2h', min: 30, max: 120 },
		{ range: '2-8h', min: 120, max: 480 },
		{ range: '8h+', min: 480, max: Infinity }
	];

	return ranges.map(r => {
		const matching = trades.filter(t => {
			const mins = (new Date(t.closeTime).getTime() - new Date(t.openTime).getTime()) / 60000;
			return mins >= r.min && mins < r.max;
		});
		return {
			range: r.range,
			count: matching.length,
			avgProfit: matching.length > 0 ? mean(matching.map(t => t.profit)) : 0
		};
	}).filter(r => r.count > 0);
}

export function computeAnalytics(
	dailyStats: { date: string; balance: number; profit: number }[],
	trades: { closeTime: string; profit: number; lot: number; openTime: string }[],
	totalPoints: number,
	maxDrawdown: number
): AnalyticsResult {
	const dailyReturns: number[] = [];
	for (let i = 1; i < dailyStats.length; i++) {
		const prevBalance = dailyStats[i - 1].balance;
		if (prevBalance > 0) {
			dailyReturns.push((dailyStats[i].balance - prevBalance) / prevBalance);
		}
	}

	return {
		sharpeRatio: calcSharpeRatio(dailyReturns),
		sortinoRatio: calcSortinoRatio(dailyReturns),
		calmarRatio: calcCalmarRatio(dailyReturns, maxDrawdown),
		avgDailyReturn: mean(dailyReturns) * 100,
		dailyVolatility: stdDev(dailyReturns) * 100,
		totalPips: totalPoints,
		pipsPerTrade: trades.length > 0 ? totalPoints / trades.length : 0,
		dayOfWeekPnL: calcDayOfWeekPerformance(trades),
		lotDistribution: calcLotDistribution(trades),
		holdingTimeAnalysis: calcHoldingTimeAnalysis(trades)
	};
}
