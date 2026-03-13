import { createSupabaseServiceClient } from '$lib/server/supabase';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const supabase = createSupabaseServiceClient();
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const [accountRes, statsRes, positionsRes, tradesRes] = await Promise.allSettled([
		supabase.from('client_accounts')
			.select('*, master_ibs(ib_code, profiles:user_id(full_name))')
			.eq('id', params.id)
			.single(),

		supabase.from('daily_stats')
			.select('*')
			.eq('client_account_id', params.id)
			.order('date', { ascending: false })
			.limit(1)
			.single(),

		supabase.from('open_positions')
			.select('*')
			.eq('client_account_id', params.id)
			.order('open_time', { ascending: false }),

		supabase.from('trades')
			.select('*')
			.eq('client_account_id', params.id)
			.order('close_time', { ascending: false })
			.limit(50)
	]);

	const getValue = (res: PromiseSettledResult<any>) =>
		res.status === 'fulfilled' ? res.value.data : null;

	const account = getValue(accountRes);
	if (!account) throw error(404, 'Account not found');

	return {
		account,
		latestStats: getValue(statsRes),
		openPositions: getValue(positionsRes) || [],
		recentTrades: getValue(tradesRes) || []
	};
};
