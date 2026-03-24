import { json } from '@sveltejs/kit';
import { rateLimit } from '$lib/server/rate-limit';
import type { WebhookEvent, WebhookType } from '$lib/server/webhooks';
import type { RequestHandler } from './$types';

const VALID_TYPES: WebhookType[] = ['line', 'discord'];
const VALID_EVENTS: WebhookEvent[] = ['trade_sync', 'daily_pnl', 'rule_break'];

export const GET: RequestHandler = async ({ locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	const { data, error } = await locals.supabase
		.from('webhook_configs')
		.select('id, webhook_type, webhook_url, events, is_active, created_at, updated_at')
		.eq('user_id', profile.id)
		.order('created_at', { ascending: true });

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ configs: data ?? [] });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	if (!(await rateLimit(`webhooks:${profile.id}`, 20, 60_000))) {
		return json({ message: 'Rate limit exceeded' }, { status: 429 });
	}

	const body = await request.json() as {
		webhook_type: WebhookType;
		webhook_url: string;
		events: WebhookEvent[];
		is_active?: boolean;
	};

	const { webhook_type, webhook_url, events, is_active = true } = body;

	if (!VALID_TYPES.includes(webhook_type)) {
		return json({ message: 'webhook_type ไม่ถูกต้อง (line หรือ discord เท่านั้น)' }, { status: 400 });
	}

	if (!webhook_url || typeof webhook_url !== 'string' || !webhook_url.startsWith('https://')) {
		return json({ message: 'webhook_url ต้องเป็น URL ที่ขึ้นต้นด้วย https://' }, { status: 400 });
	}

	if (!Array.isArray(events) || events.length === 0 || events.some((e) => !VALID_EVENTS.includes(e))) {
		return json({ message: 'events ไม่ถูกต้อง' }, { status: 400 });
	}

	const { data, error } = await locals.supabase
		.from('webhook_configs')
		.upsert(
			{
				user_id: profile.id,
				webhook_type,
				webhook_url,
				events,
				is_active,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'user_id,webhook_type' }
		)
		.select('id, webhook_type, webhook_url, events, is_active, created_at, updated_at')
		.single();

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ config: data });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	const body = await request.json() as { webhook_type: WebhookType };
	const { webhook_type } = body;

	if (!VALID_TYPES.includes(webhook_type)) {
		return json({ message: 'webhook_type ไม่ถูกต้อง' }, { status: 400 });
	}

	const { error } = await locals.supabase
		.from('webhook_configs')
		.delete()
		.eq('user_id', profile.id)
		.eq('webhook_type', webhook_type);

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ ok: true });
};
