import type { SupabaseClient } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'master_ib' | 'client';
export type AuthLevel = 'aal1' | 'aal2' | null;

type TotpFactor = {
	id: string;
	friendly_name?: string;
	factor_type: 'totp';
	status: 'verified' | 'unverified';
	created_at: string;
	updated_at: string;
	last_challenged_at?: string;
};

export type AuthMfaState = {
	currentLevel: AuthLevel;
	nextLevel: AuthLevel;
	enabled: boolean;
	needsMfa: boolean;
	factorId: string | null;
	friendlyName: string | null;
	hasUnverifiedFactor: boolean;
};

export function getRoleRedirect(role: AppRole | null | undefined): string {
	if (role === 'admin') return '/admin';
	if (role === 'master_ib') return '/ib';
	return '/portfolio';
}

export function sanitizeReturnTo(returnTo: string | null | undefined, fallback: string): string {
	if (!returnTo || !returnTo.startsWith('/')) return fallback;
	if (returnTo.startsWith('//')) return fallback;
	if (returnTo.startsWith('/auth/login') || returnTo.startsWith('/auth/callback') || returnTo.startsWith('/auth/mfa')) {
		return fallback;
	}

	return returnTo;
}

export function buildReturnTo(pathname: string, search: string): string {
	return `${pathname}${search}`;
}

export async function getAuthMfaState(supabase: SupabaseClient): Promise<AuthMfaState> {
	const [{ data: factorData, error: factorError }, { data: aalData, error: aalError }] = await Promise.all([
		supabase.auth.mfa.listFactors(),
		supabase.auth.mfa.getAuthenticatorAssuranceLevel()
	]);

	if (factorError) throw factorError;
	if (aalError) throw aalError;

	const totpFactors = (factorData?.all ?? []).filter((factor): factor is TotpFactor => factor.factor_type === 'totp');
	const verifiedFactor = totpFactors.find((factor) => factor.status === 'verified') ?? null;
	const hasUnverifiedFactor = totpFactors.some((factor) => factor.status === 'unverified');
	const currentLevel = aalData?.currentLevel ?? null;
	const nextLevel = aalData?.nextLevel ?? null;
	const enabled = verifiedFactor !== null;
	const needsMfa = enabled && currentLevel !== 'aal2' && nextLevel === 'aal2';

	return {
		currentLevel,
		nextLevel,
		enabled,
		needsMfa,
		factorId: verifiedFactor?.id ?? null,
		friendlyName: verifiedFactor?.friendly_name ?? null,
		hasUnverifiedFactor
	};
}
