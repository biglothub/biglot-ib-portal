import { createSupabaseServiceClient } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const supabase = createSupabaseServiceClient();

	const [pendingRes, ibCountRes, clientCountRes, recentRes] = await Promise.all([
		supabase.from('client_accounts').select('id', { count: 'exact' }).eq('status', 'pending'),
		supabase.from('master_ibs').select('id', { count: 'exact' }).eq('is_active', true),
		supabase.from('client_accounts').select('id', { count: 'exact' }).eq('status', 'approved'),
		supabase.from('approval_log')
			.select('*, client_accounts(client_name), profiles!performed_by(full_name)')
			.order('created_at', { ascending: false })
			.limit(10)
	]);

	// Get latest balance per approved account for AUM
	const { data: latestStats } = await supabase
		.from('daily_stats')
		.select('client_account_id, balance')
		.order('date', { ascending: false });

	const balanceMap = new Map<string, number>();
	for (const stat of (latestStats || [])) {
		if (!balanceMap.has(stat.client_account_id)) {
			balanceMap.set(stat.client_account_id, stat.balance);
		}
	}
	const totalAUM = [...balanceMap.values()].reduce((sum, b) => sum + (b || 0), 0);

	return {
		kpis: {
			pendingCount: pendingRes.count || 0,
			totalIBs: ibCountRes.count || 0,
			totalClients: clientCountRes.count || 0,
			totalAUM
		},
		recentActivity: recentRes.data || []
	};
};
