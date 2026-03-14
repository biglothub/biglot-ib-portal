import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const { subscription } = await request.json();

	if (!subscription?.endpoint || !subscription?.keys) {
		return json({ message: 'Invalid subscription' }, { status: 400 });
	}

	const { error } = await locals.supabase.from('push_subscriptions').upsert(
		{
			user_id: profile.id,
			endpoint: subscription.endpoint,
			keys: subscription.keys
		},
		{ onConflict: 'user_id,endpoint' }
	);

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const { endpoint } = await request.json();

	if (!endpoint) {
		return json({ message: 'Missing endpoint' }, { status: 400 });
	}

	const { error } = await locals.supabase
		.from('push_subscriptions')
		.delete()
		.eq('user_id', profile.id)
		.eq('endpoint', endpoint);

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true });
};
