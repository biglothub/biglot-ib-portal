import { browser } from '$app/environment';
import {
	getPlatformInfo,
	MOBILE_MEDIA_QUERY,
	STANDALONE_MEDIA_QUERY,
	type PlatformInfo
} from './platform';

function copyPlatformInfo(target: PlatformInfo, source: PlatformInfo) {
	target.isStandalone = source.isStandalone;
	target.isIOS = source.isIOS;
	target.isAndroid = source.isAndroid;
	target.isMobile = source.isMobile;
	target.viewportWidth = source.viewportWidth;
}

export function usePlatform(): PlatformInfo {
	const platform = $state<PlatformInfo>(getPlatformInfo());

	$effect(() => {
		if (!browser) return;

		const update = () => copyPlatformInfo(platform, getPlatformInfo());
		const mobileQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
		const standaloneQuery = window.matchMedia(STANDALONE_MEDIA_QUERY);

		update();
		mobileQuery.addEventListener('change', update);
		standaloneQuery.addEventListener('change', update);
		window.addEventListener('resize', update);
		window.addEventListener('orientationchange', update);

		return () => {
			mobileQuery.removeEventListener('change', update);
			standaloneQuery.removeEventListener('change', update);
			window.removeEventListener('resize', update);
			window.removeEventListener('orientationchange', update);
		};
	});

	return platform;
}
