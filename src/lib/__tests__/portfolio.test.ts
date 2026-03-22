import { describe, it, expect } from 'vitest';
import {
	EMPTY_PORTFOLIO_FILTERS,
	parsePortfolioFilters,
	buildPortfolioSearchParams,
	getTradeReview,
	getTradeReviewStatus,
	getTradeNotes,
	getTradeAttachments,
	getTradePlaybookId,
	getTradeSession,
	getTradeDurationMinutes,
	getTradeDurationBucket,
	applyPortfolioFilters
} from '../portfolio';
import type { PortfolioFilterState, Trade, TradeAttachment, TradeNote, TradeReview } from '$lib/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTrade(overrides: Partial<Trade> = {}): Trade {
	return {
		id: 'trade-1',
		client_account_id: 'acc-1',
		symbol: 'EURUSD',
		type: 'BUY',
		lot_size: 0.1,
		open_price: 1.1,
		close_price: 1.105,
		open_time: '2024-01-15T08:00:00Z',
		close_time: '2024-01-15T10:00:00Z',
		profit: 50,
		sl: null,
		tp: null,
		position_id: 1,
		pips: 50,
		commission: 0,
		swap: 0,
		created_at: '2024-01-15T10:00:00Z',
		trade_tag_assignments: [],
		trade_notes: [],
		trade_reviews: [],
		trade_attachments: [],
		...overrides
	};
}

function makeReview(overrides: Partial<TradeReview> = {}): TradeReview {
	return {
		id: 'rev-1',
		trade_id: 'trade-1',
		user_id: 'user-1',
		playbook_id: null,
		review_status: 'unreviewed',
		entry_reason: '',
		exit_reason: '',
		execution_notes: '',
		risk_notes: '',
		mistake_summary: '',
		lesson_summary: '',
		next_action: '',
		setup_quality_score: null,
		discipline_score: null,
		execution_score: null,
		confidence_at_entry: null,
		followed_plan: null,
		broken_rules: [],
		reviewed_at: null,
		created_at: '2024-01-15T10:00:00Z',
		updated_at: '2024-01-15T10:00:00Z',
		...overrides
	};
}

function makeNote(overrides: Partial<TradeNote> = {}): TradeNote {
	return {
		id: 'note-1',
		trade_id: 'trade-1',
		user_id: 'user-1',
		content: '',
		rating: null,
		created_at: '2024-01-15T10:00:00Z',
		updated_at: '2024-01-15T10:00:00Z',
		...overrides
	};
}

function makeAttachment(overrides: Partial<TradeAttachment> = {}): TradeAttachment {
	return {
		id: 'att-1',
		trade_id: 'trade-1',
		user_id: 'user-1',
		kind: 'image_url',
		storage_path: '/img.png',
		caption: '',
		sort_order: 0,
		created_at: '2024-01-15T10:00:00Z',
		...overrides
	};
}

const emptyFilters: PortfolioFilterState = { ...EMPTY_PORTFOLIO_FILTERS };

// ─── EMPTY_PORTFOLIO_FILTERS ─────────────────────────────────────────────────

describe('EMPTY_PORTFOLIO_FILTERS', () => {
	it('has all empty/null defaults', () => {
		expect(EMPTY_PORTFOLIO_FILTERS.q).toBe('');
		expect(EMPTY_PORTFOLIO_FILTERS.from).toBe('');
		expect(EMPTY_PORTFOLIO_FILTERS.to).toBe('');
		expect(EMPTY_PORTFOLIO_FILTERS.symbols).toEqual([]);
		expect(EMPTY_PORTFOLIO_FILTERS.sessions).toEqual([]);
		expect(EMPTY_PORTFOLIO_FILTERS.directions).toEqual([]);
		expect(EMPTY_PORTFOLIO_FILTERS.tagIds).toEqual([]);
		expect(EMPTY_PORTFOLIO_FILTERS.playbookIds).toEqual([]);
		expect(EMPTY_PORTFOLIO_FILTERS.reviewStatus).toEqual([]);
		expect(EMPTY_PORTFOLIO_FILTERS.outcome).toBe('');
		expect(EMPTY_PORTFOLIO_FILTERS.hasNotes).toBeNull();
		expect(EMPTY_PORTFOLIO_FILTERS.hasAttachments).toBeNull();
		expect(EMPTY_PORTFOLIO_FILTERS.durationBucket).toBe('');
	});
});

// ─── parsePortfolioFilters ───────────────────────────────────────────────────

describe('parsePortfolioFilters', () => {
	it('returns empty filters for blank params', () => {
		const result = parsePortfolioFilters(new URLSearchParams());
		expect(result).toEqual(EMPTY_PORTFOLIO_FILTERS);
	});

	it('parses q (search query)', () => {
		const p = new URLSearchParams('q=eurusd');
		expect(parsePortfolioFilters(p).q).toBe('eurusd');
	});

	it('parses valid from/to dates', () => {
		const p = new URLSearchParams('from=2024-01-01&to=2024-12-31');
		const result = parsePortfolioFilters(p);
		expect(result.from).toBe('2024-01-01');
		expect(result.to).toBe('2024-12-31');
	});

	it('rejects invalid date formats', () => {
		const p = new URLSearchParams('from=not-a-date&to=2024/01/01');
		const result = parsePortfolioFilters(p);
		expect(result.from).toBe('');
		expect(result.to).toBe('');
	});

	it('parses multiple symbols', () => {
		const p = new URLSearchParams('symbol=EURUSD&symbol=GBPUSD');
		expect(parsePortfolioFilters(p).symbols).toEqual(['EURUSD', 'GBPUSD']);
	});

	it('parses sessions, directions, tags, playbooks, reviewStatus', () => {
		const p = new URLSearchParams(
			'session=asian&direction=BUY&tag=t1&tag=t2&playbook=p1&review_status=reviewed&review_status=in_progress'
		);
		const result = parsePortfolioFilters(p);
		expect(result.sessions).toEqual(['asian']);
		expect(result.directions).toEqual(['BUY']);
		expect(result.tagIds).toEqual(['t1', 't2']);
		expect(result.playbookIds).toEqual(['p1']);
		expect(result.reviewStatus).toEqual(['reviewed', 'in_progress']);
	});

	it('parses valid outcome values', () => {
		expect(parsePortfolioFilters(new URLSearchParams('outcome=win')).outcome).toBe('win');
		expect(parsePortfolioFilters(new URLSearchParams('outcome=loss')).outcome).toBe('loss');
		expect(parsePortfolioFilters(new URLSearchParams('outcome=breakeven')).outcome).toBe('breakeven');
	});

	it('rejects invalid outcome', () => {
		expect(parsePortfolioFilters(new URLSearchParams('outcome=bad')).outcome).toBe('');
	});

	it('parses hasNotes: 1 → true, 0 → false, absent → null', () => {
		expect(parsePortfolioFilters(new URLSearchParams('has_notes=1')).hasNotes).toBe(true);
		expect(parsePortfolioFilters(new URLSearchParams('has_notes=true')).hasNotes).toBe(true);
		expect(parsePortfolioFilters(new URLSearchParams('has_notes=0')).hasNotes).toBe(false);
		expect(parsePortfolioFilters(new URLSearchParams()).hasNotes).toBeNull();
	});

	it('parses hasAttachments: 1 → true, 0 → false, absent → null', () => {
		expect(parsePortfolioFilters(new URLSearchParams('has_attachments=1')).hasAttachments).toBe(true);
		expect(parsePortfolioFilters(new URLSearchParams('has_attachments=0')).hasAttachments).toBe(false);
		expect(parsePortfolioFilters(new URLSearchParams()).hasAttachments).toBeNull();
	});

	it('parses valid durationBucket values', () => {
		for (const bucket of ['scalp', 'intraday', 'swing', 'position']) {
			expect(parsePortfolioFilters(new URLSearchParams(`duration=${bucket}`)).durationBucket).toBe(bucket);
		}
	});

	it('rejects invalid durationBucket', () => {
		expect(parsePortfolioFilters(new URLSearchParams('duration=daytrader')).durationBucket).toBe('');
	});
});

// ─── buildPortfolioSearchParams ───────────────────────────────────────────────

describe('buildPortfolioSearchParams', () => {
	it('returns empty params for empty filters', () => {
		const params = buildPortfolioSearchParams(emptyFilters);
		expect(params.toString()).toBe('');
	});

	it('roundtrips with parsePortfolioFilters', () => {
		const original: PortfolioFilterState = {
			q: 'test',
			from: '2024-01-01',
			to: '2024-12-31',
			symbols: ['EURUSD', 'GBPUSD'],
			sessions: ['asian', 'london'],
			directions: ['BUY'],
			tagIds: ['t1'],
			playbookIds: ['p1'],
			reviewStatus: ['reviewed'],
			outcome: 'win',
			hasNotes: true,
			hasAttachments: false,
			durationBucket: 'scalp',
			profitMin: null,
			profitMax: null,
			lotSizeMin: null,
			lotSizeMax: null,
			pipsMin: null,
			pipsMax: null,
			qualityScoreMin: null,
			qualityScoreMax: null,
			disciplineScoreMin: null,
			disciplineScoreMax: null,
			executionScoreMin: null,
			executionScoreMax: null,
			confidenceMin: null,
			confidenceMax: null,
			followedPlan: '',
			hasBrokenRules: '',
			dayOfWeek: []
		};
		const params = buildPortfolioSearchParams(original);
		const parsed = parsePortfolioFilters(params);
		expect(parsed).toEqual(original);
	});

	it('omits null hasNotes/hasAttachments', () => {
		const params = buildPortfolioSearchParams({ ...emptyFilters, hasNotes: null, hasAttachments: null });
		expect(params.has('has_notes')).toBe(false);
		expect(params.has('has_attachments')).toBe(false);
	});

	it('encodes hasNotes=false as 0', () => {
		const params = buildPortfolioSearchParams({ ...emptyFilters, hasNotes: false });
		expect(params.get('has_notes')).toBe('0');
	});

	it('encodes duration bucket', () => {
		const params = buildPortfolioSearchParams({ ...emptyFilters, durationBucket: 'swing' });
		expect(params.get('duration')).toBe('swing');
	});
});

// ─── Trade accessor helpers ──────────────────────────────────────────────────

describe('getTradeReview', () => {
	it('returns first review if present', () => {
		const review = makeReview({ review_status: 'reviewed' });
		const trade = makeTrade({ trade_reviews: [review] });
		expect(getTradeReview(trade)).toBe(review);
	});

	it('returns null if no reviews', () => {
		expect(getTradeReview(makeTrade({ trade_reviews: [] }))).toBeNull();
		expect(getTradeReview(makeTrade({ trade_reviews: undefined }))).toBeNull();
	});
});

describe('getTradeReviewStatus', () => {
	it('returns review_status from first review', () => {
		const trade = makeTrade({ trade_reviews: [makeReview({ review_status: 'in_progress' })] });
		expect(getTradeReviewStatus(trade)).toBe('in_progress');
	});

	it('defaults to unreviewed when no review', () => {
		expect(getTradeReviewStatus(makeTrade())).toBe('unreviewed');
	});
});

describe('getTradeNotes', () => {
	it('returns trade_notes array', () => {
		const notes = [makeNote({ id: 'n1', content: 'hello' })];
		expect(getTradeNotes(makeTrade({ trade_notes: notes }))).toBe(notes);
	});

	it('returns empty array if missing', () => {
		expect(getTradeNotes(makeTrade({ trade_notes: undefined }))).toEqual([]);
	});
});

describe('getTradeAttachments', () => {
	it('returns trade_attachments array', () => {
		const att = [makeAttachment({ id: 'a1', storage_path: '/img.png' })];
		expect(getTradeAttachments(makeTrade({ trade_attachments: att }))).toBe(att);
	});

	it('returns empty array if missing', () => {
		expect(getTradeAttachments(makeTrade({ trade_attachments: undefined }))).toEqual([]);
	});
});

describe('getTradePlaybookId', () => {
	it('returns playbook_id from review', () => {
		const trade = makeTrade({ trade_reviews: [makeReview({ playbook_id: 'pb-1' })] });
		expect(getTradePlaybookId(trade)).toBe('pb-1');
	});

	it('returns null when no review or no playbook', () => {
		expect(getTradePlaybookId(makeTrade())).toBeNull();
		expect(getTradePlaybookId(makeTrade({ trade_reviews: [makeReview({ playbook_id: null })] }))).toBeNull();
	});
});

// ─── getTradeSession ──────────────────────────────────────────────────────────

describe('getTradeSession', () => {
	it('returns asian for UTC hours 0–7', () => {
		expect(getTradeSession('2024-01-15T00:00:00Z')).toBe('asian');
		expect(getTradeSession('2024-01-15T07:59:59Z')).toBe('asian');
	});

	it('returns london for UTC hours 8–14', () => {
		expect(getTradeSession('2024-01-15T08:00:00Z')).toBe('london');
		expect(getTradeSession('2024-01-15T14:59:59Z')).toBe('london');
	});

	it('returns newyork for UTC hours 15–23', () => {
		expect(getTradeSession('2024-01-15T15:00:00Z')).toBe('newyork');
		expect(getTradeSession('2024-01-15T23:59:59Z')).toBe('newyork');
	});

	it('defaults to newyork for null/undefined close time', () => {
		expect(getTradeSession(null)).toBe('newyork');
		expect(getTradeSession(undefined)).toBe('newyork');
	});
});

// ─── getTradeDurationMinutes ──────────────────────────────────────────────────

describe('getTradeDurationMinutes', () => {
	it('calculates duration in minutes', () => {
		expect(getTradeDurationMinutes('2024-01-15T08:00:00Z', '2024-01-15T10:30:00Z')).toBe(150);
	});

	it('returns 0 for same open/close time', () => {
		expect(getTradeDurationMinutes('2024-01-15T08:00:00Z', '2024-01-15T08:00:00Z')).toBe(0);
	});

	it('returns 0 if open or close is null/undefined', () => {
		expect(getTradeDurationMinutes(null, '2024-01-15T10:00:00Z')).toBe(0);
		expect(getTradeDurationMinutes('2024-01-15T08:00:00Z', null)).toBe(0);
		expect(getTradeDurationMinutes(undefined, undefined)).toBe(0);
	});

	it('returns 0 for negative duration (close before open)', () => {
		expect(getTradeDurationMinutes('2024-01-15T10:00:00Z', '2024-01-15T08:00:00Z')).toBe(0);
	});
});

// ─── getTradeDurationBucket ───────────────────────────────────────────────────

describe('getTradeDurationBucket', () => {
	it('scalp: < 15 minutes', () => {
		expect(getTradeDurationBucket('2024-01-15T08:00:00Z', '2024-01-15T08:14:00Z')).toBe('scalp');
		expect(getTradeDurationBucket('2024-01-15T08:00:00Z', '2024-01-15T08:00:00Z')).toBe('scalp');
	});

	it('intraday: 15 min to < 24 hours', () => {
		expect(getTradeDurationBucket('2024-01-15T08:00:00Z', '2024-01-15T08:15:00Z')).toBe('intraday');
		expect(getTradeDurationBucket('2024-01-15T00:00:00Z', '2024-01-15T23:59:00Z')).toBe('intraday');
	});

	it('swing: 1 day to < 3 days', () => {
		expect(getTradeDurationBucket('2024-01-15T08:00:00Z', '2024-01-16T08:00:00Z')).toBe('swing');
		expect(getTradeDurationBucket('2024-01-15T08:00:00Z', '2024-01-17T07:59:00Z')).toBe('swing');
	});

	it('position: >= 3 days', () => {
		expect(getTradeDurationBucket('2024-01-15T08:00:00Z', '2024-01-18T08:00:00Z')).toBe('position');
	});
});

// ─── applyPortfolioFilters ────────────────────────────────────────────────────

describe('applyPortfolioFilters', () => {
	it('returns all trades with empty filters', () => {
		const trades = [makeTrade({ id: '1' }), makeTrade({ id: '2' })];
		expect(applyPortfolioFilters(trades, emptyFilters)).toHaveLength(2);
	});

	describe('symbol filter', () => {
		it('keeps only matching symbols', () => {
			const trades = [
				makeTrade({ id: '1', symbol: 'EURUSD' }),
				makeTrade({ id: '2', symbol: 'GBPUSD' })
			];
			const result = applyPortfolioFilters(trades, { ...emptyFilters, symbols: ['EURUSD'] });
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('1');
		});
	});

	describe('direction filter', () => {
		it('keeps only matching directions', () => {
			const trades = [makeTrade({ id: '1', type: 'BUY' }), makeTrade({ id: '2', type: 'SELL' })];
			const result = applyPortfolioFilters(trades, { ...emptyFilters, directions: ['SELL'] });
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('2');
		});
	});

	describe('session filter', () => {
		it('filters by session based on close_time UTC hour', () => {
			const asian = makeTrade({ id: 'a', close_time: '2024-01-15T04:00:00Z' });
			const london = makeTrade({ id: 'l', close_time: '2024-01-15T10:00:00Z' });
			const ny = makeTrade({ id: 'n', close_time: '2024-01-15T18:00:00Z' });

			const result = applyPortfolioFilters([asian, london, ny], { ...emptyFilters, sessions: ['london'] });
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('l');
		});
	});

	describe('reviewStatus filter', () => {
		it('filters by review status', () => {
			const reviewed = makeTrade({ id: '1', trade_reviews: [makeReview({ review_status: 'reviewed' })] });
			const unreviewed = makeTrade({ id: '2' });
			const result = applyPortfolioFilters([reviewed, unreviewed], {
				...emptyFilters,
				reviewStatus: ['reviewed']
			});
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('1');
		});
	});

	describe('playbook filter', () => {
		it('keeps trades with matching playbook', () => {
			const withPlaybook = makeTrade({
				id: '1',
				trade_reviews: [makeReview({ playbook_id: 'pb-1' })]
			});
			const noPlaybook = makeTrade({ id: '2' });
			const result = applyPortfolioFilters([withPlaybook, noPlaybook], {
				...emptyFilters,
				playbookIds: ['pb-1']
			});
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('1');
		});

		it('excludes trades whose playbook does not match', () => {
			const trade = makeTrade({ trade_reviews: [makeReview({ playbook_id: 'pb-other' })] });
			const result = applyPortfolioFilters([trade], { ...emptyFilters, playbookIds: ['pb-1'] });
			expect(result).toHaveLength(0);
		});
	});

	describe('tag filter', () => {
		it('keeps trades with at least one matching tag', () => {
			const tagged = makeTrade({
				id: '1',
				trade_tag_assignments: [{ id: 'ta1', trade_id: 'trade-1', tag_id: 'tag-1', created_at: '' }]
			});
			const untagged = makeTrade({ id: '2' });
			const result = applyPortfolioFilters([tagged, untagged], { ...emptyFilters, tagIds: ['tag-1'] });
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('1');
		});
	});

	describe('outcome filter', () => {
		it('win: keeps profit > 0', () => {
			const win = makeTrade({ id: 'w', profit: 100 });
			const loss = makeTrade({ id: 'l', profit: -50 });
			const be = makeTrade({ id: 'b', profit: 0 });
			const result = applyPortfolioFilters([win, loss, be], { ...emptyFilters, outcome: 'win' });
			expect(result.map((t) => t.id)).toEqual(['w']);
		});

		it('loss: keeps profit < 0', () => {
			const win = makeTrade({ id: 'w', profit: 100 });
			const loss = makeTrade({ id: 'l', profit: -50 });
			const result = applyPortfolioFilters([win, loss], { ...emptyFilters, outcome: 'loss' });
			expect(result.map((t) => t.id)).toEqual(['l']);
		});

		it('breakeven: keeps profit within 0.01 of 0', () => {
			const be = makeTrade({ id: 'b', profit: 0 });
			const nearBe = makeTrade({ id: 'nb', profit: 0.005 });
			const win = makeTrade({ id: 'w', profit: 100 });
			const result = applyPortfolioFilters([be, nearBe, win], { ...emptyFilters, outcome: 'breakeven' });
			expect(result.map((t) => t.id)).toEqual(['b', 'nb']);
		});
	});

	describe('hasNotes filter', () => {
		it('true: keeps only trades with notes', () => {
			const withNote = makeTrade({ id: '1', trade_notes: [makeNote({ id: 'n1', content: 'note' })] });
			const noNote = makeTrade({ id: '2' });
			const result = applyPortfolioFilters([withNote, noNote], { ...emptyFilters, hasNotes: true });
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('1');
		});

		it('false: keeps only trades without notes', () => {
			const withNote = makeTrade({ id: '1', trade_notes: [makeNote({ id: 'n1', content: 'note' })] });
			const noNote = makeTrade({ id: '2' });
			const result = applyPortfolioFilters([withNote, noNote], { ...emptyFilters, hasNotes: false });
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('2');
		});

		it('null: does not filter', () => {
			const trades = [
				makeTrade({ id: '1', trade_notes: [makeNote({ id: 'n1', content: 'note' })] }),
				makeTrade({ id: '2' })
			];
			expect(applyPortfolioFilters(trades, { ...emptyFilters, hasNotes: null })).toHaveLength(2);
		});
	});

	describe('hasAttachments filter', () => {
		it('true: keeps only trades with attachments', () => {
			const withAtt = makeTrade({
				id: '1',
				trade_attachments: [makeAttachment({ id: 'a1', storage_path: '/img.png' })]
			});
			const noAtt = makeTrade({ id: '2' });
			const result = applyPortfolioFilters([withAtt, noAtt], { ...emptyFilters, hasAttachments: true });
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('1');
		});

		it('false: keeps only trades without attachments', () => {
			const withAtt = makeTrade({
				id: '1',
				trade_attachments: [makeAttachment({ id: 'a1', storage_path: '/img.png' })]
			});
			const noAtt = makeTrade({ id: '2' });
			const result = applyPortfolioFilters([withAtt, noAtt], { ...emptyFilters, hasAttachments: false });
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('2');
		});
	});

	describe('durationBucket filter', () => {
		it('filters by scalp bucket', () => {
			const scalp = makeTrade({
				id: 'scalp',
				open_time: '2024-01-15T08:00:00Z',
				close_time: '2024-01-15T08:05:00Z'
			});
			const intraday = makeTrade({
				id: 'intra',
				open_time: '2024-01-15T08:00:00Z',
				close_time: '2024-01-15T10:00:00Z'
			});
			const result = applyPortfolioFilters([scalp, intraday], {
				...emptyFilters,
				durationBucket: 'scalp'
			});
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('scalp');
		});
	});

	describe('date range filter', () => {
		// THAILAND_OFFSET_MS = 7h — the filter subtracts 7h from midnight UTC
		// so from=2024-01-15 means: closeTime >= 2024-01-14T17:00:00Z
		it('from: excludes trades closed before the date (in Bangkok time)', () => {
			const before = makeTrade({ id: 'b', close_time: '2024-01-14T16:59:59Z' });
			const onDay = makeTrade({ id: 'o', close_time: '2024-01-14T17:00:00Z' });
			const after = makeTrade({ id: 'a', close_time: '2024-01-16T00:00:00Z' });
			const result = applyPortfolioFilters([before, onDay, after], {
				...emptyFilters,
				from: '2024-01-15'
			});
			expect(result.map((t) => t.id)).toEqual(['o', 'a']);
		});

		it('to: excludes trades closed after the date end (in Bangkok time)', () => {
			// to=2024-01-15 means: closeTime <= 2024-01-15T23:59:59Z - 7h = 2024-01-15T16:59:59Z
			const within = makeTrade({ id: 'w', close_time: '2024-01-15T16:59:59Z' });
			const after = makeTrade({ id: 'a', close_time: '2024-01-15T17:00:00Z' });
			const result = applyPortfolioFilters([within, after], { ...emptyFilters, to: '2024-01-15' });
			expect(result.map((t) => t.id)).toEqual(['w']);
		});
	});

	describe('text search (q) filter', () => {
		it('matches on symbol', () => {
			const trades = [makeTrade({ id: '1', symbol: 'EURUSD' }), makeTrade({ id: '2', symbol: 'GBPUSD' })];
			const result = applyPortfolioFilters(trades, { ...emptyFilters, q: 'gbp' });
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('2');
		});

		it('matches on entry_reason from review', () => {
			const trade = makeTrade({
				id: '1',
				trade_reviews: [makeReview({ entry_reason: 'breakout setup' })]
			});
			const other = makeTrade({ id: '2' });
			const result = applyPortfolioFilters([trade, other], { ...emptyFilters, q: 'breakout' });
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('1');
		});

		it('matches on tag name', () => {
			const trade = makeTrade({
				id: '1',
				trade_tag_assignments: [
					{
						id: 'ta1',
						trade_id: 'trade-1',
						tag_id: 'tag-1',
						created_at: '',
						trade_tags: { id: 'tag-1', user_id: 'u1', name: 'ScalpKing', category: 'setup', color: '#fff', created_at: '' }
					}
				]
			});
			const result = applyPortfolioFilters([trade], { ...emptyFilters, q: 'scalpking' });
			expect(result).toHaveLength(1);
		});

		it('is case-insensitive', () => {
			const trade = makeTrade({ symbol: 'EURUSD' });
			expect(applyPortfolioFilters([trade], { ...emptyFilters, q: 'eurusd' })).toHaveLength(1);
			expect(applyPortfolioFilters([trade], { ...emptyFilters, q: 'EURUSD' })).toHaveLength(1);
			expect(applyPortfolioFilters([trade], { ...emptyFilters, q: 'EuRuSd' })).toHaveLength(1);
		});

		it('excludes non-matching trades', () => {
			const trade = makeTrade({ symbol: 'EURUSD' });
			expect(applyPortfolioFilters([trade], { ...emptyFilters, q: 'USDJPY' })).toHaveLength(0);
		});
	});

	describe('combined filters', () => {
		it('applies multiple filters simultaneously (AND logic)', () => {
			const match = makeTrade({
				id: 'match',
				symbol: 'EURUSD',
				type: 'BUY',
				profit: 100,
				close_time: '2024-01-15T10:00:00Z' // london session
			});
			const wrongSymbol = makeTrade({
				id: 'wrong-sym',
				symbol: 'GBPUSD',
				type: 'BUY',
				profit: 100,
				close_time: '2024-01-15T10:00:00Z'
			});
			const wrongOutcome = makeTrade({
				id: 'wrong-outcome',
				symbol: 'EURUSD',
				type: 'BUY',
				profit: -50,
				close_time: '2024-01-15T10:00:00Z'
			});

			const result = applyPortfolioFilters([match, wrongSymbol, wrongOutcome], {
				...emptyFilters,
				symbols: ['EURUSD'],
				outcome: 'win'
			});
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('match');
		});
	});
});
