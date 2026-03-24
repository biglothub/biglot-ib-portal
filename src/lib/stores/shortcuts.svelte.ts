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
}

// Reactive list of all registered shortcuts (for help modal)
let shortcuts = $state<ShortcutDef[]>([]);

// Chord state: first key of a chord sequence and when it was pressed
let chordPrefix = $state<string | null>(null);
let chordTimer: ReturnType<typeof setTimeout> | null = null;
const CHORD_TIMEOUT = 500;

function isTypingContext(): boolean {
	const el = document.activeElement;
	if (!el) return false;
	const tag = el.tagName.toLowerCase();
	return (
		tag === 'input' ||
		tag === 'textarea' ||
		tag === 'select' ||
		(el as HTMLElement).isContentEditable
	);
}

function handleKeydown(e: KeyboardEvent) {
	if (isTypingContext()) return;

	const key = e.key;

	// If we have a chord prefix, try to complete it
	if (chordPrefix !== null) {
		const chord = `${chordPrefix}+${key}`;
		if (chordTimer) clearTimeout(chordTimer);
		chordPrefix = null;

		const match = shortcuts.find((s) => s.keys.includes(chord));
		if (match) {
			e.preventDefault();
			match.action();
			return;
		}
		// If no chord match, fall through and treat current key as new input
	}

	// Check for single-key shortcuts
	const singleMatch = shortcuts.find((s) => s.keys.includes(key) && s.keys.every((k) => !k.includes('+')));
	if (singleMatch) {
		e.preventDefault();
		singleMatch.action();
		return;
	}

	// Check if key is a chord prefix (i.e., any shortcut starts with this key)
	const isPrefix = shortcuts.some((s) => s.keys.some((k) => k.startsWith(`${key}+`)));
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
			if (chordTimer) clearTimeout(chordTimer);
			chordPrefix = null;
		}
	};
}

export function registerShortcut(shortcut: ShortcutDef) {
	// Avoid duplicates
	if (!shortcuts.find((s) => s.id === shortcut.id)) {
		shortcuts = [...shortcuts, shortcut];
	}
}

export function unregisterShortcut(id: string) {
	shortcuts = shortcuts.filter((s) => s.id !== id);
}

export function getShortcuts(): ShortcutDef[] {
	return shortcuts;
}

