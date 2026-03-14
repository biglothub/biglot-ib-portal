import { applyPortfolioFilters, parsePortfolioFilters } from '$lib/portfolio';
import { buildFilterOptions } from '$lib/server/portfolio';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const parentData = await parent();
	const { account, baseData, tags = [], playbooks = [], savedViews = [] } = parentData;

	if (!account || !locals.profile || !baseData) {
		return {
			trades: [],
			total: 0,
			page: 1,
			pageSize: PAGE_SIZE,
			filters: parsePortfolioFilters(url.searchParams),
			filterOptions: { symbols: [], sessions: [], directions: [], durationBuckets: [], playbooks: [] },
			tags: [],
			playbooks: [],
			savedViews: []
		};
	}

	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
	const filters = parsePortfolioFilters(url.searchParams);
	const filteredTrades = applyPortfolioFilters(baseData.trades, filters);
	const total = filteredTrades.length;
	const pagedTrades = filteredTrades.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	return {
		trades: pagedTrades,
		total,
		page,
		pageSize: PAGE_SIZE,
		filters,
		filterOptions: buildFilterOptions(baseData.trades, playbooks),
		tags,
		playbooks,
		savedViews: savedViews.filter((view: any) => view.page === 'trades')
	};
};
