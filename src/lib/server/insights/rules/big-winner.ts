import type { InsightRule } from '../types';

/** Trade is the best trade of the day (highest profit) */
export const bigWinnerRule: InsightRule = {
	id: 'big_winner',
	name: 'Big Winner',
	evaluate(trade, context) {
		const profit = Number(trade.profit || 0);
		if (profit <= 0) return null;

		// Check if this is the best trade among same-day trades
		const tradeDate = trade.close_time.split('T')[0];
		const sameDayTrades = context.allTrades.filter(t => {
			const d = t.close_time.split('T')[0];
			return d === tradeDate && Number(t.profit || 0) > 0;
		});

		if (sameDayTrades.length < 3) return null;

		const maxProfit = sameDayTrades.reduce((max, t) => { const v = Number(t.profit || 0); return v > max ? v : max; }, -Infinity);
		if (profit < maxProfit) return null;

		return {
			ruleId: this.id,
			category: 'positive',
			message: `Best trade of the day — $${profit.toFixed(2)} profit out of ${sameDayTrades.length} winning trades`,
			data: { profit, dayWinners: sameDayTrades.length }
		};
	}
};
