const CACHE = 'kombu-inventory-v163-8';

const APP_SHELL = [
  './',
  './index.html',
  './app-v159.js',
  './kombu-pdf-filename-v1.js?v=1.3',
  './manifest.webmanifest',
  './icon-180.png',
  './pdf-v58.js',
  './pdf-worker-v58.js',
  './PDFJS-LICENSE.txt',
  './supabase-auth-v159.js',
  './shipment-waybill-inbox-v159.js?v=160.0',
  './kombu-complete-sync-v160.js?v=160.3',
  './kombu-faxbox-bridge-v1.js?v=2.9',
  './kombu-faxbox-direct-v2.js?v=2.14'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE)
          .filter(key =>
            key.startsWith('kombu-') ||
            key.startsWith('kombu-inventory-')
          )
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request, { cache: 'no-store' });

    if (response && response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }

    throw error;
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      networkFirst(event.request, './index.html')
    );
    return;
  }

  const isRuntimeCode =
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.webmanifest');

  if (isRuntimeCode) {
    event.respondWith(
      networkFirst(event.request)
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;

        return fetch(event.request).then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache =>
              cache.put(event.request, copy)
            );
          }

          return response;
        });
      })
  );
});
