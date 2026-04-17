import { parsePortfolioFilters } from '$lib/portfolio';
import { buildFilterOptions, buildReportExplorer } from '$lib/server/portfolio';
import { buildAnalyticsViewData } from '$lib/server/analytics-export';
import type { PortfolioSavedView, Trade } from '$lib/types';
import type { PageServerLoad } from './$types';

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

	const computedResult = buildAnalyticsViewData(baseData, filterState, report);

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
