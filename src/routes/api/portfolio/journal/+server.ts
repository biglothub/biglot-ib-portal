import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import { rateLimit } from '$lib/server/rate-limit';
import { invalidateJournalsCache } from '$lib/server/portfolio';
import { generateSessionRecapHtml } from '$lib/server/session-recap';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const profile = locals.profile;
	if (!profile) return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });

	if (!(await rateLimit(`portfolio:journal:${profile.id}`, 30, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const date = url.searchParams.get('date');
	if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return json({ message: 'กรุณาระบุวันที่ (YYYY-MM-DD)' }, { status: 400 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) return json({ journal: null });

	const { data } = await locals.supabase
		.from('daily_journal')
		.select('date, pre_market_notes, post_market_notes, mood, completion_status')
		.eq('user_id', profile.id)
		.eq('client_account_id', account.id)
		.eq('date', date)
		.maybeSingle();

	return json({ journal: data });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!(await rateLimit(`portfolio:journal:${profile.id}`, 30, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ message: 'No approved account' }, { status: 404 });
	}

	const body = await request.json();

	// ── Generate session recap ──
	if (body.action === 'generate_session_recap') {
		const date = body.date as string | undefined;
		if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			return json({ message: 'รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)' }, { status: 400 });
		}

		const dayStart = `${date}T00:00:00+07:00`;
		const dayEnd = `${date}T23:59:59+07:00`;

		const { data: trades } = await locals.supabase
			.from('trades')
			.select('id, symbol, type, lot_size, open_price, close_price, open_time, close_time, profit, pips, commission, swap')
			.eq('client_account_id', account.id)
			.gte('close_time', dayStart)
			.lte('close_time', dayEnd)
			.order('close_time', { ascending: true });

		if (!trades || trades.length === 0) {
			return json({ message: 'ไม่พบเทรดในวันที่เลือก' }, { status: 404 });
		}

		const { html } = generateSessionRecapHtml(trades, date);
		return json({ html });
	}

	// ── Save journal entry ──
	const {
		date,
		pre_market_notes,
		post_market_notes,
		session_plan,
		market_bias,
		key_levels,
		checklist,
		mood,
		energy_score,
		discipline_score,
		confidence_score,
		lessons,
		tomorrow_focus,
		completion_status
	} = body;

	if (!date) {
		return json({ message: 'กรุณาระบุวันที่' }, { status: 400 });
	}

	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return json({ message: 'รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)' }, { status: 400 });
	}

	for (const [name, value] of [
		['mood', mood],
		['energy_score', energy_score],
		['discipline_score', discipline_score],
		['confidence_score', confidence_score]
	] as const) {
		if (value !== null && value !== undefined && (value < 1 || value > 5)) {
			return json({ message: `${name} ต้องอยู่ระหว่าง 1-5` }, { status: 400 });
		}
	}

	const validCompletionStatuses = ['not_started', 'in_progress', 'complete'];
	if (completion_status && !validCompletionStatuses.includes(completion_status)) {
		return json({ message: 'สถานะความสมบูรณ์ไม่ถูกต้อง' }, { status: 400 });
	}

	const { data, error } = await locals.supabase
		.from('daily_journal')
		.upsert({
			user_id: profile.id,
			client_account_id: account.id,
			date,
			pre_market_notes: pre_market_notes || '',
			post_market_notes: post_market_notes || '',
			session_plan: session_plan || '',
			market_bias: market_bias || '',
			key_levels: key_levels || '',
			checklist: Array.isArray(checklist) ? checklist : [],
			mood: mood || null,
			energy_score: energy_score || null,
			discipline_score: discipline_score || null,
			confidence_score: confidence_score || null,
			lessons: lessons || '',
			tomorrow_focus: tomorrow_focus || '',
			completion_status: completion_status || 'in_progress',
			updated_at: new Date().toISOString()
		}, { onConflict: 'user_id,client_account_id,date' })
		.select()
		.single();

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	invalidateJournalsCache(account.id);

	return json({ success: true, journal: data });
};
