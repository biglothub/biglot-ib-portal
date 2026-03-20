import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const parentData = await parent();
	const { account, userId } = parentData;
	const profile = locals.profile;

	if (!account || !profile || !userId) {
		return { folders: [], notes: [], deletedNotes: [] };
	}

	// Ensure system folders exist (skip in admin read-only view)
	if (!parentData.isAdminView) {
		await fetch_internal_ensure_folders(locals.supabase, account.id, userId);
	}

	const [foldersRes, notesRes, deletedRes] = await Promise.all([
		locals.supabase
			.from('notebook_folders')
			.select('*')
			.eq('client_account_id', account.id)
			.eq('user_id', userId)
			.order('sort_order', { ascending: true }),
		locals.supabase
			.from('notebook_notes')
			.select('id, title, content, folder_id, linked_trade_id, linked_date, linked_session, is_pinned, created_at, updated_at')
			.eq('client_account_id', account.id)
			.eq('user_id', userId)
			.eq('is_deleted', false)
			.order('is_pinned', { ascending: false })
			.order('updated_at', { ascending: false }),
		locals.supabase
			.from('notebook_notes')
			.select('id, title, folder_id, deleted_at, updated_at')
			.eq('client_account_id', account.id)
			.eq('user_id', userId)
			.eq('is_deleted', true)
			.order('deleted_at', { ascending: false })
			.limit(20)
	]);

	return {
		folders: foldersRes.data || [],
		notes: notesRes.data || [],
		deletedNotes: deletedRes.data || []
	};
};

/** Create system folders if they don't exist */
async function fetch_internal_ensure_folders(supabase: any, accountId: string, userId: string) {
	const systemFolders = [
		{ name: 'Trade Notes', system_type: 'trade_notes', icon: '📊', sort_order: 0 },
		{ name: 'Daily Journal', system_type: 'daily_journal', icon: '📅', sort_order: 1 },
		{ name: 'Sessions Recap', system_type: 'sessions', icon: '🔄', sort_order: 2 },
	];

	const { data: existing } = await supabase
		.from('notebook_folders')
		.select('system_type')
		.eq('client_account_id', accountId)
		.eq('user_id', userId)
		.eq('type', 'system');

	const existingTypes = new Set((existing || []).map((f: any) => f.system_type));
	const toCreate = systemFolders.filter(f => !existingTypes.has(f.system_type));

	if (toCreate.length > 0) {
		await supabase
			.from('notebook_folders')
			.insert(toCreate.map(f => ({
				client_account_id: accountId,
				user_id: userId,
				name: f.name,
				type: 'system',
				system_type: f.system_type,
				icon: f.icon,
				sort_order: f.sort_order
			})));
	}
}
