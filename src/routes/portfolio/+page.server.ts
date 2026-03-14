import { parsePortfolioFilters } from '$lib/portfolio';
import {
	buildCommandCenterData,
	buildDailyHistory,
	buildFilterOptions,
	buildReportExplorer,
	fetchPortfolioBaseData
} from '$lib/server/portfolio';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const parentData = await parent();
	const { account, tags = [], playbooks = [] } = parentData;
	const supabase = locals.supabase;

	if (!account || !locals.profile) {
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

	const [latestStatsRes, equityRes, openPositionsRes, baseData] = await Promise.all([
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
		fetchPortfolioBaseData(supabase, account.id, locals.profile.id)
	]);

	const report = buildReportExplorer(baseData.trades, baseData.dailyStats, baseData.journals, filterState);
	const trades = report.filteredTrades;
	const dailyHistory = buildDailyHistory(trades);
	const commandCenter = buildCommandCenterData(trades, baseData.dailyStats, baseData.journals, playbooks);

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
		reviewSummary: commandCenter.reviewSummary
	};
};
