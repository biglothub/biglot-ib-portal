import { redirect } from '@sveltejs/kit';
import { fetchPortfolioBaseData } from '$lib/server/portfolio';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	if (locals.profile?.role !== 'client') {
		throw redirect(303, '/');
	}

	// Register custom dependency keys for targeted invalidation
	depends('portfolio:baseData');
	depends('portfolio:marketNews');

	const supabase = locals.supabase;

	// Phase 1: Get account first (needed by tags + baseData)
	const { data: account } = await supabase
		.from('client_accounts')
		.select('id, client_name, mt5_account_id, mt5_server, status, last_synced_at')
		.eq('status', 'approved')
		.maybeSingle();

	if (!account || !locals.profile) {
		return {
			account,
			tags: [],
			baseData: null,
			playbooks: [],
			savedViews: [],
			userId: locals.profile?.id,
			marketNews: []
		};
	}

	const oneDayAgo = new Date();
	oneDayAgo.setDate(oneDayAgo.getDate() - 1);

	// Stream market news separately — don't block critical data
	const marketNewsPromise = supabase
		.from('market_news')
		.select('*')
		.eq('ai_processed', true)
		.gte('published_at', oneDayAgo.toISOString())
		.order('relevance_score', { ascending: false })
		.order('published_at', { ascending: false })
		.limit(20)
		.then((res) => res.data || []);

	// Critical data loads in parallel (not blocked by news)
	const [tagsRes, baseData] = await Promise.all([
		supabase
			.from('trade_tags')
			.select('*')
			.eq('user_id', locals.profile.id)
			.order('category', { ascending: true }),
		fetchPortfolioBaseData(supabase, account.id, locals.profile.id)
	]);

	return {
		account,
		tags: tagsRes.data || [],
		baseData,
		playbooks: baseData?.playbooks ?? [],
		savedViews: baseData?.savedViews ?? [],
		userId: locals.profile.id,
		marketNews: marketNewsPromise
	};
};
