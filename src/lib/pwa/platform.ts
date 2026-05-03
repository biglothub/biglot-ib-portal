import { browser } from '$app/environment';

export const MOBILE_MEDIA_QUERY = '(max-width: 767px)';
export const STANDALONE_MEDIA_QUERY = '(display-mode: standalone)';

export interface PlatformInfo {
	isStandalone: boolean;
	isIOS: boolean;
	isAndroid: boolean;
	isMobile: boolean;
	viewportWidth: number;
}

function navigatorWithStandalone(): Navigator & { standalone?: boolean } {
	return navigator as Navigator & { standalone?: boolean };
}

function userAgent(): string {
	return browser ? navigator.userAgent || '' : '';
}

export function isStandalone(): boolean {
	if (!browser) return false;
	return (
		window.matchMedia(STANDALONE_MEDIA_QUERY).matches ||
		navigatorWithStandalone().standalone === true
	);
}

export function isIOS(): boolean {
	if (!browser) return false;
	const ua = userAgent();
	const legacyIOS = /iPad|iPhone|iPod/.test(ua);
	const ipadOSDesktopMode =
		navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
	return legacyIOS || ipadOSDesktopMode;
}

export function isAndroid(): boolean {
	return browser ? /Android/i.test(userAgent()) : false;
}

export function isMobile(): boolean {
	if (!browser) return false;
	const mobileViewport = window.matchMedia(MOBILE_MEDIA_QUERY).matches;
	const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent());
	return mobileViewport || mobileUA || isIOS();
}

export function getPlatformInfo(): PlatformInfo {
	return {
		isStandalone: isStandalone(),
		isIOS: isIOS(),
		isAndroid: isAndroid(),
		isMobile: isMobile(),
		viewportWidth: browser ? window.innerWidth : 0
	};
}
