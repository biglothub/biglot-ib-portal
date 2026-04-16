import { error, redirect } from '@sveltejs/kit';
import { getAuthMfaState, getRoleRedirect } from '$lib/server/mfa';
import { normalizeEmail } from '$lib/server/clientAccounts';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');

	if (code) {
		const { error: exchangeError } = await locals.supabase.auth.exchangeCodeForSession(code);
		if (exchangeError) {
			throw redirect(303, '/auth/login?error=google_auth_failed');
		}
	}

	// Get authenticated user
	const { data: { user }, error: userError } = await locals.supabase.auth.getUser();
	if (userError) {
		throw redirect(303, '/auth/login?error=google_auth_failed');
	}
	if (!user) {
		throw redirect(303, '/auth/login');
	}

	const serviceClient = createSupabaseServiceClient();
	const userEmail = normalizeEmail(user.email);
	const finishLoginRedirect = async (role?: 'admin' | 'master_ib' | 'client' | null): Promise<never> => {
		const mfaState = await getAuthMfaState(locals.supabase);
		if (mfaState.needsMfa) {
			throw redirect(303, '/auth/mfa');
		}

		throw redirect(303, getRoleRedirect(role));
	};

	const rejectUnauthorizedUser = async (): Promise<never> => {
		const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id);
		if (deleteError) {
			throw error(500, deleteError.message);
		}

		const { error: signOutError } = await locals.supabase.auth.signOut();
		if (signOutError) {
			throw error(500, signOutError.message);
		}

		throw redirect(303, '/auth/login?error=no_account');
	};

	// Check if profile exists and get role
	const { data: profile, error: profileError } = await serviceClient
		.from('profiles')
		.select('role')
		.eq('id', user.id)
		.maybeSingle();

	if (profileError) {
		throw error(500, profileError.message);
	}

	// Admin or Master IB — just redirect normally
	if (profile?.role === 'admin' || profile?.role === 'master_ib') {
		return finishLoginRedirect(profile.role);
	}

	// Check if already a returning user (has linked accounts)
	const { data: linkedAccount, error: linkedError } = await serviceClient
		.from('client_accounts')
		.select('id')
		.eq('user_id', user.id)
		.order('submitted_at', { ascending: true })
		.order('id', { ascending: true })
		.limit(1)
		.maybeSingle();

	if (linkedError) {
		throw error(500, linkedError.message);
	}

	if (linkedAccount) {
		return finishLoginRedirect(profile?.role ?? 'client');
	}

	if (!userEmail) {
		return rejectUnauthorizedUser();
	}

	const { data: matchingAccount, error: matchingError } = await serviceClient
		.from('client_accounts')
		.select('id')
		.eq('client_email', userEmail)
		.eq('status', 'approved')
		.is('user_id', null)
		.order('submitted_at', { ascending: true })
		.order('id', { ascending: true })
		.limit(1)
		.maybeSingle();

	if (matchingError) {
		throw error(500, matchingError.message);
	}

	if (matchingAccount) {
		const { error: linkError } = await serviceClient
			.from('client_accounts')
			.update({
				user_id: user.id,
				updated_at: new Date().toISOString()
			})
			.eq('id', matchingAccount.id)
			.is('user_id', null);

		if (linkError) {
			throw error(500, linkError.message);
		}

		return finishLoginRedirect('client');
	}

	return rejectUnauthorizedUser();
};
