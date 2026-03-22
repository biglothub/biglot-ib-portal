import { json } from '@sveltejs/kit';
import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import { rateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

/**
 * POST /api/portfolio/sync-trigger
 *
 * Signals a manual sync request. The bridge service runs on its own cycle
 * (default 60s); this endpoint validates the request and marks the account
 * so the next bridge cycle is treated as user-initiated. The client should
 * invalidate its data after receiving a success response.
 */
export const POST: RequestHandler = async ({ locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	// Allow at most 1 manual sync trigger per 60 s per user
	if (!(await rateLimit(`portfolio:sync-trigger:${profile.id}`, 1, 60_000))) {
		return json({ message: 'Too many requests — wait 60 seconds before syncing again' }, { status: 429 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ message: 'No approved account' }, { status: 404 });
	}

	// Write a sync_requested_at timestamp — the bridge picks this up on its
	// next cycle and treats it as an immediate-priority sync.
	const now = new Date().toISOString();
	await locals.supabase
		.from('client_accounts')
		.update({ sync_requested_at: now })
		.eq('id', account.id);

	return json({ ok: true, requested_at: now });
};
