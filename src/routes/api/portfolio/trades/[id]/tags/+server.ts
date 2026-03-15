import { rateLimit } from '$lib/server/rate-limit';
import { json } from '@sveltejs/kit';
import { verifyTradeOwnership } from '$lib/server/trade-guard';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'Forbidden' }, { status: 403 });
	}

	if (!rateLimit(`portfolio:trade-tags:${profile.id}`, 30, 60_000)) {
		return json({ message: 'Too many requests' }, { status: 429 });
	}

	const ownership = await verifyTradeOwnership(locals.supabase, params.id, profile.id);
	if (!ownership.ok) return ownership.response;

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

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ request, params, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'Forbidden' }, { status: 403 });
	}

	const ownership = await verifyTradeOwnership(locals.supabase, params.id, profile.id);
	if (!ownership.ok) return ownership.response;

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

	return json({ success: true });
};
