import { redirect } from '@sveltejs/kit';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import { fetchPortfolioBaseData } from '$lib/server/portfolio';
import type { ClientAccount } from '$lib/types';
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

	// Guard: ensure required context exists before proceeding
	if (isAdminView && !locals.viewAsUserId) {
		throw redirect(303, '/admin/clients');
	}
	if (!isAdminView && !locals.profile) {
		throw redirect(303, '/auth/login');
	}

	// For admin view, use service client (bypasses RLS) and target the client's account
	const supabase = isAdminView ? createSupabaseServiceClient() : locals.supabase;
	const effectiveUserId = isAdminView ? locals.viewAsUserId! : locals.profile!.id;

	type AccountRow = Pick<ClientAccount, 'id' | 'client_name' | 'mt5_account_id' | 'mt5_server' | 'status' | 'last_synced_at'>;
	let account: AccountRow | null = null;
	let allAccounts: AccountRow[] = [];

	if (isAdminView) {
		// Admin viewing: load specific account by ID
		const { data } = await supabase
			.from('client_accounts')
			.select('id, client_name, mt5_account_id, mt5_server, status, last_synced_at')
			.eq('id', locals.viewAsAccountId!)
			.single();
		account = data;
	} else {
		// Client viewing: load all approved accounts
		const { data: accounts } = await supabase
			.from('client_accounts')
			.select('id, client_name, mt5_account_id, mt5_server, status, last_synced_at')
			.eq('status', 'approved')
			.order('created_at', { ascending: true });

		allAccounts = accounts || [];

		// Select account by URL param or default to first
		const selectedAccountId = url.searchParams.get('account_id');
		if (selectedAccountId) {
			account = allAccounts.find(a => a.id === selectedAccountId) ?? null;
		}
		if (!account && allAccounts.length > 0) {
			account = allAccounts[0];
		}
	}

	if (!account || !locals.profile) {
		return {
			account,
			allAccounts,
			tags: [],
			baseData: null,
			playbooks: [],
			savedViews: [],
			userId: locals.profile?.id,
			marketNews: [],
			isAdminView,
			viewAsAccountId: isAdminView ? locals.viewAsAccountId : null
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
	const [tagsRes, baseData, bridgeHealthRes] = await Promise.all([
		supabase
			.from('trade_tags')
			.select('*')
			.eq('user_id', effectiveUserId)
			.order('category', { ascending: true }),
		fetchPortfolioBaseData(supabase, account.id, effectiveUserId),
		supabase.from('bridge_health').select('status, last_heartbeat').eq('id', 'singleton').maybeSingle()
	]);

	return {
		account,
		allAccounts,
		tags: tagsRes.data || [],
		baseData,
		playbooks: baseData?.playbooks ?? [],
		savedViews: baseData?.savedViews ?? [],
		userId: effectiveUserId,
		marketNews: marketNewsPromise,
		bridgeStatus: (bridgeHealthRes.data?.status as string | null) ?? null,
		isAdminView,
		viewAsAccountId: isAdminView ? locals.viewAsAccountId : null
	};
};
