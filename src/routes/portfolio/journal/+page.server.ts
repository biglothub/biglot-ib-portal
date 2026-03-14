import { applyPortfolioFilters, parsePortfolioFilters } from '$lib/portfolio';
import {
	buildDailyHistory,
	buildFilterOptions,
	buildJournalCompletionSummary,
	fetchPortfolioBaseData
} from '$lib/server/portfolio';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const parentData = await parent();
	const { account, tags = [], playbooks = [] } = parentData;
	const profile = locals.profile;

	if (!account || !profile) {
		return {
			journals: [],
			dailyHistory: [],
			selectedDate: '',
			year: new Date().getFullYear(),
			month: new Date().getMonth() + 1,
			filterState: parsePortfolioFilters(url.searchParams),
			filterOptions: { symbols: [], sessions: [], directions: [], durationBuckets: [], playbooks: [] },
			dayTrades: []
		};
	}

	const now = new Date();
	const year = parseInt(url.searchParams.get('year') || String(now.getFullYear()));
	const month = parseInt(url.searchParams.get('month') || String(now.getMonth() + 1));
	const selectedDate = url.searchParams.get('date') || '';
	const filterState = parsePortfolioFilters(url.searchParams);

	const baseData = await fetchPortfolioBaseData(locals.supabase, account.id, profile.id);
	const filteredTrades = applyPortfolioFilters(baseData.trades, filterState);
	const dailyHistory = buildDailyHistory(filteredTrades);
	const selectedJournal = baseData.journals.find((journal: any) => journal.date === selectedDate) || null;
	const dayTrades = filteredTrades.filter((trade: any) => {
		const localDate = new Date(new Date(trade.close_time).getTime() + 7 * 60 * 60 * 1000)
			.toISOString()
			.split('T')[0];
		return localDate === selectedDate;
	});

	return {
		journals: baseData.journals,
		dailyHistory,
		selectedDate,
		selectedJournal,
		year,
		month,
		filterState,
		filterOptions: buildFilterOptions(baseData.trades, playbooks),
		journalSummary: buildJournalCompletionSummary(baseData.journals, dailyHistory),
		dayTrades,
		tags,
		playbooks
	};
};
