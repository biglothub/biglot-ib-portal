import { createSupabaseServiceClient } from '$lib/server/supabase';
import { CLIENT_ACCOUNT_PUBLIC_COLUMNS } from '$lib/server/clientAccounts';
import { error } from '@sveltejs/kit';
import type { ClientAccount } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const supabase = createSupabaseServiceClient();

	const { data: ib } = await supabase
		.from('master_ibs')
		.select('*, profiles:user_id(full_name, email, phone)')
		.eq('id', params.id)
		.single();

	if (!ib) throw error(404, 'IB not found');

	const { data: clientData } = await supabase
		.from('client_accounts')
		.select(CLIENT_ACCOUNT_PUBLIC_COLUMNS)
		.eq('master_ib_id', params.id)
		.order('created_at', { ascending: false });

	const clients = (clientData || []) as unknown as ClientAccount[];

	return { ib, clients };
};
