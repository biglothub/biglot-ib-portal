import type { DayInsightRule } from '../types';

/** All trades profitable — perfect execution day */
export const perfectDayRule: DayInsightRule = {
	id: 'perfect_day',
	name: 'Perfect Day',
	evaluate(dayTrades) {
		if (dayTrades.length === 0) return null;

		const allWinning = dayTrades.every(t => Number(t.profit || 0) > 0);
		if (!allWinning) return null;

		const totalProfit = dayTrades.reduce((s, t) => s + Number(t.profit || 0), 0);
		const date = dayTrades[0].close_time.split('T')[0];

		return {
			ruleId: this.id,
			category: 'positive',
			message: `Perfect day — ${dayTrades.length} trade${dayTrades.length > 1 ? 's' : ''}, all profitable (+$${totalProfit.toFixed(2)})`,
			data: { tradeCount: dayTrades.length, totalProfit },
			date
		};
	}
};
