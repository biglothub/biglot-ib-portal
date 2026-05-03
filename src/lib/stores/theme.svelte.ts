import { browser } from '$app/environment';

export type ThemeMode = 'gold' | 'dark' | 'light' | 'system';
export type ResolvedTheme = 'gold' | 'dark' | 'light';

const STORAGE_KEY = 'ib-portal-theme';

function getSystemPreference(): 'dark' | 'light' {
	if (!browser) return 'dark';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialMode(): ThemeMode {
	if (!browser) return 'gold';
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'gold' || stored === 'dark' || stored === 'light' || stored === 'system') return stored;
	return 'gold';
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
	if (mode === 'system') return getSystemPreference();
	return mode;
}

function applyTheme(mode: ThemeMode) {
	if (!browser) return;
	const resolved = resolveTheme(mode);
	const html = document.documentElement;
	html.classList.remove('gold', 'dark', 'light');
	html.classList.add(resolved);
	// Keep Tailwind dark variants active for both dark-looking themes.
	if (resolved === 'gold' || resolved === 'dark') html.classList.add('dark');

	const meta = document.querySelector('meta[name="theme-color"]');
	if (meta) {
		meta.setAttribute('content', resolved === 'light' ? '#f8fafc' : '#0a0a0a');
	}
}

let mode = $state<ThemeMode>(getInitialMode());
const resolved = $derived<ResolvedTheme>(resolveTheme(mode));

if (browser) {
	applyTheme(getInitialMode());

	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
		if (mode === 'system') applyTheme('system');
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
		const next: ThemeMode = resolved === 'light' ? 'gold' : 'light';
		this.set(next);
	}
};
