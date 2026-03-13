import { json, error } from '@sveltejs/kit';
import { encrypt } from '$lib/server/crypto';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || (profile.role !== 'master_ib' && profile.role !== 'admin')) {
		throw error(403, 'Forbidden');
	}

	const body = await request.json();
	const { client_name, client_email, client_phone, mt5_account_id, mt5_investor_password, mt5_server } = body;

	if (!client_name || !mt5_account_id || !mt5_investor_password || !mt5_server) {
		throw error(400, 'Missing required fields');
	}

	// --- Input validation ---
	if (client_name.length < 2 || client_name.length > 100) {
		throw error(400, 'ชื่อลูกค้าต้องมี 2-100 ตัวอักษร');
	}

	if (client_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client_email)) {
		throw error(400, 'รูปแบบอีเมลไม่ถูกต้อง');
	}

	if (!/^\d+$/.test(mt5_account_id)) {
		throw error(400, 'MT5 Account ID ต้องเป็นตัวเลขเท่านั้น');
	}

	if (mt5_investor_password.length < 4 || mt5_investor_password.length > 64) {
		throw error(400, 'Investor Password ต้องมี 4-64 ตัวอักษร');
	}

	if (mt5_server.length < 3 || mt5_server.length > 100) {
		throw error(400, 'ชื่อ MT5 Server ไม่ถูกต้อง');
	}

	// Get master_ib_id + max_clients
	const { data: ib } = await locals.supabase
		.from('master_ibs')
		.select('id, max_clients')
		.eq('user_id', profile.id)
		.single();

	if (!ib) throw error(404, 'IB profile not found');

	// Client quota enforcement
	const { count, error: countError } = await locals.supabase
		.from('client_accounts')
		.select('id', { count: 'exact', head: true })
		.eq('master_ib_id', ib.id)
		.not('status', 'eq', 'rejected');

	if (countError) throw error(500, countError.message);

	const maxClients = ib.max_clients ?? 100;
	if ((count ?? 0) >= maxClients) {
		throw error(400, `คุณมีลูกค้าเต็มโควต้าแล้ว (${maxClients} คน)`);
	}

	// Insert client account
	const { data: account, error: insertError } = await locals.supabase
		.from('client_accounts')
		.insert({
			master_ib_id: ib.id,
			client_name,
			client_email: client_email || null,
			client_phone: client_phone || null,
			mt5_account_id,
			mt5_investor_password: encrypt(mt5_investor_password),
			mt5_server,
			status: 'pending'
		})
		.select()
		.single();

	if (insertError) {
		if (insertError.code === '23505') {
			throw error(409, 'MT5 account นี้มีอยู่ในระบบแล้ว');
		}
		throw error(500, insertError.message);
	}

	// Log
	await locals.supabase.from('approval_log').insert({
		client_account_id: account.id,
		action: 'submitted',
		performed_by: profile.id
	});

	return json({ success: true, account });
};
