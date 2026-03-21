import { json } from '@sveltejs/kit';
import { getDatabaseErrorStatus } from '$lib/server/clientAccounts';
import { rateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'admin') {
		return json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
	}

	const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
	if (!rateLimit(`admin:delete:${ip}`, 10, 60_000)) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const { client_account_id, reason } = await request.json();

	if (!client_account_id) {
		return json({ message: 'กรุณาระบุ client_account_id' }, { status: 400 });
	}

	const { data, error: rpcError } = await locals.supabase.rpc('admin_delete_client_account', {
		p_account_id: client_account_id,
		p_reason: reason || null,
		p_actor_id: profile.id
	});

	if (rpcError) {
		return json({ message: rpcError.message }, { status: getDatabaseErrorStatus(rpcError.code) });
	}

	return json({ success: true, account: data });
};
