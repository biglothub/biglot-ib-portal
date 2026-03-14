import {
	buildDailyHistory,
	buildJournalCompletionSummary,
	buildProgressSnapshot,
	buildReviewSummary,
	fetchPortfolioBaseData
} from '$lib/server/portfolio';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const parentData = await parent();
	const { account } = parentData;
	const profile = locals.profile;

	if (!account || !profile) {
		return { goals: [], snapshot: [], journalSummary: null, reviewSummary: null };
	}

	const baseData = await fetchPortfolioBaseData(locals.supabase, account.id, profile.id);
	const dailyHistory = buildDailyHistory(baseData.trades);

	return {
		goals: baseData.progressGoals,
		snapshot: buildProgressSnapshot(
			baseData.trades,
			baseData.journals,
			baseData.dailyStats,
			baseData.progressGoals
		),
		journalSummary: buildJournalCompletionSummary(baseData.journals, dailyHistory),
		reviewSummary: buildReviewSummary(baseData.trades)
	};
};
