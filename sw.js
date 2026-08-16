const CACHE_VERSION = 'livro-caixa-v17-1-1-pwa';
const BASE_URL = new URL('./', self.registration.scope);
const APP_SHELL = [
  new URL('./', BASE_URL).href,
  new URL('./index.html', BASE_URL).href,
  new URL('./manifest.json', BASE_URL).href,
  new URL('./manifest.webmanifest', BASE_URL).href,
  new URL('./icons/icon-192.png', BASE_URL).href,
  new URL('./icons/icon-512.png', BASE_URL).href
];

const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const APP_CACHE = `${CACHE_VERSION}-app`;

async function putInCache(cacheName, request, response) {
  if (!response || !response.ok) return response;
  const copy = response.clone();
  const cache = await caches.open(cacheName);
  await cache.put(request, copy);
  return response;
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => ![APP_CACHE, RUNTIME_CACHE].includes(key))
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Apenas intercepta o próprio aplicativo e os CDNs que o aplicativo utiliza.
  const isSameOrigin = url.origin === self.location.origin;
  const isAllowedCdn = [
    'cdnjs.cloudflare.com',
    'cdn.jsdelivr.net',
    'www.gstatic.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
  ].includes(url.hostname);

  if (request.mode === 'navigate' && isSameOrigin) {
    event.respondWith(
      fetch(request)
        .then(response => putInCache(APP_CACHE, new URL('./index.html', BASE_URL).href, response))
        .catch(() => caches.match(new URL('./index.html', BASE_URL).href))
    );
    return;
  }

  if (!isSameOrigin && !isAllowedCdn) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => putInCache(RUNTIME_CACHE, request, response));
    })
  );
});
