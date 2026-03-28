import { describe, it, expect } from 'vitest';
import { buildSetupPerformance, buildRuleBreakMetrics } from '../server/portfolio';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTrade(overrides: Record<string, unknown> = {}) {
	return {
		id: 'trade-1',
		client_account_id: 'acc-1',
		symbol: 'EURUSD',
		type: 'BUY' as const,
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

function makeReview(overrides: Record<string, unknown> = {}) {
	return {
		id: 'rev-1',
		trade_id: 'trade-1',
		user_id: 'user-1',
		playbook_id: null,
		playbooks: null,
		review_status: 'reviewed' as const,
		entry_reason: '',
		mistake_summary: '',
		lesson_summary: '',
		followed_plan: null,
		broken_rules: [] as string[],
		setup_quality_score: null,
		discipline_score: null,
		execution_score: null,
		confidence_at_entry: null,
		reviewed_at: '2024-01-15T05:00:00Z',
		created_at: '2024-01-15T05:00:00Z',
		...overrides
	};
}

function makeSetupTag(name: string) {
	return {
		id: `ta-${name}`,
		tag_id: `tag-${name}`,
		trade_id: 'trade-1',
		trade_tags: { id: `tag-${name}`, name, color: '#fff', category: 'setup' }
	};
}

// ─── buildSetupPerformance ───────────────────────────────────────────────────

describe('buildSetupPerformance', () => {
	it('returns empty array for no trades', () => {
		expect(buildSetupPerformance([])).toEqual([]);
	});

	it('groups trade by playbook name when review has playbook_id', () => {
		const trade = makeTrade({
			profit: 100,
			trade_reviews: [
				makeReview({ playbook_id: 'pb-1', playbooks: { id: 'pb-1', name: 'Breakout' } })
			]
		});
		const result = buildSetupPerformance([trade] as any);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('Breakout');
		expect(result[0].playbookId).toBe('pb-1');
	});

	it('groups by setup tag when no playbook', () => {
		const trade = makeTrade({
			profit: 50,
			trade_tag_assignments: [makeSetupTag('FAKEOUT')]
		});
		const result = buildSetupPerformance([trade] as any);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('FAKEOUT');
		expect(result[0].playbookId).toBeNull();
	});

	it('ignores non-setup tags when grouping', () => {
		const trade = makeTrade({
			profit: 50,
			trade_tag_assignments: [
				{ id: 'ta-1', tag_id: 'tag-1', trade_id: 'trade-1', trade_tags: { id: 'tag-1', name: 'bad-tag', color: '#fff', category: 'emotion' } }
			]
		});
		const result = buildSetupPerformance([trade] as any);
		expect(result[0].name).toBe('ไม่มี Setup');
	});

	it('falls back to "ไม่มี Setup" when no playbook and no setup tag', () => {
		const trade = makeTrade({ profit: 30 });
		const result = buildSetupPerformance([trade] as any);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('ไม่มี Setup');
	});

	it('groups multiple trades under same playbook', () => {
		const pb = { id: 'pb-1', name: 'Trend' };
		const trades = [
			makeTrade({ id: 't1', profit: 100, trade_reviews: [makeReview({ playbook_id: 'pb-1', playbooks: pb })] }),
			makeTrade({ id: 't2', profit: -40, trade_reviews: [makeReview({ playbook_id: 'pb-1', playbooks: pb })] }),
			makeTrade({ id: 't3', profit: 80, trade_reviews: [makeReview({ playbook_id: 'pb-1', playbooks: pb })] })
		];
		const result = buildSetupPerformance(trades as any);
		expect(result).toHaveLength(1);
		expect(result[0].totalTrades).toBe(3);
		expect(result[0].totalProfit).toBeCloseTo(140);
	});

	it('calculates win rate correctly', () => {
		const pb = { id: 'pb-1', name: 'Breakout' };
		const trades = [
			makeTrade({ id: 't1', profit: 100, trade_reviews: [makeReview({ playbook_id: 'pb-1', playbooks: pb })] }),
			makeTrade({ id: 't2', profit: -50, trade_reviews: [makeReview({ playbook_id: 'pb-1', playbooks: pb })] }),
			makeTrade({ id: 't3', profit: 80, trade_reviews: [makeReview({ playbook_id: 'pb-1', playbooks: pb })] })
		];
		const result = buildSetupPerformance(trades as any);
		expect(result[0].winRate).toBeCloseTo(66.67, 1);
	});

	it('calculates profit factor (grossWin / grossLoss)', () => {
		const pb = { id: 'pb-1', name: 'Scalp' };
		const trades = [
			makeTrade({ id: 't1', profit: 200, trade_reviews: [makeReview({ playbook_id: 'pb-1', playbooks: pb })] }),
			makeTrade({ id: 't2', profit: -100, trade_reviews: [makeReview({ playbook_id: 'pb-1', playbooks: pb })] })
		];
		const result = buildSetupPerformance(trades as any);
		expect(result[0].profitFactor).toBeCloseTo(2, 1);
	});

	it('caps profit factor at 999 when no losses', () => {
		const pb = { id: 'pb-1', name: 'Pure Win' };
		const trades = [
			makeTrade({ id: 't1', profit: 500, trade_reviews: [makeReview({ playbook_id: 'pb-1', playbooks: pb })] })
		];
		const result = buildSetupPerformance(trades as any);
		expect(result[0].profitFactor).toBe(999);
	});

	it('calculates expectancy as totalProfit / totalTrades', () => {
		const pb = { id: 'pb-1', name: 'Mixed' };
		const trades = [
			makeTrade({ id: 't1', profit: 100, trade_reviews: [makeReview({ playbook_id: 'pb-1', playbooks: pb })] }),
			makeTrade({ id: 't2', profit: -40, trade_reviews: [makeReview({ playbook_id: 'pb-1', playbooks: pb })] })
		];
		const result = buildSetupPerformance(trades as any);
		expect(result[0].expectancy).toBeCloseTo(30); // (100 - 40) / 2
	});

	it('sorts by total profit descending', () => {
		const pb1 = { id: 'pb-1', name: 'Breakout' };
		const pb2 = { id: 'pb-2', name: 'Reversal' };
		const pb3 = { id: 'pb-3', name: 'Scalp' };
		const trades = [
			makeTrade({ id: 't1', profit: 50, trade_reviews: [makeReview({ playbook_id: 'pb-1', playbooks: pb1 })] }),
			makeTrade({ id: 't2', profit: 200, trade_reviews: [makeReview({ playbook_id: 'pb-2', playbooks: pb2 })] }),
			makeTrade({ id: 't3', profit: -20, trade_reviews: [makeReview({ playbook_id: 'pb-3', playbooks: pb3 })] })
		];
		const result = buildSetupPerformance(trades as any);
		expect(result[0].name).toBe('Reversal');
		expect(result[1].name).toBe('Breakout');
		expect(result[2].name).toBe('Scalp');
	});

	it('separates trades into different setup buckets', () => {
		const pb1 = { id: 'pb-1', name: 'A' };
		const pb2 = { id: 'pb-2', name: 'B' };
		const trades = [
			makeTrade({ id: 't1', profit: 100, trade_reviews: [makeReview({ playbook_id: 'pb-1', playbooks: pb1 })] }),
			makeTrade({ id: 't2', profit: 200, trade_reviews: [makeReview({ playbook_id: 'pb-2', playbooks: pb2 })] })
		];
		const result = buildSetupPerformance(trades as any);
		expect(result).toHaveLength(2);
	});

	it('counts reviewed trades correctly', () => {
		const pb = { id: 'pb-1', name: 'Trend' };
		const trades = [
			makeTrade({ id: 't1', profit: 100, trade_reviews: [makeReview({ playbook_id: 'pb-1', playbooks: pb, review_status: 'reviewed' })] }),
			makeTrade({ id: 't2', profit: 50, trade_reviews: [makeReview({ playbook_id: 'pb-1', playbooks: pb, review_status: 'in_progress' })] }),
			makeTrade({ id: 't3', profit: 30, trade_reviews: [] })
		];
		const result = buildSetupPerformance(trades as any);
		const trendBucket = result.find((r) => r.name === 'Trend');
		expect(trendBucket?.reviewedTrades).toBe(1);
	});

	it('handles single trade correctly', () => {
		const trade = makeTrade({ profit: 75 });
		const result = buildSetupPerformance([trade] as any);
		expect(result).toHaveLength(1);
		expect(result[0].totalTrades).toBe(1);
		expect(result[0].winRate).toBe(100);
		expect(result[0].totalProfit).toBe(75);
	});

	it('handles breakeven trade (profit = 0)', () => {
		const trade = makeTrade({ profit: 0 });
		const result = buildSetupPerformance([trade] as any);
		expect(result[0].winRate).toBe(0); // 0 profit is not counted as a win
		expect(result[0].profitFactor).toBe(0); // no wins, no losses
	});
});

// ─── buildRuleBreakMetrics ───────────────────────────────────────────────────

describe('buildRuleBreakMetrics', () => {
	it('returns empty results for no trades', () => {
		const result = buildRuleBreakMetrics([]);
		expect(result.totalRuleBreaks).toBe(0);
		expect(result.ruleBreakLoss).toBe(0);
		expect(result.topRules).toEqual([]);
	});

	it('returns empty results when no reviews', () => {
		const trades = [makeTrade({ profit: 100 }), makeTrade({ id: 't2', profit: -50 })];
		const result = buildRuleBreakMetrics(trades as any);
		expect(result.totalRuleBreaks).toBe(0);
		expect(result.ruleBreakLoss).toBe(0);
		expect(result.topRules).toEqual([]);
	});

	it('returns empty results when reviews have no broken rules', () => {
		const trades = [
			makeTrade({ profit: 100, trade_reviews: [makeReview({ broken_rules: [] })] })
		];
		const result = buildRuleBreakMetrics(trades as any);
		expect(result.totalRuleBreaks).toBe(0);
		expect(result.topRules).toEqual([]);
	});

	it('counts broken rules on a losing trade', () => {
		const trades = [
			makeTrade({ profit: -80, trade_reviews: [makeReview({ broken_rules: ['No SL', 'FOMO'] })] })
		];
		const result = buildRuleBreakMetrics(trades as any);
		expect(result.totalRuleBreaks).toBe(2);
		expect(result.ruleBreakLoss).toBeCloseTo(80);
		expect(result.topRules).toHaveLength(2);
	});

	it('counts broken rules on a winning trade without adding to loss', () => {
		const trades = [
			makeTrade({ profit: 50, trade_reviews: [makeReview({ broken_rules: ['No SL'] })] })
		];
		const result = buildRuleBreakMetrics(trades as any);
		expect(result.totalRuleBreaks).toBe(1);
		expect(result.ruleBreakLoss).toBe(0);
		expect(result.topRules[0].wins).toBe(1);
		expect(result.topRules[0].loss).toBe(0);
	});

	it('accumulates counts across trades with same rule', () => {
		const trades = [
			makeTrade({ id: 't1', profit: -50, trade_reviews: [makeReview({ broken_rules: ['No SL'] })] }),
			makeTrade({ id: 't2', profit: -30, trade_reviews: [makeReview({ broken_rules: ['No SL'] })] }),
			makeTrade({ id: 't3', profit: 20, trade_reviews: [makeReview({ broken_rules: ['No SL'] })] })
		];
		const result = buildRuleBreakMetrics(trades as any);
		expect(result.topRules[0].rule).toBe('No SL');
		expect(result.topRules[0].count).toBe(3);
		expect(result.topRules[0].loss).toBeCloseTo(80);
		expect(result.topRules[0].wins).toBe(1);
	});

	it('attributes each broken rule on the same trade separately', () => {
		const trades = [
			makeTrade({
				profit: -100,
				trade_reviews: [makeReview({ broken_rules: ['No SL', 'FOMO', 'Revenge'] })]
			})
		];
		const result = buildRuleBreakMetrics(trades as any);
		expect(result.totalRuleBreaks).toBe(3);
		// ruleBreakLoss = loss counted once per trade
		expect(result.ruleBreakLoss).toBeCloseTo(100);
		// each rule individually sees the full trade loss
		for (const r of result.topRules) {
			expect(r.loss).toBeCloseTo(100);
		}
	});

	it('sorts top rules by break count descending', () => {
		const trades = [
			makeTrade({ id: 't1', profit: -50, trade_reviews: [makeReview({ broken_rules: ['FOMO'] })] }),
			makeTrade({ id: 't2', profit: -30, trade_reviews: [makeReview({ broken_rules: ['FOMO'] })] }),
			makeTrade({ id: 't3', profit: -20, trade_reviews: [makeReview({ broken_rules: ['No SL', 'FOMO'] })] }),
			makeTrade({ id: 't4', profit: -10, trade_reviews: [makeReview({ broken_rules: ['No SL'] })] })
		];
		const result = buildRuleBreakMetrics(trades as any);
		expect(result.topRules[0].rule).toBe('FOMO'); // broken 3x
		expect(result.topRules[1].rule).toBe('No SL'); // broken 2x
	});

	it('returns at most 5 top rules', () => {
		const trades = Array.from({ length: 10 }, (_, i) =>
			makeTrade({
				id: `t${i}`,
				profit: -10,
				trade_reviews: [makeReview({ broken_rules: [`Rule ${i}`] })]
			})
		);
		const result = buildRuleBreakMetrics(trades as any);
		expect(result.topRules.length).toBeLessThanOrEqual(5);
	});

	it('counts total rule breaks across all trades', () => {
		const trades = [
			makeTrade({ id: 't1', profit: -50, trade_reviews: [makeReview({ broken_rules: ['A', 'B'] })] }),
			makeTrade({ id: 't2', profit: 30, trade_reviews: [makeReview({ broken_rules: ['C'] })] }),
			makeTrade({ id: 't3', profit: -10, trade_reviews: [makeReview({ broken_rules: [] })] })
		];
		const result = buildRuleBreakMetrics(trades as any);
		expect(result.totalRuleBreaks).toBe(3);
	});

	it('only adds loss from trades that broke rules', () => {
		const trades = [
			makeTrade({ id: 't1', profit: -100, trade_reviews: [makeReview({ broken_rules: ['No SL'] })] }),
			makeTrade({ id: 't2', profit: -200, trade_reviews: [makeReview({ broken_rules: [] })] }) // no rules broken
		];
		const result = buildRuleBreakMetrics(trades as any);
		expect(result.ruleBreakLoss).toBeCloseTo(100); // only t1's loss
	});
});
