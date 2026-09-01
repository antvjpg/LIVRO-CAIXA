/* Livro-Caixa V18-18 PWA: cacheia apenas o App Shell; dados financeiros continuam no Firestore. */
const CACHE_NAME = "livro-caixa-shell-v18-18";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest?v=18-18",
  "./icon-192.png?v=18-18",
  "./icon-512.png?v=18-18",
  "./icon-512-maskable.png?v=18-18"
];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE_NAME).then(async cache => { await Promise.allSettled(APP_SHELL.map(asset => cache.add(asset))); }).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("livro-caixa-shell-") && k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("./index.html")));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (!response || response.status !== 200 || response.type !== "basic") return response;
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    return response;
  })));
});
