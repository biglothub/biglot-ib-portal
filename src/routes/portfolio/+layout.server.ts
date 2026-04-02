import { dev } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import { fetchPortfolioBaseData } from '$lib/server/portfolio';
import { getCache, setCache } from '$lib/server/cache';
import { accountsCache, tagsCache, bridgeCache, LAYOUT_CACHE_TTL_MS, type AccountRow } from '$lib/server/layout-cache';
import type { TradeTag } from '$lib/types';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
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
		throw redirect(303, locals.profile?.role === 'master_ib' ? '/ib/clients' : '/admin/clients');
	}
	if (!isAdminView && !locals.profile) {
		throw redirect(303, '/auth/login');
	}

	// For admin view, use service client (bypasses RLS) and target the client's account
	const supabase = isAdminView ? createSupabaseServiceClient() : locals.supabase;
	const effectiveUserId = isAdminView ? locals.viewAsUserId! : locals.profile!.id;

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
		// Client viewing: check process cache first
		const cachedAccounts = accountsCache.get(effectiveUserId);
		if (cachedAccounts && Date.now() < cachedAccounts.expiresAt) {
			allAccounts = cachedAccounts.data;
			if (dev) console.log(`[layout] HIT accounts cache`);
		} else {
			const { data: accounts } = await supabase
				.from('client_accounts')
				.select('id, client_name, mt5_account_id, mt5_server, status, last_synced_at')
				.eq('user_id', effectiveUserId)
				.eq('status', 'approved')
				.order('created_at', { ascending: true });
			allAccounts = (accounts || []) as AccountRow[];
			accountsCache.set(effectiveUserId, { data: allAccounts, expiresAt: Date.now() + LAYOUT_CACHE_TTL_MS });
		}

		// Select account by URL param (resolved in hooks.server.ts) or default to first
		const selectedAccountId = locals.selectedAccountId;
		if (selectedAccountId) {
			account = allAccounts.find(a => a.id === selectedAccountId) ?? null;
		}
		if (!account && allAccounts.length > 0) {
			account = allAccounts[0];
		}
	}

	if (!account || !locals.profile) {
		locals.portfolioBaseData = null;
		return {
			account,
			allAccounts,
			tags: [],
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

	// Market news: check cache first (TTL 15min), fall back to DB
	const NEWS_CACHE_KEY = 'portfolio:news';
	const marketNewsPromise = getCache<Record<string, unknown>[]>(NEWS_CACHE_KEY).then(
		(cached) => {
			if (cached) return cached;
			return supabase
				.from('market_news')
				.select('*')
				.eq('ai_processed', true)
				.gte('published_at', oneDayAgo.toISOString())
				.order('relevance_score', { ascending: false })
				.order('published_at', { ascending: false })
				.limit(20)
				.then((res) => {
					const articles = res.data || [];
					if (articles.length > 0) void setCache(NEWS_CACHE_KEY, articles, 900);
					return articles;
				});
		}
	).catch(() => []);

	// Check process cache for tags and bridge health
	const cachedTags = tagsCache.get(effectiveUserId);
	const cachedBridge = bridgeCache.get('singleton');
	const now = Date.now();

	const needTags = !cachedTags || now >= cachedTags.expiresAt;
	const needBridge = !cachedBridge || now >= cachedBridge.expiresAt;

	if (dev && !needTags) console.log(`[layout] HIT tags cache`);
	if (dev && !needBridge) console.log(`[layout] HIT bridge cache`);

	// Run baseData + only the queries we actually need
	const [baseDataResult, tagsResult, bridgeResult] = await Promise.allSettled([
		fetchPortfolioBaseData(supabase, account.id, effectiveUserId),
		needTags
			? supabase
					.from('trade_tags')
					.select('*')
					.eq('user_id', effectiveUserId)
					.order('category', { ascending: true })
			: Promise.resolve({ data: cachedTags!.data, error: null }),
		needBridge
			? supabase.from('bridge_health').select('status, last_heartbeat').eq('id', 'singleton').maybeSingle()
			: Promise.resolve({ data: cachedBridge!.data, error: null })
	]);

	// baseData is critical — let failure propagate
	if (baseDataResult.status === 'rejected') {
		throw baseDataResult.reason;
	}
	const resolvedBaseData = baseDataResult.value;

	// Store on locals (server-only) — never serialized to client
	locals.portfolioBaseData = resolvedBaseData;

	const tags = (tagsResult.status === 'fulfilled' ? (tagsResult.value as { data: TradeTag[] | null }).data || [] : []) as TradeTag[];
	if (needTags) {
		tagsCache.set(effectiveUserId, { data: tags, expiresAt: now + LAYOUT_CACHE_TTL_MS });
	}

	const bridgeHealth = bridgeResult.status === 'fulfilled'
		? (bridgeResult.value as { data: { status: string | null; last_heartbeat: string | null } | null }).data
		: null;
	if (needBridge) {
		bridgeCache.set('singleton', { data: bridgeHealth, expiresAt: now + LAYOUT_CACHE_TTL_MS });
	}

	return {
		account,
		allAccounts,
		tags,
		playbooks: resolvedBaseData?.playbooks ?? [],
		savedViews: resolvedBaseData?.savedViews ?? [],
		userId: effectiveUserId,
		marketNews: marketNewsPromise,
		bridgeStatus: (bridgeHealth?.status as string | null) ?? null,
		isAdminView,
		viewAsAccountId: isAdminView ? locals.viewAsAccountId : null
	};
};
