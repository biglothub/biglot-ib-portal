import { applyPortfolioFilters, getTradeReviewStatus, parsePortfolioFilters } from '$lib/portfolio';
import { rateLimit } from '$lib/server/rate-limit';
import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import type { RequestEvent } from '@sveltejs/kit';
import type { Trade, TradeTagAssignment } from '$lib/types';

const EXPORT_COLUMNS = [
	'Symbol',
	'Type',
	'Lot Size',
	'Open Price',
	'Close Price',
	'Open Time',
	'Close Time',
	'Profit',
	'Pips',
	'Commission',
	'Swap',
	'SL',
	'TP',
	'Position ID',
	'Review Status',
	'Tags'
];

export const GET = async ({ locals, url }: RequestEvent) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return new Response(JSON.stringify({ message: 'ไม่ได้รับอนุญาต' }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (!(await rateLimit(`portfolio:trades-export:${profile.id}`, 5, 60_000))) {
		return new Response(JSON.stringify({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }), {
			status: 429,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return new Response(JSON.stringify({ message: 'No approved account' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// Fetch the joined fields needed to honor the same filters used in portfolio pages.
	const { data: trades, error } = await locals.supabase
		.from('trades')
		.select(`
			id, symbol, type, lot_size, open_price, close_price,
			open_time, close_time, profit, pips, commission, swap, created_at,
			sl, tp, position_id, client_account_id,
			trade_tag_assignments(tag_id, trade_tags(name)),
			trade_notes(id, content),
			trade_attachments(id),
			trade_reviews(
				review_status,
				playbook_id,
				setup_quality_score,
				discipline_score,
				execution_score,
				confidence_at_entry,
				followed_plan,
				broken_rules,
				entry_reason,
				mistake_summary,
				lesson_summary
			)
		`)
		.eq('client_account_id', account.id)
		.order('close_time', { ascending: false });

	if (error) {
		return new Response(JSON.stringify({ message: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const filters = parsePortfolioFilters(url.searchParams);
	const filtered = applyPortfolioFilters(((trades ?? []) as unknown as Trade[]), filters);

	const rows = filtered.map((t: Trade) => [
		t.symbol,
		t.type,
		t.lot_size,
		t.open_price,
		t.close_price,
		t.open_time,
		t.close_time,
		t.profit,
		t.pips ?? '',
		t.commission,
		t.swap,
		t.sl ?? '',
		t.tp ?? '',
		t.position_id,
		getTradeReviewStatus(t),
		(t.trade_tag_assignments || [])
			.map((a: TradeTagAssignment) => a.trade_tags?.name)
			.filter(Boolean)
			.join('|')
	]);

	const csvContent = [EXPORT_COLUMNS, ...rows]
		.map((row) =>
			row.map((cell: string | number | null | undefined) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
		)
		.join('\n');

	const filename = `trades_export_${new Date().toISOString().slice(0, 10)}.csv`;

	return new Response('\uFEFF' + csvContent, {
		status: 200,
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
