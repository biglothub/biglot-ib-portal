import { browser } from '$app/environment';
import {
	deletePendingAction,
	listPendingActions,
	putPendingAction,
	updatePendingAction,
	type Json,
	type PendingActionRecord
} from './offline-db';
import { canQueue } from './sync-allowlist';

export const PWA_SYNC_EVENT = 'pwa:sync-update';
export const PWA_PENDING_COUNT_KEY = 'pwa.pending.count';

const RETRY_DELAYS = [1_000, 5_000, 30_000, 120_000, 600_000];

export interface QueueInput {
	endpoint: string;
	method: string;
	body: Json;
	headers?: Record<string, string>;
}

export interface SyncQueueState {
	pending: PendingActionRecord[];
	flushing: boolean;
	lastSyncAt: number | null;
	lastError: string | null;
}

let flushing = false;

function randomId(prefix: string) {
	const cryptoObj = browser ? window.crypto : globalThis.crypto;
	if (cryptoObj?.randomUUID) return `${prefix}-${cryptoObj.randomUUID()}`;
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emitSyncUpdate(detail: Partial<SyncQueueState> = {}) {
	if (!browser) return;
	window.dispatchEvent(new CustomEvent(PWA_SYNC_EVENT, { detail }));
}

function setPendingCount(count: number) {
	if (!browser) return;
	localStorage.setItem(PWA_PENDING_COUNT_KEY, String(count));
}

export async function refreshPendingCount() {
	const pending = await listPendingActions();
	setPendingCount(pending.length);
	emitSyncUpdate({ pending });
	return pending.length;
}

export async function enqueueSyncAction(input: QueueInput) {
	if (!canQueue({ method: input.method, endpoint: input.endpoint })) {
		throw new Error(`Endpoint is not queueable: ${input.method} ${input.endpoint}`);
	}

	const createdAt = Date.now();
	const record: PendingActionRecord = {
		id: randomId('pending'),
		endpoint: input.endpoint,
		method: input.method.toUpperCase(),
		body: input.body,
		headers: input.headers ?? { 'Content-Type': 'application/json' },
		createdAt,
		attempts: 0,
		nextAttemptAt: createdAt,
		idempotencyKey: randomId('idem')
	};

	await putPendingAction(record);
	await refreshPendingCount();
	return record;
}

async function flushOne(record: PendingActionRecord) {
	const response = await fetch(record.endpoint, {
		method: record.method,
		headers: {
			...record.headers,
			'Content-Type': record.headers['Content-Type'] ?? 'application/json',
			'Idempotency-Key': record.idempotencyKey
		},
		body: JSON.stringify(record.body)
	});

	if (response.ok) {
		await deletePendingAction(record.id);
		return;
	}

	const nextAttempts = record.attempts + 1;
	const retryDelay = RETRY_DELAYS[Math.min(nextAttempts - 1, RETRY_DELAYS.length - 1)];
	const message = await response.text().catch(() => '');
	await updatePendingAction({
		...record,
		attempts: nextAttempts,
		nextAttemptAt: Date.now() + retryDelay,
		lastError: message || `HTTP ${response.status}`
	});
}

export async function flushSyncQueue({ force = false } = {}) {
	if (!browser || flushing || !navigator.onLine) return { flushed: 0, failed: 0 };
	flushing = true;
	emitSyncUpdate({ flushing: true });

	let flushed = 0;
	let failed = 0;
	try {
		const now = Date.now();
		const pending = await listPendingActions();
		for (const record of pending) {
			if (!force && record.nextAttemptAt && record.nextAttemptAt > now) continue;
			try {
				await flushOne(record);
				flushed++;
			} catch (error) {
				failed++;
				const nextAttempts = record.attempts + 1;
				const retryDelay = RETRY_DELAYS[Math.min(nextAttempts - 1, RETRY_DELAYS.length - 1)];
				await updatePendingAction({
					...record,
					attempts: nextAttempts,
					nextAttemptAt: Date.now() + retryDelay,
					lastError: error instanceof Error ? error.message : 'Sync failed'
				});
			}
		}
		const remaining = await listPendingActions();
		setPendingCount(remaining.length);
		emitSyncUpdate({
			pending: remaining,
			flushing: false,
			lastSyncAt: Date.now(),
			lastError: failed > 0 ? 'บางรายการซิงก์ไม่สำเร็จ' : null
		});
		return { flushed, failed };
	} finally {
		flushing = false;
		emitSyncUpdate({ flushing: false });
	}
}

export function initSyncQueueRuntime() {
	if (!browser) return () => undefined;

	const flush = () => {
		flushSyncQueue().catch(() => undefined);
	};
	const onVisibility = () => {
		if (document.visibilityState === 'visible') flush();
	};

	window.addEventListener('online', flush);
	window.addEventListener('focus', flush);
	document.addEventListener('visibilitychange', onVisibility);
	refreshPendingCount().catch(() => undefined);
	flush();

	return () => {
		window.removeEventListener('online', flush);
		window.removeEventListener('focus', flush);
		document.removeEventListener('visibilitychange', onVisibility);
	};
}
