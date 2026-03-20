import type { DayInsightRule } from '../types';

/** Only 1-2 trades taken and all profitable — disciplined, high-conviction day */
export const highConvictionDayRule: DayInsightRule = {
	id: 'high_conviction_day',
	name: 'High Conviction Day',
	evaluate(dayTrades) {
		if (dayTrades.length === 0 || dayTrades.length > 2) return null;

		const allWinning = dayTrades.every(t => Number(t.profit || 0) > 0);
		if (!allWinning) return null;

		const totalProfit = dayTrades.reduce((s, t) => s + Number(t.profit || 0), 0);
		const date = dayTrades[0].close_time.split('T')[0];

		return {
			ruleId: this.id,
			category: 'positive',
			message: `High conviction — only ${dayTrades.length} trade${dayTrades.length > 1 ? 's' : ''}, precise execution (+$${totalProfit.toFixed(2)})`,
			data: { tradeCount: dayTrades.length, totalProfit },
			date
		};
	}
};
