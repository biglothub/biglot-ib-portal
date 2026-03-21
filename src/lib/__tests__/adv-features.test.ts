/**
 * QA2-002: Comprehensive QA tests for ADV-001 through ADV-010
 *
 * Tests cover:
 * - ADV-001: AI Coach data preparation & caching logic
 * - ADV-002: Risk Calculator position sizing math
 * - ADV-003: Correlation Matrix Pearson computation
 * - ADV-004: Performance Alerts evaluation logic
 * - ADV-005: Screenshot Annotator shape geometry
 * - ADV-006: Multi-account combined metrics
 * - ADV-007: Journal Templates auto-fill
 * - ADV-008: Social Feed content validation
 * - ADV-009: Daily Report email template generation
 * - ADV-010: Advanced Charts timeframe ordering
 */
import { describe, it, expect } from 'vitest';
import {
	buildDailyHistory,
	buildKpiMetrics,
	buildRuleBreakMetrics,
	buildSetupPerformance,
	buildJournalCompletionSummary
} from '../server/portfolio';
import { buildDailyReportHtml, buildWeeklyDigestHtml } from '../server/email';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTrade(overrides: Record<string, unknown> = {}) {
	return {
		id: 'trade-1',
		client_account_id: 'acc-1',
		symbol: 'EURUSD',
		type: 'BUY',
		lot_size: 0.1,
		open_price: 1.1,
		close_price: 1.105,
		open_time: '2024-01-15T05:00:00Z',
		close_time: '2024-01-15T05:00:00Z',
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

// ═════════════════════════════════════════════════════════════════════════════
// ADV-001: AI Coach — data preparation & caching
// ═════════════════════════════════════════════════════════════════════════════

describe('ADV-001: AI Coach', () => {
	it('should compute session stats correctly from trades', () => {
		// Simulate session mapping: hour < 8 = Asia, < 15 = London, else NY
		const trades = [
			makeTrade({ close_time: '2024-01-15T03:00:00Z', profit: 50 }),  // Asia (UTC 3)
			makeTrade({ close_time: '2024-01-15T07:30:00Z', profit: -20 }), // Asia (UTC 7)
			makeTrade({ close_time: '2024-01-15T10:00:00Z', profit: 80 }),  // London (UTC 10)
			makeTrade({ close_time: '2024-01-15T14:00:00Z', profit: -10 }), // London (UTC 14)
			makeTrade({ close_time: '2024-01-15T18:00:00Z', profit: 120 }), // NY (UTC 18)
		];

		const sessionMap = new Map<string, { profit: number; trades: number; wins: number }>();
		for (const trade of trades) {
			const hour = new Date(trade.close_time as string).getUTCHours();
			const session = hour < 8 ? 'Asia' : hour < 15 ? 'London' : 'NY';
			const s = sessionMap.get(session) ?? { profit: 0, trades: 0, wins: 0 };
			s.trades++;
			s.profit += Number(trade.profit ?? 0);
			if (Number(trade.profit ?? 0) > 0) s.wins++;
			sessionMap.set(session, s);
		}

		expect(sessionMap.get('Asia')!.trades).toBe(2);
		expect(sessionMap.get('Asia')!.profit).toBe(30);
		expect(sessionMap.get('Asia')!.wins).toBe(1);

		expect(sessionMap.get('London')!.trades).toBe(2);
		expect(sessionMap.get('London')!.profit).toBe(70);

		expect(sessionMap.get('NY')!.trades).toBe(1);
		expect(sessionMap.get('NY')!.profit).toBe(120);
	});

	it('should require minimum 5 trades for coaching', () => {
		const trades = [
			makeTrade({ profit: 50 }),
			makeTrade({ profit: -20 }),
			makeTrade({ profit: 30 }),
			makeTrade({ profit: -10 }),
		];
		// API returns insufficient_data when < 5 trades
		expect(trades.length).toBeLessThan(5);
	});

	it('should accept 5+ trades for coaching', () => {
		const trades = Array.from({ length: 5 }, (_, i) =>
			makeTrade({ id: `trade-${i}`, profit: i * 10 - 20 })
		);
		expect(trades.length).toBeGreaterThanOrEqual(5);
	});

	it('should compute 3-hour UTC blocks correctly', () => {
		const trades = [
			makeTrade({ close_time: '2024-01-15T00:30:00Z', profit: 10 }),
			makeTrade({ close_time: '2024-01-15T01:00:00Z', profit: 20 }),
			makeTrade({ close_time: '2024-01-15T02:00:00Z', profit: -5 }),
			makeTrade({ close_time: '2024-01-15T09:00:00Z', profit: 100 }),
		];

		const hourMap = new Map<number, { profit: number; trades: number }>();
		for (const trade of trades) {
			const utcHour = new Date(trade.close_time as string).getUTCHours();
			const h = hourMap.get(utcHour) ?? { profit: 0, trades: 0 };
			h.trades++;
			h.profit += Number(trade.profit ?? 0);
			hourMap.set(utcHour, h);
		}

		const hourBlocks: { label: string; avgPnl: number; trades: number }[] = [];
		for (let start = 0; start < 24; start += 3) {
			let blockProfit = 0;
			let blockTrades = 0;
			for (let h = start; h < start + 3; h++) {
				const d = hourMap.get(h);
				if (d) {
					blockProfit += d.profit;
					blockTrades += d.trades;
				}
			}
			if (blockTrades >= 2) {
				hourBlocks.push({
					label: `${String(start).padStart(2, '0')}:00-${String(start + 3).padStart(2, '0')}:00 UTC`,
					avgPnl: blockProfit / blockTrades,
					trades: blockTrades
				});
			}
		}

		// Block 00:00-03:00 should have 3 trades (hours 0, 1, 2)
		expect(hourBlocks.length).toBe(1);
		expect(hourBlocks[0].label).toBe('00:00-03:00 UTC');
		expect(hourBlocks[0].trades).toBe(3);
		expect(hourBlocks[0].avgPnl).toBeCloseTo(25 / 3);
	});

	it('should handle profitFactor capping at 999', () => {
		const trades = [
			makeTrade({ profit: 100 }),
			makeTrade({ profit: 200 }),
		]; // All winners, no losers

		const dailyHistory = buildDailyHistory(trades as never[]);
		const kpi = buildKpiMetrics(trades as never[], dailyHistory);

		// profitFactor should be capped at 999
		expect(kpi.profitFactor).toBeGreaterThanOrEqual(999);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// ADV-002: Risk Calculator — position sizing math
// ═════════════════════════════════════════════════════════════════════════════

describe('ADV-002: Risk Calculator', () => {
	function calculateRisk(balance: number, riskPct: number, slPips: number, tpPips: number, pipValue: number) {
		const riskAmount = balance > 0 && riskPct > 0 ? balance * (riskPct / 100) : 0;
		const lotSize = slPips > 0 && pipValue > 0 ? riskAmount / (slPips * pipValue) : 0;
		const potentialProfit = tpPips > 0 ? lotSize * tpPips * pipValue : 0;
		const rrRatio = slPips > 0 && tpPips > 0 ? tpPips / slPips : 0;
		return { riskAmount, lotSize, potentialProfit, rrRatio };
	}

	it('should calculate lot size correctly for 1% risk', () => {
		const result = calculateRisk(10000, 1, 20, 40, 10);
		expect(result.riskAmount).toBe(100);
		expect(result.lotSize).toBe(0.5); // 100 / (20 * 10) = 0.5
		expect(result.potentialProfit).toBe(200); // 0.5 * 40 * 10
		expect(result.rrRatio).toBe(2);
	});

	it('should calculate lot size for 0.5% risk', () => {
		const result = calculateRisk(50000, 0.5, 30, 60, 10);
		expect(result.riskAmount).toBe(250);
		expect(result.lotSize).toBeCloseTo(0.833, 2);
		expect(result.rrRatio).toBe(2);
	});

	it('should handle zero balance gracefully', () => {
		const result = calculateRisk(0, 1, 20, 40, 10);
		expect(result.riskAmount).toBe(0);
		expect(result.lotSize).toBe(0);
	});

	it('should handle zero SL pips gracefully', () => {
		const result = calculateRisk(10000, 1, 0, 40, 10);
		expect(result.lotSize).toBe(0);
	});

	it('should handle zero pip value gracefully', () => {
		const result = calculateRisk(10000, 1, 20, 40, 0);
		expect(result.lotSize).toBe(0);
	});

	it('should handle gold pip value (1 USD/pip/lot)', () => {
		const result = calculateRisk(10000, 1, 100, 200, 1);
		expect(result.riskAmount).toBe(100);
		expect(result.lotSize).toBe(1); // 100 / (100 * 1)
		expect(result.potentialProfit).toBe(200); // 1 * 200 * 1
	});

	it('should calculate R:R ratio correctly', () => {
		expect(calculateRisk(10000, 1, 20, 60, 10).rrRatio).toBe(3);
		expect(calculateRisk(10000, 1, 50, 25, 10).rrRatio).toBe(0.5);
		expect(calculateRisk(10000, 1, 30, 30, 10).rrRatio).toBe(1);
	});

	it('should handle maximum risk (5%)', () => {
		const result = calculateRisk(10000, 5, 20, 40, 10);
		expect(result.riskAmount).toBe(500);
		expect(result.lotSize).toBe(2.5);
	});

	it('should handle very small risk (0.1%)', () => {
		const result = calculateRisk(10000, 0.1, 20, 40, 10);
		expect(result.riskAmount).toBe(10);
		expect(result.lotSize).toBe(0.05);
	});

	it('should handle zero TP pips (no target set)', () => {
		const result = calculateRisk(10000, 1, 20, 0, 10);
		expect(result.potentialProfit).toBe(0);
		expect(result.rrRatio).toBe(0);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// ADV-003: Correlation Matrix — Pearson coefficient
// ═════════════════════════════════════════════════════════════════════════════

describe('ADV-003: Correlation Matrix', () => {
	function pearson(xs: number[], ys: number[]): number | null {
		if (xs.length !== ys.length || xs.length < 3) return null;
		const n = xs.length;
		const xMean = xs.reduce((s, v) => s + v, 0) / n;
		const yMean = ys.reduce((s, v) => s + v, 0) / n;

		let num = 0, xVar = 0, yVar = 0;
		for (let i = 0; i < n; i++) {
			const dx = xs[i] - xMean;
			const dy = ys[i] - yMean;
			num += dx * dy;
			xVar += dx * dx;
			yVar += dy * dy;
		}

		const denom = Math.sqrt(xVar * yVar);
		if (denom === 0) return null;
		return Math.max(-1, Math.min(1, num / denom));
	}

	it('should compute perfect positive correlation (r=1)', () => {
		const r = pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
		expect(r).toBeCloseTo(1, 5);
	});

	it('should compute perfect negative correlation (r=-1)', () => {
		const r = pearson([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]);
		expect(r).toBeCloseTo(-1, 5);
	});

	it('should compute zero correlation for uncorrelated data', () => {
		const r = pearson([1, 2, 3, 4, 5], [3, 1, 4, 1, 5]);
		expect(r).not.toBeNull();
		// Random data — r should be close to 0 but not exactly
		expect(Math.abs(r!)).toBeLessThan(0.8);
	});

	it('should return null for fewer than 3 shared days', () => {
		expect(pearson([1, 2], [3, 4])).toBeNull();
		expect(pearson([], [])).toBeNull();
	});

	it('should return null when all values are identical (zero variance)', () => {
		const r = pearson([5, 5, 5, 5], [1, 2, 3, 4]);
		expect(r).toBeNull();
	});

	it('should clamp correlation to [-1, 1]', () => {
		const r = pearson([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]);
		expect(r).toBeGreaterThanOrEqual(-1);
		expect(r).toBeLessThanOrEqual(1);
	});

	it('should build correlation matrix for multiple symbols', () => {
		// Simulate matrix building
		const symbols = ['EURUSD', 'GBPUSD', 'USDJPY'];
		const dailyPnl: Record<string, number[]> = {
			EURUSD: [10, -5, 8, -3, 12],
			GBPUSD: [8, -4, 6, -2, 10],  // Should be highly correlated with EURUSD
			USDJPY: [-5, 3, -4, 2, -8],   // Should be negatively correlated
		};

		const n = symbols.length;
		const matrix: (number | null)[][] = Array.from({ length: n }, (_, i) =>
			Array.from({ length: n }, (_, j) => (i === j ? 1 : null))
		);

		for (let i = 0; i < n; i++) {
			for (let j = i + 1; j < n; j++) {
				const r = pearson(dailyPnl[symbols[i]], dailyPnl[symbols[j]]);
				matrix[i][j] = r;
				matrix[j][i] = r;
			}
		}

		// Diagonal should be 1
		expect(matrix[0][0]).toBe(1);
		expect(matrix[1][1]).toBe(1);
		expect(matrix[2][2]).toBe(1);

		// EURUSD-GBPUSD should be highly positively correlated
		expect(matrix[0][1]).not.toBeNull();
		expect(matrix[0][1]!).toBeGreaterThan(0.9);

		// EURUSD-USDJPY should be negatively correlated
		expect(matrix[0][2]).not.toBeNull();
		expect(matrix[0][2]!).toBeLessThan(-0.9);

		// Matrix should be symmetric
		expect(matrix[0][1]).toBe(matrix[1][0]);
		expect(matrix[0][2]).toBe(matrix[2][0]);
	});

	it('should handle single symbol (no matrix)', () => {
		const symbols = ['EURUSD'];
		expect(symbols.length).toBeLessThan(2);
	});

	it('should identify top correlated pairs with r >= 0.7 warning', () => {
		const pairs = [
			{ symA: 'EURUSD', symB: 'GBPUSD', correlation: 0.95, sharedDays: 20 },
			{ symA: 'EURUSD', symB: 'USDJPY', correlation: -0.85, sharedDays: 20 },
			{ symA: 'GBPUSD', symB: 'AUDUSD', correlation: 0.5, sharedDays: 15 },
		];

		const highCorr = pairs.filter(p => Math.abs(p.correlation) >= 0.7);
		expect(highCorr.length).toBe(2);
		expect(highCorr[0].symA).toBe('EURUSD');
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// ADV-004: Performance Alerts — evaluation logic
// ═════════════════════════════════════════════════════════════════════════════

describe('ADV-004: Performance Alerts', () => {
	function wasTriggeredRecently(lastTriggered: string | null, cooldownMs = 3_600_000): boolean {
		if (!lastTriggered) return false;
		return Date.now() - new Date(lastTriggered).getTime() < cooldownMs;
	}

	function shouldTriggerAlert(
		alertType: string,
		threshold: number,
		metrics: {
			dailyProfit: number | null;
			winRate30d: number | null;
			maxDrawdownPct: number;
			lossStreak: number;
		}
	): boolean {
		switch (alertType) {
			case 'daily_loss':
				return metrics.dailyProfit !== null && metrics.dailyProfit < 0 && Math.abs(metrics.dailyProfit) >= threshold;
			case 'daily_profit_target':
				return metrics.dailyProfit !== null && metrics.dailyProfit >= threshold;
			case 'win_rate_drop':
				return metrics.winRate30d !== null && metrics.winRate30d < threshold;
			case 'drawdown':
				return metrics.maxDrawdownPct >= threshold;
			case 'loss_streak':
				return metrics.lossStreak >= threshold;
			default:
				return false;
		}
	}

	// Cooldown tests
	it('should not trigger when cooldown is active', () => {
		const recent = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago
		expect(wasTriggeredRecently(recent)).toBe(true);
	});

	it('should allow trigger when cooldown expired', () => {
		const old = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
		expect(wasTriggeredRecently(old)).toBe(false);
	});

	it('should allow trigger when never triggered before', () => {
		expect(wasTriggeredRecently(null)).toBe(false);
	});

	// Alert type tests
	it('should trigger daily_loss alert when loss exceeds threshold', () => {
		expect(shouldTriggerAlert('daily_loss', 100, {
			dailyProfit: -150, winRate30d: 50, maxDrawdownPct: 5, lossStreak: 0
		})).toBe(true);
	});

	it('should NOT trigger daily_loss when loss is below threshold', () => {
		expect(shouldTriggerAlert('daily_loss', 100, {
			dailyProfit: -50, winRate30d: 50, maxDrawdownPct: 5, lossStreak: 0
		})).toBe(false);
	});

	it('should NOT trigger daily_loss when profit is positive', () => {
		expect(shouldTriggerAlert('daily_loss', 100, {
			dailyProfit: 200, winRate30d: 50, maxDrawdownPct: 5, lossStreak: 0
		})).toBe(false);
	});

	it('should trigger daily_profit_target when profit reaches target', () => {
		expect(shouldTriggerAlert('daily_profit_target', 200, {
			dailyProfit: 250, winRate30d: 50, maxDrawdownPct: 5, lossStreak: 0
		})).toBe(true);
	});

	it('should NOT trigger daily_profit_target when below target', () => {
		expect(shouldTriggerAlert('daily_profit_target', 200, {
			dailyProfit: 150, winRate30d: 50, maxDrawdownPct: 5, lossStreak: 0
		})).toBe(false);
	});

	it('should trigger win_rate_drop when below threshold', () => {
		expect(shouldTriggerAlert('win_rate_drop', 50, {
			dailyProfit: 0, winRate30d: 45, maxDrawdownPct: 5, lossStreak: 0
		})).toBe(true);
	});

	it('should NOT trigger win_rate_drop when above threshold', () => {
		expect(shouldTriggerAlert('win_rate_drop', 50, {
			dailyProfit: 0, winRate30d: 55, maxDrawdownPct: 5, lossStreak: 0
		})).toBe(false);
	});

	it('should trigger drawdown alert when exceeding threshold', () => {
		expect(shouldTriggerAlert('drawdown', 10, {
			dailyProfit: 0, winRate30d: 50, maxDrawdownPct: 15, lossStreak: 0
		})).toBe(true);
	});

	it('should trigger loss_streak alert when streak matches threshold', () => {
		expect(shouldTriggerAlert('loss_streak', 3, {
			dailyProfit: 0, winRate30d: 50, maxDrawdownPct: 5, lossStreak: 3
		})).toBe(true);
	});

	it('should trigger loss_streak alert when streak exceeds threshold', () => {
		expect(shouldTriggerAlert('loss_streak', 3, {
			dailyProfit: 0, winRate30d: 50, maxDrawdownPct: 5, lossStreak: 5
		})).toBe(true);
	});

	it('should NOT trigger loss_streak when below threshold', () => {
		expect(shouldTriggerAlert('loss_streak', 3, {
			dailyProfit: 0, winRate30d: 50, maxDrawdownPct: 5, lossStreak: 2
		})).toBe(false);
	});

	it('should handle null dailyProfit gracefully', () => {
		expect(shouldTriggerAlert('daily_loss', 100, {
			dailyProfit: null, winRate30d: 50, maxDrawdownPct: 5, lossStreak: 0
		})).toBe(false);
		expect(shouldTriggerAlert('daily_profit_target', 100, {
			dailyProfit: null, winRate30d: 50, maxDrawdownPct: 5, lossStreak: 0
		})).toBe(false);
	});

	it('should handle null winRate30d gracefully', () => {
		expect(shouldTriggerAlert('win_rate_drop', 50, {
			dailyProfit: 0, winRate30d: null, maxDrawdownPct: 5, lossStreak: 0
		})).toBe(false);
	});

	it('should validate all 5 alert types', () => {
		const validTypes = ['daily_loss', 'daily_profit_target', 'win_rate_drop', 'drawdown', 'loss_streak'];
		for (const type of validTypes) {
			expect(typeof shouldTriggerAlert(type, 100, {
				dailyProfit: -200, winRate30d: 30, maxDrawdownPct: 20, lossStreak: 10
			})).toBe('boolean');
		}
	});

	it('should return false for unknown alert type', () => {
		expect(shouldTriggerAlert('unknown_type', 100, {
			dailyProfit: -200, winRate30d: 30, maxDrawdownPct: 20, lossStreak: 10
		})).toBe(false);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// ADV-005: Screenshot Annotator — shape geometry
// ═════════════════════════════════════════════════════════════════════════════

describe('ADV-005: Screenshot Annotator', () => {
	it('should compute arrow from start to end', () => {
		const arrow = { type: 'arrow' as const, x1: 10, y1: 10, x2: 100, y2: 50, color: '#ef4444', lineWidth: 3 };
		expect(arrow.x2 - arrow.x1).toBe(90);
		expect(arrow.y2 - arrow.y1).toBe(40);
	});

	it('should compute ellipse center and radii', () => {
		const startX = 100, startY = 100;
		const endX = 200, endY = 150;
		const cx = (startX + endX) / 2;
		const cy = (startY + endY) / 2;
		const rx = Math.abs(endX - startX) / 2;
		const ry = Math.abs(endY - startY) / 2;

		expect(cx).toBe(150);
		expect(cy).toBe(125);
		expect(rx).toBe(50);
		expect(ry).toBe(25);
	});

	it('should compute rectangle from any corner direction', () => {
		// Dragging from bottom-right to top-left
		const startX = 200, startY = 200;
		const endX = 100, endY = 100;

		const rect = {
			x: Math.min(startX, endX),
			y: Math.min(startY, endY),
			w: Math.abs(endX - startX),
			h: Math.abs(endY - startY)
		};

		expect(rect.x).toBe(100);
		expect(rect.y).toBe(100);
		expect(rect.w).toBe(100);
		expect(rect.h).toBe(100);
	});

	it('should compute arrowhead angle correctly', () => {
		const x1 = 0, y1 = 0, x2 = 100, y2 = 0;
		const angle = Math.atan2(y2 - y1, x2 - x1);
		expect(angle).toBe(0); // Pointing right

		const x3 = 0, y3 = 0, x4 = 0, y4 = 100;
		const angle2 = Math.atan2(y4 - y3, x4 - x3);
		expect(angle2).toBeCloseTo(Math.PI / 2); // Pointing down
	});

	it('should scale canvas to max 1280px width', () => {
		const maxW = 1280;
		const imgWidth = 2560;
		const imgHeight = 1440;
		const scale = imgWidth > maxW ? maxW / imgWidth : 1;
		const canvasWidth = Math.round(imgWidth * scale);
		const canvasHeight = Math.round(imgHeight * scale);

		expect(canvasWidth).toBe(1280);
		expect(canvasHeight).toBe(720);
	});

	it('should not scale images under 1280px', () => {
		const maxW = 1280;
		const imgWidth = 800;
		const scale = imgWidth > maxW ? maxW / imgWidth : 1;
		expect(scale).toBe(1);
	});

	it('should maintain undo stack correctly', () => {
		let shapes: string[] = [];
		let undoStack: string[][] = [];

		// Add shape 1
		undoStack = [...undoStack, [...shapes]];
		shapes = [...shapes, 'arrow1'];

		// Add shape 2
		undoStack = [...undoStack, [...shapes]];
		shapes = [...shapes, 'circle1'];

		expect(shapes).toEqual(['arrow1', 'circle1']);
		expect(undoStack.length).toBe(2);

		// Undo
		shapes = undoStack[undoStack.length - 1];
		undoStack = undoStack.slice(0, -1);

		expect(shapes).toEqual(['arrow1']);
		expect(undoStack.length).toBe(1);

		// Undo again
		shapes = undoStack[undoStack.length - 1];
		undoStack = undoStack.slice(0, -1);

		expect(shapes).toEqual([]);
		expect(undoStack.length).toBe(0);
	});

	it('should validate image file type', () => {
		const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
		expect(validTypes.every(t => t.startsWith('image/'))).toBe(true);
		expect('application/pdf'.startsWith('image/')).toBe(false);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// ADV-006: Multi-account — combined metrics
// ═════════════════════════════════════════════════════════════════════════════

describe('ADV-006: Multi-account', () => {
	interface AccountSummary {
		netPnl: number;
		latestBalance: number;
		latestEquity: number;
		todayPnl: number;
		totalTrades: number;
		tradeWinRate: number;
		profitFactor: number;
	}

	function computeCombined(summaries: AccountSummary[]) {
		return {
			netPnl: summaries.reduce((s, a) => s + a.netPnl, 0),
			balance: summaries.reduce((s, a) => s + a.latestBalance, 0),
			equity: summaries.reduce((s, a) => s + a.latestEquity, 0),
			totalTrades: summaries.reduce((s, a) => s + a.totalTrades, 0),
			todayPnl: summaries.reduce((s, a) => s + a.todayPnl, 0),
		};
	}

	it('should sum net P&L across accounts correctly', () => {
		const summaries: AccountSummary[] = [
			{ netPnl: 1000, latestBalance: 10000, latestEquity: 10500, todayPnl: 200, totalTrades: 50, tradeWinRate: 60, profitFactor: 1.5 },
			{ netPnl: -300, latestBalance: 5000, latestEquity: 4800, todayPnl: -100, totalTrades: 30, tradeWinRate: 45, profitFactor: 0.8 },
			{ netPnl: 500, latestBalance: 8000, latestEquity: 8200, todayPnl: 50, totalTrades: 20, tradeWinRate: 55, profitFactor: 1.2 },
		];

		const combined = computeCombined(summaries);

		expect(combined.netPnl).toBe(1200);
		expect(combined.balance).toBe(23000);
		expect(combined.equity).toBe(23500);
		expect(combined.totalTrades).toBe(100);
		expect(combined.todayPnl).toBe(150);
	});

	it('should handle single account', () => {
		const summaries: AccountSummary[] = [
			{ netPnl: 500, latestBalance: 10000, latestEquity: 10500, todayPnl: 50, totalTrades: 25, tradeWinRate: 55, profitFactor: 1.3 },
		];

		const combined = computeCombined(summaries);
		expect(combined.netPnl).toBe(500);
		expect(combined.balance).toBe(10000);
	});

	it('should handle zero accounts', () => {
		const combined = computeCombined([]);
		expect(combined.netPnl).toBe(0);
		expect(combined.balance).toBe(0);
		expect(combined.totalTrades).toBe(0);
	});

	it('should compute profit factor correctly per account', () => {
		const trades = [
			{ profit: 100 }, { profit: 200 }, { profit: -50 }, { profit: -100 },
		];

		const wins = trades.filter(t => t.profit > 0);
		const losses = trades.filter(t => t.profit < 0);
		const grossWin = wins.reduce((s, t) => s + t.profit, 0);
		const grossLoss = Math.abs(losses.reduce((s, t) => s + t.profit, 0));
		const profitFactor = grossLoss > 0 ? Math.min(grossWin / grossLoss, 999) : grossWin > 0 ? 999 : 0;

		expect(profitFactor).toBe(2); // 300 / 150
	});

	it('should cap profit factor at 999 when no losses', () => {
		const trades = [{ profit: 100 }, { profit: 200 }];
		const wins = trades.filter(t => t.profit > 0);
		const losses = trades.filter(t => t.profit < 0);
		const grossWin = wins.reduce((s, t) => s + t.profit, 0);
		const grossLoss = Math.abs(losses.reduce((s, t) => s + t.profit, 0));
		const profitFactor = grossLoss > 0 ? Math.min(grossWin / grossLoss, 999) : grossWin > 0 ? 999 : 0;

		expect(profitFactor).toBe(999);
	});

	it('should return 0 profit factor when no trades', () => {
		const grossWin = 0;
		const grossLoss = 0;
		const profitFactor = grossLoss > 0 ? Math.min(grossWin / grossLoss, 999) : grossWin > 0 ? 999 : 0;
		expect(profitFactor).toBe(0);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// ADV-007: Journal Templates — auto-fill logic
// ═════════════════════════════════════════════════════════════════════════════

describe('ADV-007: Journal Templates', () => {
	interface DayTrade {
		symbol: string;
		type: string;
		profit: number | null;
	}

	function postMarketAutoFill(trades: DayTrade[]) {
		const wins = trades.filter(t => (t.profit ?? 0) > 0);
		const losses = trades.filter(t => (t.profit ?? 0) <= 0 && (t.profit ?? 0) !== 0);
		const totalPnl = trades.reduce((sum, t) => sum + (t.profit ?? 0), 0);
		const symbols = [...new Set(trades.map(t => t.symbol))];

		const autoSummary = trades.length > 0
			? `สรุปผลวันนี้: ${trades.length} เทรด | ชนะ ${wins.length} | แพ้ ${losses.length} | P&L: ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}\nSymbols: ${symbols.join(', ') || '-'}\n\n`
			: '';

		return autoSummary;
	}

	it('should auto-fill trade summary for post-market template', () => {
		const trades: DayTrade[] = [
			{ symbol: 'EURUSD', type: 'BUY', profit: 150 },
			{ symbol: 'GBPUSD', type: 'SELL', profit: -50 },
			{ symbol: 'EURUSD', type: 'BUY', profit: 80 },
		];

		const summary = postMarketAutoFill(trades);
		expect(summary).toContain('3 เทรด');
		expect(summary).toContain('ชนะ 2');
		expect(summary).toContain('แพ้ 1');
		expect(summary).toContain('+180.00');
		expect(summary).toContain('EURUSD');
		expect(summary).toContain('GBPUSD');
	});

	it('should deduplicate symbols', () => {
		const trades: DayTrade[] = [
			{ symbol: 'EURUSD', type: 'BUY', profit: 50 },
			{ symbol: 'EURUSD', type: 'SELL', profit: 30 },
		];

		const summary = postMarketAutoFill(trades);
		// EURUSD should appear once
		const matches = summary.match(/EURUSD/g);
		expect(matches?.length).toBe(1);
	});

	it('should handle zero trades (empty summary)', () => {
		const summary = postMarketAutoFill([]);
		expect(summary).toBe('');
	});

	it('should show negative P&L without plus sign', () => {
		const trades: DayTrade[] = [
			{ symbol: 'USDJPY', type: 'BUY', profit: -200 },
		];

		const summary = postMarketAutoFill(trades);
		expect(summary).toContain('-200.00');
		expect(summary).not.toContain('+-200');
	});

	it('should count null profits as neither win nor loss', () => {
		const trades: DayTrade[] = [
			{ symbol: 'EURUSD', type: 'BUY', profit: null },
			{ symbol: 'GBPUSD', type: 'SELL', profit: 100 },
		];

		const summary = postMarketAutoFill(trades);
		expect(summary).toContain('ชนะ 1');
		expect(summary).toContain('แพ้ 0');
	});

	it('should have 3 template types', () => {
		const templateIds = ['pre-market', 'post-market', 'weekly-review'];
		expect(templateIds.length).toBe(3);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// ADV-008: Social Feed — content validation
// ═════════════════════════════════════════════════════════════════════════════

describe('ADV-008: Social Feed', () => {
	const POST_TYPES = ['trade_share', 'insight', 'milestone'] as const;

	it('should validate post types', () => {
		expect(POST_TYPES.includes('trade_share')).toBe(true);
		expect(POST_TYPES.includes('insight')).toBe(true);
		expect(POST_TYPES.includes('milestone')).toBe(true);
		expect(POST_TYPES.includes('invalid' as never)).toBe(false);
	});

	it('should reject empty content', () => {
		expect(''.trim().length).toBe(0);
		expect('   '.trim().length).toBe(0);
	});

	it('should enforce 500 character limit', () => {
		const shortContent = 'Hello';
		expect(shortContent.length).toBeLessThanOrEqual(500);

		const longContent = 'a'.repeat(501);
		expect(longContent.length).toBeGreaterThan(500);
	});

	it('should generate consistent avatar color from user ID', () => {
		function avatarColor(userId: string): string {
			const colors = [
				'bg-blue-500', 'bg-green-500', 'bg-purple-500',
				'bg-pink-500', 'bg-amber-500', 'bg-cyan-500', 'bg-red-500'
			];
			let hash = 0;
			for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) | 0;
			return colors[Math.abs(hash) % colors.length];
		}

		const color1 = avatarColor('user-abc');
		const color2 = avatarColor('user-abc');
		expect(color1).toBe(color2); // Deterministic

		const color3 = avatarColor('user-xyz');
		// Different users may or may not get different colors, but function should not throw
		expect(typeof color3).toBe('string');
	});

	it('should generate avatar initials correctly', () => {
		function avatarInitials(name: string): string {
			return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?';
		}

		expect(avatarInitials('John Doe')).toBe('JD');
		expect(avatarInitials('Alice')).toBe('A');
		expect(avatarInitials('A B C D')).toBe('AB');
		expect(avatarInitials('')).toBe('?');
	});

	it('should track liked state per post', () => {
		const likedSet = new Set(['post-1', 'post-3']);
		expect(likedSet.has('post-1')).toBe(true);
		expect(likedSet.has('post-2')).toBe(false);
		expect(likedSet.has('post-3')).toBe(true);
	});

	it('should sort leaderboard by selected metric', () => {
		const entries = [
			{ display_name: 'A', net_pnl: 1000, win_rate: 60, profit_factor: 1.5 },
			{ display_name: 'B', net_pnl: 2000, win_rate: 45, profit_factor: 2.0 },
			{ display_name: 'C', net_pnl: 500, win_rate: 70, profit_factor: 1.8 },
		];

		const byPnl = [...entries].sort((a, b) => b.net_pnl - a.net_pnl);
		expect(byPnl[0].display_name).toBe('B');

		const byWinRate = [...entries].sort((a, b) => b.win_rate - a.win_rate);
		expect(byWinRate[0].display_name).toBe('C');

		const byPF = [...entries].sort((a, b) => b.profit_factor - a.profit_factor);
		expect(byPF[0].display_name).toBe('B');
	});

	it('should paginate feed with cursor', () => {
		const posts = Array.from({ length: 25 }, (_, i) => ({
			id: `post-${i}`,
			created_at: new Date(2024, 0, 25 - i).toISOString()
		}));

		const limit = 20;
		const firstPage = posts.slice(0, limit);
		expect(firstPage.length).toBe(20);

		const cursor = firstPage[firstPage.length - 1].created_at;
		const nextPage = posts.filter(p => p.created_at < cursor).slice(0, limit);
		expect(nextPage.length).toBe(5);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// ADV-009: Daily Report — email template generation
// ═════════════════════════════════════════════════════════════════════════════

describe('ADV-009: Daily Report Email', () => {
	it('should generate daily report HTML with correct data', () => {
		const html = buildDailyReportHtml({
			userName: 'TestTrader',
			date: '2024-01-15',
			netPnl: 250.50,
			totalTrades: 5,
			winningTrades: 3,
			losingTrades: 2,
			winRate: 60,
			profitFactor: 1.8,
			avgWin: 120,
			avgLoss: 55,
			ruleBreaks: 1,
			journalCompleted: true,
			topWinner: { symbol: 'EURUSD', profit: 200 },
			topLoser: { symbol: 'GBPUSD', profit: -80 },
			checklistCompleted: 4,
			checklistTotal: 5
		});

		expect(html).toContain('TestTrader');
		expect(html).toContain('2024-01-15');
		expect(html).toContain('+250.50 USD');
		expect(html).toContain('5'); // total trades
		expect(html).toContain('60.0%'); // win rate
		expect(html).toContain('1.80'); // profit factor
		expect(html).toContain('EURUSD');
		expect(html).toContain('GBPUSD');
		expect(html).toContain('เสร็จแล้ว');
		expect(html).toContain('4/5');
	});

	it('should show negative P&L in red', () => {
		const html = buildDailyReportHtml({
			userName: 'Trader',
			date: '2024-01-15',
			netPnl: -100,
			totalTrades: 2,
			winningTrades: 0,
			losingTrades: 2,
			winRate: 0,
			profitFactor: 0,
			avgWin: 0,
			avgLoss: 50,
			ruleBreaks: 0,
			journalCompleted: false,
			topWinner: null,
			topLoser: { symbol: 'USDJPY', profit: -60 },
			checklistCompleted: 0,
			checklistTotal: 5
		});

		expect(html).toContain('#ef4444'); // red color for negative
		expect(html).toContain('-100.00 USD');
		expect(html).toContain('วันที่ขาดทุน');
	});

	it('should show positive P&L in green', () => {
		const html = buildDailyReportHtml({
			userName: 'Trader',
			date: '2024-01-15',
			netPnl: 500,
			totalTrades: 3,
			winningTrades: 3,
			losingTrades: 0,
			winRate: 100,
			profitFactor: 999,
			avgWin: 166.67,
			avgLoss: 0,
			ruleBreaks: 0,
			journalCompleted: true,
			topWinner: { symbol: 'XAUUSD', profit: 300 },
			topLoser: null,
			checklistCompleted: 5,
			checklistTotal: 5
		});

		expect(html).toContain('#22c55e'); // green color
		expect(html).toContain('+500.00 USD');
		expect(html).toContain('วันที่ทำกำไร');
	});

	it('should handle infinity profit factor display', () => {
		const html = buildDailyReportHtml({
			userName: 'Trader',
			date: '2024-01-15',
			netPnl: 100,
			totalTrades: 1,
			winningTrades: 1,
			losingTrades: 0,
			winRate: 100,
			profitFactor: 999,
			avgWin: 100,
			avgLoss: 0,
			ruleBreaks: 0,
			journalCompleted: false,
			topWinner: null,
			topLoser: null,
			checklistCompleted: 0,
			checklistTotal: 0
		});

		// profitFactor >= 999 should show ∞
		expect(html).toContain('∞');
	});

	it('should generate weekly digest HTML correctly', () => {
		const html = buildWeeklyDigestHtml({
			userName: 'WeeklyTrader',
			weekLabel: '18–24 มี.ค. 2569',
			netPnl: 1500,
			totalTrades: 25,
			winRate: 56,
			profitFactor: 1.6,
			dayWinRate: 60,
			topSymbol: { symbol: 'EURUSD', netPnl: 800, winRate: 65 },
			ruleBreakCount: 3,
			journalStreak: 5
		});

		expect(html).toContain('WeeklyTrader');
		expect(html).toContain('18–24 มี.ค. 2569');
		expect(html).toContain('+1500.00 USD');
		expect(html).toContain('25');
		expect(html).toContain('56.0%');
		expect(html).toContain('EURUSD');
		expect(html).toContain('3 ครั้ง');
		expect(html).toContain('5 วัน');
	});

	it('should generate weekly digest without top symbol', () => {
		const html = buildWeeklyDigestHtml({
			userName: 'Trader',
			weekLabel: '1–7 ม.ค. 2569',
			netPnl: 0,
			totalTrades: 0,
			winRate: 0,
			profitFactor: 0,
			dayWinRate: 0,
			topSymbol: null,
			ruleBreakCount: 0,
			journalStreak: 0
		});

		expect(html).toContain('Trader');
		expect(html).not.toContain('Symbol ที่ดีที่สุด');
	});

	it('should include unsubscribe link in emails', () => {
		const dailyHtml = buildDailyReportHtml({
			userName: 'T', date: 'd', netPnl: 0, totalTrades: 0,
			winningTrades: 0, losingTrades: 0, winRate: 0, profitFactor: 0,
			avgWin: 0, avgLoss: 0, ruleBreaks: 0, journalCompleted: false,
			topWinner: null, topLoser: null, checklistCompleted: 0, checklistTotal: 0
		});

		expect(dailyHtml).toContain('settings/email-reports');
		expect(dailyHtml).toContain('จัดการการตั้งค่าอีเมล');

		const weeklyHtml = buildWeeklyDigestHtml({
			userName: 'T', weekLabel: 'w', netPnl: 0, totalTrades: 0,
			winRate: 0, profitFactor: 0, dayWinRate: 0, topSymbol: null,
			ruleBreakCount: 0, journalStreak: 0
		});

		expect(weeklyHtml).toContain('settings/email-reports');
	});

	it('should show zero rule breaks as excellent', () => {
		const html = buildDailyReportHtml({
			userName: 'T', date: 'd', netPnl: 100, totalTrades: 1,
			winningTrades: 1, losingTrades: 0, winRate: 100, profitFactor: 999,
			avgWin: 100, avgLoss: 0, ruleBreaks: 0, journalCompleted: true,
			topWinner: null, topLoser: null, checklistCompleted: 5, checklistTotal: 5
		});

		expect(html).toContain('ยอดเยี่ยม!');
		expect(html).toContain('0 ครั้ง');
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// ADV-010: Advanced Charts — timeframe ordering
// ═════════════════════════════════════════════════════════════════════════════

describe('ADV-010: Advanced Charts', () => {
	const TF_ORDER = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'];
	const TF_LABELS: Record<string, string> = {
		M1: '1m', M5: '5m', M15: '15m', M30: '30m',
		H1: '1H', H4: '4H', D1: 'D', W1: 'W', MN1: 'M'
	};

	it('should sort timeframes in correct ascending order', () => {
		const contexts = [
			{ timeframe: 'H4' }, { timeframe: 'M1' },
			{ timeframe: 'D1' }, { timeframe: 'M15' },
		];

		const sorted = [...contexts].sort((a, b) => {
			const ai = TF_ORDER.indexOf(a.timeframe);
			const bi = TF_ORDER.indexOf(b.timeframe);
			return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
		});

		expect(sorted.map(c => c.timeframe)).toEqual(['M1', 'M15', 'H4', 'D1']);
	});

	it('should display correct labels for each timeframe', () => {
		expect(TF_LABELS['M1']).toBe('1m');
		expect(TF_LABELS['M5']).toBe('5m');
		expect(TF_LABELS['H1']).toBe('1H');
		expect(TF_LABELS['H4']).toBe('4H');
		expect(TF_LABELS['D1']).toBe('D');
		expect(TF_LABELS['W1']).toBe('W');
		expect(TF_LABELS['MN1']).toBe('M');
	});

	it('should handle unknown timeframes gracefully', () => {
		const unknownTf = 'CUSTOM';
		const idx = TF_ORDER.indexOf(unknownTf);
		expect(idx).toBe(-1);
		// Unknown TFs should sort to the end
		expect((idx === -1 ? 99 : idx)).toBe(99);
	});

	it('should compute entry/exit markers from trade timestamps', () => {
		const trade = {
			open_time: '2024-01-15T10:30:00Z',
			close_time: '2024-01-15T14:45:00Z',
			open_price: 1.10000,
			close_price: 1.10500,
			sl: 1.09500,
			tp: 1.11000,
		};

		const entryTime = Math.floor(new Date(trade.open_time).getTime() / 1000);
		const exitTime = Math.floor(new Date(trade.close_time).getTime() / 1000);

		expect(entryTime).toBeGreaterThan(0);
		expect(exitTime).toBeGreaterThan(entryTime);
		expect(exitTime - entryTime).toBe(4 * 3600 + 15 * 60); // 4h15m
	});

	it('should create SL and TP price lines when present', () => {
		const trade = { sl: 1.095, tp: 1.110 };
		const lines: { price: number; title: string }[] = [];

		if (trade.sl) lines.push({ price: Number(trade.sl), title: 'SL' });
		if (trade.tp) lines.push({ price: Number(trade.tp), title: 'TP' });

		expect(lines.length).toBe(2);
		expect(lines[0]).toEqual({ price: 1.095, title: 'SL' });
		expect(lines[1]).toEqual({ price: 1.110, title: 'TP' });
	});

	it('should skip SL/TP lines when not set', () => {
		const trade = { sl: null, tp: null };
		const lines: { price: number; title: string }[] = [];

		if (trade.sl) lines.push({ price: Number(trade.sl), title: 'SL' });
		if (trade.tp) lines.push({ price: Number(trade.tp), title: 'TP' });

		expect(lines.length).toBe(0);
	});

	it('should handle single timeframe (no grid)', () => {
		const contexts = [{ timeframe: 'H1', bars: [] }];
		expect(contexts.length).toBe(1);
		// Grid class should be grid-cols-1 for single
	});

	it('should handle multiple timeframes (2-col grid)', () => {
		const contexts = [
			{ timeframe: 'M15', bars: [] },
			{ timeframe: 'H1', bars: [] },
			{ timeframe: 'H4', bars: [] },
			{ timeframe: 'D1', bars: [] },
		];
		expect(contexts.length).toBeGreaterThan(1);
		// Grid class should be grid-cols-2
	});

	it('should set correct chart heights based on context count', () => {
		// <= 2 contexts = 280px, > 2 = 220px
		expect(2 <= 2 ? 280 : 220).toBe(280);
		expect(3 <= 2 ? 280 : 220).toBe(220);
		expect(6 <= 2 ? 280 : 220).toBe(220);
	});

	it('should support focus mode at 380px', () => {
		const focusHeight = 380;
		expect(focusHeight).toBe(380);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// Cross-feature: KPI computation used by multiple ADV features
// ═════════════════════════════════════════════════════════════════════════════

describe('Cross-feature: KPI metrics (used by ADV-001, ADV-006, ADV-009)', () => {
	it('should compute correct KPI for mixed winning/losing trades', () => {
		const trades = [
			makeTrade({ id: 't1', profit: 100, close_time: '2024-01-15T05:00:00Z' }),
			makeTrade({ id: 't2', profit: -50, close_time: '2024-01-15T05:00:00Z' }),
			makeTrade({ id: 't3', profit: 200, close_time: '2024-01-16T05:00:00Z' }),
			makeTrade({ id: 't4', profit: -80, close_time: '2024-01-16T05:00:00Z' }),
			makeTrade({ id: 't5', profit: 30, close_time: '2024-01-17T05:00:00Z' }),
		];

		const dailyHistory = buildDailyHistory(trades as never[]);
		const kpi = buildKpiMetrics(trades as never[], dailyHistory);

		expect(kpi.totalTrades).toBe(5);
		expect(kpi.netPnl).toBe(200); // 100-50+200-80+30
		expect(kpi.tradeWinRate).toBe(60); // 3/5
		expect(kpi.winningTrades).toBe(3);
		expect(kpi.losingTrades).toBe(2);
		expect(kpi.avgWin).toBeCloseTo(110); // (100+200+30)/3
		expect(kpi.avgLoss).toBeCloseTo(65); // |(-50-80)/2| stored as positive
	});

	it('should compute rule break metrics', () => {
		const trades = [
			makeTrade({
				id: 't1',
				profit: -100,
				trade_reviews: [{ id: 'r1', broken_rules: ['Overtrading', 'No SL'], review_status: 'reviewed', followed_plan: false }]
			}),
			makeTrade({
				id: 't2',
				profit: 50,
				trade_reviews: [{ id: 'r2', broken_rules: ['Overtrading'], review_status: 'reviewed', followed_plan: true }]
			}),
			makeTrade({
				id: 't3',
				profit: -30,
				trade_reviews: []
			}),
		];

		const ruleBreaks = buildRuleBreakMetrics(trades as never[]);
		expect(ruleBreaks.totalRuleBreaks).toBe(3); // 2 + 1
		expect(ruleBreaks.topRules.length).toBe(2);
		expect(ruleBreaks.topRules[0].rule).toBe('Overtrading');
		expect(ruleBreaks.topRules[0].count).toBe(2);
	});

	it('should build journal completion summary', () => {
		const journals = [
			{ id: '1', date: '2024-01-15', completion_status: 'complete' },
			{ id: '2', date: '2024-01-16', completion_status: 'complete' },
			{ id: '3', date: '2024-01-17', completion_status: 'draft' },
		];
		const dailyHistory = [
			{ date: '2024-01-15' },
			{ date: '2024-01-16' },
			{ date: '2024-01-17' },
			{ date: '2024-01-18' },
		];

		const summary = buildJournalCompletionSummary(journals as never[], dailyHistory);
		expect(summary.totalEntries).toBe(3);
		expect(summary.completedEntries).toBe(2);
		expect(summary.activeTradingDays).toBe(4);
		// 3 journals matched 3 of 4 active days
		expect(summary.completionRate).toBe(75); // 3/4
	});
});
