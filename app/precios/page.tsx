"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { useSesion } from "@/components/sesion";
import { Cabecera } from "@/components/marco";
import { Boton, CampoImporte, Cargando, Pestanas, Vacio, cx, useAvisos } from "@/components/ui";
import { FotoPrenda } from "@/components/bloques-pedido";
import { Tarifas } from "@/components/tarifas";
import { sb, textoError } from "@/lib/supabase";
import { useCarga } from "@/lib/usar";
import { HABITUALES, categoria, categorias } from "@/lib/categorias";
import { precioVentaUd } from "@/lib/calculo";
import type { Prenda } from "@/lib/tipos";

/** Precios: lo que cobras por cada prenda y por cada personalización. Al hacer un pedido salen solos */
export default function Precios() {
  const [tab, setTab] = useState<"prendas" | "personalizacion">("prendas");
  useEffect(() => { if (new URLSearchParams(location.search).get("tab") === "personalizacion") setTab("personalizacion"); }, []);
  return (
    <>
      <Cabecera titulo="Precios" sub="Lo que cobras por cada prenda y por cada personalización. Al hacer un pedido salen solos y siempre puedes cambiarlos a mano." />
      <Pestanas valor={tab} cambiar={setTab} opciones={[{ v: "prendas", t: "Prendas" }, { v: "personalizacion", t: "Personalización" }]} />
      <div className="mt-5">{tab === "prendas" ? <PreciosPrendas /> : <Tarifas />}</div>
    </>
  );
}

type Fila = Pick<Prenda, "id" | "tipo" | "marca" | "modelo" | "referencia" | "imagen_path" | "colores" | "favorito" | "precio_compra" | "precio_venta">;

function PreciosPrendas() {
  const { empresa } = useSesion();
  const { aviso } = useAvisos();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [soloSin, setSoloSin] = useState(false);
  const [masivo, setMasivo] = useState<number | null>(null);
  const [guardado, setGuardado] = useState<Set<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const { datos, setDatos, error, recargar } = useCarga(async () => ((await sb.from("catalogo")
    .select("id, tipo, marca, modelo, referencia, imagen_path, colores, favorito, precio_compra, precio_venta")
    .eq("empresa_id", empresa!.id).order("modelo").limit(5000)).data ?? []) as Fila[]);
  useEffect(() => { const t = timers.current; return () => t.forEach(clearTimeout); }, []);
  if (!datos) return <Cargando error={error} reintentar={recargar} />;
  if (!datos.length) return <Vacio titulo="Aún no hay prendas en el catálogo" texto="Añádelas en Catálogo y aquí podrás ponerles precio." />;

  const n = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const cats = categorias(datos);
  const actual = cat && cats.some((c) => c.nombre === cat) ? cat : cats[0]?.nombre ?? null;
  const enCat = datos.filter((p) => (q ? n([p.marca, p.modelo, p.tipo, p.referencia].join(" ")).includes(n(q))
    : actual === HABITUALES ? p.favorito : categoria(p.tipo) === actual));
  const lista = enCat.filter((p) => !soloSin || p.precio_venta === null)
    .sort((a, b) => Number(b.favorito) - Number(a.favorito) || (a.modelo ?? "").localeCompare(b.modelo ?? "", "es"));
  const sinPrecio = enCat.filter((p) => p.precio_venta === null);
  const totalSin = datos.filter((p) => p.precio_venta === null).length;

  /** Cambia el precio al momento y lo guarda medio segundo después de dejar de escribir */
  function poner(p: Fila, v: number | null) {
    setDatos((d) => d?.map((x) => (x.id === p.id ? { ...x, precio_venta: v } : x)) ?? d);
    const t = timers.current; clearTimeout(t.get(p.id));
    t.set(p.id, setTimeout(async () => {
      t.delete(p.id);
      const { error: e } = await sb.from("catalogo").update({ precio_venta: v }).eq("id", p.id);
      if (e) return aviso(textoError(e), "error");
      setGuardado((s) => new Set(s).add(p.id));
      setTimeout(() => setGuardado((s) => { const x = new Set(s); x.delete(p.id); return x; }), 1500);
    }, 600));
  }

  async function aplicarATodas() {
    if (masivo === null || !sinPrecio.length) return;
    const ids = sinPrecio.map((p) => p.id);
    const { error: e } = await sb.from("catalogo").update({ precio_venta: masivo }).in("id", ids);
    if (e) return aviso(textoError(e), "error");
    setDatos((d) => d?.map((x) => (ids.includes(x.id) ? { ...x, precio_venta: masivo } : x)) ?? d);
    aviso(`Precio puesto a ${ids.length} prenda${ids.length === 1 ? "" : "s"}`); setMasivo(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Buscar prenda</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-texto2" aria-hidden="true" />
          <input className="campo !rounded-full pl-10" placeholder="Buscar por modelo o referencia" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="flex h-11 cursor-pointer items-center gap-2 rounded-full bg-superficie px-4 text-[13px] ring-1 ring-borde">
          <input type="checkbox" className="size-4 accent-[var(--azul)]" checked={soloSin} onChange={(e) => setSoloSin(e.target.checked)} />
          Solo sin precio <span className="num text-texto2">({totalSin})</span>
        </label>
      </div>

      {!q && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Categorías">
          {cats.map((c) => (
            <button key={c.nombre} role="tab" aria-selected={c.nombre === actual} onClick={() => setCat(c.nombre)}
              className={cx("h-10 shrink-0 rounded-full px-4 text-[13px] font-semibold", c.nombre === actual ? "bg-acento text-sobre-acento" : "cristal text-texto")}>
              {c.nombre === HABITUALES ? "★ " : ""}{c.nombre} <span className="num opacity-60">{c.n}</span>
            </button>
          ))}
        </div>
      )}

      {sinPrecio.length > 0 && !q && (
        <div className="tarjeta flex flex-wrap items-center gap-3 p-4 text-[13px]">
          <span className="w-full min-w-0 sm:w-auto sm:flex-1">Hay <b>{sinPrecio.length}</b> prenda{sinPrecio.length === 1 ? "" : "s"} de <b>{actual === HABITUALES ? "habituales" : actual?.toLowerCase()}</b> sin precio. Ponles a todas:</span>
          <CampoImporte className="w-28 flex-1 sm:flex-none" valor={masivo} cambiar={setMasivo} aria-label="Precio para todas las prendas sin precio" />
          <Boton tam="s" variante="primario" disabled={masivo === null} onClick={aplicarATodas}>Aplicar</Boton>
        </div>
      )}

      {!lista.length ? <p className="py-8 text-center text-[14px] text-texto2">{soloSin ? "Todas las prendas de aquí tienen precio." : "No hay prendas que coincidan."}</p> : (
        <ul className="tarjeta divide-y divide-borde overflow-hidden">
          {lista.map((p) => {
            const sugerido = p.precio_venta === null && Number(p.precio_compra) > 0 ? precioVentaUd({ precio_compra: Number(p.precio_compra), precio_venta: null }, Number(empresa!.margen)) / 100 : null;
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <FotoPrenda path={p.imagen_path} tipo={p.tipo} color={p.colores[0] ?? ""} mini cubrir className="size-12 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{p.favorito && <span className="text-azul" aria-label="Habitual">★ </span>}{p.modelo || p.tipo}</p>
                  <p className="truncate text-[12px] text-texto2">{[p.tipo, p.referencia, p.marca].filter(Boolean).join(" · ")}</p>
                </div>
                <span className="w-5 shrink-0 text-emerald-700" aria-live="polite">{guardado.has(p.id) && <Check className="size-4" aria-label="Guardado" />}</span>
                <CampoImporte className="w-28 shrink-0" valor={p.precio_venta === null ? null : Number(p.precio_venta)} cambiar={(v) => poner(p, v)}
                  placeholder={sugerido ? sugerido.toFixed(2).replace(".", ",") : "Sin precio"} aria-label={`Precio de ${p.modelo || p.tipo}`} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
