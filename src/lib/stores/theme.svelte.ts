import { browser } from '$app/environment';

export type ThemeMode = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'ib-portal-theme';

function getSystemPreference(): 'dark' | 'light' {
	if (!browser) return 'dark';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialMode(): ThemeMode {
	if (!browser) return 'dark';
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
	return 'dark';
}

function applyTheme(mode: ThemeMode) {
	if (!browser) return;
	const resolved = mode === 'system' ? getSystemPreference() : mode;
	const html = document.documentElement;
	if (resolved === 'dark') {
		html.classList.add('dark');
	} else {
		html.classList.remove('dark');
	}
	// Update meta theme-color for mobile browsers
	const meta = document.querySelector('meta[name="theme-color"]');
	if (meta) {
		meta.setAttribute('content', resolved === 'dark' ? '#0a0a0a' : '#f8fafc');
	}
}

let mode = $state<ThemeMode>(getInitialMode());

// Resolved theme (what's actually displayed)
const resolved = $derived<'dark' | 'light'>(
	mode === 'system' ? getSystemPreference() : mode
);

// Apply on init
if (browser) {
	applyTheme(getInitialMode());

	// Listen for system preference changes
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
		if (mode === 'system') {
			applyTheme('system');
		}
	});
}

export const theme = {
	get mode() { return mode; },
	get resolved() { return resolved; },
	set(newMode: ThemeMode) {
		mode = newMode;
		if (browser) {
			localStorage.setItem(STORAGE_KEY, newMode);
			applyTheme(newMode);
		}
	},
	toggle() {
		const next = resolved === 'dark' ? 'light' : 'dark';
		this.set(next);
	}
};
