import type { InsightRule } from '../types';

/** After a winning trade, increased lot size by 1.5x+ and lost */
export const overconfidenceSizingRule: InsightRule = {
	id: 'overconfidence_sizing',
	name: 'Overconfidence Sizing',
	evaluate(trade, context) {
		const profit = Number(trade.profit || 0);
		if (profit >= 0) return null;
		if (!context.previousTrade) return null;

		const prevProfit = Number(context.previousTrade.profit || 0);
		if (prevProfit <= 0) return null; // Previous trade wasn't a win

		const currentLot = Number(trade.lot_size || 0);
		const prevLot = Number(context.previousTrade.lot_size || 0);
		if (prevLot <= 0 || currentLot < prevLot * 1.5) return null;

		const sizeIncrease = ((currentLot / prevLot - 1) * 100).toFixed(0);

		return {
			ruleId: this.id,
			category: 'warning',
			message: `Overconfidence — increased size ${sizeIncrease}% after a win, then lost $${Math.abs(profit).toFixed(2)}`,
			data: { currentLot, prevLot, prevProfit, loss: Math.abs(profit) }
		};
	}
};
