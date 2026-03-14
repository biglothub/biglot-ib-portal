/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = `cache-${version}`;
const FONT_CACHE = 'google-fonts-v1';

const PRECACHE_ASSETS = [...build, ...files];

// Install: precache static assets + offline page
sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			await cache.addAll([...PRECACHE_ASSETS, '/offline']);
			await sw.skipWaiting();
		})()
	);
});

// Activate: clean old caches
sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys
					.filter((key) => key !== CACHE_NAME && key !== FONT_CACHE)
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

	// Navigation requests: network-first with offline fallback
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).catch(() => caches.match('/offline') as Promise<Response>)
		);
		return;
	}
});

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
			data: { url: data.url || '/' }
		})
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = event.notification.data?.url || '/';
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
