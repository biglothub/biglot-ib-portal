import { redirect } from '@sveltejs/kit';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');

	if (code) {
		await locals.supabase.auth.exchangeCodeForSession(code);
	}

	// Get authenticated user
	const { data: { user } } = await locals.supabase.auth.getUser();
	if (!user) {
		throw redirect(303, '/auth/login');
	}

	const serviceClient = createSupabaseServiceClient();

	// Check if profile exists and get role
	const { data: profile } = await serviceClient
		.from('profiles')
		.select('role')
		.eq('id', user.id)
		.single();

	// Admin or Master IB — just redirect normally
	if (profile?.role === 'admin' || profile?.role === 'master_ib') {
		throw redirect(303, '/');
	}

	// Client role — check if they have approved client_accounts linked
	const userEmail = user.email;

	// Check if already a returning user (has linked accounts)
	const { data: linkedAccounts } = await serviceClient
		.from('client_accounts')
		.select('id')
		.eq('user_id', user.id)
		.limit(1);

	if (linkedAccounts && linkedAccounts.length > 0) {
		// Returning client — already linked
		throw redirect(303, '/');
	}

	// Try to link by email
	if (userEmail) {
		const { data: matchingAccounts } = await serviceClient
			.from('client_accounts')
			.select('id')
			.eq('client_email', userEmail)
			.eq('status', 'approved')
			.is('user_id', null);

		if (matchingAccounts && matchingAccounts.length > 0) {
			// Link all matching accounts to this user
			await serviceClient
				.from('client_accounts')
				.update({ user_id: user.id })
				.eq('client_email', userEmail)
				.eq('status', 'approved')
				.is('user_id', null);

			throw redirect(303, '/');
		}
	}

	// No matching accounts — unauthorized signup
	// Delete auth user (cascades to profile via FK)
	await serviceClient.auth.admin.deleteUser(user.id);

	// Sign out the session
	await locals.supabase.auth.signOut();

	throw redirect(303, '/auth/login?error=no_account');
};
