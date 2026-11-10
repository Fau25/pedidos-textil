// Mis pedidos textiles · service worker
// La versión se cambia en cada publicación (la pone el workflow de GitHub automáticamente).
const VERSION = "__VERSION__";
const CACHE = "pedidos-textil-" + VERSION;

self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/pedidos-textil/", "/pedidos-textil/manifest.webmanifest"]).catch(() => {}))); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request;
  const url = new URL(r.url);
  if (r.method !== "GET" || url.origin !== location.origin || !url.pathname.startsWith("/pedidos-textil/")) return; // Supabase y demás: siempre a la red
  // Páginas: primero la red (sin caché HTTP) para ver siempre la última versión; sin conexión, la copia guardada
  if (r.mode === "navigate" || r.headers.get("accept")?.includes("text/html")) {
    e.respondWith(fetch(r, { cache: "no-cache" }).then((res) => { const c = res.clone(); caches.open(CACHE).then((k) => k.put(r, c)); return res; })
      .catch(() => caches.match(r).then((m) => m || caches.match("/pedidos-textil/"))));
    return;
  }
  // Archivos con huella (_next/static, fuentes, iconos): caché primero
  e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then((k) => k.put(r, c)); } return res; })));
});
