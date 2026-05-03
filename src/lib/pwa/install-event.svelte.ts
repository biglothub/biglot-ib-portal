import { browser } from '$app/environment';

export const PWA_INSTALL_DISMISSED_AT_KEY = 'pwa.install.dismissedAt';
export const PWA_INSTALL_OPEN_EVENT = 'pwa:open-install';

export interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);
let installed = $state(false);

export function useInstallPromptEvent(isEligible = true) {
	$effect(() => {
		if (!browser || !isEligible) return;

		const capturePrompt = (event: Event) => {
			event.preventDefault();
			deferredPrompt = event as BeforeInstallPromptEvent;
		};

		const markInstalled = () => {
			installed = true;
			deferredPrompt = null;
		};

		window.addEventListener('beforeinstallprompt', capturePrompt);
		window.addEventListener('appinstalled', markInstalled);

		return () => {
			window.removeEventListener('beforeinstallprompt', capturePrompt);
			window.removeEventListener('appinstalled', markInstalled);
		};
	});

	return {
		get canPrompt() {
			return deferredPrompt !== null;
		},
		get installed() {
			return installed;
		},
		async prompt() {
			if (!deferredPrompt) return null;
			await deferredPrompt.prompt();
			const choice = await deferredPrompt.userChoice;
			if (choice.outcome === 'accepted') {
				installed = true;
			}
			deferredPrompt = null;
			return choice.outcome;
		}
	};
}

export function openInstallPrompt() {
	if (!browser) return;
	window.dispatchEvent(new CustomEvent(PWA_INSTALL_OPEN_EVENT));
}
