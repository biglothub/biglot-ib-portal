import webpush from 'web-push';
import { env } from '$env/dynamic/private';
import type { SupabaseClient } from '@supabase/supabase-js';

export type PushCategory = 'sync_status' | 'risk_threshold' | 'account_status' | 'journal_reminder' | 'ai_insight' | 'general';

interface PushOptions {
	category?: PushCategory;
	title: string;
	body?: string;
	url?: string;
	badge?: number;
	icon?: string;
	tag?: string;
	data?: Record<string, unknown>;
}

const PREF_COLUMN_BY_CATEGORY: Partial<Record<PushCategory, string>> = {
	sync_status: 'sync_status_enabled',
	risk_threshold: 'risk_threshold_enabled',
	account_status: 'account_status_enabled',
	journal_reminder: 'journal_reminder_enabled',
	ai_insight: 'ai_insight_enabled'
};

export async function sendPushToUser(
	supabase: SupabaseClient,
	userId: string,
	titleOrOptions: string | PushOptions,
	body = '',
	url = '/'
): Promise<void> {
	const vapidPublicKey = env.VAPID_PUBLIC_KEY;
	const vapidPrivateKey = env.VAPID_PRIVATE_KEY;
	const vapidSubject = env.VAPID_SUBJECT || 'mailto:admin@ibportal.com';

	if (!vapidPublicKey || !vapidPrivateKey) return;

	webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

	const options: PushOptions = typeof titleOrOptions === 'string'
		? { category: 'general', title: titleOrOptions, body, url }
		: titleOrOptions;

	const category = options.category ?? 'general';
	const prefColumn = PREF_COLUMN_BY_CATEGORY[category];
	if (prefColumn) {
		const { data: prefs } = await supabase
			.from('user_notification_prefs')
			.select('push_enabled, sync_status_enabled, risk_threshold_enabled, account_status_enabled, journal_reminder_enabled, ai_insight_enabled')
			.eq('user_id', userId)
			.maybeSingle();
		const typedPrefs = prefs as Record<string, unknown> | null;
		if (!typedPrefs?.push_enabled || typedPrefs[prefColumn] === false) return;
	}

	const { data: subscriptions } = await supabase
		.from('push_subscriptions')
		.select('endpoint, keys')
		.eq('user_id', userId);

	if (!subscriptions?.length) return;

	const payload = JSON.stringify({
		category,
		title: options.title,
		body: options.body || '',
		url: options.url || '/portfolio',
		badge: options.badge,
		icon: options.icon || '/icon-192.png',
		tag: options.tag,
		data: options.data
	});
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
