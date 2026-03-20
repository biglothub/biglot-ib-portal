import type { DayInsightRule } from '../types';

/** Alternating BUY/SELL on same symbol 3+ times in a day */
export const flipFlopDayRule: DayInsightRule = {
	id: 'flip_flop_day',
	name: 'Flip-Flop Day',
	evaluate(dayTrades) {
		if (dayTrades.length < 3) return null;

		// Group by symbol
		const bySymbol = new Map<string, typeof dayTrades>();
		for (const t of dayTrades) {
			const arr = bySymbol.get(t.symbol) || [];
			arr.push(t);
			bySymbol.set(t.symbol, arr);
		}

		for (const [symbol, trades] of bySymbol) {
			if (trades.length < 3) continue;

			const sorted = [...trades].sort((a, b) =>
				new Date(a.open_time).getTime() - new Date(b.open_time).getTime()
			);

			let alternations = 0;
			for (let i = 1; i < sorted.length; i++) {
				if (sorted[i].type !== sorted[i - 1].type) {
					alternations++;
				}
			}

			if (alternations >= 3) {
				const date = dayTrades[0].close_time.split('T')[0];
				return {
					ruleId: this.id,
					category: 'warning',
					message: `Flip-flop day — ${alternations} direction changes on ${symbol}`,
					data: { symbol, alternations, tradeCount: trades.length },
					date
				};
			}
		}

		return null;
	}
};
