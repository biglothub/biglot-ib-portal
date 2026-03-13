import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || (profile.role !== 'master_ib' && profile.role !== 'admin')) {
		throw error(403, 'Forbidden');
	}

	const body = await request.json();
	const { client_name, client_email, client_phone, mt5_account_id, mt5_investor_password, mt5_server } = body;

	if (!client_name || !mt5_account_id || !mt5_investor_password || !mt5_server) {
		throw error(400, 'Missing required fields');
	}

	// Get master_ib_id
	const { data: ib } = await locals.supabase
		.from('master_ibs')
		.select('id')
		.eq('user_id', profile.id)
		.single();

	if (!ib) throw error(404, 'IB profile not found');

	// Insert client account
	const { data: account, error: insertError } = await locals.supabase
		.from('client_accounts')
		.insert({
			master_ib_id: ib.id,
			client_name,
			client_email: client_email || null,
			client_phone: client_phone || null,
			mt5_account_id,
			mt5_investor_password,
			mt5_server,
			status: 'pending'
		})
		.select()
		.single();

	if (insertError) {
		if (insertError.code === '23505') {
			throw error(409, 'MT5 account นี้มีอยู่ในระบบแล้ว');
		}
		throw error(500, insertError.message);
	}

	// Log
	await locals.supabase.from('approval_log').insert({
		client_account_id: account.id,
		action: 'submitted',
		performed_by: profile.id
	});

	return json({ success: true, account });
};
