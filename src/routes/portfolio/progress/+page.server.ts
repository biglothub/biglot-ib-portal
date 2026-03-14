import {
	buildDailyHistory,
	buildJournalCompletionSummary,
	buildProgressSnapshot,
	buildReviewSummary
} from '$lib/server/portfolio';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const parentData = await parent();
	const { account, baseData } = parentData;
	const profile = locals.profile;

	if (!account || !profile || !baseData) {
		return { goals: [], snapshot: [], journalSummary: null, reviewSummary: null };
	}

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
