import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import { rateLimit } from '$lib/server/rate-limit';
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
		return json({ message: 'Forbidden' }, { status: 403 });
	}

	if (!rateLimit(`portfolio:notebook:${profile.id}`, 30, 60_000)) {
		return json({ message: 'Too many requests' }, { status: 429 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ message: 'No approved account' }, { status: 404 });
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

	return json({ message: 'Unknown action' }, { status: 400 });
};
