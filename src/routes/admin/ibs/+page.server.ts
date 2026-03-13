import { createSupabaseServiceClient } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const supabase = createSupabaseServiceClient();

	const { data: ibs } = await supabase
		.from('master_ibs')
		.select(`
			*,
			profiles:user_id(full_name, email, phone, is_active),
			client_accounts(id, status)
		`)
		.order('created_at', { ascending: false });

	const ibList = (ibs || []).map(ib => ({
		...ib,
		approvedCount: ib.client_accounts?.filter((c: any) => c.status === 'approved').length || 0,
		pendingCount: ib.client_accounts?.filter((c: any) => c.status === 'pending').length || 0,
		totalCount: ib.client_accounts?.length || 0
	}));

	return { ibs: ibList };
};
