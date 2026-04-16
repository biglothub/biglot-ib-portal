import type { InsightRule } from '../types';

/** Multiple trades on the same symbol opened within a 5-minute window — possible scaling */
export const scaleDetectionRule: InsightRule = {
	id: 'scale_detection',
	name: 'Scale In/Out Detected',
	evaluate(trade, context) {
		const openTime = new Date(trade.open_time).getTime();

		const nearbyTrades = context.symbolTrades.filter(t => {
			if (t.id === trade.id) return false;
			const tOpen = new Date(t.open_time).getTime();
			return Math.abs(openTime - tOpen) <= 5 * 60 * 1000; // within 5 minutes
		});

		if (nearbyTrades.length === 0) return null;

		const sameDirection = nearbyTrades.filter(t => t.type === trade.type).length;
		const oppositeDirection = nearbyTrades.length - sameDirection;

		const action = sameDirection > oppositeDirection ? 'scale-in' : 'scale-out';

		return {
			ruleId: this.id,
			category: 'info',
			message: `อาจเป็น ${action === 'scale-in' ? 'การเพิ่มไซส์' : 'การลดไซส์'} — มี ${nearbyTrades.length + 1} trade ${trade.symbol} ภายใน 5 นาที`,
			data: { nearbyCount: nearbyTrades.length, action, sameDirection, oppositeDirection }
		};
	}
};
