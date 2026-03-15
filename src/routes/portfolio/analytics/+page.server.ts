import { parsePortfolioFilters } from '$lib/portfolio';
import {
	buildDailyHistory,
	buildFilterOptions,
	buildKpiMetrics,
	buildProgressSnapshot,
	buildReportExplorer,
	buildSymbolBreakdown
} from '$lib/server/portfolio';
import type { PageServerLoad } from './$types';

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
	const kpiMetrics = buildKpiMetrics(report.filteredTrades, dailyHistory);

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
		calendarDays: dailyHistory.map(d => ({ date: d.date, pnl: d.profit, trades: d.totalTrades })),
		kpiMetrics
	};
};
