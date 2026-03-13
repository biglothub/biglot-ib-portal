import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const supabase = locals.supabase;
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	// Client sees only their own account(s) via RLS
	const { data: accounts } = await supabase
		.from('client_accounts')
		.select('id, client_name, mt5_account_id, mt5_server, status, last_synced_at')
		.eq('status', 'approved');

	const account = accounts?.[0];
	if (!account) {
		return { account: null, latestStats: null, openPositions: [], recentTrades: [] };
	}

	const [statsRes, positionsRes, tradesRes] = await Promise.allSettled([
		supabase.from('daily_stats')
			.select('*')
			.eq('client_account_id', account.id)
			.order('date', { ascending: false })
			.limit(1)
			.single(),

		supabase.from('open_positions')
			.select('*')
			.eq('client_account_id', account.id)
			.order('open_time', { ascending: false }),

		supabase.from('trades')
			.select('*')
			.eq('client_account_id', account.id)
			.order('close_time', { ascending: false })
			.limit(50)
	]);

	const getValue = (res: PromiseSettledResult<any>) =>
		res.status === 'fulfilled' ? res.value.data : null;

	return {
		account,
		latestStats: getValue(statsRes),
		openPositions: getValue(positionsRes) || [],
		recentTrades: getValue(tradesRes) || []
	};
};
