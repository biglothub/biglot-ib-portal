import type { InsightRule } from '../types';

/** Winning trade that closed well below the TP target — left significant profit on the table */
export const leftMoneyOnTableRule: InsightRule = {
	id: 'left_money_on_table',
	name: 'Left Money on Table',
	evaluate(trade) {
		const profit = Number(trade.profit || 0);
		if (profit <= 0) return null;

		const tp = Number(trade.tp || 0);
		const openPrice = Number(trade.open_price);
		const closePrice = Number(trade.close_price);
		if (!tp || tp === 0) return null;

		// Calculate how much of the TP distance was captured
		const totalDistance = Math.abs(tp - openPrice);
		if (totalDistance <= 0) return null;

		const capturedDistance = trade.type === 'BUY'
			? closePrice - openPrice
			: openPrice - closePrice;

		if (capturedDistance <= 0) return null;

		const missedPct = ((totalDistance - capturedDistance) / totalDistance) * 100;

		// Only flag if missed > 50% of the planned move
		if (missedPct < 50) return null;

		return {
			ruleId: this.id,
			category: 'warning',
			message: `Left ${missedPct.toFixed(0)}% of TP target on the table — captured only ${(100 - missedPct).toFixed(0)}% of planned move`,
			data: { missedPct, capturedDistance, totalDistance, profit }
		};
	}
};
