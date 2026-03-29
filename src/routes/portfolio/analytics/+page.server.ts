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
import type { Trade, PortfolioSavedView } from '$lib/types';
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

function buildCorrelationMatrix(trades: Trade[]): {
	symbols: string[];
	matrix: (number | null)[][];
	topPairs: Array<{ symA: string; symB: string; correlation: number; sharedDays: number }>;
} {
	const symbolSet = new Set(trades.map(t => t.symbol).filter(Boolean));
	const symbols = [...symbolSet].sort();

	if (symbols.length < 2) {
		return { symbols, matrix: [], topPairs: [] };
	}

	// Build daily P&L per symbol: symbol → { date → pnl }
	const symbolDailyPnl = new Map<string, Map<string, number>>();
	for (const sym of symbols) symbolDailyPnl.set(sym, new Map());

	for (const trade of trades) {
		if (!trade.symbol || !trade.close_time) continue;
		const date = String(trade.close_time).split('T')[0];
		const symMap = symbolDailyPnl.get(trade.symbol);
		if (symMap) symMap.set(date, (symMap.get(date) || 0) + Number(trade.profit));
	}

	function pearson(
		aMap: Map<string, number>,
		bMap: Map<string, number>
	): { r: number | null; sharedDays: number } {
		const sharedDates = [...aMap.keys()].filter(d => bMap.has(d));
		const sharedDays = sharedDates.length;
		if (sharedDays < 3) return { r: null, sharedDays };

		const xs = sharedDates.map(d => aMap.get(d)!);
		const ys = sharedDates.map(d => bMap.get(d)!);
		const n = xs.length;
		const xMean = xs.reduce((s, v) => s + v, 0) / n;
		const yMean = ys.reduce((s, v) => s + v, 0) / n;

		let num = 0, xVar = 0, yVar = 0;
		for (let i = 0; i < n; i++) {
			const dx = xs[i] - xMean;
			const dy = ys[i] - yMean;
			num += dx * dy;
			xVar += dx * dx;
			yVar += dy * dy;
		}

		const denom = Math.sqrt(xVar * yVar);
		if (denom === 0) return { r: null, sharedDays: n };
		return { r: Math.max(-1, Math.min(1, num / denom)), sharedDays: n };
	}

	const n = symbols.length;
	const matrix: (number | null)[][] = Array.from({ length: n }, (_, i) =>
		Array.from({ length: n }, (_, j) => (i === j ? 1 : null))
	);
	const allPairs: Array<{ symA: string; symB: string; correlation: number; sharedDays: number }> = [];

	for (let i = 0; i < n; i++) {
		for (let j = i + 1; j < n; j++) {
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

// ── Analytics computation cache ────────────────────────────────────────
// Caches the expensive analytics results in-process keyed by trades fingerprint + filters.
const analyticsComputeCache = new Map<string, { result: Record<string, unknown>; expiresAt: number }>();
const ANALYTICS_CACHE_TTL_MS = 30_000; // 30s — short enough to reflect new data

function tradesFingerprint(trades: Trade[]): string {
	if (trades.length === 0) return '0';
	return `${trades.length}:${trades[0].id}:${trades[trades.length - 1].id}`;
}

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const parentData = await parent();
	const { account, tags = [], playbooks = [], savedViews = [] } = parentData;
	const baseData = locals.portfolioBaseData;

	if (!account || !locals.profile || !baseData) {
		return {
			filterState: parsePortfolioFilters(url.searchParams),
			filterOptions: { symbols: [], sessions: [], directions: [], durationBuckets: [], playbooks: [], profitRange: null, lotSizeRange: null, pipsRange: null },
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

	// Check computation cache (exclude 'tab' param — it's UI-only, doesn't affect computation)
	const filterParams = new URLSearchParams(url.searchParams);
	filterParams.delete('tab');
	const cacheKey = `${account.id}:${tradesFingerprint(report.filteredTrades)}:${filterParams.toString()}`;
	const cached = analyticsComputeCache.get(cacheKey);
	if (cached && Date.now() < cached.expiresAt) {
		return {
			...cached.result,
			tags,
			playbooks,
			savedViews: savedViews.filter((view: PortfolioSavedView) => view.page === 'analytics'),
			filterOptions: buildFilterOptions(baseData.trades, playbooks)
		};
	}

	const dailyHistory = buildDailyHistory(report.filteredTrades);
	const symbolBreakdown = buildSymbolBreakdown(report.filteredTrades);
	const tagBreakdown = buildTagBreakdown(report.filteredTrades);
	const dayOfWeekReport = buildDayOfWeekReport(report.filteredTrades);
	const dayTimeHeatmap = buildDayTimeHeatmap(report.filteredTrades);
	const kpiMetrics = buildKpiMetrics(report.filteredTrades, dailyHistory);
	const statsOverview = buildStatsOverview(report.filteredTrades, dailyHistory, report.analytics);
	const riskAnalysis = buildRiskAnalysis(report.filteredTrades, dailyHistory, report.analytics);
	const correlationMatrix = buildCorrelationMatrix(report.filteredTrades);
	const healthScore = calculateHealthScore(kpiMetrics);
	const calendarDays = dailyHistory.map(d => ({ date: d.date, pnl: d.profit, trades: d.totalTrades }));
	const progressSnapshot = buildProgressSnapshot(
		report.filteredTrades,
		baseData.journals,
		baseData.dailyStats,
		baseData.progressGoals
	);

	const computedResult = {
		filterState,
		report: { ...report, progressSnapshot },
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

	// Store in cache (evict oldest if too many entries)
	if (analyticsComputeCache.size > 20) {
		const oldest = analyticsComputeCache.keys().next().value;
		if (oldest) analyticsComputeCache.delete(oldest);
	}
	analyticsComputeCache.set(cacheKey, { result: computedResult, expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS });

	return {
		...computedResult,
		filterOptions: buildFilterOptions(baseData.trades, playbooks),
		tags,
		playbooks,
		savedViews: savedViews.filter((view: PortfolioSavedView) => view.page === 'analytics')
	};
};
