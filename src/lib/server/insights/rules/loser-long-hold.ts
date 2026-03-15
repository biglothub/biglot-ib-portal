import type { InsightRule } from '../types';

function holdMinutes(trade: { open_time: string; close_time: string }) {
	return (new Date(trade.close_time).getTime() - new Date(trade.open_time).getTime()) / 60000;
}

function formatDuration(mins: number) {
	if (mins < 60) return `${Math.round(mins)}m`;
	const h = Math.floor(mins / 60);
	const m = Math.round(mins % 60);
	return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Losing trade held much longer than average losing trade */
export const loserLongHoldRule: InsightRule = {
	id: 'loser_long_hold',
	name: 'Loser Long Hold',
	evaluate(trade, context) {
		const profit = Number(trade.profit || 0);
		if (profit >= 0) return null;

		// Calculate avg hold time for losing trades of this symbol
		const losingTrades = context.symbolTrades.filter(t => Number(t.profit || 0) < 0 && t.id !== trade.id);
		if (losingTrades.length < 3) return null;

		const avgLoserHold = losingTrades.reduce((s, t) => s + holdMinutes(t), 0) / losingTrades.length;
		const thisHold = holdMinutes(trade);

		if (thisHold < avgLoserHold * 2) return null;

		return {
			ruleId: this.id,
			category: 'negative',
			message: `Held losing trade ${formatDuration(thisHold)} — avg losing hold is ${formatDuration(avgLoserHold)}`,
			data: { holdMinutes: thisHold, avgLoserHold, profit }
		};
	}
};
