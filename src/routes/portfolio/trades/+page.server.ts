import { applyPortfolioFilters, parsePortfolioFilters } from '$lib/portfolio';
import { buildFilterOptions, fetchPortfolioBaseData } from '$lib/server/portfolio';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const parentData = await parent();
	const { account, tags = [], playbooks = [], savedViews = [] } = parentData;

	if (!account || !locals.profile) {
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
	const { trades } = await fetchPortfolioBaseData(locals.supabase, account.id, locals.profile.id);
	const filteredTrades = applyPortfolioFilters(trades, filters);
	const total = filteredTrades.length;
	const pagedTrades = filteredTrades.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	return {
		trades: pagedTrades,
		total,
		page,
		pageSize: PAGE_SIZE,
		filters,
		filterOptions: buildFilterOptions(trades, playbooks),
		tags,
		playbooks,
		savedViews: savedViews.filter((view: any) => view.page === 'trades')
	};
};
