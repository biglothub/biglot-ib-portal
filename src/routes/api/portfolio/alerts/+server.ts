import { json } from '@sveltejs/kit';
import { rateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

export type AlertType =
	| 'daily_loss'
	| 'daily_profit_target'
	| 'win_rate_drop'
	| 'drawdown'
	| 'loss_streak';

export interface PerformanceAlert {
	id: string;
	alert_type: AlertType;
	threshold: number;
	enabled: boolean;
	last_triggered_at: string | null;
	created_at: string;
}

export const GET: RequestHandler = async ({ locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	const { data, error } = await locals.supabase
		.from('performance_alerts')
		.select('id, alert_type, threshold, enabled, last_triggered_at, created_at')
		.eq('user_id', profile.id)
		.order('created_at', { ascending: true });

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ alerts: data ?? [] });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	if (!rateLimit(`alerts:${profile.id}`, 20, 60_000)) {
		return json({ message: 'Rate limit exceeded' }, { status: 429 });
	}

	const body = await request.json();
	const { id, alert_type, threshold, enabled } = body as {
		id?: string;
		alert_type: AlertType;
		threshold: number;
		enabled: boolean;
	};

	const validTypes: AlertType[] = [
		'daily_loss',
		'daily_profit_target',
		'win_rate_drop',
		'drawdown',
		'loss_streak'
	];

	if (!validTypes.includes(alert_type)) {
		return json({ message: 'ประเภทการแจ้งเตือนไม่ถูกต้อง' }, { status: 400 });
	}

	if (typeof threshold !== 'number' || threshold <= 0) {
		return json({ message: 'ค่าเกณฑ์ต้องมากกว่า 0' }, { status: 400 });
	}

	if (id) {
		// Update existing alert
		const { data, error } = await locals.supabase
			.from('performance_alerts')
			.update({ alert_type, threshold, enabled })
			.eq('id', id)
			.eq('user_id', profile.id)
			.select('id, alert_type, threshold, enabled, last_triggered_at, created_at')
			.single();

		if (error) {
			return json({ message: error.message }, { status: 500 });
		}

		return json({ alert: data });
	} else {
		// Create new alert
		const { data, error } = await locals.supabase
			.from('performance_alerts')
			.insert({ user_id: profile.id, alert_type, threshold, enabled })
			.select('id, alert_type, threshold, enabled, last_triggered_at, created_at')
			.single();

		if (error) {
			return json({ message: error.message }, { status: 500 });
		}

		return json({ alert: data }, { status: 201 });
	}
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	if (!rateLimit(`alerts:del:${profile.id}`, 20, 60_000)) {
		return json({ message: 'Rate limit exceeded' }, { status: 429 });
	}

	const id = url.searchParams.get('id');
	if (!id) {
		return json({ message: 'Missing id' }, { status: 400 });
	}

	const { error } = await locals.supabase
		.from('performance_alerts')
		.delete()
		.eq('id', id)
		.eq('user_id', profile.id);

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true });
};
