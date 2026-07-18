// CA Vault — minimal service worker for PWA installability
// Network-first: always fetches fresh from server, no offline caching
// (documents are sensitive — we don't cache them locally)

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => e.respondWith(fetch(e.request)));
