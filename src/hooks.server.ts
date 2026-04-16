import { init, sentryHandle, handleErrorWithSentry } from '@sentry/sveltekit';
import { env } from '$env/dynamic/private';
import { buildReturnTo, getAuthMfaState, getRoleRedirect } from '$lib/server/mfa';
import { createSupabaseServerClient, createSupabaseServiceClient } from '$lib/server/supabase';
import { validateEnv } from '$lib/server/env';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { i18n } from '$lib/i18n';
// Validate environment variables on startup — fail fast if required vars are missing
validateEnv();

if (env.SENTRY_DSN) {
	init({
		dsn: env.SENTRY_DSN,
		environment: env.SENTRY_ENVIRONMENT || 'production',
		tracesSampleRate: 0.2
	});
}

const PUBLIC_ROUTES = ['/auth/login', '/auth/forgot-password', '/auth/callback', '/auth/logout', '/offline', '/api/health'];
const MFA_ALLOWED_ROUTES = ['/auth/mfa', '/api/auth/mfa'];

type CachedProfile = NonNullable<App.Locals['profile']>;
// In-memory profile cache — avoids DB query on every request
const profileCache = new Map<string, { profile: CachedProfile; timestamp: number }>();
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const authHandle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createSupabaseServerClient(event);

	event.locals.safeGetSession = async () => {
		const [{ data: sessionData }, { data: userData, error }] = await Promise.all([
			event.locals.supabase.auth.getSession(),
			event.locals.supabase.auth.getUser()
		]);
		const session = sessionData.session;
		const user = userData.user;
		if (error || !user) return { session: null, user: null };

		return { session, user };
	};

	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;
	event.locals.authLevel = null;
	event.locals.needsMfa = false;

	if (user) {
		const mfaState = await getAuthMfaState(event.locals.supabase);
		event.locals.authLevel = mfaState.currentLevel;
		event.locals.needsMfa = mfaState.needsMfa;

		const now = Date.now();
		const cached = profileCache.get(user.id);

		if (cached && (now - cached.timestamp) < PROFILE_CACHE_TTL) {
			event.locals.profile = cached.profile;
		} else {
			const { data: profile } = await event.locals.supabase
				.from('profiles')
				.select('id, email, full_name, role, avatar_url')
				.eq('id', user.id)
				.single();
			event.locals.profile = profile as CachedProfile | null;

			if (profile) {
				profileCache.set(user.id, { profile, timestamp: now });
			}
		}
	} else {
		event.locals.profile = null;
	}

	const path = event.url.pathname;

	// Allow public routes
	if (PUBLIC_ROUTES.some(r => path.startsWith(r))) {
		return resolve(event, {
			filterSerializedResponseHeaders(name) {
				return name === 'content-range' || name === 'x-supabase-api-version';
			}
		});
	}

	// Redirect to login if not authenticated
	if (!user) {
		throw redirect(303, '/auth/login');
	}

	const role = event.locals.profile?.role;
	const defaultRedirect = getRoleRedirect(role);
	const isMfaRoute = MFA_ALLOWED_ROUTES.some((route) => path.startsWith(route));

	if (event.locals.needsMfa) {
		if (!isMfaRoute) {
			const returnTo = encodeURIComponent(buildReturnTo(path, event.url.search));
			throw redirect(303, `/auth/mfa?returnTo=${returnTo}`);
		}
	} else if (path.startsWith('/auth/mfa')) {
		throw redirect(303, defaultRedirect);
	}

	// Route guards
	if (path.startsWith('/admin') && role !== 'admin') {
		throw redirect(303, role === 'master_ib' ? '/ib' : '/portfolio');
	}
	if (path.startsWith('/ib') && role !== 'master_ib' && role !== 'admin') {
		throw redirect(303, role === 'client' ? '/portfolio' : '/auth/login');
	}
	if (path.startsWith('/portfolio') && role !== 'client') {
		// Allow admin/master_ib to view client portfolios via ?account_id=xxx
		const accountId = event.url.searchParams.get('account_id');
		if ((role === 'admin' || role === 'master_ib') && accountId) {
			const service = createSupabaseServiceClient();

			let query = service
				.from('client_accounts')
				.select('id, user_id, master_ib_id')
				.eq('id', accountId);

			// For master_ib, verify ownership
			if (role === 'master_ib') {
				const { data: ib } = await service
					.from('master_ibs')
					.select('id')
					.eq('user_id', user!.id)
					.single();
				if (!ib) throw redirect(303, '/ib');
				query = query.eq('master_ib_id', ib.id);
			}

			const { data: account } = await query.single();

			if (account) {
				event.locals.viewAsAccountId = account.id;
				event.locals.viewAsUserId = account.user_id;
			} else {
				throw redirect(303, role === 'admin' ? '/admin' : '/ib');
			}
		} else {
			throw redirect(303, role === 'admin' ? '/admin' : role === 'master_ib' ? '/ib' : '/auth/login');
		}
	}
	// Resolve client's selected account_id from URL so layout doesn't depend on url
	if (path.startsWith('/portfolio') && role === 'client') {
		const selectedAccountId = event.url.searchParams.get('account_id');
		if (selectedAccountId) {
			event.locals.selectedAccountId = selectedAccountId;
		}
	}

	// Redirect root based on role
	if (path === '/') {
		throw redirect(303, defaultRedirect);
	}

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

const cacheHandle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	const path = event.url.pathname;

	// Immutable hashed assets (Vite-built JS/CSS/fonts in _app/immutable/)
	if (path.startsWith('/_app/immutable/')) {
		response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
		return response;
	}

	// Other static assets (favicon, manifest, images in /static)
	if (path.startsWith('/_app/') || path.match(/\.(ico|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|eot)$/)) {
		response.headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
		return response;
	}

	// API responses — no cache by default, individual endpoints can override
	if (path.startsWith('/api/')) {
		if (!response.headers.has('Cache-Control')) {
			response.headers.set('Cache-Control', 'private, no-cache');
		}
		return response;
	}

	// HTML pages — always revalidate for fresh data
	if (!response.headers.has('Cache-Control')) {
		response.headers.set('Cache-Control', 'private, no-cache');
	}

	return response;
};

const securityHandle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	return response;
};

export const handle = sequence(i18n.handle(), sentryHandle(), authHandle, cacheHandle, securityHandle);
export const handleError = handleErrorWithSentry();
