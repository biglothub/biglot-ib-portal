import { redirect } from '@sveltejs/kit';
import { fetchPortfolioBaseData } from '$lib/server/portfolio';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (locals.profile?.role !== 'client') {
		throw redirect(303, '/');
	}

	const supabase = locals.supabase;

	const oneDayAgo = new Date();
	oneDayAgo.setDate(oneDayAgo.getDate() - 1);

	// Fetch approved account + market news in parallel
	const [accountRes, marketNewsRes] = await Promise.all([
		supabase
			.from('client_accounts')
			.select('id, client_name, mt5_account_id, mt5_server, status, last_synced_at')
			.eq('status', 'approved')
			.maybeSingle(),
		supabase
			.from('market_news')
			.select('*')
			.eq('ai_processed', true)
			.gte('published_at', oneDayAgo.toISOString())
			.order('relevance_score', { ascending: false })
			.order('published_at', { ascending: false })
			.limit(20)
	]);

	const account = accountRes.data;

	// Fetch user tags (lightweight, not part of baseData)
	let tags: any[] = [];
	if (account && locals.profile) {
		const { data } = await supabase
			.from('trade_tags')
			.select('*')
			.eq('user_id', locals.profile.id)
			.order('category', { ascending: true });
		tags = data || [];
	}

	// Fetch all portfolio base data once (shared across all sub-routes)
	let baseData = null;
	if (account && locals.profile) {
		baseData = await fetchPortfolioBaseData(supabase, account.id, locals.profile.id);
	}

	return {
		account,
		tags,
		baseData,
		playbooks: baseData?.playbooks ?? [],
		savedViews: baseData?.savedViews ?? [],
		userId: locals.profile?.id,
		marketNews: marketNewsRes.data || []
	};
};
