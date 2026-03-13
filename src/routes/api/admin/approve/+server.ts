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

	// Map action to valid client_accounts.status
	// 'reactivated' means re-approving a suspended account
	const statusMap: Record<string, string> = {
		approved: 'approved',
		rejected: 'rejected',
		suspended: 'suspended',
		reactivated: 'approved'
	};
	const newStatus = statusMap[action];

	const updateData: Record<string, unknown> = {
		status: newStatus,
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
		new_status: newStatus,
		reason: reason || null
	});

	// If approved + has email + no user_id yet → create client login
	if (newStatus === 'approved' && account.client_email && !account.user_id) {
		try {
			const { tempPassword } = await createClientUser({
				email: account.client_email,
				full_name: account.client_name,
				client_account_id
			});

			// Notify admin that client login was created
			await supabase.from('notifications').insert({
				user_id: profile.id,
				type: 'client_approved',
				title: `Client login created: ${account.client_name}`,
				body: `Email: ${account.client_email} | กรุณาแจ้งลูกค้าให้ตั้งรหัสผ่านผ่านหน้า Forgot Password`,
				metadata: { client_account_id, client_email: account.client_email }
			});
		} catch (e: any) {
			console.error('Failed to create client user:', e);
		}
	}

	// Notify Master IB
	const ibUserId = account.master_ibs?.user_id;
	if (ibUserId) {
		const notifType = newStatus === 'approved' ? 'client_approved'
			: action === 'suspended' ? 'client_suspended'
			: 'client_rejected';
		const notifTitle = action === 'reactivated'
			? `ลูกค้า ${account.client_name} ถูกเปิดใช้งานอีกครั้ง`
			: newStatus === 'approved'
			? `ลูกค้า ${account.client_name} ได้รับอนุมัติแล้ว`
			: action === 'suspended'
			? `ลูกค้า ${account.client_name} ถูกระงับ`
			: `ลูกค้า ${account.client_name} ถูกปฏิเสธ`;

		await supabase.from('notifications').insert({
			user_id: ibUserId,
			type: notifType,
			title: notifTitle,
			body: reason || null,
			metadata: { client_account_id }
		});
	}

	return json({ success: true });
};
