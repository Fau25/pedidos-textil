"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSesion } from "@/components/sesion";

/** Carga datos y los vuelve a cargar solos cuando hay cambios (tiempo real) o se vuelve a la app. */
// Última respuesta de cada pantalla: al volver a ella se ve al momento mientras se actualiza
const memoria = new Map<string, unknown>();

export function useCarga<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const { version, empresa } = useSesion();
  const clave = (empresa?.id ?? "") + fn.toString() + JSON.stringify(deps);
  const [datos, setDatos] = useState<T | null>(() => (memoria.get(clave) as T) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let vivo = true;
    setError(null);
    fn().then((d) => { memoria.set(clave, d); if (vivo) setDatos(d); })
      .catch((e) => vivo && setError(/fetch|network|Load failed/i.test(String(e?.message ?? e)) ? "Sin conexión con el servidor." : String(e?.message ?? e)));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, n, ...deps]);
  // Al cambiar de registro (otra ficha), no enseñar el anterior mientras carga
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setDatos((memoria.get(clave) as T) ?? null); }, deps);
  return { datos, error, recargar: () => setN((x) => x + 1), setDatos };
}

/** Parámetro de la URL (?id=…) que se actualiza al navegar entre fichas */
export function useParam(nombre: string) {
  return useSearchParams().get(nombre);
}
