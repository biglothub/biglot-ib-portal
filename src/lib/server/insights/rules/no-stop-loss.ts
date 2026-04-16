import type { InsightRule } from '../types';

/** Trade was opened without a stop loss */
export const noStopLossRule: InsightRule = {
	id: 'no_stop_loss',
	name: 'No Stop Loss',
	evaluate(trade) {
		if (trade.sl && trade.sl > 0) return null;

		return {
			ruleId: this.id,
			category: 'negative',
			message: `ไม่ได้ตั้ง Stop Loss — การเทรดโดยไม่มี SL เพิ่มความเสี่ยงอย่างมาก`,
			data: { symbol: trade.symbol }
		};
	}
};
