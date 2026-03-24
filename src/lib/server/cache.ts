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
		if (dev) console.log('[cache] No UPSTASH_REDIS_REST_URL/TOKEN configured, caching disabled');
	}

	return redis;
}

export async function getCache<T>(key: string): Promise<T | null> {
	const r = getRedis();
	if (!r) return null;

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
	if (!r) return;

	try {
		await r.set(key, JSON.stringify(value), { ex: ttlSeconds });
		if (dev) console.log(`[cache] SET ${key} (TTL ${ttlSeconds}s)`);
	} catch (e) {
		console.warn(`[cache] setCache error for key "${key}":`, e);
	}
}

export async function invalidateCache(key: string): Promise<void> {
	const r = getRedis();
	if (!r) return;

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
	if (!r) return;

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
