/* Livro-CAIXA — Branding Orange — PWA shell (network-first HTML, force update) */
const CACHE_NAME = "livro-caixa-shell-v20-29-opencode1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./emoji-catalog.js",
  "./app.js",
  "./patches.js",
  "./style/themes.css",
  "./style/styles.css",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png"
];

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

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "CLEAR_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});

function isHtmlRequest(request, url) {
  if (request.mode === "navigate") return true;
  if (request.destination === "document") return true;
  if (url.pathname.endsWith(".html")) return true;
  if (url.pathname.endsWith("/") || url.pathname.endsWith("/LIVRO-CAIXA")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Não intercepta Firebase, Google Auth, CDNs, etc.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // HTML / navegação: SEMPRE rede primeiro (evita login/auth preso em cache)
  if (isHtmlRequest(request, url)) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put("./index.html", copy);
              cache.put(request, networkResponse.clone()).catch(() => {});
            });
          }
          return networkResponse;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ||
              caches.match("./index.html").then((c) => c || caches.match("./"))
          )
        )
    );
    return;
  }

  // CSS/JS/manifest versionados: network-first para não travar UI antiga
  if (
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.includes("manifest.webmanifest")
  ) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Demais assets (ícones): cache-first
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return networkResponse;
      });
    })
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const data = payload && payload.data ? payload.data : payload;
  const notice = payload && payload.notification ? payload.notification : {};
  const title = notice.title || (payload && payload.title) || (data && data.title) || "Livro-Caixa";
  const options = {
    body: notice.body || (payload && payload.body) || (data && data.body) || "",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    tag: (data && data.tag) || undefined,
    data: { url: (data && data.url) || "./" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      const target = (event.notification.data && event.notification.data.url) || "./";
      return self.clients.openWindow(target);
    })
  );
});
