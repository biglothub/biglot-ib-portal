import { json } from '@sveltejs/kit';
import { getDatabaseErrorStatus, isValidEmail } from '$lib/server/clientAccounts';
import { rateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || (profile.role !== 'master_ib' && profile.role !== 'admin')) {
		return json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
	}

	const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
	if (!(await rateLimit(`ib:edit:${ip}`, 10, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const body = await request.json();
	const { client_account_id, client_name, client_email, client_phone, nickname } = body;

	if (!client_account_id || !client_name) {
		return json({ message: 'กรุณากรอกข้อมูลที่จำเป็น' }, { status: 400 });
	}

	const trimmedName = client_name.trim();
	if (trimmedName.length < 2 || trimmedName.length > 100) {
		return json({ message: 'ชื่อลูกค้าต้องมี 2-100 ตัวอักษร' }, { status: 400 });
	}

	const normalizedEmail = client_email?.trim().toLowerCase() || null;
	if (normalizedEmail && !isValidEmail(normalizedEmail)) {
		return json({ message: 'รูปแบบอีเมลไม่ถูกต้อง' }, { status: 400 });
	}

	const { data, error: rpcError } = await locals.supabase.rpc('ib_edit_client_account', {
		p_account_id: client_account_id,
		p_client_name: trimmedName,
		p_client_email: normalizedEmail,
		p_client_phone: client_phone?.trim() || null,
		p_nickname: nickname?.trim() || null,
		p_actor_id: profile.id
	});

	if (rpcError) {
		return json({ message: rpcError.message }, { status: getDatabaseErrorStatus(rpcError.code) });
	}

	return json({ success: true, account: data });
};
