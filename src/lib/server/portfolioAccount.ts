import type { SupabaseClient } from '@supabase/supabase-js';

export async function getApprovedPortfolioAccount(supabase: SupabaseClient) {
	const { data: account } = await supabase
		.from('client_accounts')
		.select('id, client_name, mt5_account_id, mt5_server, status, last_synced_at')
		.eq('status', 'approved')
		.maybeSingle();

	return account;
}
