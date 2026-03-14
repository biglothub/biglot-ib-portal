import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (locals.profile?.role !== 'client') {
		throw redirect(303, '/');
	}

	const supabase = locals.supabase;

	// Fetch approved account (shared across all portfolio sub-routes)
	const { data: account } = await supabase
		.from('client_accounts')
		.select('id, client_name, mt5_account_id, mt5_server, status, last_synced_at')
		.eq('status', 'approved')
		.maybeSingle();

	// Fetch user's tags (lightweight, used in filters across routes)
	let tags: any[] = [];
	if (account && locals.profile) {
		const { data } = await supabase
			.from('trade_tags')
			.select('*')
			.eq('user_id', locals.profile.id)
			.order('category', { ascending: true });
		tags = data || [];
	}

	return {
		account,
		tags,
		userId: locals.profile?.id
	};
};
