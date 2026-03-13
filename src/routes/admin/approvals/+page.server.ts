import { createSupabaseServiceClient } from '$lib/server/supabase';
import { CLIENT_ACCOUNT_PUBLIC_COLUMNS } from '$lib/server/clientAccounts';
import type { ClientAccount, Profile } from '$lib/types';
import type { PageServerLoad } from './$types';

type ApprovalAccount = ClientAccount & {
	master_ibs?: {
		ib_code: string | null;
		company_name: string | null;
		profiles?: Pick<Profile, 'full_name' | 'email'> | null;
	} | null;
};

export const load: PageServerLoad = async ({ url }) => {
	const status = url.searchParams.get('status') || 'pending';
	const supabase = createSupabaseServiceClient();

	let query = supabase
		.from('client_accounts')
		.select(`
			${CLIENT_ACCOUNT_PUBLIC_COLUMNS},
			master_ibs(
				ib_code, company_name,
				profiles:user_id(full_name, email)
			)
		`)
		.order('submitted_at', { ascending: false });

	if (status !== 'all') {
		query = query.eq('status', status);
	}

	const { data } = await query;
	const accounts = (data || []) as unknown as ApprovalAccount[];

	return {
		accounts,
		statusFilter: status
	};
};
