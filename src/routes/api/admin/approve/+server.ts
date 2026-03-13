import { json, error } from '@sveltejs/kit';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import { createClientUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'admin') throw error(403, 'Forbidden');

	const { client_account_id, action, reason } = await request.json();

	if (!client_account_id || !['approved', 'rejected', 'suspended', 'reactivated'].includes(action)) {
		throw error(400, 'Invalid request');
	}

	const supabase = createSupabaseServiceClient();

	const { data: account } = await supabase
		.from('client_accounts')
		.select('*, master_ibs(user_id)')
		.eq('id', client_account_id)
		.single();

	if (!account) throw error(404, 'Account not found');

	const previousStatus = account.status;

	const updateData: Record<string, unknown> = {
		status: action,
		reviewed_at: new Date().toISOString(),
		reviewed_by: profile.id
	};

	if (action === 'rejected') {
		updateData.rejection_reason = reason || null;
	}

	const { error: updateError } = await supabase
		.from('client_accounts')
		.update(updateData)
		.eq('id', client_account_id);

	if (updateError) throw error(500, updateError.message);

	// Log
	await supabase.from('approval_log').insert({
		client_account_id,
		action,
		performed_by: profile.id,
		previous_status: previousStatus,
		new_status: action,
		reason: reason || null
	});

	// If approved + has email + no user_id yet → create client login
	if (action === 'approved' && account.client_email && !account.user_id) {
		try {
			const { tempPassword } = await createClientUser({
				email: account.client_email,
				full_name: account.client_name,
				client_account_id
			});

			// Notify admin about generated password
			await supabase.from('notifications').insert({
				user_id: profile.id,
				type: 'client_approved',
				title: `Client login created: ${account.client_name}`,
				body: `Email: ${account.client_email} | Temp password: ${tempPassword}`
			});
		} catch (e: any) {
			console.error('Failed to create client user:', e);
		}
	}

	// Notify Master IB
	const ibUserId = account.master_ibs?.user_id;
	if (ibUserId) {
		await supabase.from('notifications').insert({
			user_id: ibUserId,
			type: action === 'approved' ? 'client_approved' : 'client_rejected',
			title: action === 'approved'
				? `ลูกค้า ${account.client_name} ได้รับอนุมัติแล้ว`
				: `ลูกค้า ${account.client_name} ถูกปฏิเสธ`,
			body: reason || null,
			metadata: { client_account_id }
		});
	}

	return json({ success: true });
};
