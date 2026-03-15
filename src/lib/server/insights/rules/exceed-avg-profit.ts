import type { InsightRule } from '../types';

/** Trade profit exceeded 1.5x average winning profit for this symbol */
export const exceedAvgProfitRule: InsightRule = {
	id: 'exceed_avg_profit',
	name: 'Exceeded Average Profit',
	evaluate(trade, context) {
		const profit = Number(trade.profit || 0);
		if (profit <= 0 || context.avgSymbolWin <= 0) return null;
		if (profit < context.avgSymbolWin * 1.5) return null;

		return {
			ruleId: this.id,
			category: 'positive',
			message: `Above average — $${profit.toFixed(2)} profit vs $${context.avgSymbolWin.toFixed(2)} avg for ${trade.symbol}`,
			data: { profit, avgWin: context.avgSymbolWin, ratio: profit / context.avgSymbolWin }
		};
	}
};
