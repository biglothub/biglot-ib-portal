import type { InsightRule } from '../types';

/** Winning trade where SL distance suggests significant adverse movement was survived */
export const recoveryTradeRule: InsightRule = {
	id: 'recovery_trade',
	name: 'Recovery Trade',
	evaluate(trade) {
		const profit = Number(trade.profit || 0);
		if (profit <= 0) return null;

		const sl = Number(trade.sl || 0);
		const openPrice = Number(trade.open_price);
		const closePrice = Number(trade.close_price);
		if (!sl || sl === 0) return null;

		// SL distance represents max planned risk
		const slDistance = Math.abs(openPrice - sl);
		const gain = Math.abs(closePrice - openPrice);

		if (slDistance <= 0 || gain <= 0) return null;

		// SL was deep relative to actual gain — trade survived significant risk
		if (slDistance < gain * 0.5) return null;

		return {
			ruleId: this.id,
			category: 'positive',
			message: `Recovery trade — won $${profit.toFixed(2)} despite tight SL (risk distance ${(slDistance / gain).toFixed(1)}x gain)`,
			data: { profit, slDistance, gain, riskToGainRatio: slDistance / gain }
		};
	}
};
