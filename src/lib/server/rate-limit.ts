import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { env } from '$env/dynamic/private';

type Entry = { count: number; resetAt: number };

const memoryStore = new Map<string, Entry>();

let redisLimiterCache = new Map<string, Ratelimit>();
let redis: Redis | null = null;
let redisInitialized = false;

function getRedis(): Redis | null {
	if (redisInitialized) return redis;
	redisInitialized = true;

	const url = env.UPSTASH_REDIS_REST_URL;
	const token = env.UPSTASH_REDIS_REST_TOKEN;

	if (url && token) {
		try {
			redis = new Redis({ url, token });
			console.log('[rate-limit] Using Upstash Redis for distributed rate limiting');
		} catch (e) {
			console.warn('[rate-limit] Failed to connect to Upstash Redis, using in-memory fallback:', e);
			redis = null;
		}
	} else {
		console.log('[rate-limit] No UPSTASH_REDIS_REST_URL/TOKEN configured, using in-memory rate limiting');
	}

	return redis;
}

function getRedisLimiter(limit: number, windowMs: number): Ratelimit | null {
	const r = getRedis();
	if (!r) return null;

	const cacheKey = `${limit}:${windowMs}`;
	let limiter = redisLimiterCache.get(cacheKey);
	if (!limiter) {
		limiter = new Ratelimit({
			redis: r,
			limiter: Ratelimit.fixedWindow(limit, `${windowMs} ms`),
			prefix: 'rl',
			analytics: false
		});
		redisLimiterCache.set(cacheKey, limiter);
	}
	return limiter;
}

function memoryRateLimit(key: string, limit: number, windowMs: number): boolean {
	const now = Date.now();
	const entry = memoryStore.get(key);

	if (!entry || now > entry.resetAt) {
		memoryStore.set(key, { count: 1, resetAt: now + windowMs });
		return true;
	}

	if (entry.count >= limit) return false;

	entry.count++;
	return true;
}

/**
 * Returns true if the request is allowed, false if rate-limited.
 * Uses Upstash Redis when configured, falls back to in-memory.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
	const limiter = getRedisLimiter(limit, windowMs);

	if (limiter) {
		try {
			const result = await limiter.limit(key);
			return result.success;
		} catch {
			return memoryRateLimit(key, limit, windowMs);
		}
	}

	return memoryRateLimit(key, limit, windowMs);
}
