import { json } from '@sveltejs/kit';
import { rateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

interface SymbolSetting {
	symbol: string;
	default_tp_pips: number | null;
	default_sl_pips: number | null;
	commission: number | null;
}

const VALID_TIMEZONES = [
	'Asia/Bangkok',
	'Asia/Tokyo',
	'Asia/Singapore',
	'Asia/Hong_Kong',
	'Asia/Shanghai',
	'Asia/Seoul',
	'Asia/Kolkata',
	'Asia/Dubai',
	'Europe/London',
	'Europe/Berlin',
	'Europe/Moscow',
	'America/New_York',
	'America/Chicago',
	'America/Los_Angeles',
	'Pacific/Auckland',
	'Australia/Sydney',
	'UTC'
];

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
	if (!rateLimit(`trade-settings:${locals.user.id}:${ip}`, 10, 60_000)) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const body = await request.json();
	const { timezone, default_tp_pips, default_sl_pips, symbol_settings } = body;

	// Validate timezone
	if (timezone && !VALID_TIMEZONES.includes(timezone)) {
		return json({ message: 'Timezone ไม่ถูกต้อง' }, { status: 400 });
	}

	// Validate symbol_settings
	if (symbol_settings && !Array.isArray(symbol_settings)) {
		return json({ message: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 400 });
	}

	if (symbol_settings) {
		for (const s of symbol_settings as SymbolSetting[]) {
			if (!s.symbol || typeof s.symbol !== 'string' || s.symbol.length > 20) {
				return json({ message: 'ชื่อสัญลักษณ์ไม่ถูกต้อง' }, { status: 400 });
			}
			if (s.commission != null && (typeof s.commission !== 'number' || s.commission < 0)) {
				return json({ message: 'ค่าคอมมิชชันต้องเป็นตัวเลขที่ไม่ติดลบ' }, { status: 400 });
			}
		}
	}

	// Validate PT/SL
	if (default_tp_pips != null && (typeof default_tp_pips !== 'number' || default_tp_pips < 0)) {
		return json({ message: 'ค่า Take Profit ต้องเป็นตัวเลขที่ไม่ติดลบ' }, { status: 400 });
	}
	if (default_sl_pips != null && (typeof default_sl_pips !== 'number' || default_sl_pips < 0)) {
		return json({ message: 'ค่า Stop Loss ต้องเป็นตัวเลขที่ไม่ติดลบ' }, { status: 400 });
	}

	const payload = {
		user_id: locals.user.id,
		timezone: timezone || 'Asia/Bangkok',
		default_tp_pips: default_tp_pips ?? null,
		default_sl_pips: default_sl_pips ?? null,
		symbol_settings: symbol_settings ?? []
	};

	const { error } = await locals.supabase
		.from('user_trade_settings')
		.upsert(payload, { onConflict: 'user_id' });

	if (error) {
		console.error('Failed to save trade settings:', error);
		return json({ message: 'ไม่สามารถบันทึกการตั้งค่าได้' }, { status: 500 });
	}

	return json({ success: true, message: 'บันทึกการตั้งค่าสำเร็จ' });
};
