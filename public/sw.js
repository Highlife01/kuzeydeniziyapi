const CACHE_NAME = 'kuzeydenizi-erp-v2';
const STATIC_ASSETS = ['/', '/manifest.json', '/images/logo-brand.png', '/images/logo-mark.png', '/icons/favicon-32.png', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never intercept Firebase / Google APIs / DNS lookups / same-origin Cloud Function API
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname === '/api' ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('dns.google') ||
    url.hostname.includes('gstatic.com')
  ) {
    return;
  }

  // Network-first for HTML & JS, cache fallback for offline construction sites
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
  );
});
