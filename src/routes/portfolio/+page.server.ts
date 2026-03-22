import { getTradeReviewStatus } from '$lib/portfolio';
import { parsePortfolioFilters } from '$lib/portfolio';
import {
	buildDailyHistory,
	buildFilterOptions,
	buildKpiMetrics,
	buildReportExplorer,
	buildReviewSummary
} from '$lib/server/portfolio';
import { calculateHealthScore } from '$lib/server/insights/engine';
import type { DailyJournal, DailyStats, Playbook, Trade } from '$lib/types';
import type { PageServerLoad } from './$types';

const TODAY = () => new Date().toISOString().split('T')[0];

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const parentData = await parent();
	const { account, baseData, tags = [], playbooks = [] } = parentData;
	const supabase = locals.supabase;

	if (!account || !locals.profile || !baseData) {
		return {
			latestStats: null,
			openPositions: [],
			recentTrades: [],
			analytics: null,
			dailyHistory: [],
			equityCurve: [],
			equitySnapshots: [],
			commandCenter: null,
			filterState: parsePortfolioFilters(url.searchParams),
			filterOptions: { symbols: [], sessions: [], directions: [], durationBuckets: [], playbooks: [] }
		};
	}

	const filterState = parsePortfolioFilters(url.searchParams);
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const today = TODAY();

	const [latestStatsRes, equityRes, openPositionsRes, checklistRulesRes, checklistCompletionsRes, todayJournalRes] = await Promise.all([
		supabase
			.from('daily_stats')
			.select('*')
			.eq('client_account_id', account.id)
			.order('date', { ascending: false })
			.limit(1)
			.single(),
		supabase
			.from('equity_snapshots')
			.select('timestamp, balance, equity, floating_pl')
			.eq('client_account_id', account.id)
			.gte('timestamp', thirtyDaysAgo.toISOString())
			.order('timestamp', { ascending: true }),
		supabase
			.from('open_positions')
			.select('*')
			.eq('client_account_id', account.id)
			.order('open_time', { ascending: false }),
		supabase
			.from('checklist_rules')
			.select('*')
			.eq('client_account_id', account.id)
			.eq('user_id', parentData.userId)
			.eq('is_active', true)
			.order('sort_order', { ascending: true }),
		supabase
			.from('checklist_completions')
			.select('*')
			.eq('client_account_id', account.id)
			.eq('user_id', parentData.userId)
			.eq('date', today),
		supabase
			.from('trade_journals')
			.select('id, date, completion_status, mood, notes')
			.eq('client_account_id', account.id)
			.eq('user_id', parentData.userId)
			.eq('date', today)
			.maybeSingle()
	]);

	const report = buildReportExplorer(baseData.trades, baseData.dailyStats, baseData.journals, filterState);
	const trades = report.filteredTrades;
	const dailyHistory = buildDailyHistory(trades);
	const reviewSummary = buildReviewSummary(trades);
	const kpiMetrics = buildKpiMetrics(trades, dailyHistory);

	// Build command center from already-computed data (avoid duplicate computation)
	const latestDay = dailyHistory[dailyHistory.length - 1] || null;
	const latestStats = baseData.dailyStats[baseData.dailyStats.length - 1] || null;
	const recentCompletedJournal = baseData.journals
		.filter((j: DailyJournal) => j.completion_status === 'complete')
		.slice(-1)[0] || null;

	const commandCenter = {
		today: {
			date: latestDay?.date || latestStats?.date || null,
			pnl: latestDay?.profit || 0,
			trades: latestDay?.totalTrades || 0,
			reviewedTrades: latestDay?.reviewedTrades || 0,
			completedJournal: recentCompletedJournal?.date === latestDay?.date
		},
		reviewSummary,
		journalSummary: report.journalSummary,
		setupPerformance: report.setupPerformance.slice(0, 4),
		ruleBreakMetrics: report.ruleBreakMetrics,
		unreviewedTrades: trades.filter((t: Trade) => getTradeReviewStatus(t) !== 'reviewed').slice(0, 6),
		activePlaybooks: playbooks.filter((p: Playbook) => p.is_active).length
	};

	type EquitySnapshotRow = { timestamp: string; balance: number; equity: number; floating_pl: number | null };
	const equitySnapshots = (equityRes.data as EquitySnapshotRow[] || []).map((snapshot) => ({
		time: Math.floor(new Date(snapshot.timestamp).getTime() / 1000),
		balance: snapshot.balance,
		equity: snapshot.equity,
		floatingPL: snapshot.floating_pl || 0
	}));

	type ChecklistRuleRow = { id: string };
	type ChecklistCompletionRow = { rule_id: string; completed: boolean };
	const checklistRules = (checklistRulesRes.data as ChecklistRuleRow[]) || [];
	const checklistCompletions = (checklistCompletionsRes.data as ChecklistCompletionRow[]) || [];
	const checklistDoneToday = checklistRules.length > 0 &&
		checklistRules.every((r: ChecklistRuleRow) => checklistCompletions.some((c: ChecklistCompletionRow) => c.rule_id === r.id && c.completed));

	return {
		latestStats: latestStatsRes.data || null,
		openPositions: openPositionsRes.data || [],
		recentTrades: trades.slice(0, 8),
		analytics: report.analytics,
		dailyHistory,
		equityCurve: baseData.dailyStats.map((day: DailyStats) => day.equity),
		equitySnapshots,
		commandCenter,
		filterState,
		filterOptions: buildFilterOptions(baseData.trades, playbooks),
		tags,
		playbooks,
		setupPerformance: report.setupPerformance,
		ruleBreakMetrics: report.ruleBreakMetrics,
		journalSummary: report.journalSummary,
		reviewSummary,
		kpiMetrics,
		healthScore: calculateHealthScore(kpiMetrics),
		checklistRules,
		checklistCompletions,
		checklistDoneToday,
		todayJournal: todayJournalRes.data || null,
		today
	};
};
