/**
 * Keyboard shortcut registry with chord support.
 * A chord is: first key press sets prefix, second key within 500ms triggers action.
 * Auto-disabled when focus is on input, textarea, [contenteditable], or select.
 */

export interface ShortcutDef {
	id: string;
	keys: string[];
	description: string;
	action: () => void;
	group: string;
	enabled?: () => boolean;
	allowWhenOverlayOpen?: boolean;
}

export interface OverlayRegistration {
	id: string;
	blocksShortcuts?: boolean;
	lockScroll?: boolean;
}

// Reactive list of all registered shortcuts (for help modal)
let shortcuts = $state<ShortcutDef[]>([]);
let overlays = $state<OverlayRegistration[]>([]);

// Chord state: first key of a chord sequence and when it was pressed
let chordPrefix = $state<string | null>(null);
let chordTimer: ReturnType<typeof setTimeout> | null = null;
const CHORD_TIMEOUT = 500;
const MODIFIER_PREFIX = /^(Cmd|Meta|Control|Ctrl|Alt|Shift)\+/;

function isBrowser(): boolean {
	return typeof document !== 'undefined';
}

function isTypingContext(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName.toLowerCase();
	return (
		tag === 'input' ||
		tag === 'textarea' ||
		tag === 'select' ||
		target.isContentEditable
	);
}

function isInteractiveContext(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return (
		target.matches(
			'button, a[href], summary, input, textarea, select, [role="button"], [role="menuitem"], [role="option"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [tabindex]:not([tabindex="-1"])'
		) || target.isContentEditable
	);
}

function hasDomBlockingOverlay(): boolean {
	if (!isBrowser()) return false;
	return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"]')).some(
		(node) => node.getClientRects().length > 0
	);
}

function resetChordState() {
	if (chordTimer) clearTimeout(chordTimer);
	chordTimer = null;
	chordPrefix = null;
}

function normalizeKey(key: string): string {
	return key.length === 1 ? key.toLowerCase() : key;
}

function eventKey(e: KeyboardEvent): string {
	const key = normalizeKey(e.key);
	const modifiers: string[] = [];
	if (e.metaKey) modifiers.push('Meta');
	if (e.ctrlKey) modifiers.push('Control');
	if (e.altKey) modifiers.push('Alt');
	return modifiers.length > 0 ? `${modifiers.join('+')}+${key}` : key;
}

function isChordKey(key: string): boolean {
	return key.includes('+') && !MODIFIER_PREFIX.test(key);
}

function isShortcutEnabled(shortcut: ShortcutDef): boolean {
	return shortcut.enabled ? shortcut.enabled() : true;
}

function activeShortcuts(overlayOpen: boolean): ShortcutDef[] {
	return shortcuts.filter((shortcut) => {
		if (!isShortcutEnabled(shortcut)) return false;
		if (overlayOpen && !shortcut.allowWhenOverlayOpen) return false;
		return true;
	});
}

function upsertShortcuts(defs: ShortcutDef[]) {
	const next = [...shortcuts];
	let changed = false;

	for (const def of defs) {
		const index = next.findIndex((shortcut) => shortcut.id === def.id);
		if (index === -1) {
			next.push(def);
			changed = true;
			continue;
		}

		next[index] = def;
		changed = true;
	}

	if (changed) shortcuts = next;
}

function hasRegisteredBlockingOverlay(): boolean {
	return overlays.some((overlay) => overlay.blocksShortcuts !== false);
}

function removeOverlay(id: string) {
	if (!overlays.some((overlay) => overlay.id === id)) return;
	overlays = overlays.filter((overlay) => overlay.id !== id);
}

export interface OverlayOptions {
	blocksShortcuts?: boolean;
	lockScroll?: boolean;
}

export function pushOverlay(id: string, options: OverlayOptions = {}) {
	const next: OverlayRegistration = {
		id,
		blocksShortcuts: options.blocksShortcuts ?? true,
		lockScroll: options.lockScroll ?? false
	};
	overlays = [...overlays.filter((overlay) => overlay.id !== id), next];
}

export function popOverlay(id: string) {
	removeOverlay(id);
}

export function hasBlockingOverlay(): boolean {
	return hasRegisteredBlockingOverlay() || hasDomBlockingOverlay();
}

function handleKeydown(e: KeyboardEvent) {
	if (e.defaultPrevented) return;
	if (isTypingContext(e.target) || isInteractiveContext(e.target)) {
		resetChordState();
		return;
	}

	const overlayOpen = hasBlockingOverlay();
	const candidates = activeShortcuts(overlayOpen);

	if (candidates.length === 0) {
		resetChordState();
		return;
	}

	const key = eventKey(e);

	// If we have a chord prefix, try to complete it
	if (chordPrefix !== null) {
		const chord = `${chordPrefix}+${key}`;
		resetChordState();

		const match = candidates.find((s) => s.keys.includes(chord));
		if (match) {
			e.preventDefault();
			match.action();
			return;
		}
		// If no chord match, fall through and treat current key as new input
	}

	// Check for single-key shortcuts
	const singleMatch = candidates.find((s) => s.keys.includes(key) && s.keys.every((k) => !isChordKey(k)));
	if (singleMatch) {
		e.preventDefault();
		singleMatch.action();
		return;
	}

	// Check if key is a chord prefix (i.e., any shortcut starts with this key)
	const isPrefix = candidates.some((s) => s.keys.some((k) => isChordKey(k) && k.startsWith(`${key}+`)));
	if (isPrefix) {
		chordPrefix = key;
		if (chordTimer) clearTimeout(chordTimer);
		chordTimer = setTimeout(() => {
			chordPrefix = null;
		}, CHORD_TIMEOUT);
	}
}

// Set up and tear down the global keydown listener via $effect in a component.
// Export a function components can call to attach the listener.
let listenerCount = 0;

export function initShortcuts() {
	listenerCount++;
	if (listenerCount === 1) {
		document.addEventListener('keydown', handleKeydown);
	}
	return () => {
		listenerCount--;
		if (listenerCount === 0) {
			document.removeEventListener('keydown', handleKeydown);
			resetChordState();
		}
	};
}

export function registerShortcut(shortcut: ShortcutDef) {
	upsertShortcuts([shortcut]);
}

export function registerShortcuts(defs: ShortcutDef[]) {
	upsertShortcuts(defs);
}

export function unregisterShortcuts(ids: string[]) {
	// Batch unregister — single reactive update instead of N
	const removeSet = new Set(ids);
	shortcuts = shortcuts.filter((s) => !removeSet.has(s.id));
}

export function unregisterShortcut(id: string) {
	shortcuts = shortcuts.filter((s) => s.id !== id);
}

export function getShortcuts(): ShortcutDef[] {
	return shortcuts;
}
