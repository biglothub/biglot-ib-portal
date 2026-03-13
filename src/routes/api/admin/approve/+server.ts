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
	if (!rateLimit(`admin:approve:${ip}`, 30, 60_000)) {
		return json({ message: 'Too many requests' }, { status: 429 });
	}

	const { client_account_id, action, reason } = await request.json();

	if (!client_account_id || !['approved', 'rejected', 'suspended', 'reactivated'].includes(action)) {
		return json({ message: 'Invalid request' }, { status: 400 });
	}

	const { data, error: rpcError } = await locals.supabase.rpc('admin_transition_client_account', {
		p_account_id: client_account_id,
		p_action: action,
		p_reason: reason || null,
		p_actor_id: profile.id
	});

	if (rpcError) {
		return json({ message: rpcError.message }, { status: getDatabaseErrorStatus(rpcError.code) });
	}

	return json({ success: true, account: data });
};
