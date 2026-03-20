import type { DayInsightRule } from '../types';

/** Trade count exceeds 2x the 60-day daily average */
export const overtradingDayRule: DayInsightRule = {
	id: 'overtrading_day',
	name: 'Overtrading Day',
	evaluate(dayTrades, context) {
		if (dayTrades.length === 0) return null;
		if (context.recentDays.length < 5) return null; // Need baseline

		const avgDaily = context.recentDays.reduce((s, d) => s + d.trades.length, 0) / context.recentDays.length;
		if (avgDaily <= 0 || dayTrades.length < avgDaily * 2) return null;

		const date = dayTrades[0].close_time.split('T')[0];
		const ratio = (dayTrades.length / avgDaily).toFixed(1);

		return {
			ruleId: this.id,
			category: 'warning',
			message: `Overtrading — ${dayTrades.length} trades (${ratio}x above ${avgDaily.toFixed(0)} daily avg)`,
			data: { tradeCount: dayTrades.length, avgDaily, ratio: dayTrades.length / avgDaily },
			date
		};
	}
};
