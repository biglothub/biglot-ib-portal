import { rateLimit } from '$lib/server/rate-limit';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'Forbidden' }, { status: 403 });
	}

	if (!rateLimit(`portfolio:tags:${profile.id}`, 20, 60_000)) {
		return json({ message: 'Too many requests' }, { status: 429 });
	}

	const { name, category, color } = await request.json();

	if (!name?.trim() || !category) {
		return json({ message: 'Missing required fields' }, { status: 400 });
	}

	const validCategories = ['setup', 'execution', 'emotion', 'mistake', 'market_condition', 'custom'];
	if (!validCategories.includes(category)) {
		return json({ message: 'Invalid category' }, { status: 400 });
	}

	const { data, error } = await locals.supabase
		.from('trade_tags')
		.insert({
			user_id: profile.id,
			name: name.trim(),
			category,
			color: color || '#C9A84C'
		})
		.select()
		.single();

	if (error) {
		if (error.code === '23505') {
			return json({ message: 'Tag นี้มีอยู่แล้ว' }, { status: 409 });
		}
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true, tag: data });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'Forbidden' }, { status: 403 });
	}

	if (!rateLimit(`portfolio:tags:delete:${profile.id}`, 20, 60_000)) {
		return json({ message: 'Too many requests' }, { status: 429 });
	}

	const { id } = await request.json();

	if (!id) {
		return json({ message: 'Missing tag id' }, { status: 400 });
	}

	const { error } = await locals.supabase
		.from('trade_tags')
		.delete()
		.eq('id', id)
		.eq('user_id', profile.id);

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true });
};
