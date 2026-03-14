import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'Forbidden' }, { status: 403 });
	}

	const { client_account_id, date, pre_market_notes, post_market_notes, mood } = await request.json();

	if (!client_account_id || !date) {
		return json({ message: 'Missing required fields' }, { status: 400 });
	}

	if (mood !== null && mood !== undefined && (mood < 1 || mood > 5)) {
		return json({ message: 'Mood must be 1-5' }, { status: 400 });
	}

	const { data, error } = await locals.supabase
		.from('daily_journal')
		.upsert({
			user_id: profile.id,
			client_account_id,
			date,
			pre_market_notes: pre_market_notes || '',
			post_market_notes: post_market_notes || '',
			mood: mood || null,
			updated_at: new Date().toISOString()
		}, { onConflict: 'user_id,client_account_id,date' })
		.select()
		.single();

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true, journal: data });
};
