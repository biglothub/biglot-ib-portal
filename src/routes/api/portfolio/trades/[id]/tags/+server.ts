import { rateLimit } from '$lib/server/rate-limit';
import { invalidateCache } from '$lib/server/cache';
import { invalidateBaseDataCache } from '$lib/server/portfolio';
import { json } from '@sveltejs/kit';
import { verifyTradeOwnership } from '$lib/server/trade-guard';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!(await rateLimit(`portfolio:trade-tags:${profile.id}`, 30, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const ownership = await verifyTradeOwnership(locals.supabase, params.id, profile.id);
	if (!ownership.ok) return ownership.response;
	const { accountId } = ownership;

	const { tag_id } = await request.json();

	if (!tag_id) {
		return json({ message: 'Missing tag_id' }, { status: 400 });
	}

	const { error } = await locals.supabase
		.from('trade_tag_assignments')
		.insert({
			trade_id: params.id,
			tag_id
		});

	if (error) {
		if (error.code === '23505') {
			return json({ message: 'Tag already assigned' }, { status: 409 });
		}
		return json({ message: error.message }, { status: 500 });
	}

	invalidateBaseDataCache(accountId);
	void invalidateCache(`portfolio:trades:${accountId}`);

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ request, params, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!(await rateLimit(`portfolio:trade-tags:delete:${profile.id}`, 30, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const ownership = await verifyTradeOwnership(locals.supabase, params.id, profile.id);
	if (!ownership.ok) return ownership.response;
	const { accountId: deleteAccountId } = ownership;

	const { tag_id } = await request.json();

	if (!tag_id) {
		return json({ message: 'Missing tag_id' }, { status: 400 });
	}

	const { error } = await locals.supabase
		.from('trade_tag_assignments')
		.delete()
		.eq('trade_id', params.id)
		.eq('tag_id', tag_id);

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	invalidateBaseDataCache(deleteAccountId);
	void invalidateCache(`portfolio:trades:${deleteAccountId}`);

	return json({ success: true });
};
