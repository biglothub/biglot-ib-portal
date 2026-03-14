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

	// Fetch user's tags and playbooks (lightweight, used across routes)
	let tags: any[] = [];
	let playbooks: any[] = [];
	let savedViews: any[] = [];
	if (account && locals.profile) {
		const [tagsRes, playbooksRes, savedViewsRes] = await Promise.allSettled([
			supabase
				.from('trade_tags')
				.select('*')
				.eq('user_id', locals.profile.id)
				.order('category', { ascending: true }),
			supabase
				.from('playbooks')
				.select('*')
				.eq('user_id', locals.profile.id)
				.eq('client_account_id', account.id)
				.order('sort_order', { ascending: true })
				.order('created_at', { ascending: true }),
			supabase
				.from('portfolio_saved_views')
				.select('*')
				.eq('user_id', locals.profile.id)
				.eq('client_account_id', account.id)
				.order('page', { ascending: true })
				.order('name', { ascending: true })
		]);

		tags = tagsRes.status === 'fulfilled' ? tagsRes.value.data || [] : [];
		playbooks = playbooksRes.status === 'fulfilled' ? playbooksRes.value.data || [] : [];
		savedViews = savedViewsRes.status === 'fulfilled' ? savedViewsRes.value.data || [] : [];
	}

	return {
		account,
		tags,
		playbooks,
		savedViews,
		userId: locals.profile?.id
	};
};
