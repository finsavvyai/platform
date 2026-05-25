const CACHE = 'amliq-v3';
const STATIC_ASSETS = ['/', '/index.html', '/logo.png', '/favicon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API calls — network first
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  // Hashed assets (/assets/*) — network first to avoid stale chunks
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  // Navigation — network first with app shell fallback
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Other static files — cache first
  e.respondWith(cacheFirst(e.request));
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const resp = await fetch(req);
    if (resp.ok && resp.type === 'basic') {
      const c = await caches.open(CACHE);
      c.put(req, resp.clone());
    }
    return resp;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(req) {
  try {
    const resp = await fetch(req);
    if (resp.ok) {
      const c = await caches.open(CACHE);
      c.put(req, resp.clone());
    }
    return resp;
  } catch {
    const cached = await caches.match(req);
    return cached || new Response(
      JSON.stringify({ error: 'offline', message: 'No network connection' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
