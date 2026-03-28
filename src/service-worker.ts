/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = `cache-${version}`;
const FONT_CACHE = 'google-fonts-v1';
const DATA_CACHE = 'portfolio-pages-v1';

const PRECACHE_ASSETS = [...build, ...files];

// Portfolio routes to cache for offline use (stale-while-revalidate)
const PORTFOLIO_ORIGINS = ['/portfolio'];

// Install: precache static assets + offline page
sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			await cache.addAll([...PRECACHE_ASSETS, '/offline']);
			// Do NOT skipWaiting here — let the UI prompt the user first
		})()
	);
});

// Allow UI to trigger activation after user confirms update
sw.addEventListener('message', (event) => {
	if (event.data === 'SKIP_WAITING') {
		sw.skipWaiting();
	}
});

// Activate: clean old caches
sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys
					.filter((key) => key !== CACHE_NAME && key !== FONT_CACHE && key !== DATA_CACHE)
					.map((key) => caches.delete(key))
			);
			await sw.clients.claim();
		})()
	);
});

// Fetch handler
sw.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Skip non-GET requests (all API endpoints are POST)
	if (request.method !== 'GET') return;

	// Skip auth routes, API routes, Supabase
	if (
		url.pathname.startsWith('/api/') ||
		url.pathname.startsWith('/auth/') ||
		url.hostname.includes('supabase')
	) {
		return;
	}

	// Google Fonts: stale-while-revalidate
	if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
		event.respondWith(fontCacheStrategy(request));
		return;
	}

	// Static/build assets: cache-first
	if (PRECACHE_ASSETS.includes(url.pathname)) {
		event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
		return;
	}

	// Portfolio navigation pages: stale-while-revalidate
	// Serve cached version immediately, update cache in background
	if (
		request.mode === 'navigate' &&
		PORTFOLIO_ORIGINS.some((prefix) => url.pathname === prefix || url.pathname.startsWith(prefix + '/') || url.pathname.startsWith(prefix + '?'))
	) {
		event.respondWith(portfolioStaleWhileRevalidate(request));
		return;
	}

	// Other navigation requests: network-first with offline fallback
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).catch(() => caches.match('/offline') as Promise<Response>)
		);
		return;
	}
});

/** Stale-while-revalidate: return cached instantly, update cache from network */
async function portfolioStaleWhileRevalidate(request: Request): Promise<Response> {
	const cache = await caches.open(DATA_CACHE);
	const cached = await cache.match(request);

	const networkFetch = fetch(request)
		.then((response) => {
			if (response.ok) {
				cache.put(request, response.clone());
			}
			return response;
		})
		.catch((): Response | null => null);

	// Return cached immediately if available; otherwise wait for network
	if (cached) {
		// Background revalidate — don't await
		networkFetch.catch(() => undefined);
		return cached;
	}

	// No cache: wait for network, fall back to /offline if offline
	const networkResponse = await networkFetch;
	if (networkResponse) return networkResponse;
	return (await caches.match('/offline')) as Response;
}

async function fontCacheStrategy(request: Request): Promise<Response> {
	const cached = await caches.match(request);
	if (cached) return cached;

	const response = await fetch(request);
	if (response.ok) {
		const cache = await caches.open(FONT_CACHE);
		cache.put(request, response.clone());
	}
	return response;
}

// Push Notifications
sw.addEventListener('push', (event) => {
	if (!event.data) return;

	const data = event.data.json();
	event.waitUntil(
		sw.registration.showNotification(data.title || 'IB Portal', {
			body: data.body || '',
			icon: '/icon-192.png',
			badge: '/favicon.png',
			data: { url: validateSameOriginUrl(data.url || '/') }
		})
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const rawUrl = event.notification.data?.url || '/';
	const url = validateSameOriginUrl(rawUrl);
	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
			// Focus existing window if available
			for (const client of clients) {
				if (client.url.includes(url) && 'focus' in client) {
					return client.focus();
				}
			}
			// Otherwise open new window
			return sw.clients.openWindow(url);
		})
	);
});

/** Validate that a URL is same-origin; return '/' if not */
function validateSameOriginUrl(url: string): string {
	try {
		const parsed = new URL(url, sw.location.origin);
		if (parsed.origin !== sw.location.origin) {
			return '/';
		}
		return parsed.pathname + parsed.search + parsed.hash;
	} catch {
		return '/';
	}
}
