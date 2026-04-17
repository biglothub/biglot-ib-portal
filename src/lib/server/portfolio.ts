import { dev } from '$app/environment';
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
import { getCache, setCache, invalidateCache, invalidateCachePattern } from '$lib/server/cache';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import type {
	DailyJournal,
	DailyStats,
	Playbook,
	PortfolioBaseData,
	PortfolioFilterState,
	PortfolioSavedView,
	ProgressGoal,
	Trade
} from '$lib/types';
import { THAILAND_OFFSET_MS, toThaiDateString } from '$lib/utils';
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_RATIO = 999;

/** Cap profit factor / ratio to avoid Infinity in JSON serialization */
function capRatio(numerator: number, denominator: number): number {
	if (denominator > 0) return Math.min(numerator / denominator, MAX_RATIO);
	return numerator > 0 ? MAX_RATIO : 0;
}

// ── Process-level base data cache ───────────────────────────────────────
// Caches the full PortfolioBaseData result in-process (no serialization).
// This avoids re-querying Supabase on every SvelteKit server-side navigation.
const baseDataCache = new Map<string, { data: PortfolioBaseData; expiresAt: number }>();
const BASE_DATA_TTL_MS = 60_000; // 1 minute — short enough to stay fresh

// Stampede protection: deduplicate concurrent fetches for the same cache key
const pendingFetches = new Map<string, Promise<PortfolioBaseData>>();

/** Invalidate ALL cached data for an account (trades, journals, playbooks, etc.) */
export function invalidateBaseDataCache(accountId: string): void {
	for (const key of [...baseDataCache.keys()]) {
		if (key.startsWith(accountId)) baseDataCache.delete(key);
	}
	// Also clear all Redis/memory caches for this account
	void invalidateCachePattern(`portfolio:trades:${accountId}`);
	void invalidateCachePattern(`portfolio:daily_stats:${accountId}`);
	void invalidateCachePattern(`portfolio:journals:${accountId}`);
	void invalidateCachePattern(`portfolio:playbooks:${accountId}`);
}

/** Invalidate only trades-related cache (for tag/review/manual trade mutations) */
export function invalidateTradesCache(accountId: string): void {
	for (const key of [...baseDataCache.keys()]) {
		if (key.startsWith(accountId)) baseDataCache.delete(key);
	}
	void invalidateCache(`portfolio:trades:${accountId}`);
}

type AttachmentRow = { kind?: string | null; storage_path?: string | null } & Record<string, unknown>;

/**
 * Replace bucket paths with 1-hour signed URLs for `kind === 'screenshot'` attachments.
 * Mutates each row's `storage_path` in place. Safe to call on an empty/undefined array.
 */
export async function signScreenshotAttachments<T extends AttachmentRow>(
	attachments: T[] | null | undefined
): Promise<T[]> {
	if (!attachments || attachments.length === 0) return attachments ?? [];
	const screenshots = attachments.filter((a) => a.kind === 'screenshot' && a.storage_path);
	if (screenshots.length === 0) return attachments;

	const service = createSupabaseServiceClient();
	await Promise.all(
		screenshots.map(async (att) => {
			const { data } = await service.storage
				.from('trade-screenshots')
				.createSignedUrl(att.storage_path as string, 3600);
			if (data?.signedUrl) att.storage_path = data.signedUrl;
		})
	);
	return attachments;
}

/** Invalidate only journals cache */
export function invalidateJournalsCache(accountId: string): void {
	for (const key of [...baseDataCache.keys()]) {
		if (key.startsWith(accountId)) baseDataCache.delete(key);
	}
	void invalidateCachePattern(`portfolio:journals:${accountId}`);
}

/** Invalidate only playbooks cache */
export function invalidatePlaybooksCache(accountId: string): void {
	for (const key of [...baseDataCache.keys()]) {
		if (key.startsWith(accountId)) baseDataCache.delete(key);
	}
	void invalidateCachePattern(`portfolio:playbooks:${accountId}`);
}

export async function fetchPortfolioBaseData(
	supabase: SupabaseClient,
	accountId: string,
	userId: string
): Promise<PortfolioBaseData> {
	// Check process-level cache first (no serialization overhead)
	const cacheKey = `${accountId}:${userId}`;
	const cached = baseDataCache.get(cacheKey);
	if (cached && Date.now() < cached.expiresAt) {
		if (dev) console.log(`[baseData] HIT process cache for ${accountId.slice(0, 8)}…`);
		return cached.data;
	}

	// Stampede protection: if another request is already fetching, await it
	const pending = pendingFetches.get(cacheKey);
	if (pending) {
		if (dev) console.log(`[baseData] JOIN pending fetch for ${accountId.slice(0, 8)}…`);
		return pending;
	}

	const fetchPromise = doFetchPortfolioBaseData(supabase, accountId, userId, cacheKey);
	pendingFetches.set(cacheKey, fetchPromise);

	try {
		return await fetchPromise;
	} finally {
		pendingFetches.delete(cacheKey);
	}
}

async function doFetchPortfolioBaseData(
	supabase: SupabaseClient,
	accountId: string,
	userId: string,
	cacheKey: string
): Promise<PortfolioBaseData> {

	const tradesCacheKey = `portfolio:trades:${accountId}`;
	const dailyStatsCacheKey = `portfolio:daily_stats:${accountId}`;
	const journalsCacheKey = `portfolio:journals:${accountId}:${userId}`;
	const playbooksCacheKey = `portfolio:playbooks:${accountId}:${userId}`;

	// Check hot-data cache before hitting the DB
	const [cachedTrades, cachedDailyStats, cachedJournals, cachedPlaybooks] = await Promise.all([
		getCache<Trade[]>(tradesCacheKey),
		getCache<DailyStats[]>(dailyStatsCacheKey),
		getCache<DailyJournal[]>(journalsCacheKey),
		getCache<Playbook[]>(playbooksCacheKey)
	]);

	const [tradesRes, dailyStatsRes, journalsRes, playbooksRes, savedViewsRes, progressGoalsRes] =
		await Promise.allSettled([
			// Use cached trades if available, otherwise query DB
			cachedTrades
				? Promise.resolve({ data: cachedTrades, error: null })
				: supabase
						.from('trades')
						.select(
							'*, trade_tag_assignments(id, tag_id, trade_tags(id, name, color, category)), trade_notes(id, user_id, content, rating, created_at, updated_at), trade_reviews(id, user_id, review_status, playbook_id, broken_rules, entry_reason, exit_reason, execution_notes, risk_notes, mistake_summary, lesson_summary, next_action, followed_plan, setup_quality_score, discipline_score, execution_score, confidence_at_entry, reviewed_at, created_at, updated_at, playbooks(id, name)), trade_attachments(id, user_id, kind, storage_path, caption, sort_order, created_at)'
						)
						.eq('client_account_id', accountId)
						.order('close_time', { ascending: false }),
			// Use cached daily_stats if available, otherwise query DB
			cachedDailyStats
				? Promise.resolve({ data: cachedDailyStats, error: null })
				: supabase
						.from('daily_stats')
						.select('*')
						.eq('client_account_id', accountId)
						.order('date', { ascending: true }),
			// Use cached journals if available, otherwise query DB
			cachedJournals
				? Promise.resolve({ data: cachedJournals, error: null })
				: supabase
						.from('daily_journal')
						.select('*')
						.eq('client_account_id', accountId)
						.eq('user_id', userId)
						.order('date', { ascending: true }),
			// Use cached playbooks if available, otherwise query DB
			cachedPlaybooks
				? Promise.resolve({ data: cachedPlaybooks, error: null })
				: supabase
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

	const warnings: string[] = [];
	const getData = (result: PromiseSettledResult<{ data: unknown[] | null; error: { message?: string } | null }>, label: string) => {
		if (result.status === 'fulfilled') {
			if (result.value.error) {
				console.error(`[Portfolio] ${label} query error:`, result.value.error.message);
				warnings.push(label);
			}
			return (result.value.data || []) as Record<string, unknown>[];
		}
		console.error(`[Portfolio] ${label} promise rejected:`, (result as PromiseRejectedResult).reason);
		warnings.push(label);
		return [];
	};

	const trades = getData(tradesRes, 'trades') as unknown as Trade[];
	const dailyStats = getData(dailyStatsRes, 'dailyStats') as unknown as DailyStats[];
	const journals = getData(journalsRes, 'journals') as unknown as DailyJournal[];
	const playbooks = getData(playbooksRes, 'playbooks') as unknown as Playbook[];

	// Populate cache for fresh DB results (fire-and-forget, never throws)
	if (!cachedTrades && trades.length > 0) {
		void setCache(tradesCacheKey, trades, 300); // 5 min — invalidateBaseDataCache handles mutations
	}
	if (!cachedDailyStats && dailyStats.length > 0) {
		void setCache(dailyStatsCacheKey, dailyStats, 300);
	}
	if (!cachedJournals && journals.length > 0) {
		void setCache(journalsCacheKey, journals, 300);
	}
	if (!cachedPlaybooks && playbooks.length > 0) {
		void setCache(playbooksCacheKey, playbooks, 600);
	}

	const result: PortfolioBaseData = {
		trades,
		dailyStats,
		journals,
		playbooks,
		savedViews: getData(savedViewsRes, 'savedViews') as unknown as PortfolioSavedView[],
		progressGoals: mergeDefaultProgressGoals(getData(progressGoalsRes, 'progressGoals') as unknown as ProgressGoal[], accountId, userId),
		warnings
	};

	// Store in process-level cache (no serialization — instant on next navigation)
	baseDataCache.set(cacheKey, { data: result, expiresAt: Date.now() + BASE_DATA_TTL_MS });

	return result;
}

export async function fetchTradeChartContext(supabase: SupabaseClient, tradeId: string) {
	const { data } = await supabase
		.from('trade_chart_context')
		.select('*')
		.eq('trade_id', tradeId)
		.order('timeframe', { ascending: true });

	return data || [];
}

type DailyHistoryEntry = {
	date: string;
	profit: number;
	totalTrades: number;
	reviewedTrades: number;
	winRate: number;
	bestTrade: number;
	worstTrade: number;
};

// Memoize buildDailyHistory by array reference — same array in same request = cached result
const dailyHistoryMemo = new WeakMap<Trade[], DailyHistoryEntry[]>();

export function buildDailyHistory(trades: Trade[]): DailyHistoryEntry[] {
	if (!trades || trades.length === 0) return [];

	const cached = dailyHistoryMemo.get(trades);
	if (cached) return cached;

	const dailyMap = new Map<string, { profit: number; profitValues: number[]; reviewed: number }>();

	for (const trade of trades) {
		const dateKey = toThaiDateString(trade.close_time);
		const reviewStatus = getTradeReviewStatus(trade);

		if (!dailyMap.has(dateKey)) {
			dailyMap.set(dateKey, { profit: 0, profitValues: [], reviewed: 0 });
		}
		const day = dailyMap.get(dateKey)!;
		day.profit += Number(trade.profit || 0);
		day.profitValues.push(Number(trade.profit || 0));
		if (reviewStatus === 'reviewed') day.reviewed += 1;
	}

	const result = Array.from(dailyMap.entries())
		.map(([date, data]) => {
			const wins = data.profitValues.filter((p) => p > 0);
			const losses = data.profitValues.filter((p) => p < 0);
			return {
				date,
				profit: data.profit,
				totalTrades: data.profitValues.length,
				reviewedTrades: data.reviewed,
				winRate: data.profitValues.length > 0 ? (wins.length / data.profitValues.length) * 100 : 0,
				bestTrade: wins.length > 0 ? wins.reduce((max, v) => v > max ? v : max, -Infinity) : 0,
				worstTrade: losses.length > 0 ? losses.reduce((min, v) => v < min ? v : min, Infinity) : 0
			};
		})
		.sort((a, b) => a.date.localeCompare(b.date));

	dailyHistoryMemo.set(trades, result);
	return result;
}

/**
 * Build enhanced KPI metrics for dashboard
 * Calculates: Net P&L, Day Win%, Avg Win, Avg Loss, and cumulative P&L series
 */
export function buildKpiMetrics(trades: Trade[], dailyHistory: ReturnType<typeof buildDailyHistory>, startingBalance = 0) {
	if (!trades || trades.length === 0) {
		return {
			netPnl: 0,
			totalTrades: 0,
			winningTrades: 0,
			losingTrades: 0,
			breakEvenTrades: 0,
			tradeWinRate: 0,
			profitFactor: 0,
			dayWinRate: 0,
			profitableDays: 0,
			totalTradingDays: 0,
			avgWin: 0,
			avgLoss: 0,
			avgWinLossRatio: 0,
			cumulativePnl: [] as Array<{ date: string; value: number }>
		};
	}

	// Net P&L
	const netPnl = trades.reduce((sum, t) => sum + Number(t.profit || 0), 0);

	// Trade counts
	const wins = trades.filter(t => Number(t.profit || 0) > 0);
	const losses = trades.filter(t => Number(t.profit || 0) < 0);
	const breakEven = trades.filter(t => Number(t.profit || 0) === 0);

	// Trade Win Rate
	const tradeWinRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

	// Profit Factor
	const totalWinning = wins.reduce((sum, t) => sum + Number(t.profit || 0), 0);
	const totalLosing = Math.abs(losses.reduce((sum, t) => sum + Number(t.profit || 0), 0));
	const profitFactor = capRatio(totalWinning, totalLosing);

	// Avg Win / Avg Loss
	const avgWin = wins.length > 0 ? totalWinning / wins.length : 0;
	const avgLoss = losses.length > 0 ? totalLosing / losses.length : 0;
	const avgWinLossRatio = capRatio(avgWin, avgLoss);

	// Day Win Rate
	const profitableDays = dailyHistory.filter(d => d.profit > 0).length;
	const losingDays = dailyHistory.filter(d => d.profit < 0).length;
	const breakEvenDays = dailyHistory.filter(d => d.profit === 0).length;
	const totalTradingDays = profitableDays + losingDays + breakEvenDays;
	const dayWinRate = totalTradingDays > 0 ? (profitableDays / totalTradingDays) * 100 : 0;

	// Cumulative P&L series (for line chart)
	let cumulative = 0;
	const cumulativePnl = dailyHistory.map(d => {
		cumulative += d.profit;
		return { date: d.date, value: cumulative };
	});

	// Recovery Factor: Net P&L / Max Drawdown
	let peak = 0;
	let maxDrawdown = 0;
	let runningPnl = 0;
	for (const d of dailyHistory) {
		runningPnl += d.profit;
		if (runningPnl > peak) peak = runningPnl;
		const dd = peak - runningPnl;
		if (dd > maxDrawdown) maxDrawdown = dd;
	}
	const recoveryFactor = maxDrawdown > 0 ? netPnl / maxDrawdown : netPnl > 0 ? MAX_RATIO : 0;
	const peakEquity = startingBalance + peak;
	const maxDrawdownPct = peakEquity > 0 ? (maxDrawdown / peakEquity) * 100 : (maxDrawdown > 0 ? 100 : 0);

	// Consistency: 1 - (StdDev / Mean) of daily P&L, clamped to 0-1
	const dailyProfits = dailyHistory.map(d => d.profit);
	let consistency = 0;
	if (dailyProfits.length > 1) {
		const mean = dailyProfits.reduce((a, b) => a + b, 0) / dailyProfits.length;
		const variance = dailyProfits.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / dailyProfits.length;
		const stdDev = Math.sqrt(variance);
		const range = Math.max(...dailyProfits) - Math.min(...dailyProfits);
		if (range === 0) {
			consistency = 1;
		} else if (Math.abs(mean) > stdDev * 0.1) {
			const cv = stdDev / Math.abs(mean);
			consistency = Math.max(0, Math.min(1, 1 - cv / 3));
		} else {
			consistency = Math.max(0, Math.min(1, 1 - (stdDev / range)));
		}
	}

	return {
		netPnl,
		totalTrades: trades.length,
		winningTrades: wins.length,
		losingTrades: losses.length,
		breakEvenTrades: breakEven.length,
		tradeWinRate,
		profitFactor,
		dayWinRate,
		profitableDays,
		totalTradingDays,
		avgWin,
		avgLoss,
		avgWinLossRatio,
		cumulativePnl,
		recoveryFactor: Math.min(recoveryFactor, 10),
		maxDrawdownPct,
		consistency
	};
}

/**
 * Risk of Ruin (Ralph Vince formula) — probability the account goes to zero
 * given the current edge and risk-per-trade sizing.
 * Uses avgLoss as the proxy for risk-per-trade (each losing trade risks that $ amount).
 */
export function buildRiskOfRuin(
	kpi: ReturnType<typeof buildKpiMetrics>,
	balance: number
) {
	const { tradeWinRate, avgWin, avgLoss, totalTrades } = kpi;
	if (totalTrades < 10 || balance <= 0 || avgLoss <= 0) {
		return {
			probability: 0,
			riskPerTradePct: 0,
			zone: 'unknown' as 'safe' | 'warning' | 'danger' | 'unknown',
			units: 0,
			hasEnoughData: false
		};
	}

	const p = tradeWinRate / 100; // win prob
	const q = 1 - p; // loss prob
	const payoff = avgLoss > 0 ? avgWin / avgLoss : 0; // reward:risk
	const edge = p * payoff - q; // expected value per unit risked

	const riskPerTradePct = (avgLoss / balance) * 100;
	const units = Math.max(1, balance / avgLoss);

	let probability: number;
	if (edge <= 0) {
		probability = 1; // negative expectancy → eventual ruin
	} else {
		// Approximation: a = (1 - edge) / (1 + edge); RoR = a ^ units
		const a = (1 - edge) / (1 + edge);
		probability = Math.pow(Math.max(0, Math.min(1, a)), units);
	}

	const pct = probability * 100;
	const zone: 'safe' | 'warning' | 'danger' =
		pct < 5 ? 'safe' : pct < 20 ? 'warning' : 'danger';

	return {
		probability: pct,
		riskPerTradePct,
		zone,
		units: Math.round(units),
		hasEnoughData: true
	};
}

/**
 * Current + longest win/loss streaks, by trade and by day.
 * `current` is signed: positive = win streak, negative = loss streak, 0 = flat/none.
 */
export function buildStreakMetrics(
	trades: Trade[],
	dailyHistory: ReturnType<typeof buildDailyHistory>
) {
	function streakFromOutcomes(outcomes: number[]) {
		let longestWin = 0;
		let longestLoss = 0;
		let runWin = 0;
		let runLoss = 0;
		for (const o of outcomes) {
			if (o > 0) {
				runWin += 1;
				runLoss = 0;
				if (runWin > longestWin) longestWin = runWin;
			} else if (o < 0) {
				runLoss += 1;
				runWin = 0;
				if (runLoss > longestLoss) longestLoss = runLoss;
			} else {
				runWin = 0;
				runLoss = 0;
			}
		}
		// Compute current streak from the tail
		let current = 0;
		for (let i = outcomes.length - 1; i >= 0; i--) {
			const o = outcomes[i];
			if (o === 0) break;
			if (current === 0) {
				current = o > 0 ? 1 : -1;
			} else if ((current > 0 && o > 0) || (current < 0 && o < 0)) {
				current += current > 0 ? 1 : -1;
			} else {
				break;
			}
		}
		return { current, longestWin, longestLoss };
	}

	// Trades sorted ascending by close_time
	const sortedTrades = [...trades].sort((a, b) =>
		new Date(a.close_time).getTime() - new Date(b.close_time).getTime()
	);
	const tradeOutcomes = sortedTrades.map((t) => Number(t.profit || 0));
	const tradeStreak = streakFromOutcomes(tradeOutcomes);

	// dailyHistory is already sorted ascending by date
	const dayOutcomes = dailyHistory.map((d) => d.profit);
	const dayStreak = streakFromOutcomes(dayOutcomes);

	return { trade: tradeStreak, day: dayStreak };
}

/**
 * Best (largest win) and worst (largest loss) trade in filtered set.
 * Single pass; returns refs for linking to /portfolio/trades/[id].
 */
export function buildBestWorstTrades(trades: Trade[]) {
	if (!trades || trades.length === 0) {
		return { best: null as Trade | null, worst: null as Trade | null };
	}
	let best: Trade | null = null;
	let worst: Trade | null = null;
	for (const t of trades) {
		const p = Number(t.profit || 0);
		if (best === null || p > Number(best.profit || 0)) best = t;
		if (worst === null || p < Number(worst.profit || 0)) worst = t;
	}
	return { best, worst };
}

/**
 * Monthly P&L goal progress — sums P&L for current calendar month (Thailand TZ)
 * and compares against the user's `monthly_pnl` progress goal target.
 */
export function buildMonthlyPnlGoalProgress(
	trades: Trade[],
	goals: ProgressGoal[]
) {
	const goal = goals.find((g) => g.goal_type === 'monthly_pnl' && g.is_active);
	const target = Number(goal?.target_value || 0);

	const nowThai = new Date(Date.now() + THAILAND_OFFSET_MS);
	const year = nowThai.getUTCFullYear();
	const month = nowThai.getUTCMonth(); // 0-11
	const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

	let actual = 0;
	let tradeCount = 0;
	for (const t of trades) {
		const dateStr = toThaiDateString(t.close_time);
		if (dateStr.startsWith(monthPrefix)) {
			actual += Number(t.profit || 0);
			tradeCount += 1;
		}
	}

	// Days remaining in the month
	const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	const today = nowThai.getUTCDate();
	const daysRemaining = Math.max(0, lastDay - today);
	const daysElapsed = today;

	const progressPct = target > 0 ? (actual / target) * 100 : 0;

	return {
		target,
		actual,
		progressPct,
		daysRemaining,
		daysElapsed,
		daysInMonth: lastDay,
		tradeCount,
		hasTarget: target > 0,
		goalId: goal?.id ?? null
	};
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
				profitFactor: capRatio(grossWin, grossLoss),
				reviewedTrades: bucket.trades.filter((trade) => getTradeReviewStatus(trade) === 'reviewed').length
			};
		})
		.sort((a, b) => b.totalProfit - a.totalProfit);
}

/**
 * Build rule break metrics from reviewed trades.
 * Note: `ruleBreakLoss` is the total loss of trades that broke ANY rule (counted once per trade).
 * Per-rule `loss` is attributed to each rule the trade broke — so if a losing trade broke 3 rules,
 * each rule's loss includes that trade's full loss (shows exposure per rule, intentionally sums > total).
 */
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
	const ruleMetrics = buildRuleBreakMetrics(trades);
	const kpi = buildKpiMetrics(trades, dailyHistory);

	const metrics: Record<string, number> = {
		review_completion: reviewSummary.reviewRate,
		journal_streak: journalSummary.currentStreak,
		max_rule_breaks: ruleMetrics.totalRuleBreaks,
		profit_factor: kpi.profitFactor,
		win_rate: kpi.tradeWinRate
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

/**
 * Build symbol-level performance breakdown for Reports > Symbols view
 */
export function buildSymbolBreakdown(trades: Trade[]) {
	const symbolMap = new Map<string, Trade[]>();
	for (const trade of trades) {
		const sym = trade.symbol || 'Unknown';
		if (!symbolMap.has(sym)) symbolMap.set(sym, []);
		symbolMap.get(sym)!.push(trade);
	}

	return Array.from(symbolMap.entries())
		.map(([symbol, symTrades]) => {
			const wins = symTrades.filter(t => Number(t.profit || 0) > 0);
			const losses = symTrades.filter(t => Number(t.profit || 0) < 0);
			const totalWinning = wins.reduce((s, t) => s + Number(t.profit || 0), 0);
			const totalLosing = Math.abs(losses.reduce((s, t) => s + Number(t.profit || 0), 0));
			const netPnl = symTrades.reduce((s, t) => s + Number(t.profit || 0), 0);
			return {
				symbol,
				trades: symTrades.length,
				wins: wins.length,
				losses: losses.length,
				winRate: symTrades.length > 0 ? (wins.length / symTrades.length) * 100 : 0,
				profitFactor: capRatio(totalWinning, totalLosing),
				netPnl,
				avgPnl: symTrades.length > 0 ? netPnl / symTrades.length : 0
			};
		})
		.sort((a, b) => b.netPnl - a.netPnl);
}

export function buildTagBreakdown(trades: Trade[]) {
	const tagMap = new Map<string, { tagId: string; category: string; color: string; trades: Trade[] }>();
	const categoryMap = new Map<string, { tags: Set<string>; trades: Trade[]; tradeIds: Set<string> }>();

	for (const trade of trades) {
		const assignments = trade.trade_tag_assignments || [];
		for (const assignment of assignments) {
			const tag = assignment.trade_tags;
			if (!tag) continue;

			// Per-tag grouping
			if (!tagMap.has(tag.id)) {
				tagMap.set(tag.id, { tagId: tag.id, category: tag.category, color: tag.color, trades: [] });
			}
			tagMap.get(tag.id)!.trades.push(trade);

			// Per-category grouping
			if (!categoryMap.has(tag.category)) {
				categoryMap.set(tag.category, { tags: new Set(), trades: [], tradeIds: new Set() });
			}
			const cat = categoryMap.get(tag.category)!;
			cat.tags.add(tag.id);
			if (!cat.tradeIds.has(trade.id)) {
				cat.tradeIds.add(trade.id);
				cat.trades.push(trade);
			}
		}
	}

	const calcStats = (groupTrades: Trade[]) => {
		const wins = groupTrades.filter(t => Number(t.profit || 0) > 0);
		const losses = groupTrades.filter(t => Number(t.profit || 0) < 0);
		const totalWinning = wins.reduce((s, t) => s + Number(t.profit || 0), 0);
		const totalLosing = Math.abs(losses.reduce((s, t) => s + Number(t.profit || 0), 0));
		const netPnl = groupTrades.reduce((s, t) => s + Number(t.profit || 0), 0);
		return {
			trades: groupTrades.length,
			wins: wins.length,
			losses: losses.length,
			winRate: groupTrades.length > 0 ? (wins.length / groupTrades.length) * 100 : 0,
			profitFactor: capRatio(totalWinning, totalLosing),
			netPnl,
			avgPnl: groupTrades.length > 0 ? netPnl / groupTrades.length : 0
		};
	};

	const byTag = Array.from(tagMap.entries())
		.map(([_, { tagId, category, color, trades: tagTrades }]) => {
			const tagName = trades
				.flatMap(t => t.trade_tag_assignments || [])
				.find(a => a.trade_tags?.id === tagId)?.trade_tags?.name || 'Unknown';
			return { tagId, tagName, category, color, ...calcStats(tagTrades) };
		})
		.sort((a, b) => b.netPnl - a.netPnl);

	const byCategory = Array.from(categoryMap.entries())
		.map(([category, { tags, trades: catTrades }]) => ({
			category,
			tagCount: tags.size,
			...calcStats(catTrades)
		}))
		.sort((a, b) => b.netPnl - a.netPnl);

	return { byTag, byCategory };
}

export function buildDayOfWeekReport(trades: Trade[]) {
	const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const dayMap = new Map<number, Trade[]>();

	for (const trade of trades) {
		if (!trade.close_time) continue;
		const thaiDate = new Date(new Date(trade.close_time).getTime() + THAILAND_OFFSET_MS);
		const dayIdx = thaiDate.getUTCDay();
		if (!dayMap.has(dayIdx)) dayMap.set(dayIdx, []);
		dayMap.get(dayIdx)!.push(trade);
	}

	const days = dayNames.map((name, idx) => {
		const dayTrades = dayMap.get(idx) || [];
		const wins = dayTrades.filter(t => Number(t.profit || 0) > 0);
		const losses = dayTrades.filter(t => Number(t.profit || 0) < 0);
		const totalWinning = wins.reduce((s, t) => s + Number(t.profit || 0), 0);
		const totalLosing = Math.abs(losses.reduce((s, t) => s + Number(t.profit || 0), 0));
		const netPnl = dayTrades.reduce((s, t) => s + Number(t.profit || 0), 0);
		const profits = dayTrades.map(t => Number(t.profit || 0));
		const holdTimes = dayTrades.map(t => getTradeDurationMinutes(t.open_time, t.close_time));

		return {
			day: name,
			dayIdx: idx,
			trades: dayTrades.length,
			wins: wins.length,
			losses: losses.length,
			winRate: dayTrades.length > 0 ? (wins.length / dayTrades.length) * 100 : 0,
			profitFactor: capRatio(totalWinning, totalLosing),
			netPnl,
			avgPnl: dayTrades.length > 0 ? netPnl / dayTrades.length : 0,
			avgHoldMinutes: holdTimes.length > 0 ? Math.round(holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length) : 0,
			bestTrade: profits.length > 0 ? profits.reduce((m, v) => v > m ? v : m, -Infinity) : 0,
			worstTrade: profits.length > 0 ? profits.reduce((m, v) => v < m ? v : m, Infinity) : 0
		};
	}).filter(d => d.trades > 0);

	const bestDay = days.length > 0 ? days.reduce((best, d) => d.netPnl > best.netPnl ? d : best).day : null;
	const worstDay = days.length > 0 ? days.reduce((worst, d) => d.netPnl < worst.netPnl ? d : worst).day : null;

	return { days, bestDay, worstDay };
}

export function buildDayTimeHeatmap(trades: Trade[]) {
	const cellMap = new Map<string, { trades: number; pnl: number; wins: number }>();

	for (const trade of trades) {
		if (!trade.close_time) continue;
		const thaiDate = new Date(new Date(trade.close_time).getTime() + THAILAND_OFFSET_MS);
		const dayIdx = thaiDate.getUTCDay();
		const hour = thaiDate.getUTCHours();
		const key = `${dayIdx}-${hour}`;
		const cell = cellMap.get(key) || { trades: 0, pnl: 0, wins: 0 };
		cell.trades += 1;
		cell.pnl += Number(trade.profit || 0);
		if (Number(trade.profit || 0) > 0) cell.wins += 1;
		cellMap.set(key, cell);
	}

	const cells = Array.from(cellMap.entries()).map(([key, data]) => {
		const [day, hour] = key.split('-').map(Number);
		return {
			day,
			hour,
			trades: data.trades,
			pnl: data.pnl,
			winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0
		};
	});

	return {
		cells,
		maxTrades: cells.length > 0 ? cells.reduce((m, c) => c.trades > m ? c.trades : m, 0) : 0,
		maxAbsPnl: cells.length > 0 ? cells.reduce((m, c) => Math.abs(c.pnl) > m ? Math.abs(c.pnl) : m, 0) : 0
	};
}

export function buildFilterOptions(trades: Trade[], playbooks: Playbook[]) {
	const profits = trades.map((t) => Number(t.profit || 0));
	const lotSizes = trades.map((t) => Number(t.lot_size || 0));
	const pipsValues = trades.filter((t) => t.pips != null).map((t) => Number(t.pips));

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
		playbooks: playbooks.map((playbook) => ({ id: playbook.id, name: playbook.name })),
		profitRange: profits.length
			? { min: Math.round(profits.reduce((m, v) => v < m ? v : m, Infinity) * 100) / 100, max: Math.round(profits.reduce((m, v) => v > m ? v : m, -Infinity) * 100) / 100 }
			: null,
		lotSizeRange: lotSizes.length
			? { min: lotSizes.reduce((m, v) => v < m ? v : m, Infinity), max: lotSizes.reduce((m, v) => v > m ? v : m, -Infinity) }
			: null,
		pipsRange: pipsValues.length
			? { min: Math.round(pipsValues.reduce((m, v) => v < m ? v : m, Infinity) * 10) / 10, max: Math.round(pipsValues.reduce((m, v) => v > m ? v : m, -Infinity) * 10) / 10 }
			: null
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
		{ user_id: userId, client_account_id: accountId, goal_type: 'win_rate', target_value: 55, period_days: 30, is_active: true },
		{ user_id: userId, client_account_id: accountId, goal_type: 'monthly_pnl', target_value: 0, period_days: 30, is_active: true }
	];

	return defaults.map((goal) => {
		const existing = goals.find((item) => item.goal_type === goal.goal_type);
		return (
			existing || {
				...goal,
				id: `default-${goal.goal_type}`,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			}
		);
	});
}

function buildDurationBucketStats(trades: Trade[]) {
	const buckets = new Map<string, { count: number; profit: number; totalMinutes: number }>();
	for (const trade of trades) {
		const bucket = getTradeDurationBucket(trade.open_time, trade.close_time) || 'intraday';
		const current = buckets.get(bucket) || { count: 0, profit: 0, totalMinutes: 0 };
		current.count += 1;
		current.profit += Number(trade.profit || 0);
		current.totalMinutes += getTradeDurationMinutes(trade.open_time, trade.close_time);
		buckets.set(bucket, current);
	}

	return Array.from(buckets.entries()).map(([bucket, stats]) => ({
		bucket,
		count: stats.count,
		profit: stats.profit,
		avgMinutes: stats.count > 0 ? Math.round(stats.totalMinutes / stats.count) : 0
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

export function buildDrawdownHistory(
	dailyHistory: ReturnType<typeof buildDailyHistory>,
	startingBalance = 0
): { date: string; drawdownPct: number }[] {
	let cumulative = 0;
	let peak = 0;
	return dailyHistory.map(d => {
		cumulative += d.profit;
		if (cumulative > peak) peak = cumulative;
		const peakEquity = startingBalance + peak;
		const drawdownPct = peakEquity > 0 ? ((cumulative - peak) / peakEquity) * 100 : 0;
		return { date: d.date, drawdownPct };
	});
}

export function buildIntradayDrawdown(
	snapshots: Array<{ time: number; equity: number; balance: number }>,
	startingBalance = 0
): {
	maxDrawdownPct: number;
	absoluteDrawdown: number;
	peakEquity: number;
	lowestEquity: number;
	history: Array<{ time: number; drawdownPct: number }>;
} {
	if (!snapshots || snapshots.length === 0) {
		return { maxDrawdownPct: 0, absoluteDrawdown: 0, peakEquity: startingBalance, lowestEquity: startingBalance, history: [] };
	}

	let peakEquity = startingBalance;
	let lowestEquity = snapshots[0].equity;
	let maxDrawdownPct = 0;
	let absoluteDrawdown = 0;

	const history = snapshots.map(s => {
		if (s.equity > peakEquity) peakEquity = s.equity;
		if (s.equity < lowestEquity) lowestEquity = s.equity;
		const ddPct = peakEquity > 0 ? ((peakEquity - s.equity) / peakEquity) * 100 : 0;
		if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;
		const absDD = startingBalance - s.equity;
		if (absDD > absoluteDrawdown) absoluteDrawdown = absDD;
		return { time: s.time, drawdownPct: -ddPct };
	});

	return { maxDrawdownPct, absoluteDrawdown, peakEquity, lowestEquity, history };
}
