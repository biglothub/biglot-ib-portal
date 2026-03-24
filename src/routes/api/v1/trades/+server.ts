import { json } from '@sveltejs/kit';
import { verifyApiKey, hasScope } from '$lib/server/apiKeys';
import { rateLimit } from '$lib/server/rate-limit';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
	// Extract API key from Authorization header
	const authHeader = request.headers.get('authorization');
	const key = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
	if (!key) {
		return json({ error: 'Invalid API key' }, { status: 401 });
	}

	const auth = await verifyApiKey(key);
	if (!auth) {
		return json({ error: 'Invalid API key' }, { status: 401 });
	}

	if (!hasScope(auth.scopes, 'trades:read')) {
		return json({ error: 'Insufficient scope' }, { status: 403 });
	}

	// Rate limit: 60 req/min per user
	if (!(await rateLimit(`api:v1:trades:${auth.userId}`, 60, 60_000))) {
		return json({ error: 'Rate limit exceeded. Max 60 requests per minute.' }, { status: 429 });
	}

	// Parse query params
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
	const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
	const symbol = url.searchParams.get('symbol');
	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');

	const supabase = createSupabaseServiceClient();

	// Get user's approved account
	const { data: account } = await supabase
		.from('client_accounts')
		.select('id')
		.eq('user_id', auth.userId)
		.eq('status', 'approved')
		.limit(1)
		.maybeSingle();

	if (!account) {
		return json({ data: [], total: 0, page, limit });
	}

	// Build query
	let query = supabase
		.from('trades')
		.select(
			'id, symbol, type, lot_size, open_price, close_price, open_time, close_time, profit, pips, commission, swap, sl, tp, position_id, created_at',
			{ count: 'exact' }
		)
		.eq('client_account_id', account.id)
		.order('close_time', { ascending: false });

	if (symbol) {
		query = query.eq('symbol', symbol.toUpperCase());
	}
	if (from) {
		query = query.gte('close_time', from);
	}
	if (to) {
		query = query.lte('close_time', to + 'T23:59:59');
	}

	// Pagination
	const offset = (page - 1) * limit;
	query = query.range(offset, offset + limit - 1);

	const { data: trades, count, error } = await query;

	if (error) {
		return json({ error: 'Failed to fetch trades' }, { status: 500 });
	}

	return json({
		data: trades ?? [],
		total: count ?? 0,
		page,
		limit
	});
};
