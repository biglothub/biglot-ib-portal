import { json, error } from '@sveltejs/kit';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import { rateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'admin') throw error(403, 'Forbidden');

	const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
	if (!rateLimit(`admin:approve:${ip}`, 30, 60_000)) {
		throw error(429, 'Too many requests');
	}

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

	// Notify admin that client can log in with Google
	if (newStatus === 'approved' && account.client_email) {
		await supabase.from('notifications').insert({
			user_id: profile.id,
			type: 'client_approved',
			title: `ลูกค้า ${account.client_name} ได้รับอนุมัติแล้ว`,
			body: `ลูกค้าสามารถล็อกอินด้วย Google (${account.client_email})`,
			metadata: { client_account_id, client_email: account.client_email }
		});
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
