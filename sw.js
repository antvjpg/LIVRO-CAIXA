/* Livro-Caixa V.18-19 — PWA: App Shell Caching */
const CACHE_NAME = "livro-caixa-shell-v18-19-fixdue";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest?v=18-19-fixdue",
  "./icon-192.png?v=18-19-fixdue",
  "./icon-512.png?v=18-19-fixdue",
  "./icon-512-maskable.png?v=18-19-fixdue"
];

// Instalação: pré-carrega os arquivos vitais (App Shell)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        await Promise.allSettled(APP_SHELL.map((asset) => cache.add(asset)));
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação: remove versões antigas de cache automaticamente
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("livro-caixa-shell-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Permite que a página force a ativação de uma nova versão (SKIP_WAITING)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Interceptação de requisições
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Filtra requisições de outros domínios (Firebase, Chart.js, etc.) e métodos não-GET
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Navegação: tenta a rede primeiro, usa cache local se estiver offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Mantém o index do cache atualizado a cada acesso online
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", responseToCache));
          return networkResponse;
        })
        .catch(() => caches.match("./index.html").then((cached) => cached || caches.match("./")))
    );
    return;
  }

  // Ativos locais: busca no cache primeiro; se não encontrar, baixa e salva
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        return networkResponse;
      });
    })
  );
});
