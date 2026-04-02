import type { Action } from 'svelte/action';
import { popOverlay, pushOverlay } from '$lib/stores/shortcuts.svelte';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
let overlaySeq = 0;
const scrollLocks = new Set<string>();
let previousBodyOverflow = '';
let capturedBodyOverflow = false;

export interface FocusTrapParams {
	enabled: boolean;
	id?: string;
	initialFocus?: string | HTMLElement | null;
	restoreFocus?: boolean;
	lockScroll?: boolean;
	blocksShortcuts?: boolean;
}

type FocusTrapAttributes = {
	onescape?: (event: CustomEvent<void>) => void;
};

function syncScrollLock() {
	if (typeof document === 'undefined') return;

	if (scrollLocks.size > 0) {
		if (!capturedBodyOverflow) {
			previousBodyOverflow = document.body.style.overflow;
			capturedBodyOverflow = true;
		}
		document.body.style.overflow = 'hidden';
		return;
	}

	if (capturedBodyOverflow) {
		document.body.style.overflow = previousBodyOverflow;
		capturedBodyOverflow = false;
		previousBodyOverflow = '';
	}
}

export const focusTrap: Action<HTMLElement, FocusTrapParams, FocusTrapAttributes> = (node, params) => {
	let previousFocus: HTMLElement | null = null;
	let active = false;
	const overlayId = params?.id ?? `focus-trap-${++overlaySeq}`;

	function getFocusable() {
		return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
			if (el.hasAttribute('disabled')) return false;
			if (el.getAttribute('aria-hidden') === 'true') return false;
			return el.offsetParent !== null || el === document.activeElement;
		});
	}

	function resolveInitialFocus() {
		if (params?.initialFocus instanceof HTMLElement) {
			return params.initialFocus;
		}
		if (typeof params?.initialFocus === 'string') {
			return node.querySelector<HTMLElement>(params.initialFocus);
		}
		return getFocusable()[0] ?? node;
	}

	function focusInitialTarget() {
		requestAnimationFrame(() => {
			const target = resolveInitialFocus();
			target?.focus();
		});
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!params?.enabled) return;

		if (e.key === 'Escape') {
			node.dispatchEvent(new CustomEvent('escape'));
			return;
		}

		if (e.key !== 'Tab') return;

		const focusable = getFocusable();
		if (focusable.length === 0) {
			e.preventDefault();
			node.focus();
			return;
		}

		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const activeElement = document.activeElement as HTMLElement | null;

		if (!activeElement || !node.contains(activeElement)) {
			e.preventDefault();
			(e.shiftKey ? last : first).focus();
			return;
		}

		if (e.shiftKey && activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	}

	function activate() {
		if (active || !params?.enabled) return;
		active = true;
		previousFocus = document.activeElement as HTMLElement | null;
		node.addEventListener('keydown', handleKeydown);
		pushOverlay(overlayId, {
			blocksShortcuts: params.blocksShortcuts ?? true,
			lockScroll: params.lockScroll ?? true
		});
		if (params.lockScroll ?? true) {
			scrollLocks.add(overlayId);
			syncScrollLock();
		}
		focusInitialTarget();
	}

	function deactivate() {
		if (!active) return;
		active = false;
		node.removeEventListener('keydown', handleKeydown);
		popOverlay(overlayId);
		if (scrollLocks.delete(overlayId)) {
			syncScrollLock();
		}
		if (params?.restoreFocus !== false && previousFocus?.isConnected) {
			previousFocus.focus();
		}
		previousFocus = null;
	}

	if (params?.enabled) activate();

	return {
		update(newParams) {
			const wasEnabled = params?.enabled ?? false;
			params = newParams;
			if (wasEnabled && !newParams.enabled) {
				deactivate();
			}
			if (newParams.enabled) {
				activate();
			}
		},
		destroy() {
			deactivate();
		}
	};
};
