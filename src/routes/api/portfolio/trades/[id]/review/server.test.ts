import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/rate-limit', () => ({
	rateLimit: vi.fn().mockResolvedValue(true)
}));

vi.mock('$lib/server/portfolio', () => ({
	invalidateTradesCache: vi.fn()
}));

vi.mock('$lib/server/trade-guard', () => ({
	verifyTradeOwnership: vi.fn()
}));

import { POST } from './+server';
import { rateLimit } from '$lib/server/rate-limit';
import { invalidateTradesCache } from '$lib/server/portfolio';
import { verifyTradeOwnership } from '$lib/server/trade-guard';

type SupabaseStub = {
	from: ReturnType<typeof vi.fn>;
	_upsertCalls: Array<{ payload: unknown; options: unknown }>;
};

type UpsertResult = {
	data: unknown;
	error: { message: string; code?: string } | null;
	status?: number;
};
type FetchResult = { data: unknown; error: { message: string } | null };
type ExistingReviewRow = { reviewed_at: string | null } | null;

function makeSupabase(
	upsertResult: UpsertResult,
	fetchResult: FetchResult,
	existingRow: ExistingReviewRow = null
): SupabaseStub {
	const stub = {
		_upsertCalls: [] as Array<{ payload: unknown; options: unknown }>
	} as SupabaseStub;

	// Handler calls three patterns on .from('trade_reviews'):
	//   1. .upsert(payload, opts).select().single()  → upsertResult
	//   2. .select('reviewed_at').eq().maybeSingle() → existingRow (preservation check)
	//   3. .select('*, playbooks(...)').eq().single() → fetchResult (post-upsert re-fetch)
	stub.from = vi.fn(() => ({
		upsert: vi.fn((payload: unknown, options: unknown) => {
			stub._upsertCalls.push({ payload, options });
			return {
				select: vi.fn(() => ({
					single: vi.fn(() => Promise.resolve(upsertResult))
				}))
			};
		}),
		select: vi.fn(() => ({
			eq: vi.fn(() => ({
				single: vi.fn(() => Promise.resolve(fetchResult)),
				maybeSingle: vi.fn(() => Promise.resolve({ data: existingRow, error: null }))
			}))
		}))
	}));

	return stub;
}

type MockEventOverrides = {
	body?: Record<string, unknown>;
	profile?: { id: string; role: string } | null;
	supabase?: SupabaseStub;
	tradeId?: string;
};

function makeEvent(overrides: MockEventOverrides = {}) {
	const body = overrides.body ?? {};
	const profile = overrides.profile === undefined
		? { id: 'user-1', role: 'client' }
		: overrides.profile;
	const supabase = overrides.supabase ?? makeSupabase(
		{ data: { id: 'review-1', trade_id: overrides.tradeId ?? 'trade-1' }, error: null },
		{ data: { id: 'review-1', trade_id: overrides.tradeId ?? 'trade-1' }, error: null }
	);
	const tradeId = overrides.tradeId ?? 'trade-1';

	return {
		request: new Request(`http://localhost/api/portfolio/trades/${tradeId}/review`, {
			method: 'POST',
			body: JSON.stringify(body),
			headers: { 'Content-Type': 'application/json' }
		}),
		params: { id: tradeId },
		locals: { profile, supabase }
	};
}

describe('POST /api/portfolio/trades/[id]/review', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(verifyTradeOwnership).mockResolvedValue({
			ok: true as const,
			accountId: 'account-1'
		});
		vi.mocked(rateLimit).mockResolvedValue(true);
	});

	it('returns 200 with review when upsert + fetch both succeed', async () => {
		const supabase = makeSupabase(
			{ data: { id: 'review-1', review_status: 'in_progress' }, error: null },
			{ data: { id: 'review-1', review_status: 'in_progress' }, error: null }
		);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const res = await POST(makeEvent({ supabase, body: { review_status: 'in_progress' } }) as any);

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.review).toEqual({ id: 'review-1', review_status: 'in_progress' });
		expect(invalidateTradesCache).toHaveBeenCalledWith('account-1');
	});

	it('returns 200 with review=null when upsert succeeds but fetch fails', async () => {
		const supabase = makeSupabase(
			{ data: { id: 'review-1' }, error: null },
			{ data: null, error: { message: 'fetch blew up' } }
		);
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const res = await POST(makeEvent({ supabase, body: { review_status: 'reviewed' } }) as any);

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.review).toBeNull();
		expect(invalidateTradesCache).toHaveBeenCalledWith('account-1');
		errSpy.mockRestore();
	});

	it('returns 500 when upsert fails', async () => {
		const supabase = makeSupabase(
			{ data: null, error: { message: 'duplicate key violation', code: '23505' } },
			{ data: null, error: null }
		);
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const res = await POST(makeEvent({ supabase, body: { review_status: 'in_progress' } }) as any);

		expect(res.status).toBe(500);
		const json = await res.json();
		expect(json.message).toBe('duplicate key violation');
		expect(invalidateTradesCache).not.toHaveBeenCalled();
		errSpy.mockRestore();
	});

	it('returns 400 when setup_quality_score is out of range', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const res = await POST(makeEvent({ body: { setup_quality_score: 6 } }) as any);

		expect(res.status).toBe(400);
		const json = await res.json();
		expect(json.message).toBe('setup_quality_score must be 1-5');
	});

	it('returns 400 when review_status is invalid', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const res = await POST(makeEvent({ body: { review_status: 'bogus' } }) as any);

		expect(res.status).toBe(400);
		const json = await res.json();
		expect(json.message).toBe('Invalid review_status');
	});

	it('returns 403 with specific message when role is admin', async () => {
		const res = await POST(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			makeEvent({ profile: { id: 'admin-1', role: 'admin' }, body: {} }) as any
		);

		expect(res.status).toBe(403);
		const json = await res.json();
		expect(json.message).toContain('client');
	});

	it('returns 401 when profile is null', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const res = await POST(makeEvent({ profile: null, body: {} }) as any);

		expect(res.status).toBe(401);
	});

	it('returns 429 when rate limit is exceeded', async () => {
		vi.mocked(rateLimit).mockResolvedValueOnce(false);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const res = await POST(makeEvent({ body: {} }) as any);

		expect(res.status).toBe(429);
	});

	it('sets reviewed_at when review_status is reviewed', async () => {
		const supabase = makeSupabase(
			{ data: { id: 'review-1' }, error: null },
			{ data: { id: 'review-1' }, error: null }
		);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await POST(makeEvent({ supabase, body: { review_status: 'reviewed' } }) as any);

		expect(supabase._upsertCalls).toHaveLength(1);
		const payload = supabase._upsertCalls[0].payload as { reviewed_at: string | null };
		expect(payload.reviewed_at).toBeTruthy();
		expect(typeof payload.reviewed_at).toBe('string');
	});

	it('does not include reviewed_at when review_status is not reviewed', async () => {
		const supabase = makeSupabase(
			{ data: { id: 'review-1' }, error: null },
			{ data: { id: 'review-1' }, error: null }
		);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await POST(makeEvent({ supabase, body: { review_status: 'in_progress' } }) as any);

		const payload = supabase._upsertCalls[0].payload as Record<string, unknown>;
		// reviewed_at is only added to the payload when transitioning to 'reviewed'
		expect('reviewed_at' in payload).toBe(false);
	});

	it('preserves existing reviewed_at when re-saving as reviewed', async () => {
		const originalTimestamp = '2026-01-15T10:00:00.000Z';
		const supabase = makeSupabase(
			{ data: { id: 'review-1' }, error: null },
			{ data: { id: 'review-1' }, error: null },
			{ reviewed_at: originalTimestamp }
		);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await POST(makeEvent({ supabase, body: { review_status: 'reviewed' } }) as any);

		const payload = supabase._upsertCalls[0].payload as { reviewed_at: string };
		expect(payload.reviewed_at).toBe(originalTimestamp);
	});

	it('null scores stay null, valid scores pass through (?? null, not || null)', async () => {
		const supabase = makeSupabase(
			{ data: { id: 'review-1' }, error: null },
			{ data: { id: 'review-1' }, error: null }
		);
		await POST(
			makeEvent({
				supabase,
				body: {
					review_status: 'in_progress',
					setup_quality_score: null,
					discipline_score: 3,
					execution_score: null,
					confidence_at_entry: 4
				}
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			}) as any
		);

		const payload = supabase._upsertCalls[0].payload as {
			setup_quality_score: number | null;
			discipline_score: number | null;
			execution_score: number | null;
			confidence_at_entry: number | null;
		};
		expect(payload.setup_quality_score).toBeNull();
		expect(payload.discipline_score).toBe(3);
		expect(payload.execution_score).toBeNull();
		expect(payload.confidence_at_entry).toBe(4);
	});
});
