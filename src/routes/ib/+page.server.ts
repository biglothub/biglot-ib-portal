import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const supabase = locals.supabase;
	const profile = locals.profile!;

	// IB: explicit filter by master_ib_id (defense-in-depth alongside RLS)
	// Admin: no filter needed (ca_admin_all RLS policy grants full access)
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
		.select('id, client_name, nickname, status, mt5_account_id, last_synced_at, sync_error')
		.order('created_at', { ascending: false });
	if (ibFilter) query = query.eq('master_ib_id', ibFilter);

	const { data: clients } = await query;

	const approvedClients = (clients || []).filter(c => c.status === 'approved');
	const clientIds = approvedClients.map(c => c.id);

	let statsMap: Record<string, { client_account_id: string; date: string; balance: number; equity: number; profit: number; win_rate: number; total_trades: number; max_drawdown: number }> = {};
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

	const totalBalance = Object.values(statsMap).reduce((sum: number, s: { balance?: number; profit?: number }) => sum + (s.balance || 0), 0);
	const totalProfit = Object.values(statsMap).reduce((sum: number, s: { balance?: number; profit?: number }) => sum + (s.profit || 0), 0);

	return {
		clients: clients || [],
		statsMap,
		kpis: {
			totalClients: approvedClients.length,
			pendingClients: (clients || []).filter(c => c.status === 'pending').length,
			totalBalance,
			totalProfit
		}
	};
};
