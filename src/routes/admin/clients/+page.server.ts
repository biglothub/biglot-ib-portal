import { createSupabaseServiceClient } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const supabase = createSupabaseServiceClient();
	const search = url.searchParams.get('q') || '';
	const statusFilter = url.searchParams.get('status') || 'approved';

	let query = supabase
		.from('client_accounts')
		.select('*, master_ibs(ib_code, profiles:user_id(full_name))')
		.order('created_at', { ascending: false });

	if (statusFilter !== 'all') {
		query = query.eq('status', statusFilter);
	}

	const { data: accounts } = await query;

	const filtered = (accounts || []).filter(a => {
		if (!search) return true;
		const q = search.toLowerCase();
		return (
			a.client_name?.toLowerCase().includes(q) ||
			a.client_email?.toLowerCase().includes(q) ||
			a.mt5_account_id?.toString().includes(q) ||
			(a.master_ibs as { ib_code?: string } | null)?.ib_code?.toLowerCase().includes(q)
		);
	});

	return { accounts: filtered, search, statusFilter };
};
