import type { InsightRule } from '../types';

/** Trade lot size is significantly higher than average for this symbol */
export const highVolumeRule: InsightRule = {
	id: 'high_volume',
	name: 'Unusual High Volume',
	evaluate(trade, context) {
		if (context.symbolTrades.length < 5) return null;

		const avgLot = context.symbolTrades.reduce((s, t) => s + Number(t.lot_size || 0), 0) / context.symbolTrades.length;
		const tradeLot = Number(trade.lot_size || 0);

		if (avgLot <= 0 || tradeLot < avgLot * 2) return null;

		return {
			ruleId: this.id,
			category: 'warning',
			message: `Unusual volume — ${tradeLot} lots vs ${avgLot.toFixed(2)} avg for ${trade.symbol}`,
			data: { lotSize: tradeLot, avgLot, ratio: tradeLot / avgLot }
		};
	}
};
