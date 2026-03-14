import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'Forbidden' }, { status: 403 });
	}

	const { content, rating } = await request.json();

	if (content === undefined) {
		return json({ message: 'Missing content' }, { status: 400 });
	}

	if (rating !== null && rating !== undefined && (rating < 1 || rating > 5)) {
		return json({ message: 'Rating must be 1-5' }, { status: 400 });
	}

	// Upsert: create or update the note for this trade
	const { data, error } = await locals.supabase
		.from('trade_notes')
		.upsert({
			trade_id: params.id,
			user_id: profile.id,
			content: content || '',
			rating: rating || null,
			updated_at: new Date().toISOString()
		}, { onConflict: 'trade_id' })
		.select()
		.single();

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true, note: data });
};
