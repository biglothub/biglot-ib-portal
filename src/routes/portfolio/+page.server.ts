import { getTradeReviewStatus } from '$lib/portfolio';
import { parsePortfolioFilters } from '$lib/portfolio';
import {
	buildDailyHistory,
	buildFilterOptions,
	buildReportExplorer,
	buildReviewSummary
} from '$lib/server/portfolio';
import type { PageServerLoad } from './$types';

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

	const [latestStatsRes, equityRes, openPositionsRes] = await Promise.all([
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
			.order('open_time', { ascending: false })
	]);

	const report = buildReportExplorer(baseData.trades, baseData.dailyStats, baseData.journals, filterState);
	const trades = report.filteredTrades;
	const dailyHistory = buildDailyHistory(trades);
	const reviewSummary = buildReviewSummary(trades);

	// Build command center from already-computed data (avoid duplicate computation)
	const latestDay = dailyHistory[dailyHistory.length - 1] || null;
	const latestStats = baseData.dailyStats[baseData.dailyStats.length - 1] || null;
	const recentCompletedJournal = baseData.journals
		.filter((j: any) => j.completion_status === 'complete')
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
		unreviewedTrades: trades.filter((t: any) => getTradeReviewStatus(t) !== 'reviewed').slice(0, 6),
		activePlaybooks: playbooks.filter((p: any) => p.is_active).length
	};

	const equitySnapshots = (equityRes.data || []).map((snapshot: any) => ({
		time: Math.floor(new Date(snapshot.timestamp).getTime() / 1000),
		balance: snapshot.balance,
		equity: snapshot.equity,
		floatingPL: snapshot.floating_pl || 0
	}));

	return {
		latestStats: latestStatsRes.data || null,
		openPositions: openPositionsRes.data || [],
		recentTrades: trades.slice(0, 8),
		analytics: report.analytics,
		dailyHistory,
		equityCurve: baseData.dailyStats.map((day: any) => day.equity as number),
		equitySnapshots,
		commandCenter,
		filterState,
		filterOptions: buildFilterOptions(baseData.trades, playbooks),
		tags,
		playbooks,
		setupPerformance: report.setupPerformance,
		ruleBreakMetrics: report.ruleBreakMetrics,
		journalSummary: report.journalSummary,
		reviewSummary
	};
};
