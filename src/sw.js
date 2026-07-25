/* Service Worker des Soul Dream Calendar: Offline-Cache.
 *
 * __SDC_VERSION__ wird beim Build durch einen Hash der ausgelieferten Dateien
 * ersetzt (siehe vite.config.ts). Vorher stand hier fest "sdc-v1" - der
 * Cache-Name aenderte sich also nie, und alte Antworten konnten einen Deploy
 * unbemerkt ueberleben.
 *
 * Navigationen gehen network-first, damit eine neue Version ankommt; alles
 * andere gleicher Herkunft cache-first, weil die Asset-Dateinamen ohnehin
 * einen Inhalts-Hash tragen und damit unveraenderlich sind.
 */
const VERSION = "__SDC_VERSION__";
const CACHE = `sdc-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(["./", "index.html", "manifest.webmanifest"]))
  );
  // KEIN skipWaiting hier: die neue Version wartet, bis der Nutzer im
  // Update-Hinweis zustimmt. Sonst werden mitten in der Sitzung die Assets
  // unter der laufenden Seite weggetauscht.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Die Seite bittet um die Uebernahme, sobald der Nutzer "Jetzt laden" drueckt.
self.addEventListener("message", (event) => {
  if (event.data === "sdc-skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match("index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
