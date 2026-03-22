import { env } from '$env/dynamic/private';
import type { SupabaseClient } from '@supabase/supabase-js';

const SLOW_QUERY_THRESHOLD_MS = 500;

interface QueryLogEntry {
	type: 'db-query';
	table: string;
	duration_ms: number;
	slow: boolean;
	timestamp: number;
}

function logQuery(table: string, durationMs: number): void {
	const isDev = env.NODE_ENV !== 'production';
	const slow = durationMs >= SLOW_QUERY_THRESHOLD_MS;

	if (isDev) {
		const label = slow ? 'SLOW' : 'OK';
		const color = slow ? '\x1b[31m' : '\x1b[32m';
		const reset = '\x1b[0m';
		console.log(
			`${color}[db:${label}]${reset} ${table} ${Math.round(durationMs)}ms`
		);
	} else if (slow) {
		const entry: QueryLogEntry = {
			type: 'db-query',
			table,
			duration_ms: Math.round(durationMs),
			slow: true,
			timestamp: Date.now()
		};
		console.log(JSON.stringify(entry));
	}
}

/**
 * Creates a recursive proxy that intercepts .then() at any depth in the
 * Supabase query chain (e.g. .from().select().eq().order()).
 */
function createTimedProxy<T extends object>(target: T, table: string, start: number): T {
	return new Proxy(target, {
		get(obj, prop, receiver) {
			const value = Reflect.get(obj, prop, receiver);

			if (prop === 'then') {
				// Intercept await / .then() to measure total query time
				return (
					onFulfilled?: (value: unknown) => unknown,
					onRejected?: (reason: unknown) => unknown
				) => {
					return (value as typeof Promise.prototype.then).call(
						obj,
						(result: unknown) => {
							logQuery(table, performance.now() - start);
							return onFulfilled ? onFulfilled(result) : result;
						},
						(error: unknown) => {
							logQuery(table, performance.now() - start);
							return onRejected ? onRejected(error) : Promise.reject(error);
						}
					);
				};
			}

			if (typeof value === 'function') {
				return (...args: unknown[]) => {
					const result = (value as (...a: unknown[]) => unknown).apply(obj, args);
					// If the result is a thenable object (query builder), proxy it recursively
					if (result && typeof result === 'object' && 'then' in result) {
						return createTimedProxy(result as object, table, start);
					}
					return result;
				};
			}

			return value;
		}
	}) as T;
}

/**
 * Wraps a Supabase client to log query performance.
 * In dev: logs all queries with color-coded timing.
 * In production: logs only slow queries (>500ms) as structured JSON.
 */
export function withQueryLogging<T extends SupabaseClient>(client: T): T {
	const originalFrom = client.from.bind(client);

	client.from = ((table: string) => {
		const start = performance.now();
		const queryBuilder = originalFrom(table);
		return createTimedProxy(queryBuilder, table, start);
	}) as typeof client.from;

	return client;
}
