import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'Forbidden' }, { status: 403 });
	}

	const { data, error } = await locals.supabase
		.from('trade_attachments')
		.select('*')
		.eq('trade_id', params.id)
		.eq('user_id', profile.id)
		.order('sort_order', { ascending: true })
		.order('created_at', { ascending: true });

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ attachments: data || [] });
};

export const POST: RequestHandler = async ({ request, params, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'Forbidden' }, { status: 403 });
	}

	const { id, kind, storage_path, caption, sort_order } = await request.json();
	if (!storage_path?.trim()) {
		return json({ message: 'storage_path is required' }, { status: 400 });
	}

	const validKinds = ['link', 'image_url'];
	if (kind && !validKinds.includes(kind)) {
		return json({ message: 'Invalid attachment kind' }, { status: 400 });
	}

	const payload = {
		id: id || undefined,
		trade_id: params.id,
		user_id: profile.id,
		kind: kind || 'link',
		storage_path: storage_path.trim(),
		caption: caption || '',
		sort_order: Number.isFinite(sort_order) ? sort_order : 0
	};

	const query = id
		? locals.supabase
				.from('trade_attachments')
				.update(payload)
				.eq('id', id)
				.eq('user_id', profile.id)
				.select()
				.single()
		: locals.supabase.from('trade_attachments').insert(payload).select().single();

	const { data, error } = await query;
	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true, attachment: data });
};

export const DELETE: RequestHandler = async ({ request, params, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'Forbidden' }, { status: 403 });
	}

	const { id } = await request.json();
	if (!id) {
		return json({ message: 'Attachment id is required' }, { status: 400 });
	}

	const { error } = await locals.supabase
		.from('trade_attachments')
		.delete()
		.eq('id', id)
		.eq('trade_id', params.id)
		.eq('user_id', profile.id);

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true });
};
