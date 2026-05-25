/**
 * TenantIQ Service Worker
 * Offline support, caching, Web Push, Background Sync.
 *
 * Cache strategy:
 *   - Static assets (JS/CSS/images): cache-first
 *   - Navigation: network-first → offline.html fallback
 *   - API GETs (whitelisted): stale-while-revalidate in API_CACHE
 *   - All other API: network-only (no offline)
 *
 * Background Sync: queued POST/PATCH/DELETE replay when reconnect.
 * Web Push: shows alert notification, deep-links into the app.
 */
const VERSION = 'tenantiq-v3';
const STATIC_CACHE = `${VERSION}-static`;
const API_CACHE = `${VERSION}-api`;
const OFFLINE_URL = '/offline/';

const PRECACHE_URLS = [
	'/',
	'/offline/',
	'/favicon.svg',
	'/manifest.json',
];

// API GETs we cache for offline read-only (alerts, dashboard, etc)
const CACHEABLE_API = [
	'/api/tenants/',  // tenant data: dashboard, alerts, licenses, CIS results
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((names) =>
			Promise.all(names.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n))),
		).then(() => self.clients.claim()),
	);
});

// Notify clients when a new SW takes over so the UI can prompt for reload.
self.addEventListener('message', (event) => {
	if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	if (request.method !== 'GET') return;

	const isApi = url.hostname.includes('api.tenantiq.app') || url.pathname.startsWith('/api/');
	const isCacheableApi = isApi && CACHEABLE_API.some((p) => url.pathname.includes(p));

	// Auth + platform + LS = network-only.
	if (url.pathname.startsWith('/platform/') || url.pathname.startsWith('/auth/') || url.hostname.includes('lemonsqueezy.com')) return;

	// Cacheable API: stale-while-revalidate.
	if (isCacheableApi) {
		event.respondWith(staleWhileRevalidate(request, API_CACHE));
		return;
	}

	// Other API: network-only (no offline).
	if (isApi) return;

	// Navigation: network-first, offline.html fallback.
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).then((res) => {
				if (res.ok) caches.open(STATIC_CACHE).then((c) => c.put(request, res.clone()));
				return res;
			}).catch(() => caches.match(request).then((c) => c || caches.match(OFFLINE_URL))),
		);
		return;
	}

	// Static assets: cache-first.
	if (url.pathname.match(/\.(js|css|svg|png|jpg|jpeg|webp|woff2?|ttf)$/)) {
		event.respondWith(
			caches.match(request).then((c) => c || fetch(request).then((res) => {
				if (res.ok) caches.open(STATIC_CACHE).then((cache) => cache.put(request, res.clone()));
				return res;
			})),
		);
	}
});

async function staleWhileRevalidate(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	const network = fetch(request).then((res) => {
		if (res.ok) cache.put(request, res.clone());
		return res;
	}).catch(() => cached);
	return cached || network;
}

// ─── Web Push ──────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
	if (!event.data) return;
	let payload;
	try { payload = event.data.json(); } catch { payload = { title: 'TenantIQ', body: event.data.text() }; }

	const { title = 'TenantIQ', body = '', tag, url = '/', icon = '/brand/app-icon.png', badge = '/favicon.svg', data = {} } = payload;

	event.waitUntil(
		self.registration.showNotification(title, {
			body, tag, icon, badge,
			data: { url, ...data },
			vibrate: [100, 50, 100],
			requireInteraction: payload.severity === 'critical',
		}),
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = event.notification.data?.url || '/';
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
			// Focus existing tab if any.
			for (const client of list) {
				if (client.url.includes(target) && 'focus' in client) return client.focus();
			}
			return self.clients.openWindow(target);
		}),
	);
});

// ─── Background Sync (offline write queue) ─────────────────────────────────
// Frontend enqueues actions in IndexedDB when offline; this fires on reconnect.

self.addEventListener('sync', (event) => {
	if (event.tag === 'tenantiq-action-queue') {
		event.waitUntil(replayQueue());
	}
});

async function replayQueue() {
	// Frontend code (sync-queue.ts) owns the IDB schema; SW just signals it.
	// We post a message to all clients; the page replays the queue.
	const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
	for (const client of clients) client.postMessage({ type: 'SYNC_REPLAY_QUEUE' });
}
