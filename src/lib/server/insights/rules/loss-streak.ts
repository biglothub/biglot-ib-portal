import type { InsightRule } from '../types';

/** 3+ consecutive losses within 60 minutes — possible revenge trading */
export const lossStreakRule: InsightRule = {
	id: 'loss_streak_short_gap',
	name: 'Loss Streak Short Gap',
	evaluate(trade, context) {
		const profit = Number(trade.profit || 0);
		if (profit >= 0) return null;

		const tradeTime = new Date(trade.close_time).getTime();
		const recentLosses = context.allTrades.filter(t => {
			if (t.id === trade.id) return false;
			const p = Number(t.profit || 0);
			if (p >= 0) return false;
			const tTime = new Date(t.close_time).getTime();
			const diffMinutes = Math.abs(tradeTime - tTime) / 60000;
			return diffMinutes <= 60;
		});

		if (recentLosses.length < 2) return null; // need 3 total (this + 2 others)

		return {
			ruleId: this.id,
			category: 'negative',
			message: `${recentLosses.length + 1} consecutive losses within 60 minutes — possible revenge trading`,
			data: { lossCount: recentLosses.length + 1, windowMinutes: 60 }
		};
	}
};
