import { json } from '@sveltejs/kit';
import { verifyApiKey, hasScope } from '$lib/server/apiKeys';
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

	if (!hasScope(auth.scopes, 'stats:read')) {
		return json({ error: 'Insufficient scope' }, { status: 403 });
	}

	if (!(await rateLimit(`api:v1:stats:${auth.userId}`, 60, 60_000))) {
		return json({ error: 'Rate limit exceeded. Max 60 requests per minute.' }, { status: 429 });
	}

	const supabase = createSupabaseServiceClient();

	const { data: account } = await supabase
		.from('client_accounts')
		.select('id')
		.eq('user_id', auth.userId)
		.eq('status', 'approved')
		.limit(1)
		.maybeSingle();

	if (!account) {
		return json({
			winRate: 0,
			netPnl: 0,
			totalTrades: 0,
			avgWin: 0,
			avgLoss: 0,
			bestDay: 0,
			worstDay: 0
		});
	}

	// Fetch trades to compute stats
	const { data: trades, error } = await supabase
		.from('trades')
		.select('profit, close_time')
		.eq('client_account_id', account.id);

	if (error) {
		return json({ error: 'Failed to fetch stats' }, { status: 500 });
	}

	const allTrades = trades ?? [];
	const totalTrades = allTrades.length;

	if (totalTrades === 0) {
		return json({
			winRate: 0,
			netPnl: 0,
			totalTrades: 0,
			avgWin: 0,
			avgLoss: 0,
			bestDay: 0,
			worstDay: 0
		});
	}

	const wins = allTrades.filter((t) => t.profit > 0);
	const losses = allTrades.filter((t) => t.profit < 0);
	const winRate = totalTrades > 0 ? Math.round((wins.length / totalTrades) * 10000) / 100 : 0;
	const netPnl = Math.round(allTrades.reduce((s, t) => s + t.profit, 0) * 100) / 100;
	const avgWin =
		wins.length > 0
			? Math.round((wins.reduce((s, t) => s + t.profit, 0) / wins.length) * 100) / 100
			: 0;
	const avgLoss =
		losses.length > 0
			? Math.round((losses.reduce((s, t) => s + t.profit, 0) / losses.length) * 100) / 100
			: 0;

	// Aggregate by day for best/worst day
	const dayMap = new Map<string, number>();
	for (const t of allTrades) {
		const day = t.close_time.slice(0, 10);
		dayMap.set(day, (dayMap.get(day) ?? 0) + t.profit);
	}
	const dayPnls = Array.from(dayMap.values());
	const bestDay = Math.round(Math.max(...dayPnls) * 100) / 100;
	const worstDay = Math.round(Math.min(...dayPnls) * 100) / 100;

	return json({
		winRate,
		netPnl,
		totalTrades,
		avgWin,
		avgLoss,
		bestDay,
		worstDay
	});
};
