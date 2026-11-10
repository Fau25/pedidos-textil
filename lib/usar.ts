"use client";
import { useEffect, useState } from "react";
import { useSesion } from "@/components/sesion";

/** Carga datos y los vuelve a cargar solos cuando hay cambios (tiempo real) o se vuelve a la app. */
export function useCarga<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const { version } = useSesion();
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let vivo = true;
    fn().then((d) => { if (vivo) { setDatos(d); setError(null); } }).catch((e) => vivo && setError(e?.message ?? String(e)));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, n, ...deps]);
  return { datos, error, recargar: () => setN((x) => x + 1), setDatos };
}

export function useParam(nombre: string) {
  const [v, setV] = useState<string | null>(null);
  useEffect(() => { setV(new URLSearchParams(location.search).get(nombre)); }, [nombre]);
  return v;
}
