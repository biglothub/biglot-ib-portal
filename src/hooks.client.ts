import { init, handleErrorWithSentry } from '@sentry/sveltekit';
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

export const handleError = handleErrorWithSentry();
