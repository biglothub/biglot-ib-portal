import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ShortcutsModule = typeof import('../stores/shortcuts.svelte');

describe('shortcut registry', () => {
	let shortcutsModule: ShortcutsModule;
	let cleanup: (() => void) | null = null;

	beforeEach(async () => {
		vi.resetModules();
		document.body.innerHTML = '<button id="trigger">trigger</button>';
		shortcutsModule = await import('../stores/shortcuts.svelte');
		cleanup = shortcutsModule.initShortcuts();
	});

	afterEach(() => {
		cleanup?.();
		cleanup = null;
		document.body.innerHTML = '';
	});

	it('dispatches modifier shortcuts like Meta+K and Control+K', () => {
		const action = vi.fn();
		shortcutsModule.registerShortcut({
			id: 'open-search',
			keys: ['Meta+k', 'Control+k'],
			description: 'ค้นหา',
			group: 'การค้นหา',
			action
		});

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));

		expect(action).toHaveBeenCalledTimes(2);
	});

	it('suppresses shortcuts while a blocking overlay is open unless explicitly allowed', () => {
		const blockedAction = vi.fn();
		const allowedAction = vi.fn();

		shortcutsModule.registerShortcuts([
			{
				id: 'blocked-help',
				keys: ['?'],
				description: 'เปิดช่วยเหลือ',
				group: 'อื่นๆ',
				action: blockedAction
			},
			{
				id: 'allowed-escape',
				keys: ['Escape'],
				description: 'ปิด panel',
				group: 'อื่นๆ',
				allowWhenOverlayOpen: true,
				action: allowedAction
			}
		]);

		shortcutsModule.pushOverlay('modal-under-test', { blocksShortcuts: true });

		document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

		expect(blockedAction).not.toHaveBeenCalled();
		expect(allowedAction).toHaveBeenCalledTimes(1);

		shortcutsModule.popOverlay('modal-under-test');
	});
});
