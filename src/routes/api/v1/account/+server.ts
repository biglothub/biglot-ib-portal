import { json } from '@sveltejs/kit';
import { verifyApiKey } from '$lib/server/apiKeys';
import { rateLimit } from '$lib/server/rate-limit';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const authHeader = request.headers.get('authorization');
	const key = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
	if (!key) {
		return json({ error: 'Invalid API key' }, { status: 401 });
	}

	const auth = await verifyApiKey(key);
	if (!auth) {
		return json({ error: 'Invalid API key' }, { status: 401 });
	}

	if (!(await rateLimit(`api:v1:account:${auth.userId}`, 60, 60_000))) {
		return json({ error: 'Rate limit exceeded. Max 60 requests per minute.' }, { status: 429 });
	}

	const supabase = createSupabaseServiceClient();

	const { data: account, error } = await supabase
		.from('client_accounts')
		.select('mt5_account_id, mt5_server, created_at, master_ibs(company_name)')
		.eq('user_id', auth.userId)
		.eq('status', 'approved')
		.limit(1)
		.maybeSingle();

	if (error || !account) {
		return json({ error: 'No approved account found' }, { status: 404 });
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const ibs = (account as any).master_ibs;
	const broker = Array.isArray(ibs) ? ibs[0]?.company_name ?? null : ibs?.company_name ?? null;

	return json({
		accountId: account.mt5_account_id,
		broker,
		server: account.mt5_server,
		createdAt: account.created_at
	});
};
