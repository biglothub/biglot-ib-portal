import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

interface VitalsEntry {
	id: string;
	name: string;
	value: number;
	rating: 'good' | 'needs-improvement' | 'poor';
	delta: number;
	navigationType: string;
	url: string;
	timestamp: number;
}

const VALID_METRIC_NAMES = new Set(['CLS', 'FID', 'LCP', 'INP', 'TTFB', 'FCP']);
const VALID_RATINGS = new Set(['good', 'needs-improvement', 'poor']);
const MAX_BATCH_SIZE = 20;

function isValidEntry(entry: unknown): entry is VitalsEntry {
	if (typeof entry !== 'object' || entry === null) return false;
	const e = entry as Record<string, unknown>;
	return (
		typeof e.id === 'string' &&
		typeof e.name === 'string' &&
		VALID_METRIC_NAMES.has(e.name) &&
		typeof e.value === 'number' &&
		isFinite(e.value) &&
		typeof e.rating === 'string' &&
		VALID_RATINGS.has(e.rating) &&
		typeof e.delta === 'number' &&
		typeof e.url === 'string' &&
		typeof e.timestamp === 'number'
	);
}

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	if (!Array.isArray(body) || body.length === 0 || body.length > MAX_BATCH_SIZE) {
		return json({ error: 'Invalid batch' }, { status: 400 });
	}

	const entries = body.filter(isValidEntry);
	if (entries.length === 0) {
		return json({ error: 'No valid entries' }, { status: 400 });
	}

	const isDev = env.NODE_ENV !== 'production';

	for (const entry of entries) {
		const ratingEmoji = entry.rating === 'good' ? 'OK' : entry.rating === 'needs-improvement' ? 'WARN' : 'POOR';
		const unit = entry.name === 'CLS' ? '' : 'ms';
		const value = entry.name === 'CLS' ? entry.value.toFixed(3) : Math.round(entry.value);

		if (isDev) {
			console.log(
				`[vitals] ${ratingEmoji} ${entry.name}=${value}${unit} path=${entry.url} nav=${entry.navigationType}`
			);
		} else {
			// Production: structured JSON for log aggregation (Datadog, CloudWatch, etc.)
			console.log(
				JSON.stringify({
					type: 'web-vital',
					metric: entry.name,
					value: entry.value,
					rating: entry.rating,
					delta: entry.delta,
					path: entry.url,
					navigationType: entry.navigationType,
					timestamp: entry.timestamp
				})
			);
		}
	}

	return json({ ok: true, count: entries.length });
};
