import { accountsCache, LAYOUT_CACHE_TTL_MS, type AccountRow } from '$lib/server/layout-cache';
import type { SupabaseClient } from '@supabase/supabase-js';

const ACCOUNT_SELECT = 'id, client_name, mt5_account_id, mt5_server, status, last_synced_at' as const;

export interface AccessiblePortfolioAccountOptions {
	userId: string;
	requestedAccountId?: string | null;
	selectedAccountId?: string | null;
}

function normalizeAccountId(accountId?: string | null): string | null {
	const trimmed = accountId?.trim();
	return trimmed ? trimmed : null;
}

async function loadApprovedAccounts(supabase: SupabaseClient, userId: string): Promise<AccountRow[]> {
	const cached = accountsCache.get(userId);
	if (cached && Date.now() < cached.expiresAt) {
		return cached.data;
	}

	const { data } = await supabase
		.from('client_accounts')
		.select(ACCOUNT_SELECT)
		.eq('user_id', userId)
		.eq('status', 'approved')
		.order('created_at', { ascending: true });

	const accounts = (data || []) as AccountRow[];
	accountsCache.set(userId, { data: accounts, expiresAt: Date.now() + LAYOUT_CACHE_TTL_MS });
	return accounts;
}

export async function getAccessiblePortfolioAccount(
	supabase: SupabaseClient,
	options: AccessiblePortfolioAccountOptions
): Promise<AccountRow | null> {
	const requestedAccountId = normalizeAccountId(options.requestedAccountId);
	const selectedAccountId = normalizeAccountId(options.selectedAccountId);
	const candidates = [...new Set([requestedAccountId, selectedAccountId].filter(Boolean))] as string[];

	const accounts = await loadApprovedAccounts(supabase, options.userId);
	if (candidates.length > 0) {
		const cachedMatch = candidates
			.map((accountId) => accounts.find((account) => account.id === accountId))
			.find((account): account is AccountRow => !!account);
		if (cachedMatch) return cachedMatch;

		const { data: validated } = await supabase
			.from('client_accounts')
			.select(ACCOUNT_SELECT)
			.eq('user_id', options.userId)
			.eq('status', 'approved')
			.in('id', candidates)
			.order('created_at', { ascending: true });

		const validatedAccounts = (validated || []) as AccountRow[];
		const validatedMatch = candidates
			.map((accountId) => validatedAccounts.find((account) => account.id === accountId))
			.find((account): account is AccountRow => !!account);
		if (validatedMatch) return validatedMatch;
	}

	return accounts[0] ?? null;
}

export async function getApprovedPortfolioAccount(supabase: SupabaseClient) {
	const { data: account } = await supabase
		.from('client_accounts')
		.select(ACCOUNT_SELECT)
		.eq('status', 'approved')
		.maybeSingle();

	return account as AccountRow | null;
}
