import { browser } from '$app/environment';

interface BadgeNavigator {
	setAppBadge?: (contents?: number) => Promise<void>;
	clearAppBadge?: () => Promise<void>;
}

function badgeNavigator() {
	return browser ? (navigator as Navigator & BadgeNavigator) : null;
}

export async function setAppBadgeCount(count: number) {
	const nav = badgeNavigator();
	if (!nav?.setAppBadge) return false;
	if (count <= 0) {
		await clearAppBadgeCount();
		return true;
	}
	await nav.setAppBadge(count);
	return true;
}

export async function clearAppBadgeCount() {
	const nav = badgeNavigator();
	if (!nav?.clearAppBadge) return false;
	await nav.clearAppBadge();
	return true;
}

export async function updateAppBadgeFromCounts({ unread = 0, failedSync = 0 }: { unread?: number; failedSync?: number }) {
	return setAppBadgeCount(unread + failedSync);
}
