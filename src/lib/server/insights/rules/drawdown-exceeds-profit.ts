import type { InsightRule } from '../types';

/** Loss on this trade exceeds the average winning trade profit */
export const drawdownExceedsProfitRule: InsightRule = {
	id: 'drawdown_exceeds_profit',
	name: 'Drawdown Exceeds Avg Profit',
	evaluate(trade, context) {
		const profit = Number(trade.profit || 0);
		if (profit >= 0 || context.avgSymbolWin <= 0) return null;

		const loss = Math.abs(profit);
		if (loss <= context.avgSymbolWin) return null;

		const ratio = loss / context.avgSymbolWin;

		return {
			ruleId: this.id,
			category: 'negative',
			message: `Loss ($${loss.toFixed(2)}) exceeds avg win ($${context.avgSymbolWin.toFixed(2)}) by ${ratio.toFixed(1)}x`,
			data: { loss, avgWin: context.avgSymbolWin, ratio }
		};
	}
};
