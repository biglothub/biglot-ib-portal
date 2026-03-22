import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const supabase = locals.supabase;
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const [accountRes, statsRes, historyRes, equityRes, positionsRes, tradesRes] = await Promise.allSettled([
		supabase.from('client_accounts')
			.select('id, client_name, client_email, client_phone, nickname, mt5_account_id, mt5_server, status, last_synced_at, rejection_reason, mt5_validation_error, sync_error')
			.eq('id', params.id)
			.single(),

		supabase.from('daily_stats')
			.select('*')
			.eq('client_account_id', params.id)
			.order('date', { ascending: false })
			.limit(1)
			.single(),

		supabase.from('daily_stats')
			.select('date, balance, equity, profit, win_rate, total_trades, max_drawdown, profit_factor')
			.eq('client_account_id', params.id)
			.gte('date', thirtyDaysAgo.toISOString().split('T')[0])
			.order('date', { ascending: true }),

		supabase.from('equity_snapshots')
			.select('timestamp, balance, equity, floating_pl')
			.eq('client_account_id', params.id)
			.gte('timestamp', thirtyDaysAgo.toISOString())
			.order('timestamp', { ascending: true }),

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

	const getValue = (res: PromiseSettledResult<{ data: unknown; error: unknown }>) =>
		res.status === 'fulfilled' ? res.value.data : null;

	const account = getValue(accountRes);
	if (!account) throw error(404, 'Account not found');

	return {
		account,
		latestStats: getValue(statsRes),
		history: getValue(historyRes) || [],
		equityData: getValue(equityRes) || [],
		openPositions: getValue(positionsRes) || [],
		recentTrades: getValue(tradesRes) || []
	};
};
