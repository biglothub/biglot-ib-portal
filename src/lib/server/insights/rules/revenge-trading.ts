import type { InsightRule } from '../types';

/** Loss trade opened within 30 seconds of a previous loss closing — possible revenge trade */
export const revengeTradingRule: InsightRule = {
	id: 'revenge_trading',
	name: 'Revenge Trading',
	evaluate(trade, context) {
		const profit = Number(trade.profit || 0);
		if (profit >= 0) return null;

		const openTime = new Date(trade.open_time).getTime();

		// Find loss trades that closed within 30 seconds before this trade opened
		const revengeWindow = context.allTrades.filter(t => {
			if (t.id === trade.id) return false;
			if (Number(t.profit || 0) >= 0) return false;
			const closeTime = new Date(t.close_time).getTime();
			const gap = openTime - closeTime;
			return gap >= 0 && gap <= 30000; // 0-30 seconds
		});

		if (revengeWindow.length === 0) return null;

		return {
			ruleId: this.id,
			category: 'negative',
			message: `Revenge trade — opened ${Math.round((openTime - new Date(revengeWindow[0].close_time).getTime()) / 1000)}s after a losing trade closed`,
			data: { gapSeconds: (openTime - new Date(revengeWindow[0].close_time).getTime()) / 1000, priorLoss: Number(revengeWindow[0].profit) }
		};
	}
};
