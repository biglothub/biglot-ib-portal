import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) return { provider: 'unknown' as const, lastSignIn: null };

	// Determine auth provider
	const provider = user.app_metadata?.provider || 'email';
	const lastSignIn = user.last_sign_in_at || null;

	return {
		provider,
		lastSignIn
	};
};
