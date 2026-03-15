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
 * Calculate a quality score (0-100) for a trade
 */
export function calculateQualityScore(trade: Trade, context: TradeContext): number {
	let score = 50; // Start neutral

	const profit = Number(trade.profit || 0);
	const holdMins = (new Date(trade.close_time).getTime() - new Date(trade.open_time).getTime()) / 60000;

	// Risk Management (+/- 20 points)
	if (trade.sl && trade.sl > 0) score += 10; // Has stop loss
	else score -= 10;

	if (trade.tp && trade.tp > 0) score += 5; // Has take profit

	// Outcome relative to average (+/- 20 points)
	if (profit > 0) {
		if (context.avgSymbolWin > 0) {
			const ratio = profit / context.avgSymbolWin;
			score += Math.min(20, Math.round(ratio * 10));
		} else {
			score += 10;
		}
	} else if (profit < 0) {
		if (context.avgSymbolLoss > 0) {
			const ratio = Math.abs(profit) / context.avgSymbolLoss;
			score -= Math.min(20, Math.round(ratio * 10));
		} else {
			score -= 10;
		}
	}

	// Hold time appropriateness (+/- 10 points)
	if (context.avgSymbolHoldMinutes > 0) {
		const holdRatio = holdMins / context.avgSymbolHoldMinutes;
		if (holdRatio >= 0.3 && holdRatio <= 3) score += 5; // Normal range
		else score -= 5; // Too short or too long
	}

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
