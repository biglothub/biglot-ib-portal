import type {
	InsightResult, InsightRule, Trade, TradeContext,
	DayInsightResult, DayInsightRule, DayContext, DaySummary,
	ExecutionMetrics
} from './types';

// Import trade-level rules
import { exceedAvgProfitRule } from './rules/exceed-avg-profit';
import { exceedAvgHoldRule } from './rules/exceed-avg-hold';
import { noStopLossRule } from './rules/no-stop-loss';
import { lossStreakRule } from './rules/loss-streak';
import { loserLongHoldRule } from './rules/loser-long-hold';
import { largeLossRule } from './rules/large-loss';
import { bigWinnerRule } from './rules/big-winner';
import { quickScalpRule } from './rules/quick-scalp';
import { highVolumeRule } from './rules/high-volume';
import { breakevenCloseRule } from './rules/breakeven-close';
import { greenToRedRule } from './rules/green-to-red';
import { greenToBreakevenRule } from './rules/green-to-breakeven';
import { drawdownExceedsProfitRule } from './rules/drawdown-exceeds-profit';
import { revengeTradingRule } from './rules/revenge-trading';
import { overconfidenceSizingRule } from './rules/overconfidence-sizing';
import { recoveryTradeRule } from './rules/recovery-trade';
import { leftMoneyOnTableRule } from './rules/left-money-on-table';
import { scaleDetectionRule } from './rules/scale-detection';

// Import day-level rules
import { overtradingDayRule } from './day-rules/overtrading-day';
import { tiltSessionRule } from './day-rules/tilt-session';
import { flipFlopDayRule } from './day-rules/flip-flop-day';
import { perfectDayRule } from './day-rules/perfect-day';
import { highConvictionDayRule } from './day-rules/high-conviction-day';

const ALL_RULES: InsightRule[] = [
	exceedAvgProfitRule,
	exceedAvgHoldRule,
	noStopLossRule,
	lossStreakRule,
	loserLongHoldRule,
	largeLossRule,
	bigWinnerRule,
	quickScalpRule,
	highVolumeRule,
	breakevenCloseRule,
	// Phase 7 rules
	greenToRedRule,
	greenToBreakevenRule,
	drawdownExceedsProfitRule,
	revengeTradingRule,
	overconfidenceSizingRule,
	recoveryTradeRule,
	leftMoneyOnTableRule,
	scaleDetectionRule
];

const ALL_DAY_RULES: DayInsightRule[] = [
	overtradingDayRule,
	tiltSessionRule,
	flipFlopDayRule,
	perfectDayRule,
	highConvictionDayRule
];

/**
 * Build context for a trade (pre-computed averages for its symbol)
 */
function buildTradeContext(trade: Trade, allTrades: Trade[], previousTrade?: Trade): TradeContext {
	const symbolTrades = allTrades.filter(t => t.symbol === trade.symbol);
	const symbolWins = symbolTrades.filter(t => Number(t.profit || 0) > 0);
	const symbolLosses = symbolTrades.filter(t => Number(t.profit || 0) < 0);

	const avgSymbolWin = symbolWins.length > 0
		? symbolWins.reduce((s, t) => s + Number(t.profit || 0), 0) / symbolWins.length
		: 0;
	const avgSymbolLoss = symbolLosses.length > 0
		? Math.abs(symbolLosses.reduce((s, t) => s + Number(t.profit || 0), 0)) / symbolLosses.length
		: 0;

	const holdTimes = symbolTrades.map(t =>
		(new Date(t.close_time).getTime() - new Date(t.open_time).getTime()) / 60000
	);
	const avgSymbolHoldMinutes = holdTimes.length > 0
		? holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length
		: 0;

	return { allTrades, symbolTrades, avgSymbolWin, avgSymbolLoss, avgSymbolHoldMinutes, previousTrade };
}

/**
 * Evaluate all rules for a single trade
 */
export function evaluateTradeInsights(trade: Trade, allTrades: Trade[]): InsightResult[] {
	// Find previous trade by open_time
	const sorted = [...allTrades].sort((a, b) =>
		new Date(a.open_time).getTime() - new Date(b.open_time).getTime()
	);
	const idx = sorted.findIndex(t => t.id === trade.id);
	const previousTrade = idx > 0 ? sorted[idx - 1] : undefined;

	const context = buildTradeContext(trade, allTrades, previousTrade);
	const results: InsightResult[] = [];

	for (const rule of ALL_RULES) {
		try {
			const result = rule.evaluate(trade, context);
			if (result) results.push(result);
		} catch {
			// Skip failing rules silently
		}
	}

	return results;
}

/**
 * Batch evaluate insights for all trades
 * Returns a Map: tradeId -> InsightResult[]
 */
export function evaluateAllInsights(trades: Trade[]): Map<string, InsightResult[]> {
	return evaluateInsightsForSubset(trades, trades);
}

/**
 * Evaluate insights for a subset of trades, using all trades for context.
 * Builds symbol contexts and sorted index from contextTrades,
 * but only runs rule evaluation on evaluateTrades.
 */
export function evaluateInsightsForSubset(
	contextTrades: Trade[],
	evaluateTrades: Trade[]
): Map<string, InsightResult[]> {
	const results = new Map<string, InsightResult[]>();

	// Pre-compute symbol contexts once from full context
	const symbolContextCache = new Map<string, TradeContext>();

	// Pre-sort for previousTrade lookup (from full context)
	const sorted = [...contextTrades].sort((a, b) =>
		new Date(a.open_time).getTime() - new Date(b.open_time).getTime()
	);
	const tradeIndexMap = new Map<string, number>();
	sorted.forEach((t, i) => tradeIndexMap.set(t.id, i));

	for (const trade of evaluateTrades) {
		if (!symbolContextCache.has(trade.symbol)) {
			symbolContextCache.set(trade.symbol, buildTradeContext(trade, contextTrades));
		}
		const symbolContext = symbolContextCache.get(trade.symbol)!;

		// Add previousTrade and allTrades to context
		const idx = tradeIndexMap.get(trade.id) ?? -1;
		const previousTrade = idx > 0 ? sorted[idx - 1] : undefined;
		const context: TradeContext = { ...symbolContext, allTrades: contextTrades, previousTrade };

		const tradeInsights: InsightResult[] = [];
		for (const rule of ALL_RULES) {
			try {
				const result = rule.evaluate(trade, context);
				if (result) tradeInsights.push(result);
			} catch {
				// Skip
			}
		}

		if (tradeInsights.length > 0) {
			results.set(trade.id, tradeInsights);
		}
	}

	return results;
}

// ==========================================
// Day-level insights
// ==========================================

/**
 * Build day summaries from trades (grouped by close_time date)
 */
function buildDaySummaries(trades: Trade[]): DaySummary[] {
	const dayMap = new Map<string, Trade[]>();
	for (const t of trades) {
		const date = t.close_time.split('T')[0];
		const arr = dayMap.get(date) || [];
		arr.push(t);
		dayMap.set(date, arr);
	}

	return Array.from(dayMap.entries())
		.map(([date, dayTrades]) => ({
			date,
			trades: dayTrades,
			totalPnl: dayTrades.reduce((s, t) => s + Number(t.profit || 0), 0),
			winCount: dayTrades.filter(t => Number(t.profit || 0) > 0).length,
			lossCount: dayTrades.filter(t => Number(t.profit || 0) < 0).length
		}))
		.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Evaluate day-level insights for a single day's trades
 */
export function evaluateDayInsights(dayTrades: Trade[], allTrades: Trade[]): DayInsightResult[] {
	const allSummaries = buildDaySummaries(allTrades);
	const date = dayTrades[0]?.close_time.split('T')[0] || '';

	// Get last 60 days before this date as baseline
	const recentDays = allSummaries
		.filter(d => d.date < date)
		.slice(-60);

	const context: DayContext = { allTrades, recentDays };
	const results: DayInsightResult[] = [];

	for (const rule of ALL_DAY_RULES) {
		try {
			const result = rule.evaluate(dayTrades, context);
			if (result) results.push(result);
		} catch {
			// Skip
		}
	}

	return results;
}

/**
 * Batch evaluate day-level insights for all days
 * Returns a Map: date string -> DayInsightResult[]
 */
export function evaluateAllDayInsights(trades: Trade[]): Map<string, DayInsightResult[]> {
	const results = new Map<string, DayInsightResult[]>();
	const daySummaries = buildDaySummaries(trades);

	for (let i = 0; i < daySummaries.length; i++) {
		const day = daySummaries[i];
		const recentDays = daySummaries.slice(Math.max(0, i - 60), i);
		const context: DayContext = { allTrades: trades, recentDays };

		const dayInsights: DayInsightResult[] = [];
		for (const rule of ALL_DAY_RULES) {
			try {
				const result = rule.evaluate(day.trades, context);
				if (result) dayInsights.push(result);
			} catch {
				// Skip
			}
		}

		if (dayInsights.length > 0) {
			results.set(day.date, dayInsights);
		}
	}

	return results;
}

// ==========================================
// Execution metrics
// ==========================================

/**
 * Calculate execution metrics (R-multiple, efficiency) for a trade
 */
export function calculateExecutionMetrics(trade: Trade): ExecutionMetrics {
	const openPrice = Number(trade.open_price);
	const lotSize = Number(trade.lot_size || 0);
	const profit = Number(trade.profit || 0);
	const sl = Number(trade.sl || 0);
	const tp = Number(trade.tp || 0);

	let plannedRisk: number | null = null;
	let plannedReward: number | null = null;
	let rMultiple: number | null = null;
	let executionEfficiency: number | null = null;

	if (sl > 0 && openPrice > 0 && lotSize > 0) {
		plannedRisk = Math.abs(openPrice - sl) * lotSize;
		if (plannedRisk > 0) {
			rMultiple = profit / plannedRisk;
		}
	}

	if (tp > 0 && openPrice > 0 && lotSize > 0) {
		plannedReward = Math.abs(tp - openPrice) * lotSize;
		if (plannedReward > 0 && profit > 0) {
			executionEfficiency = (profit / plannedReward) * 100;
		}
	}

	return { plannedRisk, plannedReward, rMultiple, executionEfficiency };
}

/**
 * Batch calculate execution metrics for all trades
 */
export function calculateAllExecutionMetrics(trades: Trade[]): Map<string, ExecutionMetrics> {
	const metrics = new Map<string, ExecutionMetrics>();
	for (const trade of trades) {
		metrics.set(trade.id, calculateExecutionMetrics(trade));
	}
	return metrics;
}

// ==========================================
// Health Score
// ==========================================

/**
 * Calculate composite Trading Health Score (0-100) from KPI metrics
 * Matches the normalization logic in TradingScoreRadar.svelte
 */
export function calculateHealthScore(kpi: {
	totalTrades?: number;
	tradeWinRate?: number;
	profitFactor?: number;
	avgWin?: number;
	avgLoss?: number;
	recoveryFactor?: number;
	maxDrawdownPct?: number;
	consistency?: number;
}): { score: number; axes: number[]; noData: boolean } {
	if (!kpi.totalTrades) {
		return { score: -1, axes: [0, 0, 0, 0, 0, 0], noData: true };
	}

	const nWinRate = Math.min(Math.max(kpi.tradeWinRate || 0, 0), 100);
	const nPF = Math.min(((kpi.profitFactor || 0) / 3) * 100, 100);
	const wlRatio = (kpi.avgLoss || 0) !== 0
		? Math.abs((kpi.avgWin || 0) / (kpi.avgLoss || 1))
		: 0;
	const nRatio = Math.min((wlRatio / 3) * 100, 100);
	const nRecovery = Math.min(((kpi.recoveryFactor || 0) / 5) * 100, 100);
	const nDrawdown = Math.max(0, Math.min(100, 100 - (kpi.maxDrawdownPct || 0) * 2));
	const nConsistency = Math.min(Math.max((kpi.consistency || 0) * 100, 0), 100);

	const axes = [nWinRate, nPF, nRatio, nRecovery, nDrawdown, nConsistency];

	const score = Math.round(
		nWinRate * 0.20 +
		nPF * 0.20 +
		nRatio * 0.15 +
		nRecovery * 0.15 +
		nDrawdown * 0.15 +
		nConsistency * 0.15
	);

	return { score, axes, noData: false };
}

// ==========================================
// Quality Score (unchanged)
// ==========================================

/**
 * Calculate a quality score (0-100) for a trade using 8 weighted factors
 */
export function calculateQualityScore(trade: Trade, context: TradeContext): number {
	let score = 0;
	const profit = Number(trade.profit || 0);
	const holdMins = (new Date(trade.close_time).getTime() - new Date(trade.open_time).getTime()) / 60000;
	const review = (trade as any).trade_reviews?.[0];
	const notes = (trade as any).trade_notes || [];
	const tags = (trade as any).trade_tag_assignments || [];
	const attachments = (trade as any).trade_attachments || [];

	// 1. Risk Management (0-20)
	let riskScore = 0;
	if (trade.sl && Number(trade.sl) > 0) riskScore += 10;
	if (trade.tp && Number(trade.tp) > 0) riskScore += 5;
	if (trade.sl && trade.open_price) {
		const slDist = Math.abs(Number(trade.sl) - Number(trade.open_price)) / Math.max(Number(trade.open_price), 0.0001);
		if (slDist > 0 && slDist <= 0.02) riskScore += 5; // Tight SL within 2%
		else if (slDist > 0) riskScore += 2; // Has SL but wide
	}
	score += Math.min(riskScore, 20);

	// 2. Plan Adherence (0-15)
	let planScore = 0;
	if (review?.followed_plan === true) planScore += 10;
	if (review?.playbook_id) planScore += 5;
	if (!review?.broken_rules || review.broken_rules.length === 0) planScore += 5;
	score += Math.min(planScore, 15);

	// 3. Review Completeness (0-10)
	if (review?.review_status === 'reviewed') score += 10;
	else if (review?.review_status === 'in_progress') score += 5;

	// 4. Outcome Quality (0-15)
	if (profit > 0) {
		if (context.avgSymbolWin > 0) {
			const ratio = profit / context.avgSymbolWin;
			score += Math.min(15, Math.round(ratio * 8));
		} else {
			score += 8;
		}
	} else if (profit < 0) {
		// Less penalty for small losses relative to avg
		if (context.avgSymbolLoss > 0) {
			const ratio = Math.abs(profit) / context.avgSymbolLoss;
			if (ratio <= 1) score += 5; // Loss smaller than avg = decent risk management
		}
	} else {
		score += 3; // Breakeven is neutral-positive
	}

	// 5. Execution Timing (0-10)
	if (context.avgSymbolHoldMinutes > 0) {
		const holdRatio = holdMins / context.avgSymbolHoldMinutes;
		if (holdRatio >= 0.3 && holdRatio <= 3) score += 10;
		else if (holdRatio >= 0.1 && holdRatio <= 5) score += 5;
	} else {
		score += 5; // No baseline = neutral
	}

	// 6. Position Sizing (0-10)
	const lotSize = Number(trade.lot_size || 0);
	if (context.symbolTrades.length >= 3) {
		const avgLot = context.symbolTrades.reduce((s, t) => s + Number(t.lot_size || 0), 0) / context.symbolTrades.length;
		if (avgLot > 0) {
			const lotRatio = lotSize / avgLot;
			if (lotRatio >= 0.5 && lotRatio <= 2) score += 10;
			else if (lotRatio >= 0.25 && lotRatio <= 3) score += 5;
		} else {
			score += 5;
		}
	} else {
		score += 5; // Not enough data
	}

	// 7. Risk/Reward Realized (0-10)
	if (trade.sl && Number(trade.sl) > 0 && profit !== 0) {
		const riskAmount = Math.abs(Number(trade.open_price) - Number(trade.sl)) * lotSize;
		if (riskAmount > 0) {
			const rrRealized = profit / riskAmount;
			if (rrRealized >= 2) score += 10;      // 2R+ win
			else if (rrRealized >= 1) score += 8;   // 1R+ win
			else if (rrRealized >= 0) score += 5;   // Small win
			else if (rrRealized >= -1) score += 3;  // Controlled loss within 1R
		}
	} else {
		score += 2; // No SL = low score
	}

	// 8. Documentation (0-10)
	if (notes.length > 0) score += 5;
	if (tags.length > 0) score += 3;
	if (attachments.length > 0) score += 2;

	return Math.max(0, Math.min(100, score));
}

/**
 * Batch calculate quality scores for all trades
 */
export function calculateAllQualityScores(trades: Trade[]): Map<string, number> {
	return calculateQualityScoresForSubset(trades, trades);
}

/**
 * Calculate quality scores for a subset of trades, using all trades for context.
 * Builds symbol contexts from contextTrades but only scores evaluateTrades.
 */
export function calculateQualityScoresForSubset(
	contextTrades: Trade[],
	evaluateTrades: Trade[]
): Map<string, number> {
	const scores = new Map<string, number>();
	const symbolContextCache = new Map<string, TradeContext>();

	for (const trade of evaluateTrades) {
		if (!symbolContextCache.has(trade.symbol)) {
			symbolContextCache.set(trade.symbol, buildTradeContext(trade, contextTrades));
		}
		const context = symbolContextCache.get(trade.symbol)!;
		scores.set(trade.id, calculateQualityScore(trade, context));
	}

	return scores;
}
