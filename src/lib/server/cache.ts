import { Redis } from '@upstash/redis';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

let redis: Redis | null = null;
let initialized = false;

function getRedis(): Redis | null {
	if (initialized) return redis;
	initialized = true;

	const url = env.UPSTASH_REDIS_REST_URL;
	const token = env.UPSTASH_REDIS_REST_TOKEN;

	if (url && token) {
		try {
			redis = new Redis({ url, token });
			if (dev) console.log('[cache] Using Upstash Redis for caching');
		} catch (e) {
			console.warn('[cache] Failed to init Upstash Redis, caching disabled:', e);
			redis = null;
		}
	} else {
		if (dev) console.log('[cache] No UPSTASH_REDIS_REST_URL/TOKEN configured, using in-memory cache');
	}

	return redis;
}

// ── In-memory fallback cache ────────────────────────────────────────────
// Used when Redis is not configured. Simple Map with TTL support.
const memCache = new Map<string, { value: string; expiresAt: number }>();
const MEM_MAX_ENTRIES = 200;

function memGet(key: string): string | null {
	const entry = memCache.get(key);
	if (!entry) return null;
	if (Date.now() > entry.expiresAt) {
		memCache.delete(key);
		return null;
	}
	return entry.value;
}

function memSet(key: string, value: string, ttlSeconds: number): void {
	// Evict oldest entries if cache is full
	if (memCache.size >= MEM_MAX_ENTRIES) {
		const firstKey = memCache.keys().next().value;
		if (firstKey !== undefined) memCache.delete(firstKey);
	}
	memCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function memDel(key: string): void {
	memCache.delete(key);
}

function memDelPattern(prefix: string): number {
	let count = 0;
	for (const k of [...memCache.keys()]) {
		if (k.startsWith(prefix)) {
			memCache.delete(k);
			count++;
		}
	}
	return count;
}

// ── Public API ──────────────────────────────────────────────────────────

export async function getCache<T>(key: string): Promise<T | null> {
	const r = getRedis();

	if (!r) {
		// In-memory fallback
		const raw = memGet(key);
		if (raw == null) {
			if (dev) console.log(`[cache:mem] MISS ${key}`);
			return null;
		}
		if (dev) console.log(`[cache:mem] HIT ${key}`);
		return JSON.parse(raw) as T;
	}

	try {
		const raw = await r.get<string>(key);
		if (raw == null) {
			if (dev) console.log(`[cache] MISS ${key}`);
			return null;
		}
		if (dev) console.log(`[cache] HIT ${key}`);
		// Upstash auto-deserializes JSON — value may already be an object
		return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T;
	} catch (e) {
		console.warn(`[cache] getCache error for key "${key}":`, e);
		return null;
	}
}

export async function setCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
	const r = getRedis();

	if (!r) {
		// In-memory fallback
		try {
			memSet(key, JSON.stringify(value), ttlSeconds);
			if (dev) console.log(`[cache:mem] SET ${key} (TTL ${ttlSeconds}s)`);
		} catch (e) {
			console.warn(`[cache:mem] SET FAILED for "${key}":`, e instanceof Error ? e.message : e);
		}
		return;
	}

	try {
		await r.set(key, JSON.stringify(value), { ex: ttlSeconds });
		if (dev) console.log(`[cache] SET ${key} (TTL ${ttlSeconds}s)`);
	} catch (e) {
		console.warn(`[cache] setCache error for key "${key}":`, e);
	}
}

export async function invalidateCache(key: string): Promise<void> {
	const r = getRedis();

	if (!r) {
		memDel(key);
		if (dev) console.log(`[cache:mem] INVALIDATE ${key}`);
		return;
	}

	try {
		await r.del(key);
		if (dev) console.log(`[cache] INVALIDATE ${key}`);
	} catch (e) {
		console.warn(`[cache] invalidateCache error for key "${key}":`, e);
	}
}

/** Delete all keys whose name starts with the given prefix (scans up to 500 keys). */
export async function invalidateCachePattern(prefix: string): Promise<void> {
	const r = getRedis();

	if (!r) {
		const count = memDelPattern(prefix);
		if (dev) console.log(`[cache:mem] INVALIDATE pattern "${prefix}*" — deleted ${count} keys`);
		return;
	}

	try {
		// SCAN with MATCH to find matching keys — Upstash Redis supports SCAN
		let cursor = 0;
		const found: string[] = [];

		do {
			const [nextCursor, keys] = await r.scan(cursor, { match: `${prefix}*`, count: 100 });
			cursor = Number(nextCursor);
			found.push(...(keys as string[]));
		} while (cursor !== 0 && found.length < 500);

		if (found.length > 0) {
			await r.del(...found);
			if (dev) console.log(`[cache] INVALIDATE pattern "${prefix}*" — deleted ${found.length} keys`);
		}
	} catch (e) {
		console.warn(`[cache] invalidateCachePattern error for prefix "${prefix}":`, e);
	}
}
