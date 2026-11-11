// Mis pedidos textiles · service worker
// La versión se cambia en cada publicación (la pone el workflow de GitHub automáticamente).
const VERSION = "__VERSION__";
const CACHE = "pedidos-textil-" + VERSION;
const FOTOS = "pedidos-textil-fotos-1"; // no se borra al publicar una versión nueva

self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/pedidos-textil/", "/pedidos-textil/manifest.webmanifest"]).catch(() => {}))); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== FOTOS).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request;
  const url = new URL(r.url);
  // Fotos de Supabase (catálogo, prendas, logos): la primera vez se descargan y después salen del dispositivo.
  // La clave es la ruta sin el token, que cambia aunque la foto sea la misma.
  if (r.method === "GET" && url.hostname.endsWith(".supabase.co") && url.pathname.startsWith("/storage/v1/object/sign/")) {
    const clave = new Request(url.origin + url.pathname);
    e.respondWith(caches.open(FOTOS).then((c) => c.match(clave).then((m) => m || fetch(r.url, { mode: "cors", credentials: "omit" }).then((res) => { if (res.ok) c.put(clave, res.clone()); return res; }).catch(() => fetch(r)))));
    return;
  }
  if (r.method !== "GET" || url.origin !== location.origin || !url.pathname.startsWith("/pedidos-textil/")) return; // Supabase y demás: siempre a la red
  // Páginas: se abren al instante con la copia del dispositivo y se actualizan por detrás.
  // Las versiones nuevas llegan con un service worker nuevo (cambia VERSION): al activarse, la app se recarga sola.
  if (r.mode === "navigate" || r.headers.get("accept")?.includes("text/html")) {
    const red = fetch(r, { cache: "no-cache" }).then((res) => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then((k) => k.put(r, c)); } return res; });
    e.respondWith(caches.match(r).then((m) => {
      if (m) { e.waitUntil(red.catch(() => {})); return m; }
      return red.catch(() => caches.match("/pedidos-textil/"));
    }));
    return;
  }
  // Archivos con huella (_next/static, fuentes, iconos): caché primero
  e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then((k) => k.put(r, c)); } return res; })));
});
