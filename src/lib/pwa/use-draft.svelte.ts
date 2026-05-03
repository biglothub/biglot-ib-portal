import { browser } from '$app/environment';
import {
	deleteDraft,
	getDraft,
	putDraft,
	type DraftRecord,
	type DraftType,
	type Json
} from './offline-db';
import { isMobile } from './platform';

export type DraftStatus = 'idle' | 'loading' | 'saved' | 'dirty' | 'cleared' | 'error';

export function useDraft(type: DraftType, getEntityId: () => string | null | undefined, options: { enabled?: () => boolean } = {}) {
	let status = $state<DraftStatus>('idle');
	let draft = $state<DraftRecord | null>(null);
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	const isEnabled = () => browser && isMobile() && (options.enabled?.() ?? true);

	async function load() {
		const entityId = getEntityId();
		if (!isEnabled() || !entityId) return null;
		status = 'loading';
		try {
			draft = (await getDraft(type, entityId)) ?? null;
			status = draft ? 'saved' : 'idle';
			return draft;
		} catch {
			status = 'error';
			return null;
		}
	}

	function save(payload: Json) {
		const entityId = getEntityId();
		if (!isEnabled() || !entityId) return;
		status = 'dirty';
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(async () => {
			try {
				draft = await putDraft({ type, entityId, payload });
				status = 'saved';
			} catch {
				status = 'error';
			}
		}, 800);
	}

	async function saveNow(payload: Json) {
		const entityId = getEntityId();
		if (!isEnabled() || !entityId) return null;
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
		}
		try {
			draft = await putDraft({ type, entityId, payload });
			status = 'saved';
			return draft;
		} catch {
			status = 'error';
			return null;
		}
	}

	async function clear() {
		const entityId = getEntityId();
		if (!browser || !entityId) return;
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
		}
		await deleteDraft(type, entityId);
		draft = null;
		status = 'cleared';
	}

	return {
		get draft() {
			return draft;
		},
		get status() {
			return status;
		},
		load,
		save,
		saveNow,
		clear
	};
}
