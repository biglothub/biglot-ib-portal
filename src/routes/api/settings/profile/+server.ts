import { json } from '@sveltejs/kit';
import { rateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
	if (!(await rateLimit(`profile-settings:${locals.user.id}:${ip}`, 10, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const body = await request.json();
	const { action } = body;

	if (action === 'update_name') {
		const { full_name } = body;
		if (!full_name || typeof full_name !== 'string') {
			return json({ message: 'กรุณากรอกชื่อที่แสดง' }, { status: 400 });
		}

		const trimmed = full_name.trim();
		if (trimmed.length < 2 || trimmed.length > 100) {
			return json({ message: 'ชื่อต้องมีความยาว 2-100 ตัวอักษร' }, { status: 400 });
		}

		const { error } = await locals.supabase
			.from('profiles')
			.update({ full_name: trimmed })
			.eq('id', locals.user.id);

		if (error) {
				return json({ message: 'ไม่สามารถอัปเดตชื่อได้' }, { status: 500 });
		}

		return json({ success: true, message: 'อัปเดตชื่อสำเร็จ' });
	}

	if (action === 'update_notifications') {
		const {
			push_enabled,
			daily_email_enabled,
			trade_alerts_enabled,
			weekly_recap_enabled,
			sync_status_enabled,
			risk_threshold_enabled,
			account_status_enabled,
			journal_reminder_enabled,
			ai_insight_enabled
		} = body;

		const payload = {
			user_id: locals.user.id,
			push_enabled: !!push_enabled,
			daily_email_enabled: !!daily_email_enabled,
			trade_alerts_enabled: !!trade_alerts_enabled,
			weekly_recap_enabled: !!weekly_recap_enabled,
			sync_status_enabled: sync_status_enabled !== false,
			risk_threshold_enabled: risk_threshold_enabled !== false,
			account_status_enabled: account_status_enabled !== false,
			journal_reminder_enabled: !!journal_reminder_enabled,
			ai_insight_enabled: ai_insight_enabled !== false
		};

		const { error } = await locals.supabase
			.from('user_notification_prefs')
			.upsert(payload, { onConflict: 'user_id' });

		if (error) {
				return json({ message: 'ไม่สามารถบันทึกการตั้งค่าแจ้งเตือนได้' }, { status: 500 });
		}

		return json({ success: true, message: 'บันทึกการตั้งค่าแจ้งเตือนสำเร็จ' });
	}

	return json({ message: 'การกระทำไม่ถูกต้อง' }, { status: 400 });
};
