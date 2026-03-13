import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const supabase = locals.supabase;

	const { data: clients } = await supabase
		.from('client_accounts')
		.select('id, client_name, nickname, status, mt5_account_id, last_synced_at, sync_error')
		.order('created_at', { ascending: false });

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

	const totalBalance = Object.values(statsMap).reduce((sum: number, s: any) => sum + (s.balance || 0), 0);
	const totalProfit = Object.values(statsMap).reduce((sum: number, s: any) => sum + (s.profit || 0), 0);

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
