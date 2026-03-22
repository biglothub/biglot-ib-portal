import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { rateLimit } from '$lib/server/rate-limit';
import { isSafeUrl } from '$lib/server/trade-guard';
import webpush from 'web-push';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'admin') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!rateLimit(`push:send:${profile.id}`, 10, 60_000)) {
		return json({ message: 'Rate limit exceeded' }, { status: 429 });
	}

	const { userId, title, body, url } = await request.json();

	if (!userId || !title) {
		return json({ message: 'Missing required fields' }, { status: 400 });
	}

	const vapidPublicKey = env.VAPID_PUBLIC_KEY;
	const vapidPrivateKey = env.VAPID_PRIVATE_KEY;
	const vapidSubject = env.VAPID_SUBJECT || 'mailto:admin@ibportal.com';

	if (!vapidPublicKey || !vapidPrivateKey) {
		return json({ message: 'Push notifications not configured' }, { status: 500 });
	}

	webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

	// Get all subscriptions for the target user
	const { data: subscriptions, error } = await locals.supabase
		.from('push_subscriptions')
		.select('endpoint, keys')
		.eq('user_id', userId);

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	if (!subscriptions?.length) {
		return json({ message: 'No subscriptions found', sent: 0 });
	}

	const safeUrl = (url && isSafeUrl(url)) ? url : '/';
	const payload = JSON.stringify({ title, body: body || '', url: safeUrl });

	let sent = 0;
	const staleEndpoints: string[] = [];

	for (const sub of subscriptions) {
		try {
			await webpush.sendNotification(
				{
					endpoint: sub.endpoint,
					keys: sub.keys as { p256dh: string; auth: string }
				},
				payload
			);
			sent++;
		} catch (err: unknown) {
			// Remove expired/invalid subscriptions
			if (typeof err === 'object' && err !== null && 'statusCode' in err &&
				(err.statusCode === 410 || err.statusCode === 404)) {
				staleEndpoints.push(sub.endpoint);
			}
		}
	}

	// Clean up stale subscriptions
	if (staleEndpoints.length > 0) {
		await locals.supabase
			.from('push_subscriptions')
			.delete()
			.eq('user_id', userId)
			.in('endpoint', staleEndpoints);
	}

	return json({ success: true, sent, total: subscriptions.length });
};
