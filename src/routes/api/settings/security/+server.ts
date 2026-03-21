import { json } from '@sveltejs/kit';
import { rateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
	if (!rateLimit(`security:password:${locals.user.id}:${ip}`, 5, 60_000)) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const { action, currentPassword, newPassword } = await request.json();

	if (action === 'change-password') {
		if (!newPassword || newPassword.length < 8) {
			return json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 400 });
		}

		// Verify current password by attempting sign-in
		const email = locals.user.email;
		if (!email) {
			return json({ message: 'ไม่พบอีเมลของผู้ใช้' }, { status: 400 });
		}

		if (currentPassword) {
			const { error: signInError } = await locals.supabase.auth.signInWithPassword({
				email,
				password: currentPassword
			});

			if (signInError) {
				return json({ message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }, { status: 400 });
			}
		}

		const { error: updateError } = await locals.supabase.auth.updateUser({
			password: newPassword
		});

		if (updateError) {
			return json({ message: updateError.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้' }, { status: 500 });
		}

		return json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
	}

	return json({ message: 'Invalid action' }, { status: 400 });
};
