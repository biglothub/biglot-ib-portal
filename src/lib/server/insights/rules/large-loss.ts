import type { InsightRule } from '../types';

/** Trade loss exceeded 2x the average loss for this symbol */
export const largeLossRule: InsightRule = {
	id: 'large_loss',
	name: 'Large Loss',
	evaluate(trade, context) {
		const profit = Number(trade.profit || 0);
		if (profit >= 0 || context.avgSymbolLoss <= 0) return null;
		const loss = Math.abs(profit);
		if (loss < context.avgSymbolLoss * 2) return null;

		return {
			ruleId: this.id,
			category: 'negative',
			message: `Large loss — $${loss.toFixed(2)} vs $${context.avgSymbolLoss.toFixed(2)} avg loss for ${trade.symbol}`,
			data: { loss, avgLoss: context.avgSymbolLoss, ratio: loss / context.avgSymbolLoss }
		};
	}
};
