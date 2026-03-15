import type { InsightRule } from '../types';

/** Profitable trade closed very quickly (< 5 minutes) */
export const quickScalpRule: InsightRule = {
	id: 'quick_scalp',
	name: 'Quick Scalp',
	evaluate(trade) {
		const profit = Number(trade.profit || 0);
		if (profit <= 0) return null;

		const holdMs = new Date(trade.close_time).getTime() - new Date(trade.open_time).getTime();
		const holdMinutes = holdMs / 60000;
		if (holdMinutes >= 5) return null;

		return {
			ruleId: this.id,
			category: 'info',
			message: `Quick scalp — closed in ${holdMinutes < 1 ? '<1' : Math.round(holdMinutes)} minute${holdMinutes >= 2 ? 's' : ''} with $${profit.toFixed(2)} profit`,
			data: { holdMinutes, profit }
		};
	}
};
