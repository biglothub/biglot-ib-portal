import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const supabase = locals.supabase;
	const profile = locals.profile!;

	let ibFilter: string | null = null;
	if (profile.role === 'master_ib') {
		const { data: ib } = await supabase
			.from('master_ibs')
			.select('id')
			.eq('user_id', profile.id)
			.single();
		if (!ib) throw error(403, 'IB profile not found');
		ibFilter = ib.id;
	}

	let query = supabase
		.from('client_accounts')
		.select('id, client_name, nickname, status, mt5_account_id, last_synced_at, sync_error, rejection_reason')
		.order('created_at', { ascending: false });
	if (ibFilter) query = query.eq('master_ib_id', ibFilter);

	const { data: clients } = await query;

	const approvedClients = (clients || []).filter(c => c.status === 'approved');
	const clientIds = approvedClients.map(c => c.id);

	let statsMap: Record<string, any> = {};
	if (clientIds.length > 0) {
		const { data: stats } = await supabase
			.from('daily_stats')
			.select('client_account_id, date, balance, equity, profit, win_rate, total_trades, max_drawdown')
			.in('client_account_id', clientIds)
			.order('date', { ascending: false });

		const seen = new Set<string>();
		for (const stat of (stats || [])) {
			if (!seen.has(stat.client_account_id)) {
				seen.add(stat.client_account_id);
				statsMap[stat.client_account_id] = stat;
			}
		}
	}

	return {
		clients: clients || [],
		statsMap
	};
};
