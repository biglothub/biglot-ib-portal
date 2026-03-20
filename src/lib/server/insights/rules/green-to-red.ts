import type { InsightRule } from '../types';

/** Trade had a TP target on the winning side but closed at a loss */
export const greenToRedRule: InsightRule = {
	id: 'green_to_red',
	name: 'Green to Red',
	evaluate(trade) {
		const profit = Number(trade.profit || 0);
		if (profit >= 0) return null;

		const tp = Number(trade.tp || 0);
		const openPrice = Number(trade.open_price);
		if (!tp || tp === 0) return null;

		// TP was on the winning side — trader planned profit but ended in loss
		const tpOnWinningSide =
			(trade.type === 'BUY' && tp > openPrice) ||
			(trade.type === 'SELL' && tp < openPrice);

		if (!tpOnWinningSide) return null;

		return {
			ruleId: this.id,
			category: 'negative',
			message: `Green to Red — had TP target but closed at $${profit.toFixed(2)} loss`,
			data: { profit, tp, openPrice }
		};
	}
};
