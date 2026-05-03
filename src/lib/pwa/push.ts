import { browser } from '$app/environment';

export const PWA_PUSH_PERMISSION_EVENT = 'pwa:open-push-permission';
export const PUSH_PERMISSION_DISMISSED_AT_KEY = 'push-permission-dismissed';

export function pushSupported() {
	return browser && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

export function openPushPermissionPrompt() {
	if (!browser) return;
	window.dispatchEvent(new CustomEvent(PWA_PUSH_PERMISSION_EVENT));
}
