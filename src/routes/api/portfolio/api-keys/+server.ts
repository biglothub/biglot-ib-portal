import { json } from '@sveltejs/kit';
import { createApiKey, hashApiKey } from '$lib/server/apiKeys';
import { rateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

const VALID_SCOPES = ['trades:read', 'stats:read', 'account:read'];
const MAX_KEYS_PER_USER = 10;

export const GET: RequestHandler = async ({ locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { data: keys, error } = await locals.supabase
		.from('api_keys')
		.select('id, name, key_prefix, scopes, last_used_at, expires_at, is_active, created_at')
		.eq('user_id', profile.id)
		.order('created_at', { ascending: false });

	if (error) {
		return json({ error: 'Failed to fetch API keys' }, { status: 500 });
	}

	return json({ keys: keys ?? [] });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!(await rateLimit(`api-keys:create:${profile.id}`, 5, 60_000))) {
		return json({ error: 'Rate limit exceeded' }, { status: 429 });
	}

	const body = await request.json();
	const name = typeof body.name === 'string' ? body.name.trim() : '';
	if (!name || name.length < 1 || name.length > 100) {
		return json({ error: 'Name is required (1-100 characters)' }, { status: 400 });
	}

	// Validate scopes
	const scopes: string[] = Array.isArray(body.scopes)
		? body.scopes.filter((s: unknown) => typeof s === 'string' && VALID_SCOPES.includes(s as string))
		: ['trades:read', 'stats:read'];
	if (scopes.length === 0) {
		scopes.push('trades:read', 'stats:read');
	}

	// Optional expiry
	const expiresInDays = typeof body.expiresInDays === 'number' ? body.expiresInDays : null;
	const expiresAt =
		expiresInDays && expiresInDays > 0
			? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
			: null;

	// Check key limit
	const { count } = await locals.supabase
		.from('api_keys')
		.select('id', { count: 'exact', head: true })
		.eq('user_id', profile.id)
		.eq('is_active', true);

	if ((count ?? 0) >= MAX_KEYS_PER_USER) {
		return json({ error: `Maximum ${MAX_KEYS_PER_USER} active keys allowed` }, { status: 400 });
	}

	const keyData = await createApiKey();

	const { error } = await locals.supabase.from('api_keys').insert({
		user_id: profile.id,
		name,
		key_hash: keyData.hash,
		key_prefix: keyData.prefix,
		scopes,
		expires_at: expiresAt
	});

	if (error) {
		return json({ error: 'Failed to create API key' }, { status: 500 });
	}

	// Return the full key ONCE — it will never be shown again
	return json({
		key: keyData.key,
		prefix: keyData.prefix,
		name,
		scopes,
		expiresAt
	});
};

export const DELETE: RequestHandler = async ({ locals, request }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const id = typeof body.id === 'string' ? body.id : '';
	if (!id) {
		return json({ error: 'Key ID is required' }, { status: 400 });
	}

	// Deactivate (soft delete) — RLS ensures user can only update their own keys
	const { error } = await locals.supabase
		.from('api_keys')
		.update({ is_active: false })
		.eq('id', id)
		.eq('user_id', profile.id);

	if (error) {
		return json({ error: 'Failed to revoke key' }, { status: 500 });
	}

	return json({ success: true });
};
