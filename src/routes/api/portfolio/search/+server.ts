import { getAccessiblePortfolioAccount } from '$lib/server/portfolioAccount';
import { rateLimit } from '$lib/server/rate-limit';
import { sanitizeSearchQuery } from '$lib/server/validation';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface SearchResult {
	id: string;
	title: string;
	subtitle: string;
	href: string;
	type: 'trade' | 'journal' | 'playbook';
}

interface SearchResponse {
	trades: SearchResult[];
	journals: SearchResult[];
	playbooks: SearchResult[];
}

function formatThaiDate(dateStr: string): string {
	const date = new Date(dateStr);
	const thaiMonths = [
		'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
		'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
	];
	const day = date.getDate();
	const month = thaiMonths[date.getMonth()];
	const year = date.getFullYear() + 543;
	return `วันที่ ${day} ${month} พ.ศ. ${year}`;
}

function truncate(text: string, max: number): string {
	if (!text) return '';
	const clean = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
	return clean.length > max ? clean.slice(0, max) + '...' : clean;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!(await rateLimit(`portfolio:search:${profile.id}`, 60, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	let body: { query?: unknown; accountId?: unknown };
	try {
		body = await request.json();
	} catch {
		return json({ message: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
	}

	const rawQuery = typeof body.query === 'string' ? body.query.trim() : '';

	if (rawQuery.length < 2) {
		return json({ message: 'กรุณาพิมพ์อย่างน้อย 2 ตัวอักษร' }, { status: 400 });
	}
	if (rawQuery.length > 100) {
		return json({ message: 'คำค้นหายาวเกินไป' }, { status: 400 });
	}

	const safeQuery = sanitizeSearchQuery(rawQuery);
	if (!safeQuery) {
		return json({ message: 'คำค้นหาไม่ถูกต้อง' }, { status: 400 });
	}

	const requestedAccountId = typeof body.accountId === 'string' ? body.accountId.trim() : null;
	const account = await getAccessiblePortfolioAccount(locals.supabase, {
		userId: profile.id,
		requestedAccountId,
		selectedAccountId: typeof locals.selectedAccountId === 'string' ? locals.selectedAccountId : null
	});
	if (!account) {
		return json({ message: 'ไม่พบบัญชีที่อนุมัติ' }, { status: 404 });
	}

	const accountId = account.id;
	const likePattern = `%${safeQuery}%`;

	const [tradesResult, journalsResult, playbooksResult] = await Promise.allSettled([
		locals.supabase
			.from('trades')
			.select('id, symbol, ticket, profit')
			.eq('client_account_id', accountId)
			.or(`symbol.ilike.${likePattern},ticket::text.ilike.${likePattern}`)
			.order('close_time', { ascending: false })
			.limit(5),

		locals.supabase
			.from('daily_journal')
			.select('id, date, content')
			.eq('client_account_id', accountId)
			.ilike('content', likePattern)
			.order('date', { ascending: false })
			.limit(5),

		locals.supabase
			.from('playbooks')
			.select('id, name, description')
			.eq('client_account_id', accountId)
			.or(`name.ilike.${likePattern},description.ilike.${likePattern}`)
			.order('created_at', { ascending: false })
			.limit(5),
	]);

	const response: SearchResponse = {
		trades: [],
		journals: [],
		playbooks: [],
	};

	if (tradesResult.status === 'fulfilled' && tradesResult.value.data) {
		response.trades = tradesResult.value.data.map((t: { id: string; symbol: string; ticket: string | number | null; profit: number | null }) => ({
			id: String(t.id),
			title: t.symbol,
			subtitle: `P&L: ฿${Number(t.profit ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
			href: `/portfolio/trades/${t.id}`,
			type: 'trade' as const,
		}));
	}

	if (journalsResult.status === 'fulfilled' && journalsResult.value.data) {
		response.journals = journalsResult.value.data.map((j: { id: string; date: string; content: string | null }) => ({
			id: String(j.id),
			title: formatThaiDate(j.date),
			subtitle: truncate(j.content ?? '', 60),
			href: `/portfolio/journal?date=${j.date}`,
			type: 'journal' as const,
		}));
	}

	if (playbooksResult.status === 'fulfilled' && playbooksResult.value.data) {
		response.playbooks = playbooksResult.value.data.map((p: { id: string; name: string; description: string | null }) => ({
			id: String(p.id),
			title: p.name,
			subtitle: truncate(p.description ?? '', 60),
			href: `/portfolio/playbook`,
			type: 'playbook' as const,
		}));
	}

	return json(response);
};
