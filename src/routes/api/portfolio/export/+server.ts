import JSZip from 'jszip';
import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import { rateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

function toCSV(rows: Record<string, unknown>[]): string {
	if (rows.length === 0) return '';
	const headers = Object.keys(rows[0]);
	const escape = (v: unknown): string => {
		if (v === null || v === undefined) return '';
		const s = String(v);
		if (s.includes(',') || s.includes('"') || s.includes('\n')) {
			return '"' + s.replace(/"/g, '""') + '"';
		}
		return s;
	};
	const lines = [
		headers.join(','),
		...rows.map((row) => headers.map((h) => escape(row[h])).join(','))
	];
	return lines.join('\n');
}

export const GET: RequestHandler = async ({ locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return new Response(JSON.stringify({ message: 'ไม่ได้รับอนุญาต' }), { status: 403 });
	}

	// Rate limit: 1 export per 60 seconds per user
	if (!(await rateLimit(`portfolio:export:${profile.id}`, 1, 60_000))) {
		return new Response(JSON.stringify({ message: 'Too many requests — wait 60 seconds before exporting again' }), { status: 429 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return new Response(JSON.stringify({ message: 'No approved account' }), { status: 404 });
	}

	const accountId = account.id;
	const userId = profile.id;

	// Fetch all data in parallel
	const [tradesRes, journalsRes, dailyStatsRes, playbooksRes, checklistRes] = await Promise.allSettled([
		locals.supabase
			.from('trades')
			.select('id, client_account_id, symbol, type, lot_size, open_price, close_price, open_time, close_time, profit, sl, tp, position_id, pips, commission, swap, created_at')
			.eq('client_account_id', accountId)
			.order('close_time', { ascending: false }),
		locals.supabase
			.from('daily_journal')
			.select('*')
			.eq('client_account_id', accountId)
			.eq('user_id', userId)
			.order('date', { ascending: true }),
		locals.supabase
			.from('daily_stats')
			.select('*')
			.eq('client_account_id', accountId)
			.order('date', { ascending: true }),
		locals.supabase
			.from('playbooks')
			.select('id, name, description, entry_criteria, exit_criteria, risk_management, notes, is_active, created_at, updated_at')
			.eq('client_account_id', accountId)
			.eq('user_id', userId)
			.order('sort_order', { ascending: true }),
		locals.supabase
			.from('checklist_entries')
			.select('*')
			.eq('client_account_id', accountId)
			.eq('user_id', userId)
			.order('date', { ascending: true })
	]);

	const trades = (tradesRes.status === 'fulfilled' ? tradesRes.value.data : null) ?? [];
	const journals = (journalsRes.status === 'fulfilled' ? journalsRes.value.data : null) ?? [];
	const dailyStats = (dailyStatsRes.status === 'fulfilled' ? dailyStatsRes.value.data : null) ?? [];
	const playbooks = (playbooksRes.status === 'fulfilled' ? playbooksRes.value.data : null) ?? [];
	const checklistEntries = (checklistRes.status === 'fulfilled' ? checklistRes.value.data : null) ?? [];

	const exportDate = new Date().toISOString().slice(0, 10);

	const readme = `IB-Portal Data Export
Exported: ${new Date().toISOString()}
User: ${profile.email}

Files:
- trades.json / trades.csv — All trades
- journals.json / journals.csv — Daily journal entries
- daily_stats.json / daily_stats.csv — Daily performance stats
- playbooks.json — Trading playbooks/strategies
- checklist_entries.json — Daily checklist completions

For support: contact your IB
`;

	const zip = new JSZip();
	const data = zip.folder('data')!;

	data.file('trades.json', JSON.stringify(trades, null, 2));
	data.file('trades.csv', toCSV(trades as Record<string, unknown>[]));
	data.file('journals.json', JSON.stringify(journals, null, 2));
	data.file('journals.csv', toCSV(journals as Record<string, unknown>[]));
	data.file('daily_stats.json', JSON.stringify(dailyStats, null, 2));
	data.file('daily_stats.csv', toCSV(dailyStats as Record<string, unknown>[]));
	data.file('playbooks.json', JSON.stringify(playbooks, null, 2));
	data.file('checklist_entries.json', JSON.stringify(checklistEntries, null, 2));
	zip.file('README.txt', readme);

	const buffer = await zip.generateAsync({ type: 'arraybuffer' });

	return new Response(buffer, {
		status: 200,
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="ib-portal-export-${exportDate}.zip"`,
			'Cache-Control': 'no-store'
		}
	});
};
