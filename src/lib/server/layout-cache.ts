import type { ClientAccount, TradeTag } from '$lib/types';

// ── Process-level caches for layout queries ────────────────────────────
// These run on EVERY navigation but rarely change. Cache them in-process.
export const LAYOUT_CACHE_TTL_MS = 60_000; // 1 minute

export type AccountRow = Pick<ClientAccount, 'id' | 'client_name' | 'mt5_account_id' | 'mt5_server' | 'status' | 'last_synced_at'>;

export const accountsCache = new Map<string, { data: AccountRow[]; expiresAt: number }>();
export const tagsCache = new Map<string, { data: TradeTag[]; expiresAt: number }>();
export const bridgeCache = new Map<string, { data: { status: string | null; last_heartbeat: string | null } | null; expiresAt: number }>();

/** Called from API endpoints when accounts/tags/bridge change */
export function invalidateLayoutCache(userId?: string): void {
	if (userId) {
		accountsCache.delete(userId);
		tagsCache.delete(userId);
	} else {
		accountsCache.clear();
		tagsCache.clear();
	}
	bridgeCache.clear();
}
