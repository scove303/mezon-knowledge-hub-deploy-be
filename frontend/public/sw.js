/* eslint-disable */
// Mezon MindFolder Service Worker (PWA)
// Strategy: network-first cho điều hướng (offline fallback), stale-while-revalidate cho tài nguyên tĩnh.
const CACHE_NAME = "mezon-mindfolder-v1";
const PRECACHE_URLS = ["/dashboard", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
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
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Chỉ xử lý GET cùng origin (không chạm API :8000, YouTube, ...)
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Điều hướng trang: network-first, fallback cache khi offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/dashboard")),
        ),
    );
    return;
  }

  // Tài nguyên tĩnh (JS/CSS/fonts/icon): stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const refresh = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || refresh;
    }),
  );
});