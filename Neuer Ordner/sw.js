// ---------- sw.js ----------
const CACHE_NAME = "spieltracker-v2"; // Version hochziehen, wenn du Änderungen machst

const CORE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// Install: Core Assets cachen (robust)
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Best-effort caching: wenn ein File fehlt, soll SW trotzdem installieren
    await Promise.all(
      CORE_ASSETS.map(async (url) => {
        try {
          const resp = await fetch(url, { cache: "no-store" });
          if (resp.ok) await cache.put(url, resp.clone());
        } catch (_) {
          // offline/404 -> ignorieren, SW darf trotzdem aktiv werden
        }
      })
    );

    self.skipWaiting();
  })());
});

// Activate: alte Caches löschen
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key))));
    self.clients.claim();
  })());
});

// Fetch
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Nur same-origin cachen (verhindert Stress mit CDNs, Analytics etc.)
  if (url.origin !== self.location.origin) return;

  // Navigation: network-first, offline -> index.html
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        // Optional: index.html aktuell halten
        const cache = await caches.open(CACHE_NAME);
        cache.put("/index.html", fresh.clone());
        return fresh;
      } catch (_) {
        return (await caches.match("/index.html")) || Response.error();
      }
    })());
    return;
  }

  // Assets: cache-first, fallback -> network -> cache
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const resp = await fetch(req);
      if (resp.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, resp.clone());
      }
      return resp;
    } catch (_) {
      return cached || Response.error();
    }
  })());
});
