import { json } from '@sveltejs/kit';
import { getDatabaseErrorStatus } from '$lib/server/clientAccounts';
import { rateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'admin') {
		return json({ message: 'Forbidden' }, { status: 403 });
	}

	const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
	if (!rateLimit(`admin:edit:${ip}`, 30, 60_000)) {
		return json({ message: 'Too many requests' }, { status: 429 });
	}

	const body = await request.json();
	const { client_account_id, client_name, client_email, client_phone, nickname, mt5_account_id, mt5_server } = body;

	if (!client_account_id || !client_name || !mt5_account_id || !mt5_server) {
		return json({ message: 'Missing required fields' }, { status: 400 });
	}

	const { data, error: rpcError } = await locals.supabase.rpc('admin_edit_client_account', {
		p_account_id: client_account_id,
		p_client_name: client_name,
		p_client_email: client_email || null,
		p_client_phone: client_phone || null,
		p_nickname: nickname || null,
		p_mt5_account_id: mt5_account_id,
		p_mt5_server: mt5_server,
		p_actor_id: profile.id
	});

	if (rpcError) {
		return json({ message: rpcError.message }, { status: getDatabaseErrorStatus(rpcError.code) });
	}

	return json({ success: true, account: data });
};
