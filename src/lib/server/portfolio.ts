import { computeAnalytics } from '$lib/analytics';
import {
	applyPortfolioFilters,
	getTradeDurationBucket,
	getTradeDurationMinutes,
	getTradePlaybookId,
	getTradeReview,
	getTradeReviewStatus,
	getTradeSession
} from '$lib/portfolio';
import type {
	DailyJournal,
	DailyStats,
	Playbook,
	PortfolioBaseData,
	PortfolioFilterState,
	ProgressGoal,
	Trade
} from '$lib/types';
import { toThaiDateString } from '$lib/utils';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function fetchPortfolioBaseData(
	supabase: SupabaseClient,
	accountId: string,
	userId: string
): Promise<PortfolioBaseData> {
	const [tradesRes, dailyStatsRes, journalsRes, playbooksRes, savedViewsRes, progressGoalsRes] =
		await Promise.allSettled([
			supabase
				.from('trades')
				.select(
					'*, trade_tag_assignments(id, tag_id, trade_tags(id, name, color, category)), trade_notes(id), trade_reviews(id, review_status, playbook_id, broken_rules, entry_reason, mistake_summary, lesson_summary, followed_plan, playbooks(id, name)), trade_attachments(id)'
				)
				.eq('client_account_id', accountId)
				.order('close_time', { ascending: false }),
			supabase
				.from('daily_stats')
				.select('*')
				.eq('client_account_id', accountId)
				.order('date', { ascending: true }),
			supabase
				.from('daily_journal')
				.select('*')
				.eq('client_account_id', accountId)
				.eq('user_id', userId)
				.order('date', { ascending: true }),
			supabase
				.from('playbooks')
				.select('*, trade_tags(id, name, color, category)')
				.eq('client_account_id', accountId)
				.eq('user_id', userId)
				.order('sort_order', { ascending: true })
				.order('created_at', { ascending: true }),
			supabase
				.from('portfolio_saved_views')
				.select('*')
				.eq('client_account_id', accountId)
				.eq('user_id', userId)
				.order('page', { ascending: true })
				.order('name', { ascending: true }),
			supabase
				.from('progress_goals')
				.select('*')
				.eq('client_account_id', accountId)
				.eq('user_id', userId)
				.eq('is_active', true)
				.order('goal_type', { ascending: true })
		]);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const getData = (result: PromiseSettledResult<{ data: any[] | null }>) =>
		result.status === 'fulfilled' ? result.value.data || [] : [];

	return {
		trades: getData(tradesRes),
		dailyStats: getData(dailyStatsRes),
		journals: getData(journalsRes),
		playbooks: getData(playbooksRes),
		savedViews: getData(savedViewsRes),
		progressGoals: mergeDefaultProgressGoals(getData(progressGoalsRes), accountId, userId)
	};
}

export async function fetchTradeChartContext(supabase: SupabaseClient, tradeId: string) {
	const { data } = await supabase
		.from('trade_chart_context')
		.select('*')
		.eq('trade_id', tradeId)
		.order('timeframe', { ascending: true });

	return data || [];
}

export function buildDailyHistory(trades: Trade[]) {
	if (!trades || trades.length === 0) return [];

	const dailyMap = new Map<string, { profit: number; trades: number[]; reviewed: number }>();

	for (const trade of trades) {
		const dateKey = toThaiDateString(trade.close_time);
		const reviewStatus = getTradeReviewStatus(trade);

		if (!dailyMap.has(dateKey)) {
			dailyMap.set(dateKey, { profit: 0, trades: [], reviewed: 0 });
		}
		const day = dailyMap.get(dateKey)!;
		day.profit += Number(trade.profit || 0);
		day.trades.push(Number(trade.profit || 0));
		if (reviewStatus === 'reviewed') day.reviewed += 1;
	}

	return Array.from(dailyMap.entries())
		.map(([date, data]) => {
			const wins = data.trades.filter((p) => p > 0);
			const losses = data.trades.filter((p) => p < 0);
			return {
				date,
				profit: data.profit,
				totalTrades: data.trades.length,
				reviewedTrades: data.reviewed,
				winRate: data.trades.length > 0 ? (wins.length / data.trades.length) * 100 : 0,
				bestTrade: wins.length > 0 ? Math.max(...wins) : 0,
				worstTrade: losses.length > 0 ? Math.min(...losses) : 0
			};
		})
		.sort((a, b) => a.date.localeCompare(b.date));
}

export function buildSetupPerformance(trades: Trade[]) {
	const buckets: Map<string, { name: string; trades: Trade[]; playbookId: string | null }> = new Map();

	for (const trade of trades) {
		const review = getTradeReview(trade);
		const playbookId = review?.playbook_id || null;
		const playbookName = review?.playbooks?.name || null;
		const setupTags = (trade.trade_tag_assignments || [])
			.filter((assignment) => assignment.trade_tags?.category === 'setup')
			.map((assignment) => assignment.trade_tags?.name)
			.filter(Boolean);

		const key = playbookId || setupTags[0] || '_none';
		const name = playbookName || setupTags[0] || 'ไม่มี Setup';
		const bucket = buckets.get(key) || { name, trades: [] as Trade[], playbookId };
		bucket.trades.push(trade);
		buckets.set(key, bucket);
	}

	return Array.from(buckets.values())
		.map((bucket) => {
			const totalProfit = bucket.trades.reduce((sum, trade) => sum + Number(trade.profit || 0), 0);
			const wins = bucket.trades.filter((trade) => Number(trade.profit || 0) > 0);
			const losses = bucket.trades.filter((trade) => Number(trade.profit || 0) < 0);
			const grossWin = wins.reduce((sum, trade) => sum + Number(trade.profit || 0), 0);
			const grossLoss = losses.reduce((sum, trade) => sum + Math.abs(Number(trade.profit || 0)), 0);
			return {
				name: bucket.name,
				playbookId: bucket.playbookId,
				totalTrades: bucket.trades.length,
				totalProfit,
				winRate: bucket.trades.length > 0 ? (wins.length / bucket.trades.length) * 100 : 0,
				expectancy: bucket.trades.length > 0 ? totalProfit / bucket.trades.length : 0,
				profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
				reviewedTrades: bucket.trades.filter((trade) => getTradeReviewStatus(trade) === 'reviewed').length
			};
		})
		.sort((a, b) => b.totalProfit - a.totalProfit);
}

export function buildRuleBreakMetrics(trades: Trade[]) {
	const brokenRuleMap = new Map<string, { count: number; loss: number; wins: number }>();
	let totalRuleBreaks = 0;
	let ruleBreakLoss = 0;

	for (const trade of trades) {
		const review = getTradeReview(trade);
		const rules: string[] = review?.broken_rules || [];
		if (rules.length === 0) continue;

		totalRuleBreaks += rules.length;
		if (Number(trade.profit || 0) < 0) ruleBreakLoss += Math.abs(Number(trade.profit || 0));

		for (const rule of rules) {
			const current = brokenRuleMap.get(rule) || { count: 0, loss: 0, wins: 0 };
			current.count += 1;
			if (Number(trade.profit || 0) < 0) current.loss += Math.abs(Number(trade.profit || 0));
			if (Number(trade.profit || 0) > 0) current.wins += 1;
			brokenRuleMap.set(rule, current);
		}
	}

	return {
		totalRuleBreaks,
		ruleBreakLoss,
		topRules: Array.from(brokenRuleMap.entries())
			.map(([rule, stats]) => ({ rule, ...stats }))
			.sort((a, b) => b.count - a.count || b.loss - a.loss)
			.slice(0, 5)
	};
}

export function buildJournalCompletionSummary(journals: DailyJournal[], dailyHistory: { date: string }[]) {
	const completed = journals.filter((journal) => journal.completion_status === 'complete');
	const activeDates = new Set(dailyHistory.map((day) => day.date));
	const daysWithJournal = journals.filter((journal) => activeDates.has(journal.date));

	return {
		totalEntries: journals.length,
		completedEntries: completed.length,
		activeTradingDays: activeDates.size,
		completionRate: activeDates.size > 0 ? (daysWithJournal.length / activeDates.size) * 100 : 0,
		currentStreak: calculateJournalStreak(completed),
		lastCompletedDate: completed[completed.length - 1]?.date || null
	};
}

export function buildReviewSummary(trades: Trade[]) {
	const reviewed = trades.filter((trade) => getTradeReviewStatus(trade) === 'reviewed').length;
	const inProgress = trades.filter((trade) => getTradeReviewStatus(trade) === 'in_progress').length;
	const unreviewed = trades.length - reviewed - inProgress;

	return {
		total: trades.length,
		reviewed,
		inProgress,
		unreviewed,
		reviewRate: trades.length > 0 ? (reviewed / trades.length) * 100 : 0
	};
}

export function buildProgressSnapshot(
	trades: Trade[],
	journals: DailyJournal[],
	dailyStats: DailyStats[],
	goals: ProgressGoal[]
) {
	const reviewSummary = buildReviewSummary(trades);
	const dailyHistory = buildDailyHistory(trades);
	const journalSummary = buildJournalCompletionSummary(journals, dailyHistory);
	const latestStats = dailyStats[dailyStats.length - 1] || null;
	const ruleMetrics = buildRuleBreakMetrics(trades);

	const metrics: Record<string, number> = {
		review_completion: reviewSummary.reviewRate,
		journal_streak: journalSummary.currentStreak,
		max_rule_breaks: ruleMetrics.totalRuleBreaks,
		profit_factor: Number(latestStats?.profit_factor || 0),
		win_rate: Number(latestStats?.win_rate || 0)
	};

	return goals.map((goal) => {
		const currentValue = metrics[goal.goal_type] ?? 0;
		const progress =
			goal.goal_type === 'max_rule_breaks'
				? goal.target_value <= 0
					? 100
					: Math.max(0, Math.min(100, (goal.target_value - currentValue) / goal.target_value * 100))
				: goal.target_value <= 0
					? 0
					: Math.max(0, Math.min(100, currentValue / goal.target_value * 100));

		return {
			...goal,
			currentValue,
			progress
		};
	});
}

export function buildReportExplorer(
	trades: Trade[],
	dailyStats: DailyStats[],
	journals: DailyJournal[],
	filters: PortfolioFilterState
) {
	const filteredTrades = applyPortfolioFilters(trades, filters);
	const filteredDailyStats = dailyStats.filter((day) => {
		if (filters.from && day.date < filters.from) return false;
		if (filters.to && day.date > filters.to) return false;
		return true;
	});
	const latestStats = filteredDailyStats[filteredDailyStats.length - 1] || dailyStats[dailyStats.length - 1] || null;
	const tradesForAnalytics = filteredTrades
		.slice()
		.reverse()
		.map((trade) => ({
			closeTime: trade.close_time,
			openTime: trade.open_time,
			profit: Number(trade.profit || 0),
			lot: Number(trade.lot_size || 0)
		}));
	const analytics = filteredDailyStats.length > 1 || tradesForAnalytics.length > 0
		? computeAnalytics(
				filteredDailyStats.map((day) => ({
					date: day.date,
					balance: Number(day.balance || day.equity || 0),
					profit: Number(day.profit || 0)
				})),
				tradesForAnalytics,
				Number(latestStats?.profit || 0),
				Number(latestStats?.max_drawdown || 0)
			)
		: null;

	const setupPerformance = buildSetupPerformance(filteredTrades);
	const ruleBreakMetrics = buildRuleBreakMetrics(filteredTrades);
	const journalSummary = buildJournalCompletionSummary(journals, buildDailyHistory(filteredTrades));
	const expectancy =
		filteredTrades.length > 0
			? filteredTrades.reduce((sum, trade) => sum + Number(trade.profit || 0), 0) / filteredTrades.length
			: 0;

	return {
		filteredTrades,
		analytics,
		setupPerformance,
		ruleBreakMetrics,
		journalSummary,
		expectancy,
		durationBuckets: buildDurationBucketStats(filteredTrades),
		sessionStats: buildSessionStats(filteredTrades),
		mistakeStats: buildMistakeStats(filteredTrades)
	};
}

export function buildCommandCenterData(
	trades: Trade[],
	dailyStats: DailyStats[],
	journals: DailyJournal[],
	playbooks: Playbook[]
) {
	const dailyHistory = buildDailyHistory(trades);
	const reviewSummary = buildReviewSummary(trades);
	const journalSummary = buildJournalCompletionSummary(journals, dailyHistory);
	const setupPerformance = buildSetupPerformance(trades).slice(0, 4);
	const ruleBreakMetrics = buildRuleBreakMetrics(trades);
	const latestStats = dailyStats[dailyStats.length - 1] || null;
	const latestDay = dailyHistory[dailyHistory.length - 1] || null;
	const unreviewedTrades = trades.filter((trade) => getTradeReviewStatus(trade) !== 'reviewed').slice(0, 6);
	const recentCompletedJournal = journals
		.filter((journal) => journal.completion_status === 'complete')
		.slice(-1)[0] || null;

	return {
		today: {
			date: latestDay?.date || latestStats?.date || null,
			pnl: latestDay?.profit || 0,
			trades: latestDay?.totalTrades || 0,
			reviewedTrades: latestDay?.reviewedTrades || 0,
			completedJournal: recentCompletedJournal?.date === latestDay?.date
		},
		reviewSummary,
		journalSummary,
		setupPerformance,
		ruleBreakMetrics,
		unreviewedTrades,
		activePlaybooks: playbooks.filter((playbook) => playbook.is_active).length
	};
}

export function buildFilterOptions(trades: Trade[], playbooks: Playbook[]) {
	return {
		symbols: [...new Set(trades.map((trade) => trade.symbol).filter(Boolean))].sort(),
		sessions: ['asian', 'london', 'newyork'],
		directions: ['BUY', 'SELL'],
		durationBuckets: [
			{ value: 'scalp', label: 'Scalp (<15m)' },
			{ value: 'intraday', label: 'Intraday (<1d)' },
			{ value: 'swing', label: 'Swing (<3d)' },
			{ value: 'position', label: 'Position (3d+)' }
		],
		playbooks: playbooks.map((playbook) => ({ id: playbook.id, name: playbook.name }))
	};
}

function calculateJournalStreak(journals: DailyJournal[]) {
	if (journals.length === 0) return 0;

	const completeDates = journals
		.filter((journal) => journal.completion_status === 'complete')
		.map((journal) => journal.date)
		.sort();
	if (completeDates.length === 0) return 0;

	let streak = 1;
	for (let i = completeDates.length - 1; i > 0; i--) {
		const current = new Date(`${completeDates[i]}T00:00:00`);
		const previous = new Date(`${completeDates[i - 1]}T00:00:00`);
		const diffDays = Math.round((current.getTime() - previous.getTime()) / 86400000);
		if (diffDays === 1) streak += 1;
		else break;
	}
	return streak;
}

function mergeDefaultProgressGoals(goals: ProgressGoal[], accountId: string, userId: string) {
	const defaults: Omit<ProgressGoal, 'id' | 'created_at' | 'updated_at'>[] = [
		{ user_id: userId, client_account_id: accountId, goal_type: 'review_completion', target_value: 90, period_days: 30, is_active: true },
		{ user_id: userId, client_account_id: accountId, goal_type: 'journal_streak', target_value: 5, period_days: 30, is_active: true },
		{ user_id: userId, client_account_id: accountId, goal_type: 'max_rule_breaks', target_value: 3, period_days: 30, is_active: true },
		{ user_id: userId, client_account_id: accountId, goal_type: 'profit_factor', target_value: 1.5, period_days: 30, is_active: true },
		{ user_id: userId, client_account_id: accountId, goal_type: 'win_rate', target_value: 55, period_days: 30, is_active: true }
	];

	return defaults.map((goal) => {
		const existing = goals.find((item) => item.goal_type === goal.goal_type);
		return (
			existing || {
				...goal,
				id: `default-${goal.goal_type}`,
				created_at: '',
				updated_at: ''
			}
		);
	});
}

function buildDurationBucketStats(trades: Trade[]) {
	const buckets = new Map<string, { count: number; profit: number }>();
	for (const trade of trades) {
		const bucket = getTradeDurationBucket(trade.open_time, trade.close_time) || 'intraday';
		const current = buckets.get(bucket) || { count: 0, profit: 0 };
		current.count += 1;
		current.profit += Number(trade.profit || 0);
		buckets.set(bucket, current);
	}

	return Array.from(buckets.entries()).map(([bucket, stats]) => ({
		bucket,
		...stats,
		avgMinutes:
			stats.count > 0
				? Math.round(
						trades
							.filter((trade) => getTradeDurationBucket(trade.open_time, trade.close_time) === bucket)
							.reduce((sum, trade) => sum + getTradeDurationMinutes(trade.open_time, trade.close_time), 0) / stats.count
					)
				: 0
	}));
}

function buildSessionStats(trades: Trade[]) {
	const sessions = new Map<string, { trades: number; profit: number; wins: number }>();
	for (const trade of trades) {
		const session = getTradeSession(trade.close_time);
		const current = sessions.get(session) || { trades: 0, profit: 0, wins: 0 };
		current.trades += 1;
		current.profit += Number(trade.profit || 0);
		if (Number(trade.profit || 0) > 0) current.wins += 1;
		sessions.set(session, current);
	}

	return Array.from(sessions.entries()).map(([session, stats]) => ({
		session,
		...stats,
		winRate: stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0
	}));
}

function buildMistakeStats(trades: Trade[]) {
	const mistakes = new Map<string, { count: number; cost: number }>();
	for (const trade of trades) {
		const mistakeTags = (trade.trade_tag_assignments || []).filter(
			(assignment) => assignment.trade_tags?.category === 'mistake'
		);
		for (const assignment of mistakeTags) {
			const key = assignment.trade_tags?.name || 'Mistake';
			const current = mistakes.get(key) || { count: 0, cost: 0 };
			current.count += 1;
			if (Number(trade.profit || 0) < 0) current.cost += Math.abs(Number(trade.profit || 0));
			mistakes.set(key, current);
		}
	}

	return Array.from(mistakes.entries())
		.map(([name, stats]) => ({ name, ...stats }))
		.sort((a, b) => b.count - a.count || b.cost - a.cost);
}
