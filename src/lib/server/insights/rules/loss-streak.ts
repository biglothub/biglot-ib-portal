import type { InsightRule } from '../types';

/** 3+ consecutive losses within 60 minutes — possible revenge trading */
export const lossStreakRule: InsightRule = {
	id: 'loss_streak_short_gap',
	name: 'Loss Streak Short Gap',
	evaluate(trade, context) {
		const profit = Number(trade.profit || 0);
		if (profit >= 0) return null;

		const tradeTime = new Date(trade.close_time).getTime();

		// Get trades closed before this one, sorted by close_time descending (most recent first)
		const priorTrades = context.allTrades
			.filter(t => {
				if (t.id === trade.id) return false;
				const tTime = new Date(t.close_time).getTime();
				return tTime < tradeTime && (tradeTime - tTime) <= 60 * 60000;
			})
			.sort((a, b) => new Date(b.close_time).getTime() - new Date(a.close_time).getTime());

		// Count consecutive losses (stop at first non-loss)
		let consecutiveLosses = 0;
		for (const t of priorTrades) {
			if (Number(t.profit || 0) >= 0) break;
			consecutiveLosses++;
		}

		if (consecutiveLosses < 2) return null; // need 3 total (this + 2 prior)

		return {
			ruleId: this.id,
			category: 'negative',
			message: `${consecutiveLosses + 1} consecutive losses within 60 minutes — possible revenge trading`,
			data: { lossCount: consecutiveLosses + 1, windowMinutes: 60 }
		};
	}
};
