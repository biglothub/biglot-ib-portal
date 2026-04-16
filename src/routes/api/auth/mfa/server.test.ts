import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/rate-limit', () => ({
	rateLimit: vi.fn().mockResolvedValue(true)
}));

import { POST } from './+server';
import { rateLimit } from '$lib/server/rate-limit';

function makeSupabase(overrides: {
	factors?: Array<{
		id: string;
		factor_type: 'totp';
		status: 'verified' | 'unverified';
		created_at: string;
		updated_at: string;
	}>;
	verifyError?: { message: string } | null;
}) {
	return {
		auth: {
			mfa: {
				listFactors: vi.fn().mockResolvedValue({
					data: { all: overrides.factors ?? [] },
					error: null
				}),
				challengeAndVerify: vi.fn().mockResolvedValue({
					data: null,
					error: overrides.verifyError ?? null
				})
			}
		}
	};
}

function makeEvent(body: Record<string, unknown>, overrides?: { needsMfa?: boolean; role?: 'admin' | 'master_ib' | 'client'; supabase?: ReturnType<typeof makeSupabase> }) {
	return {
		request: new Request('http://localhost/api/auth/mfa', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: {
			user: { id: 'user-1', email: 'user@example.com' },
			needsMfa: overrides?.needsMfa ?? true,
			profile: { role: overrides?.role ?? 'client' },
			supabase: overrides?.supabase ?? makeSupabase({})
		}
	};
}

describe('POST /api/auth/mfa', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(rateLimit).mockResolvedValue(true);
	});

	it('verifies totp and returns sanitized redirect path', async () => {
		const supabase = makeSupabase({
			factors: [
				{
					id: 'factor-1',
					factor_type: 'totp',
					status: 'verified',
					created_at: '2026-04-01T00:00:00.000Z',
					updated_at: '2026-04-01T00:00:00.000Z'
				}
			]
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const res = await POST(makeEvent({ action: 'verify-totp', code: '123456', returnTo: '/portfolio?tab=journal' }, { supabase }) as any);

		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			success: true,
			redirectTo: '/portfolio?tab=journal'
		});
		expect(supabase.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({
			factorId: 'factor-1',
			code: '123456'
		});
	});

	it('falls back to role home when returnTo is not safe', async () => {
		const supabase = makeSupabase({
			factors: [
				{
					id: 'factor-1',
					factor_type: 'totp',
					status: 'verified',
					created_at: '2026-04-01T00:00:00.000Z',
					updated_at: '2026-04-01T00:00:00.000Z'
				}
			]
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const res = await POST(makeEvent({ action: 'verify-totp', code: '123456', returnTo: 'https://evil.test' }, { role: 'admin', supabase }) as any);

		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ redirectTo: '/admin' });
	});

	it('rejects when current session does not need mfa', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const res = await POST(makeEvent({ action: 'verify-totp', code: '123456' }, { needsMfa: false }) as any);

		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ message: 'เซสชันนี้ไม่ต้องยืนยันตัวตนเพิ่มเติม' });
	});

	it('rejects when no verified factor exists', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const res = await POST(makeEvent({ action: 'verify-totp', code: '123456' }) as any);

		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ message: 'ไม่พบตัวตรวจสอบสิทธิ์ 2FA ที่เปิดใช้งานอยู่' });
	});

	it('returns 429 when rate limited', async () => {
		vi.mocked(rateLimit).mockResolvedValueOnce(false);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const res = await POST(makeEvent({ action: 'verify-totp', code: '123456' }) as any);

		expect(res.status).toBe(429);
	});
});
