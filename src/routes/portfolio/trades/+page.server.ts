import { applyPortfolioFilters, parsePortfolioFilters } from '$lib/portfolio';
import { buildFilterOptions, buildDailyHistory, buildKpiMetrics } from '$lib/server/portfolio';
import { evaluateInsightsForSubset, calculateQualityScoresForSubset, calculateAllExecutionMetrics } from '$lib/server/insights/engine';
import type { PortfolioSavedView } from '$lib/types';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 25;

// Contract size by instrument type (matches Tradezella's contract_multiplier)
function getContractSize(symbol: string): number {
	const s = symbol.replace(/\.(S|raw|std|pro|micro)$/i, '').toUpperCase();
	if (s === 'XAUUSD' || s === 'GOLD') return 100;
	if (s === 'XAGUSD' || s === 'SILVER') return 5000;
	if (s.includes('XAU') || s.includes('XAG')) return 100;
	return 100000; // Standard forex
}

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const parentData = await parent();
	const { account, tags = [], playbooks = [], savedViews = [] } = parentData;
	const baseData = locals.portfolioBaseData;

	if (!account || !locals.profile || !baseData) {
		return {
			trades: [],
			total: 0,
			page: 1,
			pageSize: PAGE_SIZE,
			filters: parsePortfolioFilters(url.searchParams),
			filterOptions: { symbols: [], sessions: [], directions: [], durationBuckets: [], playbooks: [], profitRange: null, lotSizeRange: null, pipsRange: null },
			tags: [],
			playbooks: [],
			savedViews: [],
			tradeInsights: {},
			tradeScores: {}
		};
	}

	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
	const filters = parsePortfolioFilters(url.searchParams);
	const filteredTrades = applyPortfolioFilters(baseData.trades, filters);
	const total = filteredTrades.length;
	const pagedTrades = filteredTrades.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	// KPI metrics for filtered trades (header cards)
	const dailyHistory = buildDailyHistory(filteredTrades);
	const kpiMetrics = buildKpiMetrics(filteredTrades, dailyHistory);

	// Build context from all filtered trades, but only evaluate rules for the paged subset
	// Execution metrics are per-trade (no context needed) — compute only for paged trades
	const allInsightsMap = evaluateInsightsForSubset(filteredTrades, pagedTrades);
	const allScoresMap = calculateQualityScoresForSubset(filteredTrades, pagedTrades);
	const allMetricsMap = calculateAllExecutionMetrics(pagedTrades);

	// Convert maps to plain objects for serialization (only for paged trades)
	const tradeInsights: Record<string, any[]> = {};
	const tradeScores: Record<string, number> = {};
	const tradeExecutionMetrics: Record<string, any> = {};
	for (const trade of pagedTrades) {
		const insights = allInsightsMap.get(trade.id);
		if (insights) tradeInsights[trade.id] = insights;
		const score = allScoresMap.get(trade.id);
		if (score !== undefined) tradeScores[trade.id] = score;
		const metrics = allMetricsMap.get(trade.id);
		if (metrics) tradeExecutionMetrics[trade.id] = {
			...metrics,
			netRoi: (trade.open_price && trade.lot_size)
				? (Number(trade.profit) / (Number(trade.open_price) * Number(trade.lot_size) * getContractSize(String(trade.symbol)))) * 100
				: null
		};
	}

	return {
		trades: pagedTrades,
		total,
		page,
		pageSize: PAGE_SIZE,
		filters,
		filterOptions: buildFilterOptions(baseData.trades, playbooks),
		tags,
		playbooks,
		savedViews: savedViews.filter((view: PortfolioSavedView) => view.page === 'trades'),
		tradeInsights,
		tradeScores,
		tradeExecutionMetrics,
		kpiMetrics
	};
};
