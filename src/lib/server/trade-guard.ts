import type { SupabaseClient } from '@supabase/supabase-js';
import { json } from '@sveltejs/kit';

/**
 * Verify that a trade belongs to the authenticated user's account.
 * Prevents IDOR attacks by checking trade → client_account → user_id chain.
 */
export async function verifyTradeOwnership(
	supabase: SupabaseClient,
	tradeId: string,
	userId: string
): Promise<{ ok: true; accountId: string } | { ok: false; response: Response }> {
	const { data: trade, error } = await supabase
		.from('trades')
		.select('client_account_id')
		.eq('id', tradeId)
		.single();

	if (error || !trade) {
		return { ok: false, response: json({ message: 'Trade not found' }, { status: 404 }) };
	}

	const { data: account, error: accError } = await supabase
		.from('client_accounts')
		.select('user_id')
		.eq('id', trade.client_account_id)
		.single();

	if (accError || !account || account.user_id !== userId) {
		return { ok: false, response: json({ message: 'Forbidden' }, { status: 403 }) };
	}

	return { ok: true, accountId: trade.client_account_id };
}

/**
 * Validate that a URL uses a safe protocol (http/https only).
 * Blocks javascript:, data:, vbscript: and other dangerous protocols.
 */
export function isSafeUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		return ['http:', 'https:'].includes(parsed.protocol);
	} catch {
		return false;
	}
}
