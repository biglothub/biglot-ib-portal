import { json, error } from '@sveltejs/kit';
import { encrypt } from '$lib/server/crypto';
import { rateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || (profile.role !== 'master_ib' && profile.role !== 'admin')) {
		throw error(403, 'Forbidden');
	}

	const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
	if (!rateLimit(`ib:resubmit:${ip}`, 5, 60_000)) {
		throw error(429, 'Too many requests โปรดรอสักครู่แล้วลองใหม่');
	}

	const body = await request.json();
	const { client_account_id, mt5_account_id, mt5_investor_password, mt5_server } = body;

	if (!client_account_id || !mt5_account_id || !mt5_investor_password || !mt5_server) {
		throw error(400, 'Missing required fields');
	}

	// Validate inputs
	if (!/^\d+$/.test(mt5_account_id)) {
		throw error(400, 'MT5 Account ID ต้องเป็นตัวเลขเท่านั้น');
	}

	if (mt5_investor_password.length < 4 || mt5_investor_password.length > 64) {
		throw error(400, 'Investor Password ต้องมี 4-64 ตัวอักษร');
	}

	if (mt5_server.length < 3 || mt5_server.length > 100) {
		throw error(400, 'ชื่อ MT5 Server ไม่ถูกต้อง');
	}

	// Fetch account (RLS ensures IB can only see their own)
	const { data: account } = await locals.supabase
		.from('client_accounts')
		.select('id, status')
		.eq('id', client_account_id)
		.single();

	if (!account) throw error(404, 'Account not found');
	if (account.status !== 'rejected') {
		throw error(400, 'เฉพาะบัญชีที่ถูกปฏิเสธเท่านั้นที่สามารถส่งใหม่ได้');
	}

	// Update account
	const { error: updateError } = await locals.supabase
		.from('client_accounts')
		.update({
			mt5_account_id,
			mt5_investor_password: encrypt(mt5_investor_password),
			mt5_server,
			status: 'pending',
			mt5_validated: false,
			mt5_validation_error: null,
			rejection_reason: null,
			reviewed_at: null,
			reviewed_by: null,
			sync_error: null
		})
		.eq('id', client_account_id);

	if (updateError) {
		if (updateError.code === '23505') {
			throw error(409, 'MT5 account นี้มีอยู่ในระบบแล้ว');
		}
		throw error(500, updateError.message);
	}

	// Log
	await locals.supabase.from('approval_log').insert({
		client_account_id,
		action: 'resubmitted',
		performed_by: profile.id,
		previous_status: 'rejected',
		new_status: 'pending'
	});

	return json({ success: true });
};
