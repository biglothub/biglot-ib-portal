import { getAuthMfaState } from '$lib/server/mfa';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		return {
			provider: 'unknown' as const,
			lastSignIn: null,
			mfa: {
				enabled: false,
				factorId: null,
				friendlyName: null,
				currentLevel: null,
				needsMfa: false,
				hasUnverifiedFactor: false
			}
		};
	}

	// Determine auth provider
	const provider = user.app_metadata?.provider || 'email';
	const lastSignIn = user.last_sign_in_at || null;
	const mfaState = await getAuthMfaState(locals.supabase);

	return {
		provider,
		lastSignIn,
		mfa: {
			enabled: mfaState.enabled,
			factorId: mfaState.factorId,
			friendlyName: mfaState.friendlyName,
			currentLevel: mfaState.currentLevel,
			needsMfa: mfaState.needsMfa,
			hasUnverifiedFactor: mfaState.hasUnverifiedFactor
		}
	};
};
