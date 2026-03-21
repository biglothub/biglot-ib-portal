import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import { rateLimit } from '$lib/server/rate-limit';
import { getTradeSession } from '$lib/portfolio';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Strip HTML tags to get plain text for search indexing */
function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Escape special characters that could break PostgREST filter syntax */
function escapePostgrestValue(str: string): string {
	return str.replace(/[%_\\]/g, c => '\\' + c).replace(/[,.()"']/g, '');
}

/** POST: CRUD operations for notebooks */
export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!rateLimit(`portfolio:notebook:${profile.id}`, 30, 60_000)) {
		return json({ message: 'คำขอมากเกินไป' }, { status: 429 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ message: 'ไม่พบบัญชีที่อนุมัติ' }, { status: 404 });
	}

	const body = await request.json();

	// ── Create / ensure system folders ──
	if (body.action === 'ensure_folders') {
		const systemFolders = [
			{ name: 'Trade Notes', system_type: 'trade_notes', icon: '📊', sort_order: 0 },
			{ name: 'Daily Journal', system_type: 'daily_journal', icon: '📅', sort_order: 1 },
			{ name: 'Sessions Recap', system_type: 'sessions', icon: '🔄', sort_order: 2 },
		];

		const { data: existing } = await locals.supabase
			.from('notebook_folders')
			.select('system_type')
			.eq('client_account_id', account.id)
			.eq('user_id', profile.id)
			.eq('type', 'system');

		const existingTypes = new Set((existing || []).map((f: any) => f.system_type));
		const toCreate = systemFolders.filter(f => !existingTypes.has(f.system_type));

		if (toCreate.length > 0) {
			await locals.supabase
				.from('notebook_folders')
				.insert(toCreate.map(f => ({
					client_account_id: account.id,
					user_id: profile.id,
					name: f.name,
					type: 'system',
					system_type: f.system_type,
					icon: f.icon,
					sort_order: f.sort_order
				})));
		}

		const { data: folders } = await locals.supabase
			.from('notebook_folders')
			.select('*')
			.eq('client_account_id', account.id)
			.eq('user_id', profile.id)
			.order('sort_order', { ascending: true });

		return json({ folders: folders || [] });
	}

	// ── Create folder ──
	if (body.action === 'create_folder') {
		const { data, error } = await locals.supabase
			.from('notebook_folders')
			.insert({
				client_account_id: account.id,
				user_id: profile.id,
				name: body.name || 'New Folder',
				type: 'custom',
				icon: body.icon || '📁',
				sort_order: body.sort_order ?? 99
			})
			.select()
			.single();

		if (error) return json({ message: error.message }, { status: 500 });
		return json({ success: true, folder: data });
	}

	// ── Delete folder ──
	if (body.action === 'delete_folder') {
		// Move notes to unfiled, then delete folder
		await locals.supabase
			.from('notebook_notes')
			.update({ folder_id: null })
			.eq('folder_id', body.folder_id)
			.eq('user_id', profile.id);

		const { error } = await locals.supabase
			.from('notebook_folders')
			.delete()
			.eq('id', body.folder_id)
			.eq('user_id', profile.id)
			.eq('type', 'custom'); // prevent deleting system folders

		if (error) return json({ message: error.message }, { status: 500 });
		return json({ success: true });
	}

	// ── Create note ──
	if (body.action === 'create_note') {
		const { data, error } = await locals.supabase
			.from('notebook_notes')
			.insert({
				client_account_id: account.id,
				user_id: profile.id,
				folder_id: body.folder_id || null,
				title: body.title || '',
				content: body.content || '',
				content_plain: stripHtml(body.content || ''),
				linked_trade_id: body.linked_trade_id || null,
				linked_date: body.linked_date || null,
				linked_session: body.linked_session || null,
			})
			.select()
			.single();

		if (error) return json({ message: error.message }, { status: 500 });
		return json({ success: true, note: data });
	}

	// ── Update note ──
	if (body.action === 'update_note') {
		const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
		if (body.title !== undefined) updates.title = body.title;
		if (body.content !== undefined) {
			updates.content = body.content;
			updates.content_plain = stripHtml(body.content);
		}
		if (body.folder_id !== undefined) updates.folder_id = body.folder_id;
		if (body.is_pinned !== undefined) updates.is_pinned = body.is_pinned;

		const { data, error } = await locals.supabase
			.from('notebook_notes')
			.update(updates)
			.eq('id', body.note_id)
			.eq('user_id', profile.id)
			.select()
			.single();

		if (error) return json({ message: error.message }, { status: 500 });
		return json({ success: true, note: data });
	}

	// ── Soft delete note ──
	if (body.action === 'delete_note') {
		const { error } = await locals.supabase
			.from('notebook_notes')
			.update({ is_deleted: true, deleted_at: new Date().toISOString() })
			.eq('id', body.note_id)
			.eq('user_id', profile.id);

		if (error) return json({ message: error.message }, { status: 500 });
		return json({ success: true });
	}

	// ── Restore note ──
	if (body.action === 'restore_note') {
		const { error } = await locals.supabase
			.from('notebook_notes')
			.update({ is_deleted: false, deleted_at: null })
			.eq('id', body.note_id)
			.eq('user_id', profile.id);

		if (error) return json({ message: error.message }, { status: 500 });
		return json({ success: true });
	}

	// ── Search notes ──
	if (body.action === 'search') {
		const query = body.query?.trim();
		if (!query) return json({ notes: [] });

		const safeQuery = escapePostgrestValue(query);
		const { data } = await locals.supabase
			.from('notebook_notes')
			.select('id, title, content_plain, folder_id, created_at, updated_at')
			.eq('client_account_id', account.id)
			.eq('user_id', profile.id)
			.eq('is_deleted', false)
			.or(`title.ilike.%${safeQuery}%,content_plain.ilike.%${safeQuery}%`)
			.order('updated_at', { ascending: false })
			.limit(20);

		return json({ notes: data || [] });
	}

	// ── Generate session recap ──
	if (body.action === 'generate_session_recap') {
		const date = body.date as string | undefined;
		if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			return json({ message: 'รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)' }, { status: 400 });
		}

		// Find Sessions Recap folder
		const { data: sessionsFolder } = await locals.supabase
			.from('notebook_folders')
			.select('id')
			.eq('client_account_id', account.id)
			.eq('user_id', profile.id)
			.eq('system_type', 'sessions')
			.single();

		if (!sessionsFolder) {
			return json({ message: 'ไม่พบโฟลเดอร์ Sessions Recap' }, { status: 404 });
		}

		// Check if recap already exists for this date
		const { data: existingNote } = await locals.supabase
			.from('notebook_notes')
			.select('id')
			.eq('folder_id', sessionsFolder.id)
			.eq('user_id', profile.id)
			.eq('linked_date', date)
			.eq('is_deleted', false)
			.maybeSingle();

		if (existingNote) {
			return json({ message: 'มี Recap ของวันนี้แล้ว', existingId: existingNote.id }, { status: 409 });
		}

		// Fetch trades for the date (using Thai timezone: date boundary = UTC 17:00 prev day to UTC 17:00 this day)
		const dayStart = `${date}T00:00:00+07:00`;
		const dayEnd = `${date}T23:59:59+07:00`;

		const { data: trades } = await locals.supabase
			.from('trades')
			.select('id, symbol, type, lot_size, open_price, close_price, open_time, close_time, profit, pips, commission, swap')
			.eq('client_account_id', account.id)
			.gte('close_time', dayStart)
			.lte('close_time', dayEnd)
			.order('close_time', { ascending: true });

		const allTrades = trades || [];

		if (allTrades.length === 0) {
			return json({ message: 'ไม่พบเทรดในวันที่เลือก' }, { status: 404 });
		}

		// Group trades by session
		const sessionMap = new Map<string, typeof allTrades>();
		for (const trade of allTrades) {
			const session = getTradeSession(trade.close_time);
			const list = sessionMap.get(session) || [];
			list.push(trade);
			sessionMap.set(session, list);
		}

		const sessionLabels: Record<string, string> = {
			asian: 'เซสชัน Asian (00:00–08:00 UTC)',
			london: 'เซสชัน London (08:00–15:00 UTC)',
			newyork: 'เซสชัน New York (15:00–24:00 UTC)'
		};

		// Build HTML recap
		const totalProfit = allTrades.reduce((s, t) => s + Number(t.profit || 0), 0);
		const totalWins = allTrades.filter(t => Number(t.profit || 0) > 0).length;
		const winRate = allTrades.length > 0 ? ((totalWins / allTrades.length) * 100).toFixed(1) : '0';

		let html = `<h1>สรุปเซสชัน — ${date}</h1>`;
		html += `<p><strong>รวม:</strong> ${allTrades.length} เทรด | P&L: $${totalProfit.toFixed(2)} | Win Rate: ${winRate}%</p>`;
		html += `<hr>`;

		for (const sessionKey of ['asian', 'london', 'newyork'] as const) {
			const sessionTrades = sessionMap.get(sessionKey);
			if (!sessionTrades || sessionTrades.length === 0) {
				html += `<h2>${sessionLabels[sessionKey]}</h2>`;
				html += `<p><em>ไม่มีเทรด</em></p>`;
				continue;
			}

			const sessionProfit = sessionTrades.reduce((s, t) => s + Number(t.profit || 0), 0);
			const sessionWins = sessionTrades.filter(t => Number(t.profit || 0) > 0).length;
			const sessionWinRate = ((sessionWins / sessionTrades.length) * 100).toFixed(1);

			html += `<h2>${sessionLabels[sessionKey]}</h2>`;
			html += `<p><strong>${sessionTrades.length}</strong> เทรด | P&L: <strong>$${sessionProfit.toFixed(2)}</strong> | Win Rate: ${sessionWinRate}%</p>`;
			html += `<ul>`;
			for (const t of sessionTrades) {
				const pnlColor = Number(t.profit || 0) >= 0 ? 'green' : 'red';
				const closeTimeStr = t.close_time ? new Date(t.close_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }) + ' UTC' : '';
				html += `<li><strong>${t.symbol}</strong> ${t.type} ${t.lot_size} lots — P&L: $${Number(t.profit || 0).toFixed(2)} ${t.pips != null ? `(${Number(t.pips).toFixed(1)} pips)` : ''} @ ${closeTimeStr}</li>`;
			}
			html += `</ul>`;
		}

		const title = `สรุปเซสชัน — ${date}`;
		const contentPlain = stripHtml(html);

		const { data: note, error } = await locals.supabase
			.from('notebook_notes')
			.insert({
				client_account_id: account.id,
				user_id: profile.id,
				folder_id: sessionsFolder.id,
				title,
				content: html,
				content_plain: contentPlain,
				linked_date: date,
				linked_session: null
			})
			.select()
			.single();

		if (error) return json({ message: error.message }, { status: 500 });
		return json({ success: true, note });
	}

	return json({ message: 'การกระทำไม่ถูกต้อง' }, { status: 400 });
};
