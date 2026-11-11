import { createClient } from "@supabase/supabase-js";

// Datos públicos del proyecto: la clave publicable está pensada para ir en el navegador.
// La seguridad la ponen las reglas (RLS) de la base de datos.
export const SUPABASE_URL = "https://sqartxsdlynecelkufyq.supabase.co";
export const SUPABASE_KEY = "sb_publishable_yfnqiDl0NRnKi7u9_nHiWg_KF4fBPYJ";

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const BASE = "/pedidos-textil";
export const SITIO = "https://fau25.github.io/pedidos-textil/";

/** Mensaje de error comprensible */
export function textoError(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/Invalid login credentials/i.test(m)) return "Email o contraseña incorrectos.";
  if (/Email not confirmed/i.test(m)) return "Falta confirmar el email: revisa tu correo y pulsa el enlace.";
  if (/no está invitado/i.test(m)) return m;
  if (/User already registered/i.test(m)) return "Ya existe una cuenta con ese email. Prueba a entrar.";
  if (/Password should be at least/i.test(m)) return "La contraseña debe tener al menos 8 caracteres.";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Sin conexión. Comprueba internet y vuelve a intentarlo.";
  if (/violates foreign key.*clientes/i.test(m) || /restrict/i.test(m)) return "No se puede borrar: tiene pedidos asociados.";
  if (/row-level security/i.test(m)) return "No tienes permiso para hacer este cambio.";
  return m;
}

// URLs firmadas: se piden por lotes (una petición para todas las fotos de una pantalla), valen 12 h
// y se guardan en el dispositivo, así el navegador reutiliza las fotos ya descargadas.
const DURA = 12 * 3600, CLAVE_CACHE = "urls-firmadas-1";
const cacheUrl: Map<string, { url: string; hasta: number }> = (() => {
  try { return new Map(Object.entries(JSON.parse(localStorage.getItem(CLAVE_CACHE) || "{}"))); } catch { return new Map(); }
})();
let guardarCache: ReturnType<typeof setTimeout> | null = null;
function persistir() {
  if (guardarCache) return;
  guardarCache = setTimeout(() => {
    guardarCache = null; const ahora = Date.now();
    try { localStorage.setItem(CLAVE_CACHE, JSON.stringify(Object.fromEntries([...cacheUrl].filter(([, v]) => v.hasta > ahora)))); } catch { /* sin almacenamiento */ }
  }, 500);
}
const colas = new Map<string, Map<string, ((u: string | null) => void)[]>>();
function pedirFirma(bucket: string, ruta: string): Promise<string | null> {
  return new Promise((res) => {
    let cola = colas.get(bucket);
    if (!cola) {
      cola = new Map(); colas.set(bucket, cola);
      setTimeout(async () => {
        const lote = colas.get(bucket)!; colas.delete(bucket);
        const rutas = [...lote.keys()];
        for (let i = 0; i < rutas.length; i += 100) {
          const parte = rutas.slice(i, i + 100);
          const { data } = await sb.storage.from(bucket).createSignedUrls(parte, DURA).catch(() => ({ data: null }));
          const porRuta = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
          for (const r of parte) { const u = porRuta.get(r) || null; for (const f of lote.get(r)!) f(u); }
        }
      }, 15);
    }
    const esperan = cola.get(ruta) ?? []; esperan.push(res); cola.set(ruta, esperan);
  });
}

/** URL ya firmada y vigente (sin esperar): para pintar la foto en el primer momento */
export function urlCacheada(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const hit = cacheUrl.get(path);
  return hit && hit.hasta > Date.now() ? hit.url : null;
}

/** URL firmada de un archivo privado. «roly:REF» = foto compartida de Roly */
export async function urlArchivo(path?: string | null): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const hit = cacheUrl.get(path);
  if (hit && hit.hasta > Date.now()) return hit.url;
  const [bucket, ruta] = path.startsWith("roly-mini:") ? ["roly", "mini/" + path.slice(10) + ".webp"]
    : path.startsWith("roly:") ? ["roly", path.slice(5) + ".jpg"] : ["archivos", path];
  const url = await pedirFirma(bucket, ruta);
  if (url) { cacheUrl.set(path, { url, hasta: Date.now() + (DURA - 600) * 1000 }); persistir(); }
  return url;
}

export async function subirArchivo(empresaId: string, carpeta: string, f: File, conMiniatura = false): Promise<string> {
  const ext = (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${empresaId}/${carpeta}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from("archivos").upload(path, f, { upsert: false, contentType: f.type || undefined });
  if (error) throw error;
  if (conMiniatura && /^image\//.test(f.type)) await subirMiniatura(path, f).catch(() => {});
  return path;
}

/* ───── Miniaturas: copia pequeña (400 px de ancho, WebP) de cada foto para las fichas; la original se usa al verla en grande ───── */

/** Ruta de la miniatura de una foto: «roly:REF» → «roly-mini:REF»; «empresa/x/y.jpg» → «empresa/mini/x/y.webp» */
export function miniDe(path?: string | null): string | null {
  if (!path || /^https?:\/\//i.test(path)) return null;
  if (path.startsWith("roly:")) return "roly-mini:" + path.slice(5);
  const [e, ...resto] = path.split("/");
  return resto.length ? `${e}/mini/${resto.join("/").replace(/\.[a-z0-9]+$/i, "")}.webp` : null;
}

/** Reduce una imagen a 400 px de ancho en WebP (calidad 0,8) */
export async function hacerMiniatura(b: Blob, ancho = 400): Promise<Blob> {
  const img = await createImageBitmap(b);
  const w = Math.min(ancho, img.width), h = Math.round((img.height * w) / img.width);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(img, 0, 0, w, h); img.close();
  return await new Promise<Blob>((ok, mal) => c.toBlob((x) => (x ? ok(x) : mal(new Error("No se pudo crear la miniatura"))), "image/webp", 0.8));
}

/** Crea y sube la miniatura de una foto ya subida (path como en imagen_path) */
export async function subirMiniatura(path: string, original: Blob) {
  const m = miniDe(path); if (!m) return;
  const [bucket, ruta] = m.startsWith("roly-mini:") ? ["roly", "mini/" + m.slice(10) + ".webp"] : ["archivos", m];
  const { error } = await sb.storage.from(bucket).upload(ruta, await hacerMiniatura(original), { upsert: true, contentType: "image/webp" });
  if (error) throw error;
  cacheUrl.delete(m); persistir();
}

/** Crea las miniaturas que falten: fotos de Roly (si eres administrador) y fotos propias del catálogo */
export async function crearMiniaturas(empresaId: string, admin: boolean, avance: (hechas: number, total: number) => void): Promise<number> {
  const tareas: { path: string; bajar: () => Promise<Blob | null> }[] = [];
  if (admin) {
    const { data } = await sb.storage.from("roly").list("", { limit: 1000 });
    const { data: hechas } = await sb.storage.from("roly").list("mini", { limit: 1000 });
    const ya = new Set((hechas ?? []).map((x) => x.name.replace(/\.webp$/, "")));
    for (const o of data ?? []) if (/\.jpe?g$/i.test(o.name) && !ya.has(o.name.replace(/\.jpe?g$/i, "")))
      tareas.push({ path: "roly:" + o.name.replace(/\.jpe?g$/i, ""), bajar: async () => (await sb.storage.from("roly").download(o.name)).data });
  }
  const { data: filas } = await sb.from("catalogo").select("imagen_path").eq("empresa_id", empresaId).not("imagen_path", "is", null);
  for (const f of filas ?? []) {
    const p = f.imagen_path as string;
    if (p.startsWith("roly:") || /^https?:/.test(p)) continue;
    const m = miniDe(p)!; const carpeta = m.slice(0, m.lastIndexOf("/")); const nombre = m.slice(m.lastIndexOf("/") + 1);
    const { data: hay } = await sb.storage.from("archivos").list(carpeta, { search: nombre });
    if (hay?.some((x) => x.name === nombre)) continue;
    tareas.push({ path: p, bajar: async () => (await sb.storage.from("archivos").download(p)).data });
  }
  let n = 0; avance(0, tareas.length);
  for (const t of tareas) { const b = await t.bajar(); if (b) await subirMiniatura(t.path, b); avance(++n, tareas.length); }
  return n;
}


/** Sube fotos de Roly a la carpeta privada compartida. El nombre debe llevar la referencia (p. ej. «Camiseta CA6554.jpg») */
export async function subirFotosRoly(files: File[], avance: (hechas: number) => void): Promise<{ ok: number; sinRef: string[] }> {
  let ok = 0; const sinRef: string[] = [];
  for (const f of files) {
    const ref = f.name.toUpperCase().match(/[A-Z]{2}\d{4}/)?.[0];
    if (!ref || !/^image\//.test(f.type)) { sinRef.push(f.name); continue; }
    const { error } = await sb.storage.from("roly").upload(ref + ".jpg", f, { upsert: true, contentType: f.type });
    if (error) throw error;
    await subirMiniatura("roly:" + ref, f).catch(() => {});
    cacheUrl.delete("roly:" + ref); persistir(); ok++; avance(ok);
    try { const c = await caches.open("pedidos-textil-fotos-1"); for (const k of await c.keys()) if (k.url.endsWith("/roly/" + ref + ".jpg") || k.url.endsWith("/roly/mini/" + ref + ".webp")) await c.delete(k); } catch { /* sin caché */ }
  }
  return { ok, sinRef };
}

/** Cerrar sesión borrando lo guardado en el dispositivo (datos del taller y enlaces de fotos) */
export async function salir() {
  try { for (const k of Object.keys(localStorage)) if (k.startsWith("sesion-cache:") || k.startsWith("carga:") || k.startsWith("listas:") || k.startsWith("pedido:") || k.startsWith("cambios:") || k === CLAVE_CACHE) localStorage.removeItem(k); } catch { /* nada */ }
  cacheUrl.clear();
  try { await caches.delete("pedidos-textil-fotos-1"); } catch { /* sin caché */ }
  await sb.auth.signOut();
}

/** Borra la cuenta del usuario y todos sus datos: archivos del taller (si es propietario), base de datos y acceso */
export async function borrarCuenta(empresaId: string | null, propietario: boolean) {
  if (empresaId && propietario) {
    // Archivos del taller (logo, diseños, fotos de prendas): se listan carpeta a carpeta y se borran
    const rutas: string[] = [];
    const recorrer = async (carpeta: string) => {
      for (let desde = 0; ; desde += 1000) {
        const { data, error } = await sb.storage.from("archivos").list(carpeta, { limit: 1000, offset: desde });
        if (error) throw error;
        for (const x of data ?? []) { const r = `${carpeta}/${x.name}`; if (x.id) rutas.push(r); else await recorrer(r); }
        if (!data || data.length < 1000) break;
      }
    };
    await recorrer(empresaId);
    for (let i = 0; i < rutas.length; i += 100) {
      const { error } = await sb.storage.from("archivos").remove(rutas.slice(i, i + 100));
      if (error) throw error;
    }
  }
  const { error } = await sb.rpc("borrar_mi_cuenta");
  if (error) throw error;
  await salir();
}

/** Borra una fila y ofrece «Deshacer» durante 6 s (la vuelve a insertar tal cual) */
export async function borrarConDeshacer(tabla: string, fila: Record<string, unknown> & { id: string }, texto: string,
  aviso: (t: string, tipo?: "ok" | "error", accion?: { texto: string; fn: () => void }) => void, despues: () => void) {
  const { error } = await sb.from(tabla).delete().eq("id", fila.id);
  if (error) return aviso(textoError(error), "error");
  despues();
  aviso(texto, "ok", { texto: "Deshacer", fn: async () => {
    const { error: e } = await sb.from(tabla).insert(fila);
    if (e) aviso(textoError(e), "error"); else { aviso("Recuperado"); despues(); }
  } });
}
