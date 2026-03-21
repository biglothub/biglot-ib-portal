import { rateLimit } from '$lib/server/rate-limit';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

const VALID_REVIEW_STATUSES = ['unreviewed', 'in_progress', 'reviewed'];
const MAX_BULK = 200;

export const POST = async ({ request, locals }: RequestEvent) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!rateLimit(`portfolio:trades-bulk:${profile.id}`, 10, 60_000)) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const body = await request.json();
	const { trade_ids, action, payload } = body;

	if (!Array.isArray(trade_ids) || trade_ids.length === 0) {
		return json({ message: 'trade_ids must be a non-empty array' }, { status: 400 });
	}

	if (trade_ids.length > MAX_BULK) {
		return json({ message: `Cannot bulk-act on more than ${MAX_BULK} trades at once` }, { status: 400 });
	}

	if (!['tag', 'review_status'].includes(action)) {
		return json({ message: 'action must be tag or review_status' }, { status: 400 });
	}

	// Verify all trades belong to the authenticated user via client_account → user_id chain
	const { data: trades, error: tradeError } = await locals.supabase
		.from('trades')
		.select('id, client_account_id, client_accounts!inner(user_id)')
		.in('id', trade_ids);

	if (tradeError) {
		return json({ message: tradeError.message }, { status: 500 });
	}

	const ownedIds = new Set(
		(trades ?? [])
			.filter((t: any) => t.client_accounts?.user_id === profile.id)
			.map((t: any) => t.id)
	);

	const unauthorised = trade_ids.filter((id: string) => !ownedIds.has(id));
	if (unauthorised.length > 0) {
		return json({ message: 'Forbidden: some trades do not belong to you' }, { status: 403 });
	}

	if (action === 'tag') {
		const { tag_id } = payload ?? {};
		if (!tag_id) return json({ message: 'Missing tag_id' }, { status: 400 });

		// Verify the tag belongs to the user
		const { data: tag } = await locals.supabase
			.from('trade_tags')
			.select('id')
			.eq('id', tag_id)
			.eq('user_id', profile.id)
			.single();

		if (!tag) return json({ message: 'Tag not found' }, { status: 404 });

		const rows = trade_ids.map((id: string) => ({ trade_id: id, tag_id }));

		const { error } = await locals.supabase
			.from('trade_tag_assignments')
			.upsert(rows, { onConflict: 'trade_id,tag_id', ignoreDuplicates: true });

		if (error) return json({ message: error.message }, { status: 500 });

		return json({ success: true, affected: trade_ids.length });
	}

	if (action === 'review_status') {
		const { review_status } = payload ?? {};
		if (!review_status || !VALID_REVIEW_STATUSES.includes(review_status)) {
			return json({ message: 'Invalid review_status' }, { status: 400 });
		}

		const rows = trade_ids.map((id: string) => ({
			trade_id: id,
			user_id: profile.id,
			review_status,
			reviewed_at: review_status === 'reviewed' ? new Date().toISOString() : null,
			updated_at: new Date().toISOString()
		}));

		const { error } = await locals.supabase
			.from('trade_reviews')
			.upsert(rows, { onConflict: 'trade_id' });

		if (error) return json({ message: error.message }, { status: 500 });

		return json({ success: true, affected: trade_ids.length });
	}

	return json({ message: 'Unknown action' }, { status: 400 });
};
