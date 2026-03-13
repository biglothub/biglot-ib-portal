import { json } from '@sveltejs/kit';
import { encrypt } from '$lib/server/crypto';
import {
	CLIENT_ACCOUNT_PUBLIC_COLUMNS,
	normalizeEmail
} from '$lib/server/clientAccounts';
import { rateLimit } from '$lib/server/rate-limit';
import type { ClientAccount } from '$lib/types';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || (profile.role !== 'master_ib' && profile.role !== 'admin')) {
		return json({ message: 'Forbidden' }, { status: 403 });
	}

	const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
	if (!rateLimit(`ib:clients:${ip}`, 10, 60_000)) {
		return json({ message: 'Too many requests โปรดรอสักครู่แล้วลองใหม่' }, { status: 429 });
	}

	const body = await request.json();
	const { client_name, client_email, client_phone, mt5_account_id, mt5_investor_password, mt5_server } = body;

	if (!client_name || !mt5_account_id || !mt5_investor_password || !mt5_server) {
		return json({ message: 'Missing required fields' }, { status: 400 });
	}

	const normalizedClientName = client_name.trim();
	const normalizedClientEmail = normalizeEmail(client_email);
	const normalizedClientPhone = client_phone?.trim() || null;
	const normalizedServer = mt5_server.trim();

	// --- Input validation ---
	if (normalizedClientName.length < 2 || normalizedClientName.length > 100) {
		return json({ message: 'ชื่อลูกค้าต้องมี 2-100 ตัวอักษร' }, { status: 400 });
	}

	if (normalizedClientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedClientEmail)) {
		return json({ message: 'รูปแบบอีเมลไม่ถูกต้อง' }, { status: 400 });
	}

	if (!/^\d+$/.test(mt5_account_id)) {
		return json({ message: 'MT5 Account ID ต้องเป็นตัวเลขเท่านั้น' }, { status: 400 });
	}

	if (mt5_investor_password.length < 4 || mt5_investor_password.length > 64) {
		return json({ message: 'Investor Password ต้องมี 4-64 ตัวอักษร' }, { status: 400 });
	}

	if (normalizedServer.length < 3 || normalizedServer.length > 100) {
		return json({ message: 'ชื่อ MT5 Server ไม่ถูกต้อง' }, { status: 400 });
	}

	// Get master_ib_id + max_clients
	const { data: ib } = await locals.supabase
		.from('master_ibs')
		.select('id, max_clients')
		.eq('user_id', profile.id)
		.single();

	if (!ib) {
		return json({ message: 'IB profile not found' }, { status: 404 });
	}

	// Client quota enforcement
	const { count, error: countError } = await locals.supabase
		.from('client_accounts')
		.select('id', { count: 'exact', head: true })
		.eq('master_ib_id', ib.id)
		.not('status', 'eq', 'rejected');

	if (countError) {
		return json({ message: countError.message }, { status: 500 });
	}

	const maxClients = ib.max_clients ?? 100;
	if ((count ?? 0) >= maxClients) {
		return json({ message: `คุณมีลูกค้าเต็มโควต้าแล้ว (${maxClients} คน)` }, { status: 400 });
	}

	// Insert client account
	const { data: insertedAccount, error: insertError } = await locals.supabase
		.from('client_accounts')
		.insert({
			master_ib_id: ib.id,
			client_name: normalizedClientName,
			client_email: normalizedClientEmail,
			client_phone: normalizedClientPhone,
			mt5_account_id,
			mt5_investor_password: encrypt(mt5_investor_password),
			mt5_server: normalizedServer,
			status: 'pending'
		})
		.select(CLIENT_ACCOUNT_PUBLIC_COLUMNS)
		.single();

	if (insertError) {
		if (insertError.code === '23505') {
			return json({ message: 'MT5 account นี้มีอยู่ในระบบแล้ว' }, { status: 409 });
		}
		return json({ message: insertError.message }, { status: 500 });
	}

	const account = insertedAccount as unknown as ClientAccount;

	// Log
	const { error: logError } = await locals.supabase.from('approval_log').insert({
		client_account_id: account.id,
		action: 'submitted',
		performed_by: profile.id
	});

	if (logError) {
		return json({ message: logError.message }, { status: 500 });
	}

	return json({ success: true, account });
};
