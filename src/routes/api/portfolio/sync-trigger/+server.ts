import { json } from '@sveltejs/kit';
import { getAccessiblePortfolioAccount } from '$lib/server/portfolioAccount';
import { rateLimit } from '$lib/server/rate-limit';
import { invalidateBaseDataCache } from '$lib/server/portfolio';
import { invalidateLayoutCache } from '$lib/server/layout-cache';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import { sendTradeSync } from '$lib/server/webhooks';
import type { Trade } from '$lib/types';
import type { RequestHandler } from './$types';

/**
 * POST /api/portfolio/sync-trigger
 *
 * Signals a manual sync request. The bridge service runs on its own cycle
 * (default 60s); this endpoint validates the request and marks the account
 * so the next bridge cycle is treated as user-initiated. The client should
 * invalidate its data after receiving a success response.
 */
export const POST: RequestHandler = async ({ locals, url }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	// Allow at most 1 manual sync trigger per 60 s per user
	if (!(await rateLimit(`portfolio:sync-trigger:${profile.id}`, 1, 60_000))) {
		return json({ message: 'Too many requests — wait 60 seconds before syncing again' }, { status: 429 });
	}

	// Resolve the currently-viewed account (supports multi-account users).
	// SELECT runs through locals.supabase so RLS enforces ownership.
	const requestedAccountId = url.searchParams.get('account_id');
	const account = await getAccessiblePortfolioAccount(locals.supabase, {
		userId: profile.id,
		requestedAccountId,
		selectedAccountId: typeof locals.selectedAccountId === 'string' ? locals.selectedAccountId : null
	});
	if (!account) {
		return json({ message: 'No approved account' }, { status: 404 });
	}

	// Write a sync_requested_at timestamp — the bridge picks this up on its
	// next cycle and treats it as an immediate-priority sync.
	//
	// client_accounts has no RLS UPDATE policy for role=client (migration 001
	// only granted SELECT), so a user-scoped update silently affects 0 rows.
	// Use the service client and guard by user_id to enforce ownership.
	const now = new Date().toISOString();
	const service = createSupabaseServiceClient();
	const { error: updateError, count } = await service
		.from('client_accounts')
		.update({ sync_requested_at: now }, { count: 'exact' })
		.eq('id', account.id)
		.eq('user_id', profile.id);
	if (updateError || !count) {
		return json({ message: 'ไม่สามารถสั่ง Sync ได้' }, { status: 500 });
	}

	// Invalidate all caches so the next page load fetches fresh data after sync.
	// Layout cache holds last_synced_at + bridge status — without this the
	// SyncStatusBadge shows stale "Synced · X ago" for up to 60s after resync.
	invalidateBaseDataCache(account.id);
	invalidateLayoutCache(profile.id);

	// Fire trade_sync webhook (non-blocking — silent fail on error)
	// Fetch the latest trades so the webhook payload has real data
	Promise.resolve(
		locals.supabase
			.from('trades')
			.select('id, client_account_id, symbol, type, lot_size, open_price, close_price, open_time, close_time, profit, sl, tp, position_id, pips, commission, swap, created_at')
			.eq('client_account_id', account.id)
			.order('close_time', { ascending: false })
			.limit(50)
	).then(({ data }) => {
		if (data && data.length > 0) {
			sendTradeSync(locals.supabase, profile.id, data as Trade[]).catch(() => undefined);
		}
	}).catch(() => undefined);

	return json({ ok: true, requested_at: now });
};
