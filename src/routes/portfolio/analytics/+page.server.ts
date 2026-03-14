import { parsePortfolioFilters } from '$lib/portfolio';
import {
	buildFilterOptions,
	buildProgressSnapshot,
	buildReportExplorer
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
			savedViews: []
		};
	}

	const filterState = parsePortfolioFilters(url.searchParams);
	const report = buildReportExplorer(baseData.trades, baseData.dailyStats, baseData.journals, filterState);

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
		savedViews: savedViews.filter((view: any) => view.page === 'analytics')
	};
};
