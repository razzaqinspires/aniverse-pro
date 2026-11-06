/* Aniverse PRO — Service Worker (PWA offline support)
 * Strategi:
 *  - Aset statis (JS/CSS/gambar/font/_next/static): cache-first
 *  - Navigasi halaman (request.mode === 'navigate'): network-first,
 *    jika gagal → fallback ke /offline.html
 *  - Video/media & API request: TIDAK di-cache (lewati ke network)
 *  - skipWaiting + clients.claim agar SW aktif segera tanpa reload kedua.
 */
const CACHE_NAME = "aniverse-pro-v1";
const PRECACHE_URLS = ["/offline.html", "/icon.svg", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()) // tetap lanjut walau precache gagal
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Hanya tangani GET; yang lain biarkan lewat.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Jangan cache API, video stream, atau request lintas asal non-aset.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/api-auth/") ||
    req.headers.get("range")
  ) {
    return;
  }

  // Navigasi halaman: network-first dengan fallback offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("/offline.html"))
        )
    );
    return;
  }

  // Aset statis same-origin: cache-first, fallback network lalu simpan.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            if (res && res.status === 200 && res.type === "basic") {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
      })
    );
  }
});
