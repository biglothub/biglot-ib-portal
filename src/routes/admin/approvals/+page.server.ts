import { createSupabaseServiceClient } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const status = url.searchParams.get('status') || 'pending';
	const supabase = createSupabaseServiceClient();

	let query = supabase
		.from('client_accounts')
		.select(`
			*,
			master_ibs(
				ib_code, company_name,
				profiles:user_id(full_name, email)
			)
		`)
		.order('submitted_at', { ascending: false });

	if (status !== 'all') {
		query = query.eq('status', status);
	}

	const { data: accounts } = await query;

	return {
		accounts: accounts || [],
		statusFilter: status
	};
};
