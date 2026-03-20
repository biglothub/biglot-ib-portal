import type { DayInsightRule } from '../types';

/** 3+ losses within 5 minutes of each other — emotional/tilt trading */
export const tiltSessionRule: DayInsightRule = {
	id: 'tilt_session',
	name: 'Tilt Session',
	evaluate(dayTrades) {
		if (dayTrades.length < 3) return null;

		const losses = dayTrades
			.filter(t => Number(t.profit || 0) < 0)
			.sort((a, b) => new Date(a.close_time).getTime() - new Date(b.close_time).getTime());

		if (losses.length < 3) return null;

		// Check for 3 consecutive losses within 5 minutes of each other
		for (let i = 0; i <= losses.length - 3; i++) {
			const first = new Date(losses[i].close_time).getTime();
			const third = new Date(losses[i + 2].close_time).getTime();
			if (third - first <= 5 * 60 * 1000) {
				const date = dayTrades[0].close_time.split('T')[0];
				const totalTiltLoss = losses.slice(i, i + 3).reduce((s, t) => s + Math.abs(Number(t.profit || 0)), 0);
				return {
					ruleId: this.id,
					category: 'negative',
					message: `Tilt session — 3 losses within 5 minutes, total loss $${totalTiltLoss.toFixed(2)}`,
					data: { lossCount: 3, windowMinutes: 5, totalTiltLoss },
					date
				};
			}
		}

		return null;
	}
};
