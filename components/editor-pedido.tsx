"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, ChevronDown } from "lucide-react";
import { useSesion } from "./sesion";
import { Boton, Campo, CampoImporte, Tarjeta, cx, useAvisos } from "./ui";
import { sb, textoError } from "@/lib/supabase";
import { calcular, euros, tarifaPara, sumaUnidades } from "@/lib/calculo";
import { aCalc, claveBorrador, describirLinea, duplicar, guardarPedido, hoy, id, lineaVacia, cargarPedido, pedidoGuardado, type LineaEd, type PedidoEd, type PersEd } from "@/lib/pedidos";
import { SelectorCliente } from "./selector-cliente";
import { SelectorTecnica, TarjetaLinea, TarjetaPers } from "./bloques-pedido";
export { SelectorCliente };
import type { Cliente, Prenda } from "@/lib/tipos";


export function EditorPedido({ pedidoId, duplicarDe }: { pedidoId: string | null; duplicarDe: string | null }) {
  const { empresa, tecnicas, tarifas, proveedores, sesion } = useSesion();
  const BORRADOR = claveBorrador(sesion!.user.id);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { aviso, confirmar } = useAvisos();
  const router = useRouter();
  const margen = Number(empresa!.margen);
  const [p, setP] = useState<PedidoEd | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [guardando, setGuardando] = useState<"" | "pendiente">("");
  const [enviando, setEnviando] = useState(false);
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({ cliente: true, prendas: true, pers: true, notas: true });
  const [lineasAbiertas, setLineasAbiertas] = useState<Set<string> | null>(null);
  const [prendas, setPrendas] = useState<Prenda[]>([]);
  const [errorCliente, setErrorCliente] = useState(false);
  const cambiado = useRef(false);

  // Carga inicial: clientes, catálogo y pedido a la vez. Clientes y catálogo salen al momento de la copia local
  useEffect(() => {
    const k = "listas:" + empresa!.id;
    try { const c = JSON.parse(localStorage.getItem(k) || "null"); if (c) { setClientes(c.clientes); setPrendas(c.prendas); } } catch {}
    Promise.all([
      sb.from("clientes").select("*").eq("empresa_id", empresa!.id).order("nombre"),
      sb.from("catalogo").select("*").eq("empresa_id", empresa!.id).order("marca").order("modelo").limit(5000),
    ]).then(([c, cat]) => {
      if (c.error || cat.error) return;
      setClientes((c.data ?? []) as Cliente[]); setPrendas((cat.data ?? []) as Prenda[]);
      try { localStorage.setItem(k, JSON.stringify({ clientes: c.data, prendas: cat.data })); } catch {}
    }).catch(() => {});
    (async () => {
      if (pedidoId) {
        const copia = pedidoGuardado(pedidoId);
        if (copia) setP(copia); // al instante; se sustituye por el del servidor si aún no se ha tocado nada
        const r = await cargarPedido(pedidoId);
        if (!r) { aviso("No se encuentra el pedido", "error"); return router.replace("/pedidos/"); }
        if (!cambiado.current) setP(r.ed);
        return;
      }
      if (duplicarDe) {
        const r = await cargarPedido(duplicarDe);
        if (r) { setP(duplicar(r.ed)); cambiado.current = true; return; }
      }
      try {
        const g = JSON.parse(localStorage.getItem(BORRADOR) || "null") as PedidoEd | null;
        if (g && g.nuevo && (g.lineas.length || g.cliente_id)) { setP(g); aviso("Hemos recuperado el pedido que estabas creando"); return; }
      } catch {}
      setP({
        id: id(), nuevo: true, cliente_id: new URLSearchParams(location.search).get("cliente"), fecha: hoy(), entrega: null, entregado: false,
        referencia: "", notas: "", descuento_pct: 0, gastos_coste: 0, gastos_venta: 0, iva: Number(empresa!.iva),
        lineas: [lineaVacia(margen)], pers: [],
      });
    })().catch((e) => aviso(textoError(e), "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId, duplicarDe]);

  const t = useMemo(() => (p ? calcular(aCalc(p, margen)) : null), [p, margen]);

  // Borrador local si es nuevo (agrupado: no en cada letra); un pedido existente se guarda al pulsar Guardar
  useEffect(() => {
    if (!p || !cambiado.current) return;
    if (!p.nuevo) { setGuardando("pendiente"); return; }
    const t = setTimeout(() => { try { localStorage.setItem(BORRADOR, JSON.stringify(p)); } catch {} }, 400);
    return () => clearTimeout(t);
  }, [p, BORRADOR]);

  // Al abrir: pedido nuevo con todo desplegado; uno existente con las prendas plegadas
  useEffect(() => {
    if (!p || lineasAbiertas) return;
    setLineasAbiertas(new Set(p.nuevo ? p.lineas.map((l) => l.clave) : []));
    if (!p.nuevo) setAbiertos({ cliente: false, prendas: true, pers: true, notas: !!p.notas });
  }, [p, lineasAbiertas]);
  const alternar = (k: string) => setAbiertos((a) => ({ ...a, [k]: !a[k] }));
  const alternarLinea = (k: string) => setLineasAbiertas((s) => { const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x; });

  const set = useCallback((f: (x: PedidoEd) => PedidoEd) => { cambiado.current = true; setP((x) => (x ? f(x) : x)); }, []);
  const setLinea = (clave: string, cambio: Partial<LineaEd>) => set((x) => ({ ...x, lineas: x.lineas.map((l) => (l.clave === clave ? { ...l, ...cambio } : l)) }));
  const setPers = (clave: string, cambio: Partial<PersEd>) => set((x) => ({ ...x, pers: x.pers.map((z) => (z.clave === clave ? { ...z, ...cambio } : z)) }));

  // Tarifas automáticas: al cambiar unidades o técnica, se recalcula el precio (salvo precio manual)
  useEffect(() => {
    if (!p || !t) return;
    let cambia = false;
    const pers = p.pers.map((z, i) => {
      if (z.precio_manual) return z;
      const tf = tarifaPara(tarifas, z.tecnica_id, t.pers[i]?.unidades ?? 0);
      if (tf && (tf.coste !== z.coste_ud || tf.precio !== z.precio_ud)) { cambia = true; return { ...z, coste_ud: tf.coste, precio_ud: tf.precio }; }
      return z;
    });
    if (cambia) setP((x) => (x ? { ...x, pers } : x));
  }, [p, t, tarifas]);

  async function guardar() {
    if (!p) return;
    if (!p.cliente_id) { setErrorCliente(true); setAbiertos((a) => ({ ...a, cliente: true })); await new Promise((r) => setTimeout(r, 50)); document.getElementById("bloque-cliente")?.scrollIntoView({ behavior: "smooth", block: "center" }); return aviso("Elige un cliente para guardar el pedido", "error"); }
    setEnviando(true);
    if (temporizador.current) { clearTimeout(temporizador.current); temporizador.current = null; } // sin guardados solapados
    try {
      await guardarPedido(p, empresa!);
      if (p.nuevo) try { localStorage.removeItem(BORRADOR); } catch {}
      aviso(p.nuevo ? "Pedido creado" : "Cambios guardados");
      router.push(`/pedidos/ver/?id=${p.id}`);
    } catch (e) { aviso(textoError(e), "error"); setEnviando(false); }
  }

  /** Salir sin guardar */
  async function cancelar() {
    if (!p) return;
    if (p.nuevo) {
      if (cambiado.current && !(await confirmar({ titulo: "¿Salir sin guardar?", texto: "El pedido no se creará y se perderá lo que has escrito.", ok: "Salir sin guardar", peligro: true }))) return;
      try { localStorage.removeItem(BORRADOR); } catch {}
      return router.push("/pedidos/");
    }
    if (cambiado.current && !(await confirmar({ titulo: "¿Salir sin guardar?", texto: "Los cambios que has hecho no se guardarán.", ok: "Salir sin guardar", peligro: true }))) return;
    router.push(`/pedidos/ver/?id=${p.id}`);
  }

  if (!p || !t) return <div className="flex justify-center py-20 text-texto2"><Loader2 className="size-5 animate-spin" /></div>;
  const cliente = clientes.find((c) => c.id === p.cliente_id);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <button onClick={cancelar} className="-ml-1 mb-1 inline-flex h-10 items-center px-1 text-[13px] text-texto2 hover:text-texto">← Volver</button>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] sm:text-[28px]">{p.nuevo ? "Nuevo pedido" : `Editar ${p.numero}`}</h1>
        </div>
        <p className="text-[12px] text-texto2" aria-live="polite">
          {p.nuevo ? "Borrador guardado en este dispositivo" : guardando === "pendiente" ? "Cambios sin guardar" : ""}
        </p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_330px]">
        <div className="min-w-0 space-y-6">
          {/* 1 · Cliente y fechas */}
          <Seccion tarjeta id="bloque-cliente" titulo="Cliente y fecha" abierta={abiertos.cliente} alternar={() => alternar("cliente")}
            resumen={[cliente?.nombre ?? "Sin cliente", fechaCorta(p.fecha), p.referencia].filter(Boolean).join(" · ")}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <SelectorCliente clientes={clientes} valor={p.cliente_id} error={errorCliente}
                  cambiar={(cid) => { setErrorCliente(false); set((x) => ({ ...x, cliente_id: cid })); }}
                  creado={(c) => { setClientes((l) => [...l, c].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))); setErrorCliente(false); set((x) => ({ ...x, cliente_id: c.id })); }} />
                {cliente && <p className="mt-1.5 truncate text-[12px] text-texto2">{[cliente.contacto, cliente.telefono, cliente.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}</p>}
              </div>
              <Campo etiqueta="Fecha del pedido"><input type="date" className="campo" value={p.fecha} onChange={(e) => set((x) => ({ ...x, fecha: e.target.value }))} /></Campo>
              <Campo etiqueta="Referencia interna (opcional)" className="sm:col-span-2"><input className="campo" placeholder="Ej.: Temporada 26/27" value={p.referencia} onChange={(e) => set((x) => ({ ...x, referencia: e.target.value }))} /></Campo>
            </div>
          </Seccion>

          {/* 2 · Prendas */}
          <Seccion titulo={<>Prendas <span className="ml-1 text-[13px] font-normal text-texto2">{t.unidades} uds</span></>} abierta={abiertos.prendas} alternar={() => alternar("prendas")}
            resumen={p.lineas.length ? p.lineas.map((l) => [l.modelo || l.tipo, l.color].filter(Boolean).join(" ")).filter(Boolean).join(" · ") || `${p.lineas.length} prenda(s)` : "Sin prendas"}>
            <div className="space-y-4">
              {p.lineas.map((l, i) => (
                <TarjetaLinea key={l.clave} abierta={!!lineasAbiertas?.has(l.clave)} alternar={() => alternarLinea(l.clave)} l={l} n={i + 1} margen={margen} t={t.lineas[l.clave]} catalogo={prendas} proveedores={proveedores}
                  cambiar={(c) => setLinea(l.clave, c)}
                  duplicar={() => set((x) => { const k = x.lineas.findIndex((z) => z.clave === l.clave); const nueva = { ...l, clave: id(), color: "", tallas: {}, estado: "pendiente" as const }; const ls = [...x.lineas]; ls.splice(k + 1, 0, nueva);
                    return { ...x, lineas: ls, pers: x.pers.map((z) => (z.lineas.includes(l.clave) ? { ...z, lineas: [...z.lineas, nueva.clave] } : z)) }; })}
                  quitar={async () => {
                    if (sumaUnidades(Object.entries(l.tallas).map(([talla, cantidad]) => ({ talla, cantidad }))) > 0 && !(await confirmar({ titulo: "¿Quitar esta prenda?", texto: describirLinea(l), ok: "Quitar", peligro: true }))) return;
                    set((x) => ({ ...x, lineas: x.lineas.filter((z) => z.clave !== l.clave), pers: x.pers.map((z) => ({ ...z, lineas: z.lineas.filter((k) => k !== l.clave) })) }));
                  }} />
              ))}
              <button onClick={() => { const nueva = lineaVacia(margen); setLineasAbiertas(new Set([nueva.clave])); set((x) => ({ ...x, lineas: [...x.lineas, nueva] })); }}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-borde text-[14px] font-medium text-texto2 hover:border-acento hover:text-texto">
                <Plus className="size-4" />Añadir otra prenda
              </button>
            </div>
          </Seccion>

          {/* 3 · Personalización */}
          <Seccion titulo="Personalización" abierta={abiertos.pers} alternar={() => alternar("pers")}
            resumen={p.pers.length ? p.pers.map((z) => `${z.tecnica} · ${z.ubicacion}`).join(" · ") : "Sin personalización"}>
            <div className="space-y-4">
              {p.pers.map((z, i) => (
                <TarjetaPers key={z.clave} z={z} lineas={p.lineas} calc={t.pers[i]} tecnicas={tecnicas}
                  cambiar={(c) => setPers(z.clave, c)}
                  quitar={() => set((x) => ({ ...x, pers: x.pers.filter((q) => q.clave !== z.clave) }))}
                  usarTarifa={() => { const tf = tarifaPara(tarifas, z.tecnica_id, t.pers[i]?.unidades ?? 0); setPers(z.clave, { precio_manual: false, coste_ud: tf?.coste ?? 0, precio_ud: tf?.precio ?? 0 }); }} />
              ))}
              <div className="tarjeta p-5">
                <p className="mb-4 text-[13px] text-texto2">{p.pers.length ? "Añadir otra personalización:" : "Elige la técnica y después indica dónde va y a qué prendas se aplica."}</p>
                <SelectorTecnica grande tecnicas={tecnicas} elegir={(tec) => set((x) => ({ ...x, pers: [...x.pers, {
                  clave: id(), tecnica_id: tec.id, tecnica: tec.nombre, ubicacion: "Pecho izquierdo", aplicaciones: 1, coste_ud: 0, precio_ud: 0,
                  precio_manual: false, diseno_path: null, notas: "", estado: "pendiente", lineas: x.lineas.map((l) => l.clave),
                }] }))} />
              </div>
            </div>
          </Seccion>

          <Seccion tarjeta titulo="Observaciones" abierta={abiertos.notas} alternar={() => alternar("notas")} resumen={p.notas || "Sin observaciones"}>
            <textarea className="campo" rows={3} placeholder="Notas para el pedido (plazos, indicaciones del cliente…)" value={p.notas} onChange={(e) => set((x) => ({ ...x, notas: e.target.value }))} />
          </Seccion>
        </div>

        {/* Resumen fijo */}
        <aside className="xl:sticky xl:top-8">
          <Tarjeta titulo="Resumen">
            <dl className="space-y-2 text-[13px]">
              <Fila t="Prendas" v={euros(t.ventaPrendas)} />
              <Fila t="Personalización" v={euros(t.ventaPers)} />
              <div className="flex items-center justify-between gap-3">
                <dt className="text-texto2">Gastos adicionales</dt>
                <CampoImporte className="w-28" valor={p.gastos_venta || null} cambiar={(v) => set((x) => ({ ...x, gastos_venta: v ?? 0 }))} aria-label="Gastos adicionales (venta)" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-texto2">Descuento</dt>
                <div className="relative w-28"><input inputMode="decimal" aria-label="Descuento en %" className="campo num pr-7 text-right" value={p.descuento_pct || ""} placeholder="0"
                  onChange={(e) => { const n = Number(e.target.value.replace(",", ".")); set((x) => ({ ...x, descuento_pct: Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0 })); }} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-texto2">%</span></div>
              </div>
              {t.descuento > 0 && <Fila t="" v={"−" + euros(t.descuento)} />}
              <div className="my-2 border-t border-borde" />
              <Fila t="Base imponible" v={euros(t.base)} />
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1 text-texto2">IVA
                  <select className="ml-1 h-9 rounded-lg bg-suave px-2 text-[13px]" value={p.iva} onChange={(e) => set((x) => ({ ...x, iva: Number(e.target.value) }))} aria-label="Tipo de IVA">
                    {[21, 10, 4, 0].map((v) => <option key={v} value={v}>{v} %</option>)}
                  </select>
                </dt><dd className="num">{euros(t.iva)}</dd>
              </div>
              <div className="flex items-baseline justify-between pt-2"><dt className="font-semibold">Total</dt><dd className="num text-[24px] font-semibold tracking-[-0.02em]">{euros(t.total)}</dd></div>
            </dl>
            <div className="mt-4 hidden flex-col gap-2 xl:flex">
              <Boton variante="primario" cargando={enviando} onClick={() => guardar()}>{p.nuevo ? "Guardar pedido" : "Guardar y salir"}</Boton>
              <Boton onClick={cancelar}>Cancelar</Boton>
            </div>
          </Tarjeta>
        </aside>
      </div>

      {/* Barra de acciones (móvil) */}
      <div className="h-20 xl:hidden" />
      <div className="no-imprimir fixed inset-x-4 bottom-[92px] z-20 mx-auto flex max-w-[640px] lg:bottom-4 lg:left-[260px] items-center gap-3 rounded-[22px] border border-borde bg-superficie/95 px-4 py-3 shadow-[0_10px_30px_-12px_rgba(16,18,24,0.25)] backdrop-blur xl:hidden">
        <div className="min-w-0 flex-1"><p className="text-[11px] text-texto2">Total · {t.unidades} uds</p><p className="num text-[18px] font-semibold leading-tight">{euros(t.total)}</p></div>
        <Boton onClick={cancelar}>Cancelar</Boton>
        <Boton variante="primario" cargando={enviando} onClick={() => guardar()}>Guardar</Boton>
      </div>


    </>
  );
}

const Fila = ({ t, v }: { t: string; v: string }) => <div className="flex justify-between gap-3"><dt className="text-texto2">{t}</dt><dd className="num">{v}</dd></div>;


const fechaCorta = (f: string) => { try { return new Date(f + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" }); } catch { return f; } };

/** Bloque que se pliega: título (y resumen cuando está plegado) */
function Seccion({ titulo, resumen, abierta, alternar, tarjeta, id, children }: {
  titulo: React.ReactNode; resumen?: string; abierta: boolean; alternar: () => void; tarjeta?: boolean; id?: string; children: React.ReactNode;
}) {
  return (
    <section className={cx(tarjeta && "tarjeta")}>
      <button type="button" onClick={alternar} aria-expanded={abierta} id={id}
        className={cx("flex w-full items-center gap-3 text-left", tarjeta ? "min-h-14 px-5 py-3.5" : cx("min-h-11", abierta && "mb-3"), !abierta && !tarjeta && "tarjeta min-h-14 px-5 py-3.5")}>
        <span className="min-w-0 flex-1">
          <span className={cx("block font-semibold tracking-[-0.01em]", tarjeta || !abierta ? "text-[16px]" : "text-[19px]")}>{titulo}</span>
          {!abierta && resumen && <span className="mt-0.5 block truncate text-[13px] text-texto2">{resumen}</span>}
        </span>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-suave text-texto2"><ChevronDown className={cx("size-4 transition-transform", abierta && "rotate-180")} /></span>
      </button>
      {abierta && <div className={cx("animar", tarjeta && "px-5 pb-5")}>{children}</div>}
    </section>
  );
}
