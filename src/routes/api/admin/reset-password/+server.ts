import { json } from '@sveltejs/kit';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import { rateLimit } from '$lib/server/rate-limit';
import crypto from 'crypto';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (locals.profile?.role !== 'admin') {
		return json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
	}

	const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
	if (!(await rateLimit(`admin:reset-password:${ip}`, 5, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const { user_id } = await request.json();

	if (!user_id) {
		return json({ message: 'กรุณาระบุ user_id' }, { status: 400 });
	}

	const supabase = createSupabaseServiceClient();

	// Verify the user exists and is a master_ib
	const { data: ib, error: ibError } = await supabase
		.from('master_ibs')
		.select('id')
		.eq('user_id', user_id)
		.single();

	if (ibError || !ib) {
		return json({ message: 'ไม่พบ Master IB' }, { status: 404 });
	}

	const newPassword = crypto.randomBytes(8).toString('hex');

	const { error: updateError } = await supabase.auth.admin.updateUserById(user_id, {
		password: newPassword
	});

	if (updateError) {
		return json({ message: updateError.message || 'ไม่สามารถรีเซ็ตรหัสผ่านได้' }, { status: 500 });
	}

	return json({ success: true, tempPassword: newPassword });
};
