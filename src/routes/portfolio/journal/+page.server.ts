import { applyPortfolioFilters, parsePortfolioFilters } from '$lib/portfolio';
import {
	buildDailyHistory,
	buildFilterOptions,
	buildJournalCompletionSummary
} from '$lib/server/portfolio';
import { toThaiDateString } from '$lib/utils';
import type { DailyJournal, Trade } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const parentData = await parent();
	const { account, tags = [], playbooks = [] } = parentData;
	const baseData = locals.portfolioBaseData;
	const profile = locals.profile;

	if (!account || !profile || !baseData) {
		return {
			journals: [],
			dailyHistory: [],
			selectedDate: '',
			year: new Date().getFullYear(),
			month: new Date().getMonth() + 1,
			filterState: parsePortfolioFilters(url.searchParams),
			filterOptions: { symbols: [], sessions: [], directions: [], durationBuckets: [], playbooks: [], profitRange: null, lotSizeRange: null, pipsRange: null },
			dayTrades: [],
			previousJournal: null
		};
	}

	const now = new Date();
	const year = parseInt(url.searchParams.get('year') || String(now.getFullYear()));
	const month = parseInt(url.searchParams.get('month') || String(now.getMonth() + 1));
	const selectedDate = url.searchParams.get('date') || '';
	const filterState = parsePortfolioFilters(url.searchParams);

	const filteredTrades = applyPortfolioFilters(baseData.trades, filterState);
	const dailyHistory = buildDailyHistory(filteredTrades);
	const selectedJournal = baseData.journals.find((journal: DailyJournal) => journal.date === selectedDate) || null;
	const dayTrades = filteredTrades.filter((trade: Trade) => {
		return toThaiDateString(trade.close_time) === selectedDate;
	});

	// A3: Find most recent previous journal with market_bias or key_levels (for "copy from yesterday")
	let previousJournal: { date: string; market_bias: string; key_levels: string } | null = null;
	if (selectedDate) {
		const prev = [...baseData.journals]
			.filter((j: DailyJournal) => j.date < selectedDate && (j.market_bias || j.key_levels))
			.sort((a: DailyJournal, b: DailyJournal) => b.date.localeCompare(a.date))[0];
		if (prev) {
			previousJournal = {
				date: prev.date,
				market_bias: prev.market_bias || '',
				key_levels: prev.key_levels || ''
			};
		}
	}

	// Load today's checklist data from Progress system
	let checklistTotalRules = 0;
	let checklistCompletedCount = 0;
	if (selectedDate) {
		const userId = parentData.userId;
		const [rulesRes, completionsRes] = await Promise.all([
			locals.supabase
				.from('checklist_rules')
				.select('id')
				.eq('client_account_id', account.id)
				.eq('user_id', userId)
				.eq('is_active', true),
			locals.supabase
				.from('checklist_completions')
				.select('rule_id, completed')
				.eq('client_account_id', account.id)
				.eq('user_id', userId)
				.eq('date', selectedDate)
		]);
		const rules = rulesRes.data || [];
		const completions = completionsRes.data || [];
		checklistTotalRules = rules.length;
		checklistCompletedCount = rules.filter((r: { id: string }) =>
			completions.some((c: { rule_id: string; completed: boolean }) => c.rule_id === r.id && c.completed)
		).length;
	}

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
		playbooks,
		checklistTotalRules,
		checklistCompletedCount,
		previousJournal
	};
};
