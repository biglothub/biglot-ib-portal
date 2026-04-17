import { getTradeReviewStatus, getTradeSession } from '$lib/portfolio';
import { parsePortfolioFilters } from '$lib/portfolio';
import { toThaiDateString } from '$lib/utils';
import {
	buildDailyHistory,
	buildDrawdownHistory,
	buildIntradayDrawdown,
	buildFilterOptions,
	buildKpiMetrics,
	buildReportExplorer,
	buildReviewSummary,
	buildRiskOfRuin,
	buildStreakMetrics,
	buildBestWorstTrades,
	buildMonthlyPnlGoalProgress
} from '$lib/server/portfolio';
import { calculateHealthScore, evaluateDayInsights } from '$lib/server/insights/engine';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import type { DailyJournal, DailyStats, Playbook, Trade } from '$lib/types';
import type { PageServerLoad } from './$types';

const THAILAND_OFFSET_MS = 7 * 3600000;
const TODAY = () => new Date(Date.now() + THAILAND_OFFSET_MS).toISOString().split('T')[0];

export const load: PageServerLoad = async ({ parent, locals, url, depends }) => {
	depends('portfolio:baseData');

	const parentData = await parent();
	const { account, tags = [], playbooks = [], isAdminView } = parentData;
	const baseData = locals.portfolioBaseData;
	const supabase = isAdminView ? createSupabaseServiceClient() : locals.supabase;

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
			filterOptions: { symbols: [], sessions: [], directions: [], durationBuckets: [], playbooks: [], profitRange: null, lotSizeRange: null, pipsRange: null },
			todayInsights: [],
			todaySummary: null,
			sessionBreakdown: [],
			showWeeklyNudge: false,
			riskOfRuin: null,
			streaks: null,
			bestWorst: { best: null, worst: null },
			monthlyGoal: null
		};
	}

	const filterState = parsePortfolioFilters(url.searchParams);
	const oneYearAgo = new Date();
	oneYearAgo.setDate(oneYearAgo.getDate() - 365);

	const today = TODAY();

	const [equityRes, openPositionsRes, checklistRulesRes, checklistCompletionsRes] = await Promise.all([
		supabase
			.from('equity_snapshots')
			.select('timestamp, balance, equity, floating_pl')
			.eq('client_account_id', account.id)
			.gte('timestamp', oneYearAgo.toISOString())
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

	// Derive starting balance from earliest daily_stats
	const firstStat = baseData.dailyStats[0];
	const startingBalance = firstStat ? Number(firstStat.balance || 0) - Number(firstStat.profit || 0) : 0;

	const drawdownHistory = buildDrawdownHistory(dailyHistory, startingBalance);
	const reviewSummary = buildReviewSummary(trades);
	const kpiMetrics = buildKpiMetrics(trades, dailyHistory, startingBalance);
	const latestBalance = Number(baseData.dailyStats[baseData.dailyStats.length - 1]?.balance || startingBalance || 0);
	const riskOfRuin = buildRiskOfRuin(kpiMetrics, latestBalance);
	const streaks = buildStreakMetrics(trades, dailyHistory);
	const bestWorst = buildBestWorstTrades(trades);
	const monthlyGoal = buildMonthlyPnlGoalProgress(trades, baseData.progressGoals);
	const todayJournal = baseData.journals.find((journal: DailyJournal) => journal.date === today) || null;

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

	// D1+D2: Today's insights + session breakdown
	const todayTrades = trades.filter((t: Trade) => toThaiDateString(t.close_time) === today);
	const todayInsights = todayTrades.length > 0
		? evaluateDayInsights(todayTrades, baseData.trades)
		: [];
	const todaySummary = todayTrades.length > 0 ? {
		totalTrades: todayTrades.length,
		totalPnl: todayTrades.reduce((s: number, t: Trade) => s + (Number(t.profit) || 0), 0),
		wins: todayTrades.filter((t: Trade) => (Number(t.profit) || 0) > 0).length,
		winRate: (todayTrades.filter((t: Trade) => (Number(t.profit) || 0) > 0).length / todayTrades.length) * 100
	} : null;

	const sessionBreakdown = (['asian', 'london', 'newyork'] as const).map((sessionKey) => {
		const sessionTrades = todayTrades.filter((t: Trade) => getTradeSession(t.close_time) === sessionKey);
		const pnl = sessionTrades.reduce((s: number, t: Trade) => s + (Number(t.profit) || 0), 0);
		const wins = sessionTrades.filter((t: Trade) => (Number(t.profit) || 0) > 0).length;
		return {
			session: sessionKey,
			trades: sessionTrades.length,
			pnl,
			winRate: sessionTrades.length > 0 ? (wins / sessionTrades.length) * 100 : 0
		};
	});

	// D3: Weekly recap nudge (Fri/Sat/Sun, when last week's recap isn't generated yet)
	const thaiNow = new Date(Date.now() + THAILAND_OFFSET_MS);
	const dayOfWeek = thaiNow.getUTCDay(); // 0=Sun, 5=Fri, 6=Sat
	const isWeekReflectionTime = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
	let showWeeklyNudge = false;
	if (isWeekReflectionTime && account && baseData.trades.length > 0) {
		// Last week = previous Sunday through Saturday
		const lastWeekStart = new Date(thaiNow);
		lastWeekStart.setUTCDate(thaiNow.getUTCDate() - dayOfWeek - 7);
		const lastWeekStartStr = lastWeekStart.toISOString().split('T')[0];
		const { data: existingRecap } = await supabase
			.from('trading_recaps')
			.select('id')
			.eq('client_account_id', account.id)
			.eq('user_id', locals.profile.id)
			.eq('period_type', 'week')
			.eq('period_start', lastWeekStartStr)
			.maybeSingle();
		showWeeklyNudge = !existingRecap;
	}

	type EquitySnapshotRow = { timestamp: string; balance: number; equity: number; floating_pl: number | null };
	const equitySnapshots = (equityRes.data as EquitySnapshotRow[] || []).map((snapshot) => ({
		time: Math.floor(new Date(snapshot.timestamp).getTime() / 1000),
		balance: snapshot.balance,
		equity: snapshot.equity,
		floatingPL: snapshot.floating_pl || 0
	}));

	const intradayDrawdown = buildIntradayDrawdown(equitySnapshots, startingBalance);

	type ChecklistRuleRow = { id: string };
	type ChecklistCompletionRow = { rule_id: string; completed: boolean };
	const checklistRules = (checklistRulesRes.data as ChecklistRuleRow[]) || [];
	const checklistCompletions = (checklistCompletionsRes.data as ChecklistCompletionRow[]) || [];
	const checklistDoneToday = checklistRules.length > 0 &&
		checklistRules.every((r: ChecklistRuleRow) => checklistCompletions.some((c: ChecklistCompletionRow) => c.rule_id === r.id && c.completed));

	return {
		latestStats: baseData.dailyStats[baseData.dailyStats.length - 1] || null,
		openPositions: openPositionsRes.data || [],
		recentTrades: trades.slice(0, 8),
		allFilteredTrades: trades.slice(0, 2000),
		analytics: report.analytics,
		dailyHistory,
		drawdownHistory,
		equityCurve: baseData.dailyStats.map((day: DailyStats) => day.equity),
		equitySnapshots,
		intradayDrawdown,
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
		todayJournal,
		today,
		todayInsights,
		todaySummary,
		sessionBreakdown,
		showWeeklyNudge,
		riskOfRuin,
		streaks,
		bestWorst,
		monthlyGoal
	};
};
