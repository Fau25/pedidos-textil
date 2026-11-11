import { sb } from "./supabase";
import { VERSION } from "./version";

/** Registro de errores: lo que falla en el móvil de cualquiera queda apuntado en Supabase y se ve en Ajustes.
 *  Como mucho 10 por sesión y sin repetir el mismo mensaje. Si falla el registro, no pasa nada. */
let empresaActual: string | null = null;
export const fijarEmpresaErrores = (id: string | null) => { empresaActual = id; };
const vistos = new Set<string>();
export function apuntarError(e: unknown, detalle?: string) {
  try {
    const mensaje = String((e as { message?: string })?.message ?? e ?? "Error").slice(0, 500);
    // Lo que no es un fallo de la app (sin conexión, extensiones del navegador, recursos que no cargan) no se apunta
    if (/Failed to fetch|NetworkError|Load failed|ResizeObserver loop|chrome-extension|moz-extension|AbortError/i.test(mensaje)) return;
    if (vistos.has(mensaje) || vistos.size >= 10) return;
    vistos.add(mensaje);
    const det = (detalle ?? (e as { stack?: string })?.stack ?? "").slice(0, 4000) || null;
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      return sb.from("errores").insert({ mensaje, detalle: det, version: VERSION, ruta: location.pathname + location.search, empresa_id: empresaActual });
    }).catch(() => {});
  } catch { /* nunca romper la app por apuntar un error */ }
}

/** Escucha los errores no controlados de toda la app */
export function escucharErrores() {
  const a = (ev: ErrorEvent) => apuntarError(ev.error ?? ev.message);
  const b = (ev: PromiseRejectionEvent) => apuntarError(ev.reason);
  window.addEventListener("error", a); window.addEventListener("unhandledrejection", b);
  return () => { window.removeEventListener("error", a); window.removeEventListener("unhandledrejection", b); };
}
