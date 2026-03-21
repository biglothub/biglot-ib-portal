import { rateLimit } from '$lib/server/rate-limit';
import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export const POST = async ({ request, locals }: RequestEvent) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!rateLimit(`portfolio:trades-manual:${profile.id}`, 20, 60_000)) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ message: 'ไม่พบบัญชี' }, { status: 404 });
	}

	let body: {
		symbol: string;
		type: string;
		profit: number;
		lot_size?: number;
		open_price?: number;
		close_price?: number;
		open_time: string;
		close_time: string;
		sl?: number | null;
		tp?: number | null;
		pips?: number | null;
	};

	try {
		body = await request.json();
	} catch {
		return json({ message: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
	}

	const { symbol, type, profit, open_time, close_time } = body;

	// Validate required fields
	if (!symbol || typeof symbol !== 'string' || symbol.trim().length === 0) {
		return json({ message: 'กรุณาระบุสัญลักษณ์' }, { status: 400 });
	}
	if (type !== 'BUY' && type !== 'SELL') {
		return json({ message: 'ประเภทต้องเป็น BUY หรือ SELL' }, { status: 400 });
	}
	if (typeof profit !== 'number' || isNaN(profit)) {
		return json({ message: 'กำไร/ขาดทุนต้องเป็นตัวเลข' }, { status: 400 });
	}

	const openTime = new Date(open_time);
	const closeTime = new Date(close_time);
	if (isNaN(openTime.getTime()) || isNaN(closeTime.getTime())) {
		return json({ message: 'รูปแบบวันเวลาไม่ถูกต้อง' }, { status: 400 });
	}
	if (closeTime < openTime) {
		return json({ message: 'เวลาปิดต้องหลังเวลาเปิด' }, { status: 400 });
	}

	const lotSize = typeof body.lot_size === 'number' && body.lot_size > 0 ? body.lot_size : 0.01;
	const openPrice = typeof body.open_price === 'number' ? body.open_price : 0;
	const closePrice = typeof body.close_price === 'number' ? body.close_price : 0;

	const { data, error } = await locals.supabase
		.from('trades')
		.insert({
			client_account_id: account.id,
			symbol: symbol.trim().toUpperCase(),
			type,
			profit,
			lot_size: lotSize,
			open_price: openPrice,
			close_price: closePrice,
			open_time: openTime.toISOString(),
			close_time: closeTime.toISOString(),
			sl: body.sl ?? null,
			tp: body.tp ?? null,
			pips: body.pips ?? null,
			commission: 0,
			swap: 0,
			position_id: 0
		})
		.select('id')
		.single();

	if (error) {
		return json({ message: 'บันทึกเทรดไม่สำเร็จ' }, { status: 500 });
	}

	return json({ id: data.id }, { status: 201 });
};
