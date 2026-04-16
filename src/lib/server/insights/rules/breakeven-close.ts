import type { InsightRule } from '../types';

/** Trade closed at near breakeven (very small profit or loss relative to position size) */
export const breakevenCloseRule: InsightRule = {
	id: 'breakeven_close',
	name: 'Breakeven Close',
	evaluate(trade, context) {
		const profit = Number(trade.profit || 0);
		if (context.avgSymbolWin <= 0) return null;

		// Consider breakeven if profit is less than 5% of average win
		const threshold = context.avgSymbolWin * 0.05;
		if (Math.abs(profit) > threshold) return null;
		if (Math.abs(profit) === 0) return null;

		return {
			ruleId: this.id,
			category: 'info',
			message: `ปิดที่ Breakeven — $${profit.toFixed(2)} (น้อยกว่า 5% ของ avg win $${context.avgSymbolWin.toFixed(2)})`,
			data: { profit, avgWin: context.avgSymbolWin, threshold }
		};
	}
};
