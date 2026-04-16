import type { InsightRule } from '../types';

/** Trade had a TP target but closed near breakeven */
export const greenToBreakevenRule: InsightRule = {
	id: 'green_to_breakeven',
	name: 'Green to Breakeven',
	evaluate(trade, context) {
		const profit = Number(trade.profit || 0);
		if (profit === 0 || context.avgSymbolWin <= 0) return null;

		const tp = Number(trade.tp || 0);
		const openPrice = Number(trade.open_price);
		if (!tp || tp === 0) return null;

		// TP was on the winning side
		const tpOnWinningSide =
			(trade.type === 'BUY' && tp > openPrice) ||
			(trade.type === 'SELL' && tp < openPrice);
		if (!tpOnWinningSide) return null;

		// Profit is near zero (within 5% of avg win)
		const threshold = context.avgSymbolWin * 0.05;
		if (Math.abs(profit) > threshold) return null;

		return {
			ruleId: this.id,
			category: 'warning',
			message: `Green to Breakeven — ตั้ง TP ไว้แต่ปิดที่ $${profit.toFixed(2)}`,
			data: { profit, tp, avgWin: context.avgSymbolWin }
		};
	}
};
