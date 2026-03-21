import { describe, it, expect } from 'vitest';
import { buildDailyHistory, buildKpiMetrics } from '../server/portfolio';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTrade(overrides: Record<string, unknown> = {}) {
	return {
		id: 'trade-1',
		client_account_id: 'acc-1',
		symbol: 'EURUSD',
		type: 'BUY',
		lot_size: 0.1,
		open_price: 1.1,
		close_price: 1.105,
		// Use UTC noon so Thailand offset (+7h) stays on same calendar day
		open_time: '2024-01-15T05:00:00Z',
		close_time: '2024-01-15T05:00:00Z', // 12:00 Thai time → 2024-01-15
		profit: 100,
		sl: null,
		tp: null,
		position_id: 1,
		pips: 50,
		commission: 0,
		swap: 0,
		created_at: '2024-01-15T05:00:00Z',
		trade_tag_assignments: [],
		trade_notes: [],
		trade_reviews: [],
		trade_attachments: [],
		...overrides
	};
}

// ─── buildDailyHistory ───────────────────────────────────────────────────────

describe('buildDailyHistory', () => {
	it('returns empty array for empty input', () => {
		expect(buildDailyHistory([])).toEqual([]);
	});

	it('returns empty array for null/undefined input', () => {
		// @ts-expect-error testing null input
		expect(buildDailyHistory(null)).toEqual([]);
	});

	it('groups a single trade into one day', () => {
		const trades = [makeTrade({ profit: 50 })];
		const result = buildDailyHistory(trades);
		expect(result).toHaveLength(1);
		expect(result[0].profit).toBe(50);
		expect(result[0].totalTrades).toBe(1);
		expect(result[0].date).toBe('2024-01-15');
	});

	it('aggregates multiple trades on the same day', () => {
		const trades = [
			makeTrade({ id: 'trade-1', profit: 100, close_time: '2024-01-15T05:00:00Z' }),
			makeTrade({ id: 'trade-2', profit: -40, close_time: '2024-01-15T08:00:00Z' }),
			makeTrade({ id: 'trade-3', profit: 60, close_time: '2024-01-15T10:00:00Z' })
		];
		const result = buildDailyHistory(trades);
		expect(result).toHaveLength(1);
		expect(result[0].profit).toBeCloseTo(120);
		expect(result[0].totalTrades).toBe(3);
	});

	it('separates trades on different days', () => {
		const trades = [
			makeTrade({ id: 'trade-1', profit: 50, close_time: '2024-01-15T05:00:00Z' }),
			makeTrade({ id: 'trade-2', profit: -30, close_time: '2024-01-16T05:00:00Z' }),
			makeTrade({ id: 'trade-3', profit: 80, close_time: '2024-01-17T05:00:00Z' })
		];
		const result = buildDailyHistory(trades);
		expect(result).toHaveLength(3);
	});

	it('sorts output ascending by date', () => {
		const trades = [
			makeTrade({ id: 'trade-3', profit: 80, close_time: '2024-01-17T05:00:00Z' }),
			makeTrade({ id: 'trade-1', profit: 50, close_time: '2024-01-15T05:00:00Z' }),
			makeTrade({ id: 'trade-2', profit: -30, close_time: '2024-01-16T05:00:00Z' })
		];
		const result = buildDailyHistory(trades);
		expect(result[0].date).toBe('2024-01-15');
		expect(result[1].date).toBe('2024-01-16');
		expect(result[2].date).toBe('2024-01-17');
	});

	it('calculates win rate correctly', () => {
		const trades = [
			makeTrade({ id: 't1', profit: 100 }),
			makeTrade({ id: 't2', profit: 50 }),
			makeTrade({ id: 't3', profit: -30 }),
			makeTrade({ id: 't4', profit: 0 })
		];
		const result = buildDailyHistory(trades);
		// 2 wins out of 4 trades = 50%
		expect(result[0].winRate).toBe(50);
	});

	it('returns winRate=0 when no trades', () => {
		// Edge: handled by empty array guard
		const result = buildDailyHistory([]);
		expect(result).toHaveLength(0);
	});

	it('computes bestTrade and worstTrade correctly', () => {
		const trades = [
			makeTrade({ id: 't1', profit: 200 }),
			makeTrade({ id: 't2', profit: 50 }),
			makeTrade({ id: 't3', profit: -80 }),
			makeTrade({ id: 't4', profit: -10 })
		];
		const result = buildDailyHistory(trades);
		expect(result[0].bestTrade).toBe(200);
		expect(result[0].worstTrade).toBe(-80);
	});

	it('sets bestTrade=0 when no winning trades', () => {
		const trades = [
			makeTrade({ id: 't1', profit: -50 }),
			makeTrade({ id: 't2', profit: -20 })
		];
		const result = buildDailyHistory(trades);
		expect(result[0].bestTrade).toBe(0);
	});

	it('sets worstTrade=0 when no losing trades', () => {
		const trades = [
			makeTrade({ id: 't1', profit: 100 }),
			makeTrade({ id: 't2', profit: 50 })
		];
		const result = buildDailyHistory(trades);
		expect(result[0].worstTrade).toBe(0);
	});

	it('counts reviewed trades correctly', () => {
		const reviewed = makeTrade({
			id: 't1',
			trade_reviews: [{ id: 'rev-1', review_status: 'reviewed' }]
		});
		const unreviewed = makeTrade({ id: 't2', profit: 50 });
		const result = buildDailyHistory([reviewed, unreviewed]);
		expect(result[0].reviewedTrades).toBe(1);
	});

	it('treats null/undefined profit as 0', () => {
		const trades = [
			makeTrade({ id: 't1', profit: null }),
			makeTrade({ id: 't2', profit: undefined })
		];
		const result = buildDailyHistory(trades);
		expect(result[0].profit).toBe(0);
		expect(result[0].totalTrades).toBe(2);
	});
});

// ─── buildKpiMetrics ─────────────────────────────────────────────────────────

describe('buildKpiMetrics', () => {
	it('returns zero state for empty trades', () => {
		const result = buildKpiMetrics([], []);
		expect(result.netPnl).toBe(0);
		expect(result.totalTrades).toBe(0);
		expect(result.tradeWinRate).toBe(0);
		expect(result.profitFactor).toBe(0);
		expect(result.dayWinRate).toBe(0);
		expect(result.cumulativePnl).toEqual([]);
	});

	it('calculates netPnl correctly', () => {
		const trades = [
			makeTrade({ id: 't1', profit: 200 }),
			makeTrade({ id: 't2', profit: -50 }),
			makeTrade({ id: 't3', profit: 100 })
		];
		const daily = buildDailyHistory(trades);
		const result = buildKpiMetrics(trades, daily);
		expect(result.netPnl).toBeCloseTo(250);
	});

	it('counts winning, losing, and breakeven trades', () => {
		const trades = [
			makeTrade({ id: 't1', profit: 100 }),
			makeTrade({ id: 't2', profit: -50 }),
			makeTrade({ id: 't3', profit: 0 })
		];
		const daily = buildDailyHistory(trades);
		const result = buildKpiMetrics(trades, daily);
		expect(result.winningTrades).toBe(1);
		expect(result.losingTrades).toBe(1);
		expect(result.breakEvenTrades).toBe(1);
		expect(result.totalTrades).toBe(3);
	});

	it('calculates tradeWinRate correctly', () => {
		const trades = [
			makeTrade({ id: 't1', profit: 100 }),
			makeTrade({ id: 't2', profit: 50 }),
			makeTrade({ id: 't3', profit: -30 }),
			makeTrade({ id: 't4', profit: -20 })
		];
		const daily = buildDailyHistory(trades);
		const result = buildKpiMetrics(trades, daily);
		expect(result.tradeWinRate).toBe(50);
	});

	it('calculates profitFactor correctly', () => {
		const trades = [
			makeTrade({ id: 't1', profit: 300 }),
			makeTrade({ id: 't2', profit: -100 })
		];
		const daily = buildDailyHistory(trades);
		const result = buildKpiMetrics(trades, daily);
		expect(result.profitFactor).toBeCloseTo(3);
	});

	it('caps profitFactor to 999 when no losses', () => {
		const trades = [makeTrade({ id: 't1', profit: 500 })];
		const daily = buildDailyHistory(trades);
		const result = buildKpiMetrics(trades, daily);
		expect(result.profitFactor).toBe(999);
	});

	it('calculates avgWin and avgLoss correctly', () => {
		const trades = [
			makeTrade({ id: 't1', profit: 100 }),
			makeTrade({ id: 't2', profit: 200 }),
			makeTrade({ id: 't3', profit: -50 }),
			makeTrade({ id: 't4', profit: -150 })
		];
		const daily = buildDailyHistory(trades);
		const result = buildKpiMetrics(trades, daily);
		expect(result.avgWin).toBe(150);
		expect(result.avgLoss).toBe(100);
		expect(result.avgWinLossRatio).toBeCloseTo(1.5);
	});

	it('calculates dayWinRate across multiple days', () => {
		const trades = [
			makeTrade({ id: 't1', profit: 100, close_time: '2024-01-15T05:00:00Z' }),
			makeTrade({ id: 't2', profit: -30, close_time: '2024-01-16T05:00:00Z' }),
			makeTrade({ id: 't3', profit: 80, close_time: '2024-01-17T05:00:00Z' })
		];
		const daily = buildDailyHistory(trades);
		const result = buildKpiMetrics(trades, daily);
		// 2 profitable days, 1 losing day → 66.67%
		expect(result.profitableDays).toBe(2);
		expect(result.totalTradingDays).toBe(3);
		expect(result.dayWinRate).toBeCloseTo(66.67, 1);
	});

	it('produces cumulativePnl series in date order', () => {
		const trades = [
			makeTrade({ id: 't1', profit: 100, close_time: '2024-01-15T05:00:00Z' }),
			makeTrade({ id: 't2', profit: 50, close_time: '2024-01-16T05:00:00Z' })
		];
		const daily = buildDailyHistory(trades);
		const result = buildKpiMetrics(trades, daily);
		expect(result.cumulativePnl).toHaveLength(2);
		expect(result.cumulativePnl[0]).toEqual({ date: '2024-01-15', value: 100 });
		expect(result.cumulativePnl[1]).toEqual({ date: '2024-01-16', value: 150 });
	});

	it('calculates maxDrawdownPct correctly', () => {
		// Day1: +200, Day2: -100, Day3: +50
		// Running: 200, 100, 150 — peak=200, dd=100, maxDrawdownPct = 100/200 * 100 = 50%
		const trades = [
			makeTrade({ id: 't1', profit: 200, close_time: '2024-01-15T05:00:00Z' }),
			makeTrade({ id: 't2', profit: -100, close_time: '2024-01-16T05:00:00Z' }),
			makeTrade({ id: 't3', profit: 50, close_time: '2024-01-17T05:00:00Z' })
		];
		const daily = buildDailyHistory(trades);
		const result = buildKpiMetrics(trades, daily);
		expect(result.maxDrawdownPct).toBeCloseTo(50);
	});

	it('returns maxDrawdownPct=0 when no drawdown', () => {
		const trades = [
			makeTrade({ id: 't1', profit: 100, close_time: '2024-01-15T05:00:00Z' }),
			makeTrade({ id: 't2', profit: 200, close_time: '2024-01-16T05:00:00Z' })
		];
		const daily = buildDailyHistory(trades);
		const result = buildKpiMetrics(trades, daily);
		expect(result.maxDrawdownPct).toBe(0);
	});

	it('calculates recoveryFactor correctly', () => {
		// netPnl=150, maxDrawdown=100 → recoveryFactor=1.5
		const trades = [
			makeTrade({ id: 't1', profit: 200, close_time: '2024-01-15T05:00:00Z' }),
			makeTrade({ id: 't2', profit: -100, close_time: '2024-01-16T05:00:00Z' }),
			makeTrade({ id: 't3', profit: 50, close_time: '2024-01-17T05:00:00Z' })
		];
		const daily = buildDailyHistory(trades);
		const result = buildKpiMetrics(trades, daily);
		expect(result.recoveryFactor).toBeCloseTo(1.5);
	});

	it('caps recoveryFactor at 10', () => {
		// Very small drawdown relative to large profit
		const trades = [
			makeTrade({ id: 't1', profit: 1000, close_time: '2024-01-15T05:00:00Z' }),
			makeTrade({ id: 't2', profit: -1, close_time: '2024-01-16T05:00:00Z' }),
			makeTrade({ id: 't3', profit: 500, close_time: '2024-01-17T05:00:00Z' })
		];
		const daily = buildDailyHistory(trades);
		const result = buildKpiMetrics(trades, daily);
		expect(result.recoveryFactor).toBeLessThanOrEqual(10);
	});

	it('calculates consistency for consistent daily returns', () => {
		// Same profit each day → very consistent
		const trades = [
			makeTrade({ id: 't1', profit: 100, close_time: '2024-01-15T05:00:00Z' }),
			makeTrade({ id: 't2', profit: 100, close_time: '2024-01-16T05:00:00Z' }),
			makeTrade({ id: 't3', profit: 100, close_time: '2024-01-17T05:00:00Z' })
		];
		const daily = buildDailyHistory(trades);
		const result = buildKpiMetrics(trades, daily);
		// cv=0 when stdDev=0 → consistency = max(0, min(1, 1 - 0/3)) = 1
		expect(result.consistency).toBeCloseTo(1);
	});

	it('returns consistency=0 for single trading day', () => {
		const trades = [makeTrade({ id: 't1', profit: 100 })];
		const daily = buildDailyHistory(trades);
		const result = buildKpiMetrics(trades, daily);
		// Only 1 day → consistency stays 0 (needs >1 day)
		expect(result.consistency).toBe(0);
	});

	it('treats null profit as 0', () => {
		const trades = [makeTrade({ id: 't1', profit: null })];
		const daily = buildDailyHistory(trades);
		const result = buildKpiMetrics(trades, daily);
		expect(result.netPnl).toBe(0);
		expect(result.breakEvenTrades).toBe(1);
	});
});
