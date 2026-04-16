import { json } from '@sveltejs/kit';
import { getRoleRedirect, sanitizeReturnTo } from '$lib/server/mfa';
import { rateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

function isValidTotpCode(code: unknown): code is string {
	return typeof code === 'string' && /^\d{6}$/.test(code);
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	if (!locals.needsMfa) {
		return json({ message: 'เซสชันนี้ไม่ต้องยืนยันตัวตนเพิ่มเติม' }, { status: 400 });
	}

	const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
	if (!(await rateLimit(`auth:mfa:${locals.user.id}:${ip}`, 5, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const { action, code, returnTo } = await request.json();
	if (action !== 'verify-totp') {
		return json({ message: 'การกระทำไม่ถูกต้อง' }, { status: 400 });
	}

	if (!isValidTotpCode(code)) {
		return json({ message: 'กรุณากรอกรหัสยืนยัน 6 หลัก' }, { status: 400 });
	}

	const { data: factorData, error: factorError } = await locals.supabase.auth.mfa.listFactors();
	if (factorError) {
		return json({ message: factorError.message || 'ไม่สามารถตรวจสอบสถานะ 2FA ได้' }, { status: 500 });
	}

	const factor = (factorData?.all ?? []).find((item) => item.factor_type === 'totp' && item.status === 'verified');
	if (!factor) {
		return json({ message: 'ไม่พบตัวตรวจสอบสิทธิ์ 2FA ที่เปิดใช้งานอยู่' }, { status: 400 });
	}

	const { error: verifyError } = await locals.supabase.auth.mfa.challengeAndVerify({
		factorId: factor.id,
		code
	});

	if (verifyError) {
		return json({ message: 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุแล้ว' }, { status: 400 });
	}

	const fallback = getRoleRedirect(locals.profile?.role);
	return json({
		success: true,
		message: 'ยืนยันตัวตนสำเร็จ',
		redirectTo: sanitizeReturnTo(typeof returnTo === 'string' ? returnTo : null, fallback)
	});
};
