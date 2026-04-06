import webpush from 'web-push';
import { env } from '$env/dynamic/private';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function sendPushToUser(
	supabase: SupabaseClient,
	userId: string,
	title: string,
	body: string,
	url = '/'
): Promise<void> {
	const vapidPublicKey = env.VAPID_PUBLIC_KEY;
	const vapidPrivateKey = env.VAPID_PRIVATE_KEY;
	const vapidSubject = env.VAPID_SUBJECT || 'mailto:admin@ibportal.com';

	if (!vapidPublicKey || !vapidPrivateKey) return;

	webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

	const { data: subscriptions } = await supabase
		.from('push_subscriptions')
		.select('endpoint, keys')
		.eq('user_id', userId);

	if (!subscriptions?.length) return;

	const payload = JSON.stringify({ title, body, url });
	const stale: string[] = [];

	for (const sub of subscriptions) {
		try {
			await webpush.sendNotification(
				{ endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
				payload
			);
		} catch (err: unknown) {
			const e = err as { statusCode?: number };
			if (e.statusCode === 410 || e.statusCode === 404) {
				stale.push(sub.endpoint);
			}
		}
	}

	if (stale.length > 0) {
		await supabase
			.from('push_subscriptions')
			.delete()
			.eq('user_id', userId)
			.in('endpoint', stale);
	}
}
