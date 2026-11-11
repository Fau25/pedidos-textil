"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSesion } from "@/components/sesion";

/** Carga datos y los vuelve a cargar solos cuando hay cambios (tiempo real) o se vuelve a la app. */
// Última respuesta de cada pantalla: en memoria y en el dispositivo. Al abrir o volver a una pantalla
// se pinta al momento con lo último que se vio y se actualiza por detrás.
const memoria = new Map<string, unknown>();
const hash = (t: string) => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
function leer<T>(clave: string): T | null {
  if (memoria.has(clave)) return memoria.get(clave) as T;
  try { const v = localStorage.getItem("carga:" + clave); if (v) { const d = JSON.parse(v) as T; memoria.set(clave, d); return d; } } catch { /* nada */ }
  return null;
}
function guardar(clave: string, d: unknown) {
  memoria.set(clave, d);
  try { // solo datos simples (un Map o Set no se puede guardar tal cual)
    const v = JSON.stringify(d, (_, x) => { if (x instanceof Map || x instanceof Set || x instanceof Date) throw new Error("no guardable"); return x; });
    if (v.length < 400_000) localStorage.setItem("carga:" + clave, v);
  } catch { /* no guardable, lleno o sin almacenamiento: queda solo en memoria */ }
}

export function useCarga<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const { version, empresa } = useSesion();
  const clave = hash((empresa?.id ?? "") + fn.toString() + JSON.stringify(deps));
  const [datos, setDatos] = useState<T | null>(() => leer<T>(clave));
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let vivo = true;
    setError(null);
    fn().then((d) => { guardar(clave, d); if (vivo) setDatos(d); })
      .catch((e) => vivo && setError(/fetch|network|Load failed/i.test(String(e?.message ?? e)) ? "Sin conexión con el servidor." : String(e?.message ?? e)));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, n, ...deps]);
  // Al cambiar de registro (otra ficha), no enseñar el anterior mientras carga
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setDatos(leer<T>(clave)); }, deps);
  return { datos, error: datos ? null : error, recargar: () => setN((x) => x + 1), setDatos };
}

/** Parámetro de la URL (?id=…) que se actualiza al navegar entre fichas */
export function useParam(nombre: string) {
  return useSearchParams().get(nombre);
}
