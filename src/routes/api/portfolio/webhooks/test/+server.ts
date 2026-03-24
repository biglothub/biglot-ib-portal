import { json } from '@sveltejs/kit';
import { rateLimit } from '$lib/server/rate-limit';
import { sendTestWebhook } from '$lib/server/webhooks';
import type { WebhookConfig, WebhookType } from '$lib/server/webhooks';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	// Allow at most 5 test fires per minute per user
	if (!(await rateLimit(`webhooks-test:${profile.id}`, 5, 60_000))) {
		return json({ message: 'Rate limit exceeded — รอสักครู่แล้วลองใหม่' }, { status: 429 });
	}

	const body = await request.json() as { webhook_type: WebhookType };
	const { webhook_type } = body;

	if (webhook_type !== 'line' && webhook_type !== 'discord') {
		return json({ message: 'webhook_type ไม่ถูกต้อง' }, { status: 400 });
	}

	const { data, error } = await locals.supabase
		.from('webhook_configs')
		.select('*')
		.eq('user_id', profile.id)
		.eq('webhook_type', webhook_type)
		.single();

	if (error || !data) {
		return json({ message: 'ไม่พบการตั้งค่า Webhook สำหรับประเภทนี้' }, { status: 404 });
	}

	await sendTestWebhook(data as WebhookConfig);

	return json({ success: true });
};
