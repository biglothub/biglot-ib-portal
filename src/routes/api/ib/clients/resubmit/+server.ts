import { json } from '@sveltejs/kit';
import { encrypt } from '$lib/server/crypto';
import { getDatabaseErrorStatus } from '$lib/server/clientAccounts';
import { rateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || (profile.role !== 'master_ib' && profile.role !== 'admin')) {
		return json({ message: 'Forbidden' }, { status: 403 });
	}

	const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
	if (!rateLimit(`ib:resubmit:${ip}`, 5, 60_000)) {
		return json({ message: 'Too many requests โปรดรอสักครู่แล้วลองใหม่' }, { status: 429 });
	}

	const body = await request.json();
	const { client_account_id, mt5_account_id, mt5_investor_password, mt5_server } = body;

	if (!client_account_id || !mt5_account_id || !mt5_investor_password || !mt5_server) {
		return json({ message: 'Missing required fields' }, { status: 400 });
	}

	// Validate inputs
	if (!/^\d+$/.test(mt5_account_id)) {
		return json({ message: 'MT5 Account ID ต้องเป็นตัวเลขเท่านั้น' }, { status: 400 });
	}

	if (mt5_investor_password.length < 4 || mt5_investor_password.length > 64) {
		return json({ message: 'Investor Password ต้องมี 4-64 ตัวอักษร' }, { status: 400 });
	}

	const normalizedServer = mt5_server.trim();
	if (normalizedServer.length < 3 || normalizedServer.length > 100) {
		return json({ message: 'ชื่อ MT5 Server ไม่ถูกต้อง' }, { status: 400 });
	}

	const { data, error: rpcError } = await locals.supabase.rpc('ib_resubmit_client_account', {
		p_account_id: client_account_id,
		p_mt5_account_id: mt5_account_id,
		p_mt5_password_encrypted: encrypt(mt5_investor_password),
		p_mt5_server: normalizedServer,
		p_actor_id: profile.id
	});

	if (rpcError) {
		return json({ message: rpcError.message }, { status: getDatabaseErrorStatus(rpcError.code) });
	}

	return json({ success: true, account: data });
};
