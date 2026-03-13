type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

/**
 * Returns true if the request is allowed, false if rate-limited.
 * @param key    Unique key (e.g. "ib:clients:1.2.3.4")
 * @param limit  Max requests per window
 * @param windowMs  Window size in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
	const now = Date.now();
	const entry = store.get(key);

	if (!entry || now > entry.resetAt) {
		store.set(key, { count: 1, resetAt: now + windowMs });
		return true;
	}

	if (entry.count >= limit) return false;

	entry.count++;
	return true;
}
