import { init, handleErrorWithSentry } from '@sentry/sveltekit';
import { afterNavigate } from '$app/navigation';
import { env } from '$env/dynamic/public';
import { initWebVitals } from '$lib/web-vitals';

if (env.PUBLIC_SENTRY_DSN) {
	init({
		dsn: env.PUBLIC_SENTRY_DSN,
		environment: env.PUBLIC_SENTRY_ENVIRONMENT || 'production',
		tracesSampleRate: 0.2,
		replaysSessionSampleRate: 0,
		replaysOnErrorSampleRate: 1.0
	});
}

initWebVitals();

afterNavigate(({ to }) => {
	if (!to?.url) return;
	if (to.url.pathname === '/offline' || to.url.pathname.startsWith('/auth/')) return;
	localStorage.setItem('pwa.lastRoute', `${to.url.pathname}${to.url.search}${to.url.hash}`);
});

export const handleError = handleErrorWithSentry();
