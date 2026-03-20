import {
	buildDailyHistory,
	buildJournalCompletionSummary,
	buildProgressSnapshot,
	buildReviewSummary
} from '$lib/server/portfolio';
import { calculateChecklistStreak, buildChecklistHeatmap } from '$lib/server/checklist';
import { buildRulesAnalytics } from '$lib/server/rules-analytics';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const parentData = await parent();
	const { account, baseData, userId } = parentData;
	const profile = locals.profile;

	if (!account || !profile || !baseData || !userId) {
		return {
			goals: [], snapshot: [], journalSummary: null, reviewSummary: null,
			checklistRules: [], checklistCompletions: [], checklistStreak: 0, heatmapData: []
		};
	}

	const dailyHistory = buildDailyHistory(baseData.trades);

	// Load checklist data
	const [rulesRes, completionsRes] = await Promise.all([
		locals.supabase
			.from('checklist_rules')
			.select('*')
			.eq('client_account_id', account.id)
			.eq('user_id', userId)
			.eq('is_active', true)
			.order('sort_order', { ascending: true }),
		locals.supabase
			.from('checklist_completions')
			.select('*')
			.eq('client_account_id', account.id)
			.eq('user_id', userId)
			.order('date', { ascending: false })
			.limit(700) // ~12 weeks × ~8 rules
	]);

	const checklistRules = rulesRes.data || [];
	const checklistCompletions = completionsRes.data || [];
	const checklistStreak = calculateChecklistStreak(checklistCompletions, checklistRules);
	const heatmapData = buildChecklistHeatmap(checklistCompletions, checklistRules, 12);
	const rulesAnalytics = buildRulesAnalytics(checklistRules, checklistCompletions, dailyHistory);

	return {
		goals: baseData.progressGoals,
		snapshot: buildProgressSnapshot(
			baseData.trades,
			baseData.journals,
			baseData.dailyStats,
			baseData.progressGoals
		),
		journalSummary: buildJournalCompletionSummary(baseData.journals, dailyHistory),
		reviewSummary: buildReviewSummary(baseData.trades),
		checklistRules,
		checklistCompletions,
		checklistStreak,
		heatmapData,
		rulesAnalytics
	};
};
