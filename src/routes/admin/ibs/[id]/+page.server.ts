import { createSupabaseServiceClient } from '$lib/server/supabase';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const supabase = createSupabaseServiceClient();

	const { data: ib } = await supabase
		.from('master_ibs')
		.select('*, profiles:user_id(full_name, email, phone)')
		.eq('id', params.id)
		.single();

	if (!ib) throw error(404, 'IB not found');

	const { data: clients } = await supabase
		.from('client_accounts')
		.select('*')
		.eq('master_ib_id', params.id)
		.order('created_at', { ascending: false });

	return { ib, clients: clients || [] };
};
