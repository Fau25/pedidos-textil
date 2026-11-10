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

const cacheUrl = new Map<string, { url: string; hasta: number }>();

/** URL firmada (1 h) de un archivo privado. «roly:REF» = foto compartida de Roly */
export async function urlArchivo(path?: string | null): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const hit = cacheUrl.get(path);
  if (hit && hit.hasta > Date.now()) return hit.url;
  const [bucket, ruta] = path.startsWith("roly:") ? ["roly", path.slice(5) + ".jpg"] : ["archivos", path];
  const { data } = await sb.storage.from(bucket).createSignedUrl(ruta, 3600);
  if (data?.signedUrl) cacheUrl.set(path, { url: data.signedUrl, hasta: Date.now() + 50 * 60_000 });
  return data?.signedUrl ?? null;
}

export async function subirArchivo(empresaId: string, carpeta: string, f: File): Promise<string> {
  const ext = (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${empresaId}/${carpeta}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from("archivos").upload(path, f, { upsert: false, contentType: f.type || undefined });
  if (error) throw error;
  return path;
}

/** Búsqueda del modelo en la web de Roly (abre en el navegador) */
export function enlaceRoly(p: { marca?: string | null; modelo?: string | null; referencia?: string | null }): string | null {
  if (!/roly/i.test(p.marca ?? "")) return null;
  const q = ["site:roly.es", p.modelo, (p.referencia ?? "").replace(/^[A-Z]+/i, "")].filter(Boolean).join(" ");
  return "https://www.google.com/search?q=" + encodeURIComponent(q);
}

/** Sube fotos de Roly a la carpeta privada compartida. El nombre debe llevar la referencia (p. ej. «Camiseta CA6554.jpg») */
export async function subirFotosRoly(files: File[], avance: (hechas: number) => void): Promise<{ ok: number; sinRef: string[] }> {
  let ok = 0; const sinRef: string[] = [];
  for (const f of files) {
    const ref = f.name.toUpperCase().match(/[A-Z]{2}\d{4}/)?.[0];
    if (!ref || !/^image\//.test(f.type)) { sinRef.push(f.name); continue; }
    const { error } = await sb.storage.from("roly").upload(ref + ".jpg", f, { upsert: true, contentType: f.type });
    if (error) throw error;
    cacheUrl.delete("roly:" + ref); ok++; avance(ok);
  }
  return { ok, sinRef };
}
