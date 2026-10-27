const CACHE_NAME = "car-log-shell-v6";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./login.html",
  "./auth.js",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./assets/logo.png",
  "./dashboard.html",
  "./dashboard.css",
  "./dashboard.js",
  "./manifest-dashboard.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch((err) => {
      console.error("[SW] cache addAll failed", err);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Only handle same-origin GET requests.
// Shell files: cache-first. Everything else: network-only.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Normalize: treat "/" and "./" as index.html for matching
  const isShell = SHELL_FILES.some((f) => {
    const normalized = new URL(f, self.location.href).pathname;
    return url.pathname === normalized || (f === "./" && (url.pathname === "/" || url.pathname.endsWith("/index.html")));
  });

  if (!isShell) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (!response || !response.ok) return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached || caches.match("./index.html"));
    })
  );
});
