import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	const { data, error } = await locals.supabase
		.from('dashboard_layouts')
		.select('layout')
		.eq('user_id', profile.id)
		.maybeSingle();

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ layout: data?.layout || [] });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	const body = await request.json();
	const layout = body.layout;
	if (!Array.isArray(layout)) {
		return json({ message: 'Invalid layout payload' }, { status: 400 });
	}

	const { error } = await locals.supabase
		.from('dashboard_layouts')
		.upsert(
			{
				user_id: profile.id,
				layout,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: 'user_id' }
		);

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true });
};
