import { createSupabaseServiceClient } from '$lib/server/supabase';

export interface ApiKeyGenResult {
	key: string;
	prefix: string;
	hash: string;
}

export interface ApiKeyAuth {
	userId: string;
	scopes: string[];
}

/** Generate a new API key with format "ibp_" + 32 random hex chars */
export function generateApiKey(): ApiKeyGenResult {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	const hex = Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	const key = `ibp_${hex}`;
	const prefix = key.slice(0, 8);
	return { key, prefix, hash: '' }; // hash filled async
}

/** SHA-256 hash a string using Web Crypto API */
export async function hashApiKey(key: string): Promise<string> {
	const encoded = new TextEncoder().encode(key);
	const digest = await crypto.subtle.digest('SHA-256', encoded);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/** Generate a key and compute its hash */
export async function createApiKey(): Promise<ApiKeyGenResult> {
	const result = generateApiKey();
	result.hash = await hashApiKey(result.key);
	return result;
}

/**
 * Verify an API key against the database.
 * Returns user ID and scopes if valid, null otherwise.
 * Uses service role client to bypass RLS (API keys auth is not session-based).
 */
export async function verifyApiKey(key: string): Promise<ApiKeyAuth | null> {
	if (!key || !key.startsWith('ibp_')) return null;

	const hash = await hashApiKey(key);
	const supabase = createSupabaseServiceClient();

	const { data, error } = await supabase
		.from('api_keys')
		.select('id, user_id, scopes, is_active, expires_at')
		.eq('key_hash', hash)
		.single();

	if (error || !data) return null;
	if (!data.is_active) return null;
	if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

	// Update last_used_at (fire-and-forget)
	supabase
		.from('api_keys')
		.update({ last_used_at: new Date().toISOString() })
		.eq('id', data.id)
		.then(() => {});

	return {
		userId: data.user_id,
		scopes: data.scopes
	};
}

/** Check if a scope is included in the granted scopes */
export function hasScope(grantedScopes: string[], requiredScope: string): boolean {
	return grantedScopes.includes(requiredScope);
}
