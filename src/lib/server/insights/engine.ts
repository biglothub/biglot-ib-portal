import type { InsightResult, InsightRule, Trade, TradeContext } from './types';

// Import all rules
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
	breakevenCloseRule
];

/**
 * Build context for a trade (pre-computed averages for its symbol)
 */
function buildTradeContext(trade: Trade, allTrades: Trade[]): TradeContext {
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

	return { allTrades, symbolTrades, avgSymbolWin, avgSymbolLoss, avgSymbolHoldMinutes };
}

/**
 * Evaluate all rules for a single trade
 */
export function evaluateTradeInsights(trade: Trade, allTrades: Trade[]): InsightResult[] {
	const context = buildTradeContext(trade, allTrades);
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
 * Returns a Map: tradeId → InsightResult[]
 */
export function evaluateAllInsights(trades: Trade[]): Map<string, InsightResult[]> {
	const results = new Map<string, InsightResult[]>();

	// Pre-compute symbol contexts once
	const symbolContextCache = new Map<string, TradeContext>();

	for (const trade of trades) {
		if (!symbolContextCache.has(trade.symbol)) {
			symbolContextCache.set(trade.symbol, buildTradeContext(trade, trades));
		}
		const context = symbolContextCache.get(trade.symbol)!;
		// Override allTrades for loss streak detection (needs all trades, not just symbol)
		const contextWithAll = { ...context, allTrades: trades };

		const tradeInsights: InsightResult[] = [];
		for (const rule of ALL_RULES) {
			try {
				const result = rule.evaluate(trade, contextWithAll);
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
	const scores = new Map<string, number>();
	const symbolContextCache = new Map<string, TradeContext>();

	for (const trade of trades) {
		if (!symbolContextCache.has(trade.symbol)) {
			symbolContextCache.set(trade.symbol, buildTradeContext(trade, trades));
		}
		const context = symbolContextCache.get(trade.symbol)!;
		scores.set(trade.id, calculateQualityScore(trade, context));
	}

	return scores;
}
