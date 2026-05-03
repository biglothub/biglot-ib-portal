import { browser } from '$app/environment';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export type Json =
	| string
	| number
	| boolean
	| null
	| Json[]
	| { [key: string]: Json };

export type DraftType = 'journal' | 'review' | 'note';

export interface DraftRecord {
	id: string;
	type: DraftType;
	entityId: string;
	payload: Json;
	updatedAt: number;
	version: number;
}

export interface PendingActionRecord {
	id: string;
	endpoint: string;
	method: string;
	body: Json;
	headers: Record<string, string>;
	createdAt: number;
	attempts: number;
	nextAttemptAt?: number;
	lastError?: string;
	idempotencyKey: string;
}

export interface SnapshotRecord {
	route: string;
	data: Json;
	capturedAt: number;
}

interface IbPortalPwaDb extends DBSchema {
	drafts: {
		key: string;
		value: DraftRecord;
		indexes: {
			'by-type-entity': [DraftType, string];
			'by-updated-at': number;
		};
	};
	pending: {
		key: string;
		value: PendingActionRecord;
		indexes: {
			'by-created-at': number;
			'by-next-attempt-at': number;
		};
	};
	snapshots: {
		key: string;
		value: SnapshotRecord;
	};
}

const DB_NAME = 'ib-portal-pwa-v1';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<IbPortalPwaDb>> | null = null;

function assertBrowser() {
	if (!browser) {
		throw new Error('PWA offline DB is only available in the browser');
	}
}

export function draftId(type: DraftType, entityId: string) {
	return `${type}:${entityId}`;
}

export function getOfflineDb() {
	assertBrowser();
	dbPromise ??= openDB<IbPortalPwaDb>(DB_NAME, DB_VERSION, {
		upgrade(db) {
			if (!db.objectStoreNames.contains('drafts')) {
				const drafts = db.createObjectStore('drafts', { keyPath: 'id' });
				drafts.createIndex('by-type-entity', ['type', 'entityId']);
				drafts.createIndex('by-updated-at', 'updatedAt');
			}

			if (!db.objectStoreNames.contains('pending')) {
				const pending = db.createObjectStore('pending', { keyPath: 'id' });
				pending.createIndex('by-created-at', 'createdAt');
				pending.createIndex('by-next-attempt-at', 'nextAttemptAt');
			}

			if (!db.objectStoreNames.contains('snapshots')) {
				db.createObjectStore('snapshots', { keyPath: 'route' });
			}
		}
	});
	return dbPromise;
}

export async function putDraft(record: Omit<DraftRecord, 'id' | 'updatedAt' | 'version'> & Partial<Pick<DraftRecord, 'updatedAt' | 'version'>>) {
	const db = await getOfflineDb();
	const now = Date.now();
	const draft: DraftRecord = {
		id: draftId(record.type, record.entityId),
		type: record.type,
		entityId: record.entityId,
		payload: record.payload,
		updatedAt: record.updatedAt ?? now,
		version: record.version ?? 1
	};
	await db.put('drafts', draft);
	return draft;
}

export async function getDraft(type: DraftType, entityId: string) {
	const db = await getOfflineDb();
	return db.get('drafts', draftId(type, entityId));
}

export async function deleteDraft(type: DraftType, entityId: string) {
	const db = await getOfflineDb();
	await db.delete('drafts', draftId(type, entityId));
}

export async function listDrafts() {
	const db = await getOfflineDb();
	return db.getAll('drafts');
}

export async function putPendingAction(record: PendingActionRecord) {
	const db = await getOfflineDb();
	await db.put('pending', record);
	return record;
}

export async function listPendingActions() {
	const db = await getOfflineDb();
	return db.getAllFromIndex('pending', 'by-created-at');
}

export async function updatePendingAction(record: PendingActionRecord) {
	const db = await getOfflineDb();
	await db.put('pending', record);
}

export async function deletePendingAction(id: string) {
	const db = await getOfflineDb();
	await db.delete('pending', id);
}

export async function putSnapshot(record: SnapshotRecord) {
	const db = await getOfflineDb();
	await db.put('snapshots', record);
}

export async function listSnapshots() {
	const db = await getOfflineDb();
	return db.getAll('snapshots');
}

export async function clearSnapshots() {
	const db = await getOfflineDb();
	await db.clear('snapshots');
}
