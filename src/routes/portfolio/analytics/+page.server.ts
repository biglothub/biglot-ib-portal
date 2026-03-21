import { parsePortfolioFilters } from '$lib/portfolio';
import {
	buildDailyHistory,
	buildDayOfWeekReport,
	buildDayTimeHeatmap,
	buildFilterOptions,
	buildKpiMetrics,
	buildProgressSnapshot,
	buildReportExplorer,
	buildSymbolBreakdown,
	buildTagBreakdown
} from '$lib/server/portfolio';
import { buildStatsOverview } from '$lib/server/stats-overview';
import { calculateHealthScore } from '$lib/server/insights/engine';
import type { Trade } from '$lib/types';
import type { AnalyticsResult } from '$lib/analytics';
import type { PageServerLoad } from './$types';

type DailyHistoryEntry = ReturnType<typeof buildDailyHistory>[number];

function buildRiskAnalysis(
	trades: Trade[],
	dailyHistory: DailyHistoryEntry[],
	analytics: AnalyticsResult | null | undefined
) {
	// Drawdown series: compute daily drawdown from cumulative P&L
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

	// Drawdown periods: identify distinct drawdown events
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
				// Recovery: close the current drawdown period
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
	// Close unclosed drawdown period
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

	// Sort by max drawdown descending, take top 10
	const topDrawdowns = [...drawdownPeriods].sort((a, b) => b.maxDrawdown - a.maxDrawdown).slice(0, 10);

	// Average drawdown
	const avgDrawdown = drawdownPeriods.length > 0
		? drawdownPeriods.reduce((s, p) => s + p.maxDrawdown, 0) / drawdownPeriods.length
		: 0;

	// R:R distribution from trades with SL
	const rrBuckets = [
		{ label: '< 0.5', min: 0, max: 0.5 },
		{ label: '0.5 - 1.0', min: 0.5, max: 1.0 },
		{ label: '1.0 - 1.5', min: 1.0, max: 1.5 },
		{ label: '1.5 - 2.0', min: 1.5, max: 2.0 },
		{ label: '2.0 - 3.0', min: 2.0, max: 3.0 },
		{ label: '3.0+', min: 3.0, max: Infinity }
	];

	const rrData: Array<{ label: string; count: number; wins: number; losses: number }> = [];
	let totalRRTrades = 0;

	for (const bucket of rrBuckets) {
		const matching = trades.filter(t => {
			const rr = computeTradeRR(t);
			return rr !== null && rr >= bucket.min && rr < bucket.max;
		});
		const wins = matching.filter(t => Number(t.profit) > 0).length;
		rrData.push({
			label: bucket.label,
			count: matching.length,
			wins,
			losses: matching.length - wins
		});
		totalRRTrades += matching.length;
	}

	// Consecutive loss streaks
	let maxLossStreak = 0;
	let currentStreak = 0;
	const sortedTrades = [...trades].sort((a, b) =>
		new Date(a.close_time).getTime() - new Date(b.close_time).getTime()
	);
	for (const t of sortedTrades) {
		if (Number(t.profit) < 0) {
			currentStreak++;
			if (currentStreak > maxLossStreak) maxLossStreak = currentStreak;
		} else {
			currentStreak = 0;
		}
	}

	// Daily P&L volatility
	const dailyProfits = dailyHistory.map(d => d.profit);
	const dailyMean = dailyProfits.length > 0 ? dailyProfits.reduce((a, b) => a + b, 0) / dailyProfits.length : 0;
	const dailyVariance = dailyProfits.length > 1
		? dailyProfits.reduce((sum, p) => sum + (p - dailyMean) ** 2, 0) / (dailyProfits.length - 1)
		: 0;
	const dailyStdDev = Math.sqrt(dailyVariance);

	// Largest single-trade loss
	const largestLoss = trades.reduce((max, t) => {
		const p = Number(t.profit);
		return p < max ? p : max;
	}, 0);

	// Largest single-trade win
	const largestWin = trades.reduce((max, t) => {
		const p = Number(t.profit);
		return p > max ? p : max;
	}, 0);

	return {
		drawdownSeries,
		topDrawdowns,
		maxDrawdown,
		maxDrawdownDate,
		avgDrawdown,
		rrDistribution: rrData,
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
			? Math.round(drawdownPeriods.reduce((s, p) => s + p.durationDays, 0) / drawdownPeriods.length)
			: 0
	};
}

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

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const parentData = await parent();
	const { account, baseData, tags = [], playbooks = [], savedViews = [] } = parentData;

	if (!account || !locals.profile || !baseData) {
		return {
			filterState: parsePortfolioFilters(url.searchParams),
			filterOptions: { symbols: [], sessions: [], directions: [], durationBuckets: [], playbooks: [] },
			report: null,
			tags: [],
			playbooks: [],
			savedViews: [],
			symbolBreakdown: [],
			calendarDays: [],
			kpiMetrics: null
		};
	}

	const filterState = parsePortfolioFilters(url.searchParams);
	const report = buildReportExplorer(baseData.trades, baseData.dailyStats, baseData.journals, filterState);
	const dailyHistory = buildDailyHistory(report.filteredTrades);
	const symbolBreakdown = buildSymbolBreakdown(report.filteredTrades);
	const tagBreakdown = buildTagBreakdown(report.filteredTrades);
	const dayOfWeekReport = buildDayOfWeekReport(report.filteredTrades);
	const dayTimeHeatmap = buildDayTimeHeatmap(report.filteredTrades);
	const kpiMetrics = buildKpiMetrics(report.filteredTrades, dailyHistory);
	const statsOverview = buildStatsOverview(report.filteredTrades, dailyHistory, report.analytics);
	const riskAnalysis = buildRiskAnalysis(report.filteredTrades, dailyHistory, report.analytics);

	return {
		filterState,
		filterOptions: buildFilterOptions(baseData.trades, playbooks),
		report: {
			...report,
			progressSnapshot: buildProgressSnapshot(
				report.filteredTrades,
				baseData.journals,
				baseData.dailyStats,
				baseData.progressGoals
			)
		},
		tags,
		playbooks,
		savedViews: savedViews.filter((view: any) => view.page === 'analytics'),
		symbolBreakdown,
		tagBreakdown,
		dayOfWeekReport,
		dayTimeHeatmap,
		calendarDays: dailyHistory.map(d => ({ date: d.date, pnl: d.profit, trades: d.totalTrades })),
		kpiMetrics,
		statsOverview,
		healthScore: calculateHealthScore(kpiMetrics),
		riskAnalysis
	};
};
