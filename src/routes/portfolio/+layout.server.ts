import { redirect } from '@sveltejs/kit';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import { fetchPortfolioBaseData } from '$lib/server/portfolio';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends, url }) => {
	const isAdminView = !!locals.viewAsAccountId;

	// Only clients and admin-viewing-as can access portfolio routes
	if (!isAdminView && locals.profile?.role !== 'client') {
		throw redirect(303, '/');
	}

	// Register custom dependency keys for targeted invalidation
	depends('portfolio:baseData');
	depends('portfolio:marketNews');

	// For admin view, use service client (bypasses RLS) and target the client's account
	const supabase = isAdminView ? createSupabaseServiceClient() : locals.supabase;
	const effectiveUserId = isAdminView ? locals.viewAsUserId! : locals.profile!.id;

	let account: any;

	if (isAdminView) {
		// Admin viewing: load specific account by ID
		const { data } = await supabase
			.from('client_accounts')
			.select('id, client_name, mt5_account_id, mt5_server, status, last_synced_at')
			.eq('id', locals.viewAsAccountId!)
			.single();
		account = data;
	} else {
		// Client viewing own account
		const { data } = await supabase
			.from('client_accounts')
			.select('id, client_name, mt5_account_id, mt5_server, status, last_synced_at')
			.eq('status', 'approved')
			.maybeSingle();
		account = data;
	}

	if (!account || !locals.profile) {
		return {
			account,
			tags: [],
			baseData: null,
			playbooks: [],
			savedViews: [],
			userId: locals.profile?.id,
			marketNews: [],
			isAdminView: false,
			viewAsAccountId: null
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
			.eq('user_id', effectiveUserId)
			.order('category', { ascending: true }),
		fetchPortfolioBaseData(supabase, account.id, effectiveUserId)
	]);

	return {
		account,
		tags: tagsRes.data || [],
		baseData,
		playbooks: baseData?.playbooks ?? [],
		savedViews: baseData?.savedViews ?? [],
		userId: effectiveUserId,
		marketNews: marketNewsPromise,
		isAdminView,
		viewAsAccountId: isAdminView ? locals.viewAsAccountId : null
	};
};
