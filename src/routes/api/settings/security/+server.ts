import { json } from '@sveltejs/kit';
import { rateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

type SecurityAction = 'change-password' | '2fa-enroll' | '2fa-verify-enroll' | '2fa-disable';
type TotpFactor = {
	id: string;
	friendly_name?: string;
	factor_type: 'totp';
	status: 'verified' | 'unverified';
	created_at: string;
	updated_at: string;
	last_challenged_at?: string;
};

function isValidTotpCode(code: unknown): code is string {
	return typeof code === 'string' && /^\d{6}$/.test(code);
}

function getRateLimitBucket(action: SecurityAction, userId: string, ip: string) {
	if (action === 'change-password') {
		return { key: `security:password:${userId}:${ip}`, limit: 5 };
	}

	return { key: `security:2fa:${action}:${userId}:${ip}`, limit: 10 };
}

async function listTotpFactors(locals: App.Locals) {
	const { data, error } = await locals.supabase.auth.mfa.listFactors();
	if (error) throw error;

	return (data?.all ?? []).filter((factor): factor is TotpFactor => factor.factor_type === 'totp');
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	const body = await request.json();
	const action = body.action as SecurityAction | undefined;
	if (!action) {
		return json({ message: 'การกระทำไม่ถูกต้อง' }, { status: 400 });
	}

	const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
	const rate = getRateLimitBucket(action, locals.user.id, ip);
	if (!(await rateLimit(rate.key, rate.limit, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	if (action === 'change-password') {
		const currentPassword = body.currentPassword;
		const newPassword = body.newPassword;

		if (!newPassword || newPassword.length < 8) {
			return json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 400 });
		}

		const email = locals.user.email;
		if (!email) {
			return json({ message: 'ไม่พบอีเมลของผู้ใช้' }, { status: 400 });
		}

		if (!currentPassword) {
			return json({ message: 'กรุณากรอกรหัสผ่านปัจจุบัน' }, { status: 400 });
		}

		const { error: signInError } = await locals.supabase.auth.signInWithPassword({
			email,
			password: currentPassword
		});

		if (signInError) {
			return json({ message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }, { status: 400 });
		}

		const { error: updateError } = await locals.supabase.auth.updateUser({
			password: newPassword
		});

		if (updateError) {
			return json({ message: updateError.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้' }, { status: 500 });
		}

		return json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
	}

	if (action === '2fa-enroll') {
		try {
			const factors = await listTotpFactors(locals);
			const verifiedFactor = factors.find((factor) => factor.status === 'verified');
			if (verifiedFactor) {
				return json({ message: 'บัญชีนี้เปิดใช้งาน 2FA อยู่แล้ว' }, { status: 400 });
			}

			for (const factor of factors.filter((item) => item.status === 'unverified')) {
				await locals.supabase.auth.mfa.unenroll({ factorId: factor.id });
			}

			const { data, error } = await locals.supabase.auth.mfa.enroll({
				factorType: 'totp',
				issuer: 'IB Portal',
				friendlyName: 'Authenticator App'
			});

			if (error || !data) {
				return json({ message: error?.message || 'ไม่สามารถเริ่มเปิดใช้งาน 2FA ได้' }, { status: 500 });
			}

			return json({
				success: true,
				message: 'สร้าง QR Code สำหรับ 2FA แล้ว',
				factorId: data.id,
				qrCode: data.totp.qr_code,
				secret: data.totp.secret,
				uri: data.totp.uri
			});
		} catch (error) {
			return json({ message: error instanceof Error ? error.message : 'ไม่สามารถเริ่มเปิดใช้งาน 2FA ได้' }, { status: 500 });
		}
	}

	if (action === '2fa-verify-enroll') {
		const factorId = typeof body.factorId === 'string' ? body.factorId : '';
		const code = body.code;

		if (!factorId) {
			return json({ message: 'ไม่พบ factor ที่ต้องการยืนยัน' }, { status: 400 });
		}
		if (!isValidTotpCode(code)) {
			return json({ message: 'กรุณากรอกรหัสยืนยัน 6 หลัก' }, { status: 400 });
		}

		try {
			const factors = await listTotpFactors(locals);
			const pendingFactor = factors.find((factor) => factor.id === factorId && factor.status === 'unverified');
			if (!pendingFactor) {
				return json({ message: 'ไม่พบคำขอเปิดใช้งาน 2FA ที่รอการยืนยัน' }, { status: 400 });
			}

			const { data: challengeData, error: challengeError } = await locals.supabase.auth.mfa.challenge({ factorId });
			if (challengeError || !challengeData) {
				return json({ message: challengeError?.message || 'ไม่สามารถสร้างคำขอยืนยัน 2FA ได้' }, { status: 500 });
			}

			const { error: verifyError } = await locals.supabase.auth.mfa.verify({
				factorId,
				challengeId: challengeData.id,
				code
			});
			if (verifyError) {
				return json({ message: 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุแล้ว' }, { status: 400 });
			}

			return json({ success: true, message: 'เปิดใช้งาน 2FA สำเร็จแล้ว' });
		} catch (error) {
			return json({ message: error instanceof Error ? error.message : 'ไม่สามารถยืนยันการเปิดใช้งาน 2FA ได้' }, { status: 500 });
		}
	}

	if (action === '2fa-disable') {
		const code = body.code;
		if (!isValidTotpCode(code)) {
			return json({ message: 'กรุณากรอกรหัสยืนยัน 6 หลัก' }, { status: 400 });
		}

		try {
			const factors = await listTotpFactors(locals);
			const verifiedFactor = factors.find((factor) => factor.status === 'verified');
			if (!verifiedFactor) {
				return json({ message: 'บัญชีนี้ยังไม่ได้เปิดใช้งาน 2FA' }, { status: 400 });
			}

			const { data: challengeData, error: challengeError } = await locals.supabase.auth.mfa.challenge({
				factorId: verifiedFactor.id
			});
			if (challengeError || !challengeData) {
				return json({ message: challengeError?.message || 'ไม่สามารถยืนยันการปิด 2FA ได้' }, { status: 500 });
			}

			const { error: verifyError } = await locals.supabase.auth.mfa.verify({
				factorId: verifiedFactor.id,
				challengeId: challengeData.id,
				code
			});
			if (verifyError) {
				return json({ message: 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุแล้ว' }, { status: 400 });
			}

			const { error: unenrollError } = await locals.supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id });
			if (unenrollError) {
				return json({ message: unenrollError.message || 'ไม่สามารถปิดการใช้งาน 2FA ได้' }, { status: 500 });
			}

			return json({ success: true, message: 'ปิดการใช้งาน 2FA แล้ว' });
		} catch (error) {
			return json({ message: error instanceof Error ? error.message : 'ไม่สามารถปิดการใช้งาน 2FA ได้' }, { status: 500 });
		}
	}

	return json({ message: 'การกระทำไม่ถูกต้อง' }, { status: 400 });
};
