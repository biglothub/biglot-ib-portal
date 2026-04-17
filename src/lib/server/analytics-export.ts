import type { AnalyticsResult } from '$lib/analytics';
import {
	buildDailyHistory,
	buildDayOfWeekReport,
	buildDayTimeHeatmap,
	buildKpiMetrics,
	buildProgressSnapshot,
	buildReportExplorer,
	buildSymbolBreakdown,
	buildTagBreakdown
} from '$lib/server/portfolio';
import { calculateHealthScore } from '$lib/server/insights/engine';
import { buildStatsOverview } from '$lib/server/stats-overview';
import type { PortfolioBaseData, PortfolioFilterState, Trade } from '$lib/types';

type DailyHistoryEntry = ReturnType<typeof buildDailyHistory>[number];

function computeTradeRR(trade: Trade): number | null {
	if (!trade.sl || trade.sl === 0) return null;
	const entry = Number(trade.open_price);
	const sl = Number(trade.sl);
	const exit = Number(trade.close_price);
	const risk = Math.abs(entry - sl);
	if (risk === 0) return null;
	const reward = Math.abs(exit - entry);
	return reward / risk;
}

function daysBetween(d1: string, d2: string): number {
	const ms = new Date(d2).getTime() - new Date(d1).getTime();
	return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function buildRiskAnalysis(
	trades: Trade[],
	dailyHistory: DailyHistoryEntry[],
	analytics: AnalyticsResult | null | undefined
) {
	let peak = 0;
	let runningPnl = 0;
	let maxDrawdown = 0;
	let maxDrawdownDate = '';
	const drawdownSeries: Array<{ date: string; drawdown: number; drawdownPct: number }> = [];

	for (const d of dailyHistory) {
		runningPnl += d.profit;
		if (runningPnl > peak) peak = runningPnl;
		const dd = peak - runningPnl;
		const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
		if (dd > maxDrawdown) {
			maxDrawdown = dd;
			maxDrawdownDate = d.date;
		}
		drawdownSeries.push({ date: d.date, drawdown: -dd, drawdownPct: -ddPct });
	}

	const drawdownPeriods: Array<{
		startDate: string;
		troughDate: string;
		recoveryDate: string | null;
		maxDrawdown: number;
		maxDrawdownPct: number;
		durationDays: number;
		recoveryDays: number | null;
	}> = [];

	let currentPeak = 0;
	let currentRunning = 0;
	let inDrawdown = false;
	let periodStart = '';
	let periodTroughDate = '';
	let periodMaxDD = 0;
	let periodMaxDDPct = 0;

	for (let i = 0; i < dailyHistory.length; i++) {
		currentRunning += dailyHistory[i].profit;
		if (currentRunning > currentPeak) {
			if (inDrawdown) {
				drawdownPeriods.push({
					startDate: periodStart,
					troughDate: periodTroughDate,
					recoveryDate: dailyHistory[i].date,
					maxDrawdown: periodMaxDD,
					maxDrawdownPct: periodMaxDDPct,
					durationDays: daysBetween(periodStart, dailyHistory[i].date),
					recoveryDays: daysBetween(periodTroughDate, dailyHistory[i].date)
				});
				inDrawdown = false;
			}
			currentPeak = currentRunning;
		} else if (currentPeak - currentRunning > 0) {
			const dd = currentPeak - currentRunning;
			const ddPct = currentPeak > 0 ? (dd / currentPeak) * 100 : 0;
			if (!inDrawdown) {
				inDrawdown = true;
				periodStart = dailyHistory[i].date;
				periodTroughDate = dailyHistory[i].date;
				periodMaxDD = dd;
				periodMaxDDPct = ddPct;
			} else if (dd > periodMaxDD) {
				periodTroughDate = dailyHistory[i].date;
				periodMaxDD = dd;
				periodMaxDDPct = ddPct;
			}
		}
	}

	if (inDrawdown) {
		const lastDate = dailyHistory[dailyHistory.length - 1]?.date || '';
		drawdownPeriods.push({
			startDate: periodStart,
			troughDate: periodTroughDate,
			recoveryDate: null,
			maxDrawdown: periodMaxDD,
			maxDrawdownPct: periodMaxDDPct,
			durationDays: daysBetween(periodStart, lastDate),
			recoveryDays: null
		});
	}

	const topDrawdowns = [...drawdownPeriods].sort((a, b) => b.maxDrawdown - a.maxDrawdown).slice(0, 10);
	const avgDrawdown = drawdownPeriods.length > 0
		? drawdownPeriods.reduce((s, p) => s + p.maxDrawdown, 0) / drawdownPeriods.length
		: 0;

	const rrBuckets = [
		{ label: '< 0.5', min: 0, max: 0.5 },
		{ label: '0.5 - 1.0', min: 0.5, max: 1.0 },
		{ label: '1.0 - 1.5', min: 1.0, max: 1.5 },
		{ label: '1.5 - 2.0', min: 1.5, max: 2.0 },
		{ label: '2.0 - 3.0', min: 2.0, max: 3.0 },
		{ label: '3.0+', min: 3.0, max: Infinity }
	];

	const rrDistribution: Array<{ label: string; count: number; wins: number; losses: number }> = [];
	let totalRRTrades = 0;
	for (const bucket of rrBuckets) {
		const matching = trades.filter((trade) => {
			const rr = computeTradeRR(trade);
			return rr !== null && rr >= bucket.min && rr < bucket.max;
		});
		const wins = matching.filter((trade) => Number(trade.profit) > 0).length;
		rrDistribution.push({
			label: bucket.label,
			count: matching.length,
			wins,
			losses: matching.length - wins
		});
		totalRRTrades += matching.length;
	}

	let maxLossStreak = 0;
	let currentStreak = 0;
	const sortedTrades = [...trades].sort(
		(a, b) => new Date(a.close_time).getTime() - new Date(b.close_time).getTime()
	);
	for (const trade of sortedTrades) {
		if (Number(trade.profit) < 0) {
			currentStreak += 1;
			if (currentStreak > maxLossStreak) maxLossStreak = currentStreak;
		} else {
			currentStreak = 0;
		}
	}

	const dailyProfits = dailyHistory.map((day) => day.profit);
	const dailyMean = dailyProfits.length > 0 ? dailyProfits.reduce((a, b) => a + b, 0) / dailyProfits.length : 0;
	const dailyVariance = dailyProfits.length > 1
		? dailyProfits.reduce((sum, profit) => sum + (profit - dailyMean) ** 2, 0) / (dailyProfits.length - 1)
		: 0;
	const dailyStdDev = Math.sqrt(dailyVariance);

	const largestLoss = trades.reduce((minLoss, trade) => {
		const profit = Number(trade.profit);
		return profit < minLoss ? profit : minLoss;
	}, 0);

	const largestWin = trades.reduce((maxWin, trade) => {
		const profit = Number(trade.profit);
		return profit > maxWin ? profit : maxWin;
	}, 0);

	return {
		drawdownSeries,
		topDrawdowns,
		maxDrawdown,
		maxDrawdownDate,
		avgDrawdown,
		rrDistribution,
		totalRRTrades,
		maxLossStreak,
		dailyStdDev,
		dailyMean,
		largestLoss,
		largestWin,
		sharpeRatio: analytics?.sharpeRatio || 0,
		sortinoRatio: analytics?.sortinoRatio || 0,
		calmarRatio: analytics?.calmarRatio || 0,
		avgDailyReturn: analytics?.avgDailyReturn || 0,
		dailyVolatility: analytics?.dailyVolatility || 0,
		drawdownPeriodCount: drawdownPeriods.length,
		avgDrawdownDuration: drawdownPeriods.length > 0
			? Math.round(drawdownPeriods.reduce((sum, period) => sum + period.durationDays, 0) / drawdownPeriods.length)
			: 0
	};
}

export function buildCorrelationMatrix(trades: Trade[]) {
	const symbolSet = new Set(trades.map((trade) => trade.symbol).filter(Boolean));
	const symbols = [...symbolSet].sort();

	if (symbols.length < 2) {
		return { symbols, matrix: [] as (number | null)[][], topPairs: [] as Array<{ symA: string; symB: string; correlation: number; sharedDays: number }> };
	}

	const symbolDailyPnl = new Map<string, Map<string, number>>();
	for (const symbol of symbols) symbolDailyPnl.set(symbol, new Map());

	for (const trade of trades) {
		if (!trade.symbol || !trade.close_time) continue;
		const date = String(trade.close_time).split('T')[0];
		const symMap = symbolDailyPnl.get(trade.symbol);
		if (symMap) symMap.set(date, (symMap.get(date) || 0) + Number(trade.profit));
	}

	function pearson(aMap: Map<string, number>, bMap: Map<string, number>) {
		const sharedDates = [...aMap.keys()].filter((date) => bMap.has(date));
		const sharedDays = sharedDates.length;
		if (sharedDays < 3) return { r: null as number | null, sharedDays };

		const xs = sharedDates.map((date) => aMap.get(date)!);
		const ys = sharedDates.map((date) => bMap.get(date)!);
		const xMean = xs.reduce((sum, value) => sum + value, 0) / xs.length;
		const yMean = ys.reduce((sum, value) => sum + value, 0) / ys.length;

		let numerator = 0;
		let xVariance = 0;
		let yVariance = 0;
		for (let i = 0; i < xs.length; i++) {
			const dx = xs[i] - xMean;
			const dy = ys[i] - yMean;
			numerator += dx * dy;
			xVariance += dx * dx;
			yVariance += dy * dy;
		}

		const denominator = Math.sqrt(xVariance * yVariance);
		if (denominator === 0) return { r: null as number | null, sharedDays };
		return { r: Math.max(-1, Math.min(1, numerator / denominator)), sharedDays };
	}

	const matrix: (number | null)[][] = Array.from({ length: symbols.length }, (_, i) =>
		Array.from({ length: symbols.length }, (_, j) => (i === j ? 1 : null))
	);
	const allPairs: Array<{ symA: string; symB: string; correlation: number; sharedDays: number }> = [];

	for (let i = 0; i < symbols.length; i++) {
		for (let j = i + 1; j < symbols.length; j++) {
			const { r, sharedDays } = pearson(
				symbolDailyPnl.get(symbols[i])!,
				symbolDailyPnl.get(symbols[j])!
			);
			matrix[i][j] = r;
			matrix[j][i] = r;
			if (r !== null) {
				allPairs.push({ symA: symbols[i], symB: symbols[j], correlation: r, sharedDays });
			}
		}
	}

	allPairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

	return { symbols, matrix, topPairs: allPairs.slice(0, 10) };
}

export function buildAnalyticsViewData(
	baseData: PortfolioBaseData,
	filterState: PortfolioFilterState,
	precomputedReport = buildReportExplorer(baseData.trades, baseData.dailyStats, baseData.journals, filterState)
) {
	const dailyHistory = buildDailyHistory(precomputedReport.filteredTrades);
	const symbolBreakdown = buildSymbolBreakdown(precomputedReport.filteredTrades);
	const tagBreakdown = buildTagBreakdown(precomputedReport.filteredTrades);
	const dayOfWeekReport = buildDayOfWeekReport(precomputedReport.filteredTrades);
	const dayTimeHeatmap = buildDayTimeHeatmap(precomputedReport.filteredTrades);
	const kpiMetrics = buildKpiMetrics(precomputedReport.filteredTrades, dailyHistory);
	const statsOverview = buildStatsOverview(precomputedReport.filteredTrades, dailyHistory, precomputedReport.analytics);
	const riskAnalysis = buildRiskAnalysis(precomputedReport.filteredTrades, dailyHistory, precomputedReport.analytics);
	const correlationMatrix = buildCorrelationMatrix(precomputedReport.filteredTrades);
	const healthScore = calculateHealthScore(kpiMetrics);
	const calendarDays = dailyHistory.map((day) => ({ date: day.date, pnl: day.profit, trades: day.totalTrades }));
	const progressSnapshot = buildProgressSnapshot(
		precomputedReport.filteredTrades,
		baseData.journals,
		baseData.dailyStats,
		baseData.progressGoals
	);
	const filteredDailyStats = baseData.dailyStats.filter((day) => {
		if (filterState.from && day.date < filterState.from) return false;
		if (filterState.to && day.date > filterState.to) return false;
		return true;
	});

	return {
		filterState,
		dailyHistory,
		filteredDailyStats,
		report: { ...precomputedReport, progressSnapshot },
		symbolBreakdown,
		tagBreakdown,
		dayOfWeekReport,
		dayTimeHeatmap,
		calendarDays,
		kpiMetrics,
		statsOverview,
		healthScore,
		riskAnalysis,
		correlationMatrix
	};
}
