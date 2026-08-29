/* e-learner service worker (v2.1): offline reading of lessons you have already opened.
   - Static assets (/_next/static, icons): cache-first.
   - Lesson pages (/learn/...): network-first, falling back to the cached copy, then /offline.
   - Everything else: network only (server actions and API calls must not be cached). */
const VERSION = "el-sw-v1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg" || url.pathname.startsWith("/icon-")) {
    event.respondWith(caches.open(STATIC).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => (c.put(req, res.clone()), res)))));
    return;
  }

  const isLessonPage = req.mode === "navigate" && (url.pathname.startsWith("/learn/") || url.pathname === "/learn");
  if (isLessonPage) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(PAGES).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.open(PAGES).then((c) => c.match(req).then((hit) => hit || c.match(OFFLINE_URL)))),
    );
  }
});
