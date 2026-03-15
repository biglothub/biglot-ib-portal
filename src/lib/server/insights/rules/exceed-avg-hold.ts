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

/** Trade was held significantly longer than average for this symbol */
export const exceedAvgHoldRule: InsightRule = {
	id: 'exceed_avg_hold',
	name: 'Exceeded Average Hold Time',
	evaluate(trade, context) {
		if (context.avgSymbolHoldMinutes <= 0) return null;
		const hold = holdMinutes(trade);
		if (hold < context.avgSymbolHoldMinutes * 2) return null;

		return {
			ruleId: this.id,
			category: 'warning',
			message: `Held ${formatDuration(hold)} vs average ${formatDuration(context.avgSymbolHoldMinutes)} for ${trade.symbol}`,
			data: { holdMinutes: hold, avgHoldMinutes: context.avgSymbolHoldMinutes }
		};
	}
};
