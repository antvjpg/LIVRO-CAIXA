/* Livro-Caixa V18-19 PWA: App Shell Caching */
const CACHE_NAME = "livro-caixa-shell-v18-19";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest?v=18-19",
  "./icon-192.png?v=18-19",
  "./icon-512.png?v=18-19",
  "./icon-512-maskable.png?v=18-19"
];

// Instalação: Pré-carrega os arquivos vitais (App Shell)[span_0](start_span)[span_0](end_span)
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

// Ativação: Remove versões antigas de cache automaticamente[span_1](start_span)[span_1](end_span)
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

// Interceptação de Requisições[span_2](start_span)[span_2](end_span)
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Filtra requisições de outros domínios (Firebase, Chart.js, etc.) e métodos não-GET[span_3](start_span)[span_3](end_span)
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Navegação: Tenta a rede primeiro, usa cache local se estiver offline[span_4](start_span)[span_4](end_span)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Ativos locais: Busca no cache primeiro, se não encontrar baixa e salva[span_5](start_span)[span_5](end_span)
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
