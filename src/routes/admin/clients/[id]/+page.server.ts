import { createSupabaseServiceClient } from '$lib/server/supabase';
import { CLIENT_ACCOUNT_PUBLIC_COLUMNS } from '$lib/server/clientAccounts';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const supabase = createSupabaseServiceClient();

	const [accountRes, statsRes, positionsRes, tradesRes] = await Promise.allSettled([
		supabase.from('client_accounts')
			.select(`${CLIENT_ACCOUNT_PUBLIC_COLUMNS}, master_ibs(ib_code, profiles:user_id(full_name))`)
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

	const getValue = (res: PromiseSettledResult<{ data: unknown; error: unknown }>) => {
		if (res.status !== 'fulfilled') return null;
		if (res.value.error) {
			console.error('[admin/clients] query error:', res.value.error);
			return null;
		}
		return res.value.data;
	};

	const account = getValue(accountRes);
	if (!account) throw error(404, 'Account not found');

	console.log('[admin/clients] tradesRes status:', tradesRes.status);
	if (tradesRes.status === 'fulfilled') {
		console.log('[admin/clients] trades error:', tradesRes.value.error);
		console.log('[admin/clients] trades count:', Array.isArray(tradesRes.value.data) ? tradesRes.value.data.length : tradesRes.value.data);
	}

	return {
		account,
		latestStats: getValue(statsRes),
		openPositions: getValue(positionsRes) || [],
		recentTrades: getValue(tradesRes) || []
	};
};
