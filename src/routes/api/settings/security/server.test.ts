import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/rate-limit', () => ({
	rateLimit: vi.fn().mockResolvedValue(true)
}));

import { POST } from './+server';
import { rateLimit } from '$lib/server/rate-limit';

type MfaFactor = {
	id: string;
	friendly_name?: string;
	factor_type: 'totp';
	status: 'verified' | 'unverified';
	created_at: string;
	updated_at: string;
};

function makeSupabase(overrides: {
	signInError?: { message: string } | null;
	updateError?: { message: string } | null;
	factors?: MfaFactor[];
	enrollData?: { id: string; totp: { qr_code: string; secret: string; uri: string } } | null;
	enrollError?: { message: string } | null;
	challengeData?: { id: string } | null;
	challengeError?: { message: string } | null;
	verifyError?: { message: string } | null;
	unenrollError?: { message: string } | null;
}) {
	return {
		auth: {
			signInWithPassword: vi.fn().mockResolvedValue({ error: overrides.signInError ?? null }),
			updateUser: vi.fn().mockResolvedValue({ error: overrides.updateError ?? null }),
			mfa: {
				listFactors: vi.fn().mockResolvedValue({ data: { all: overrides.factors ?? [] }, error: null }),
				enroll: vi.fn().mockResolvedValue({ data: overrides.enrollData ?? null, error: overrides.enrollError ?? null }),
				challenge: vi.fn().mockResolvedValue({ data: overrides.challengeData ?? { id: 'challenge-1' }, error: overrides.challengeError ?? null }),
				verify: vi.fn().mockResolvedValue({ data: null, error: overrides.verifyError ?? null }),
				unenroll: vi.fn().mockResolvedValue({ data: { id: 'factor-1' }, error: overrides.unenrollError ?? null })
			}
		}
	};
}

function makeEvent(body: Record<string, unknown>, supabase = makeSupabase({})) {
	return {
		request: new Request('http://localhost/api/settings/security', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: {
			user: { id: 'user-1', email: 'user@example.com' },
			supabase
		}
	};
}

describe('POST /api/settings/security', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(rateLimit).mockResolvedValue(true);
	});

	it('changes password successfully', async () => {
		const supabase = makeSupabase({});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const res = await POST(makeEvent({ action: 'change-password', currentPassword: 'oldpass123', newPassword: 'newpass123' }, supabase) as any);

		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
		expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
			email: 'user@example.com',
			password: 'oldpass123'
		});
		expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newpass123' });
	});

	it('enrolls 2fa after removing stale unverified factor', async () => {
		const supabase = makeSupabase({
			factors: [
				{
					id: 'factor-stale',
					factor_type: 'totp',
					status: 'unverified',
					created_at: '2026-04-01T00:00:00.000Z',
					updated_at: '2026-04-01T00:00:00.000Z'
				}
			],
			enrollData: {
				id: 'factor-new',
				totp: {
					qr_code: '<svg />',
					secret: 'ABC123',
					uri: 'otpauth://totp/IBPortal'
				}
			}
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const res = await POST(makeEvent({ action: '2fa-enroll' }, supabase) as any);

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.factorId).toBe('factor-new');
		expect(supabase.auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'factor-stale' });
		expect(supabase.auth.mfa.enroll).toHaveBeenCalled();
	});

	it('rejects 2fa enroll when verified factor already exists', async () => {
		const supabase = makeSupabase({
			factors: [
				{
					id: 'factor-verified',
					factor_type: 'totp',
					status: 'verified',
					created_at: '2026-04-01T00:00:00.000Z',
					updated_at: '2026-04-01T00:00:00.000Z'
				}
			]
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const res = await POST(makeEvent({ action: '2fa-enroll' }, supabase) as any);

		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ message: 'บัญชีนี้เปิดใช้งาน 2FA อยู่แล้ว' });
	});

	it('rejects 2fa verify when pending factor does not exist', async () => {
		const supabase = makeSupabase({ factors: [] });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const res = await POST(makeEvent({ action: '2fa-verify-enroll', factorId: 'missing', code: '123456' }, supabase) as any);

		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ message: 'ไม่พบคำขอเปิดใช้งาน 2FA ที่รอการยืนยัน' });
	});

	it('disables 2fa when code is valid', async () => {
		const supabase = makeSupabase({
			factors: [
				{
					id: 'factor-verified',
					factor_type: 'totp',
					status: 'verified',
					created_at: '2026-04-01T00:00:00.000Z',
					updated_at: '2026-04-01T00:00:00.000Z'
				}
			]
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const res = await POST(makeEvent({ action: '2fa-disable', code: '123456' }, supabase) as any);

		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ success: true, message: 'ปิดการใช้งาน 2FA แล้ว' });
		expect(supabase.auth.mfa.verify).toHaveBeenCalled();
		expect(supabase.auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'factor-verified' });
	});

	it('returns 429 when rate limit is exceeded', async () => {
		vi.mocked(rateLimit).mockResolvedValueOnce(false);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const res = await POST(makeEvent({ action: '2fa-enroll' }) as any);

		expect(res.status).toBe(429);
	});
});
