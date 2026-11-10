"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy, Trash2, ImagePlus, Paperclip, Shirt, Check, ChevronDown, Search, Loader2, Sparkles, X } from "lucide-react";
import { useSesion } from "./sesion";
import { Boton, Campo, CampoImporte, Hoja, Tarjeta, cx, useAvisos } from "./ui";
import { sb, subirArchivo, textoError, urlArchivo } from "@/lib/supabase";
import { calcular, euros, tarifaPara, precioVentaUd, sumaUnidades } from "@/lib/calculo";
import { aCalc, describirLinea, duplicar, guardarPedido, hoy, id, lineaVacia, ordenTalla, cargarPedido, type LineaEd, type PedidoEd, type PersEd } from "@/lib/pedidos";
import { crearPresupuesto } from "@/lib/presupuestos";
import { TALLAS, TALLAS_NINO, TIPOS_PRENDA, UBICACIONES, type Cliente, type Prenda } from "@/lib/tipos";

const BORRADOR = "pedido-borrador";

export function EditorPedido({ pedidoId, duplicarDe }: { pedidoId: string | null; duplicarDe: string | null }) {
  const { empresa, estadoClave, tecnicas, tarifas, proveedores } = useSesion();
  const { aviso, confirmar } = useAvisos();
  const router = useRouter();
  const margen = Number(empresa!.margen);
  const [p, setP] = useState<PedidoEd | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [guardando, setGuardando] = useState<"" | "guardando" | "guardado" | "error">("");
  const [enviando, setEnviando] = useState(false);
  const [catalogo, setCatalogo] = useState(false);
  const [errorCliente, setErrorCliente] = useState(false);
  const cambiado = useRef(false);

  // Carga inicial
  useEffect(() => {
    (async () => {
      const c = await sb.from("clientes").select("*").eq("empresa_id", empresa!.id).order("nombre");
      setClientes((c.data ?? []) as Cliente[]);
      if (pedidoId) {
        const r = await cargarPedido(pedidoId);
        if (!r) { aviso("No se encuentra el pedido", "error"); return router.replace("/pedidos/"); }
        return setP(r.ed);
      }
      const borrador = estadoClave("borrador")?.id ?? null;
      if (duplicarDe) {
        const r = await cargarPedido(duplicarDe);
        if (r) { setP(duplicar(r.ed, borrador)); cambiado.current = true; return; }
      }
      try {
        const g = JSON.parse(localStorage.getItem(BORRADOR) || "null") as PedidoEd | null;
        if (g && g.nuevo && (g.lineas.length || g.cliente_id)) { setP(g); aviso("Hemos recuperado el pedido que estabas creando"); return; }
      } catch {}
      setP({
        id: id(), nuevo: true, cliente_id: new URLSearchParams(location.search).get("cliente"), fecha: hoy(), entrega: null, estado_id: borrador,
        referencia: "", notas: "", descuento_pct: 0, gastos_coste: 0, gastos_venta: 0, iva: Number(empresa!.iva),
        lineas: [lineaVacia(margen)], pers: [],
      });
    })().catch((e) => aviso(textoError(e), "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId, duplicarDe]);

  const t = useMemo(() => (p ? calcular(aCalc(p, margen)) : null), [p, margen]);

  // Autoguardado: borrador local si es nuevo; en la base si ya existe
  useEffect(() => {
    if (!p || !cambiado.current) return;
    if (p.nuevo) { try { localStorage.setItem(BORRADOR, JSON.stringify(p)); } catch {} return; }
    setGuardando("guardando");
    const h = setTimeout(async () => {
      try { await guardarPedido(p, empresa!); setGuardando("guardado"); }
      catch (e) { setGuardando("error"); aviso(textoError(e), "error"); }
    }, 900);
    return () => clearTimeout(h);
  }, [p, empresa, aviso]);

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

  async function guardar(presupuesto = false) {
    if (!p) return;
    if (!p.cliente_id) { setErrorCliente(true); document.getElementById("bloque-cliente")?.scrollIntoView({ behavior: "smooth", block: "center" }); return aviso("Elige un cliente para guardar el pedido", "error"); }
    setEnviando(true);
    try {
      await guardarPedido(p, empresa!);
      if (p.nuevo) try { localStorage.removeItem(BORRADOR); } catch {}
      if (presupuesto) {
        await crearPresupuesto(p.id, empresa!);
        aviso("Pedido guardado y presupuesto generado");
        router.push(`/pedidos/ver/?id=${p.id}&tab=presupuesto`);
      } else {
        aviso(p.nuevo ? "Pedido creado" : "Cambios guardados");
        router.push(`/pedidos/ver/?id=${p.id}`);
      }
    } catch (e) { aviso(textoError(e), "error"); setEnviando(false); }
  }

  async function descartar() {
    if (!(await confirmar({ titulo: "¿Descartar este pedido?", texto: "Se perderá lo que has escrito.", ok: "Descartar", peligro: true }))) return;
    try { localStorage.removeItem(BORRADOR); } catch {}
    router.push("/pedidos/");
  }

  if (!p || !t) return <div className="flex justify-center py-20 text-texto2"><Loader2 className="size-5 animate-spin" /></div>;
  const cliente = clientes.find((c) => c.id === p.cliente_id);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <button onClick={() => router.back()} className="mb-2 text-[13px] text-texto2 hover:text-texto">← Volver</button>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] sm:text-[28px]">{p.nuevo ? "Nuevo pedido" : `Editar ${p.numero}`}</h1>
        </div>
        <p className="text-[12px] text-texto2" aria-live="polite">
          {p.nuevo ? "Borrador guardado en este dispositivo" : guardando === "guardando" ? "Guardando…" : guardando === "guardado" ? "✓ Guardado automáticamente" : guardando === "error" ? "No se pudo guardar" : ""}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_330px]">
        <div className="space-y-6">
          {/* 1 · Cliente y fechas */}
          <Tarjeta titulo={<span id="bloque-cliente">Cliente</span>}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <SelectorCliente clientes={clientes} valor={p.cliente_id} error={errorCliente}
                  cambiar={(cid) => { setErrorCliente(false); set((x) => ({ ...x, cliente_id: cid })); }}
                  creado={(c) => { setClientes((l) => [...l, c].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))); setErrorCliente(false); set((x) => ({ ...x, cliente_id: c.id })); }} />
                {cliente && <p className="mt-1.5 truncate text-[12px] text-texto2">{[cliente.contacto, cliente.telefono, cliente.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}</p>}
              </div>
              <Campo etiqueta="Fecha del pedido"><input type="date" className="campo" value={p.fecha} onChange={(e) => set((x) => ({ ...x, fecha: e.target.value }))} /></Campo>
              <Campo etiqueta="Entrega prevista"><input type="date" className="campo" value={p.entrega ?? ""} min={p.fecha} onChange={(e) => set((x) => ({ ...x, entrega: e.target.value || null }))} /></Campo>
              <Campo etiqueta="Referencia interna (opcional)" className="sm:col-span-2"><input className="campo" placeholder="Ej.: Temporada 26/27" value={p.referencia} onChange={(e) => set((x) => ({ ...x, referencia: e.target.value }))} /></Campo>
            </div>
          </Tarjeta>

          {/* 2 · Prendas */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">Prendas <span className="ml-1 text-[13px] font-normal text-texto2">{t.unidades} uds</span></h2>
            </div>
            <div className="space-y-4">
              {p.lineas.map((l, i) => (
                <TarjetaLinea key={l.clave} l={l} n={i + 1} margen={margen} t={t.lineas[l.clave]} proveedores={proveedores}
                  cambiar={(c) => setLinea(l.clave, c)}
                  duplicar={() => set((x) => { const k = x.lineas.findIndex((z) => z.clave === l.clave); const nueva = { ...l, clave: id(), color: "", tallas: {}, estado: "pendiente" as const }; const ls = [...x.lineas]; ls.splice(k + 1, 0, nueva);
                    return { ...x, lineas: ls, pers: x.pers.map((z) => (z.lineas.includes(l.clave) ? { ...z, lineas: [...z.lineas, nueva.clave] } : z)) }; })}
                  quitar={async () => {
                    if (sumaUnidades(Object.entries(l.tallas).map(([talla, cantidad]) => ({ talla, cantidad }))) > 0 && !(await confirmar({ titulo: "¿Quitar esta prenda?", texto: describirLinea(l), ok: "Quitar", peligro: true }))) return;
                    set((x) => ({ ...x, lineas: x.lineas.filter((z) => z.clave !== l.clave), pers: x.pers.map((z) => ({ ...z, lineas: z.lineas.filter((k) => k !== l.clave) })) }));
                  }} />
              ))}
              <div className="flex flex-wrap gap-2">
                <Boton onClick={() => set((x) => ({ ...x, lineas: [...x.lineas, lineaVacia(margen)] }))}><Plus className="size-4" />Añadir prenda</Boton>
                <Boton variante="fantasma" onClick={() => setCatalogo(true)}><Shirt className="size-4" />Desde el catálogo</Boton>
              </div>
            </div>
          </section>

          {/* 3 · Personalización */}
          <section>
            <h2 className="mb-3 text-[17px] font-semibold">Personalización</h2>
            <div className="space-y-4">
              {!p.pers.length && <p className="tarjeta p-5 text-[13px] text-texto2">Sin personalización. Añade bordado, serigrafía, vinilo o DTF y elige a qué prendas se aplica.</p>}
              {p.pers.map((z, i) => (
                <TarjetaPers key={z.clave} z={z} lineas={p.lineas} calc={t.pers[i]} tecnicas={tecnicas}
                  cambiar={(c) => setPers(z.clave, c)}
                  quitar={() => set((x) => ({ ...x, pers: x.pers.filter((q) => q.clave !== z.clave) }))}
                  usarTarifa={() => { const tf = tarifaPara(tarifas, z.tecnica_id, t.pers[i]?.unidades ?? 0); setPers(z.clave, { precio_manual: false, coste_ud: tf?.coste ?? 0, precio_ud: tf?.precio ?? 0 }); }} />
              ))}
              <Boton onClick={() => {
                const tec = tecnicas[0];
                set((x) => ({ ...x, pers: [...x.pers, { clave: id(), tecnica_id: tec?.id ?? null, tecnica: tec?.nombre ?? "Bordado", ubicacion: "Pecho izquierdo", aplicaciones: 1, coste_ud: 0, precio_ud: 0, precio_manual: false, diseno_path: null, notas: "", estado: "pendiente", lineas: x.lineas.map((l) => l.clave) }] }));
              }}><Sparkles className="size-4" />Añadir personalización</Boton>
            </div>
          </section>

          <Tarjeta titulo="Observaciones">
            <textarea className="campo" rows={3} placeholder="Notas para el pedido (plazos, indicaciones del cliente…)" value={p.notas} onChange={(e) => set((x) => ({ ...x, notas: e.target.value }))} />
          </Tarjeta>
        </div>

        {/* Resumen fijo */}
        <aside className="lg:sticky lg:top-8">
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
                  <select className="ml-1 rounded-md bg-suave px-1 py-0.5 text-[12px]" value={p.iva} onChange={(e) => set((x) => ({ ...x, iva: Number(e.target.value) }))} aria-label="Tipo de IVA">
                    {[21, 10, 4, 0].map((v) => <option key={v} value={v}>{v} %</option>)}
                  </select>
                </dt><dd className="num">{euros(t.iva)}</dd>
              </div>
              <div className="flex items-baseline justify-between pt-2"><dt className="font-semibold">Total</dt><dd className="num text-[24px] font-semibold tracking-[-0.02em]">{euros(t.total)}</dd></div>
            </dl>
            <div className={cx("mt-4 rounded-xl p-3 text-[13px]", t.margen >= 0 ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300")}>
              <div className="flex justify-between"><span>Margen bruto</span><b className="num">{euros(t.margen)} · {t.margenPct.toLocaleString("es-ES")} %</b></div>
              <details className="mt-1">
                <summary className="cursor-pointer text-[12px] opacity-80">Ver costes</summary>
                <dl className="mt-2 space-y-1 text-[12px]">
                  <Fila t="Coste prendas" v={euros(t.costePrendas)} />
                  <Fila t="Coste personalización" v={euros(t.costePers)} />
                  <div className="flex items-center justify-between gap-2"><dt>Otros gastos (coste)</dt><CampoImporte className="w-24" valor={p.gastos_coste || null} cambiar={(v) => set((x) => ({ ...x, gastos_coste: v ?? 0 }))} aria-label="Otros gastos de coste" /></div>
                  <Fila t="Coste total" v={euros(t.coste)} />
                </dl>
              </details>
            </div>
            <div className="mt-4 hidden flex-col gap-2 lg:flex">
              <Boton variante="primario" cargando={enviando} onClick={() => guardar(true)}>Guardar y generar presupuesto</Boton>
              <Boton onClick={() => guardar(false)} disabled={enviando}>{p.nuevo ? "Guardar pedido" : "Guardar y salir"}</Boton>
              {p.nuevo && <Boton variante="fantasma" onClick={descartar}>Descartar</Boton>}
            </div>
          </Tarjeta>
        </aside>
      </div>

      {/* Barra de acciones (móvil) */}
      <div className="no-imprimir fixed inset-x-0 bottom-16 z-20 flex items-center gap-3 border-t border-borde bg-superficie/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1"><p className="text-[11px] text-texto2">Total · {t.unidades} uds</p><p className="num text-[18px] font-semibold leading-tight">{euros(t.total)}</p></div>
        <Boton onClick={() => guardar(false)} disabled={enviando}>Guardar</Boton>
        <Boton variante="primario" cargando={enviando} onClick={() => guardar(true)}>Presupuesto</Boton>
      </div>

      <Catalogo abierto={catalogo} cerrar={() => setCatalogo(false)} margen={margen}
        elegir={(pr, color) => { set((x) => ({ ...x, lineas: [...x.lineas.filter((l) => !(sumaUnidades(Object.entries(l.tallas).map(([a, b]) => ({ talla: a, cantidad: b }))) === 0 && !l.marca && !l.modelo && !l.precio_compra)), lineaVacia(margen, {
          tipo: pr.tipo, marca: pr.marca ?? "", modelo: pr.modelo ?? "", color, proveedor_id: pr.proveedor_id, precio_compra: Number(pr.precio_compra), precio_venta: pr.precio_venta === null ? null : Number(pr.precio_venta), imagen_path: pr.imagen_path,
        })] })); setCatalogo(false); }} />
    </>
  );
}

const Fila = ({ t, v }: { t: string; v: string }) => <div className="flex justify-between gap-3"><dt className="text-texto2">{t}</dt><dd className="num">{v}</dd></div>;

/* ───────── Cliente ───────── */
function SelectorCliente({ clientes, valor, cambiar, creado, error }: { clientes: Cliente[]; valor: string | null; cambiar: (id: string) => void; creado: (c: Cliente) => void; error?: boolean }) {
  const { empresa } = useSesion();
  const { aviso } = useAvisos();
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [alta, setAlta] = useState<{ nombre: string; telefono: string; email: string; contacto: string } | null>(null);
  const [creando, setCreando] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const actual = clientes.find((c) => c.id === valor);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const lista = clientes.filter((c) => !q || norm([c.nombre, c.contacto, c.telefono, c.email].join(" ")).includes(norm(q))).slice(0, 8);
  const opciones = [...lista.map((c) => ({ c })), ...(q.trim() ? [{ nuevo: q.trim() }] : [{ nuevo: "" }])];

  useEffect(() => {
    const f = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener("mousedown", f);
    return () => document.removeEventListener("mousedown", f);
  }, []);

  const elegir = (o: (typeof opciones)[number]) => {
    if ("c" in o) { cambiar(o.c.id); setAbierto(false); setQ(""); }
    else { setAlta({ nombre: o.nuevo, telefono: "", email: "", contacto: "" }); setAbierto(false); }
  };

  return (
    <div ref={caja} className="relative">
      <span className="mb-1.5 block text-[12px] font-medium text-texto2">Cliente</span>
      <div className={cx("campo flex items-center gap-2 px-3", error && "border-red-500")}>
        <Search className="size-4 shrink-0 text-texto2" />
        <input role="combobox" aria-expanded={abierto} aria-label="Buscar cliente" className="h-full flex-1 bg-transparent outline-none"
          placeholder={actual ? actual.nombre : "Buscar o crear cliente…"} value={abierto ? q : actual?.nombre ?? q}
          onFocus={() => { setAbierto(true); setQ(""); setSel(0); }}
          onChange={(e) => { setQ(e.target.value); setAbierto(true); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, opciones.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter") { e.preventDefault(); elegir(opciones[sel]); }
            if (e.key === "Escape") setAbierto(false);
          }} />
        <ChevronDown className="size-4 text-texto2" />
      </div>
      {error && <span className="mt-1 block text-[12px] text-red-600">Elige o crea un cliente</span>}
      {abierto && (
        <div className="animar absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-borde bg-superficie p-1 shadow-xl" role="listbox">
          {opciones.map((o, i) => (
            <button key={"c" in o ? o.c.id : "nuevo"} role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(o)}
              className={cx("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left", i === sel && "bg-suave")}>
              {"c" in o ? (<><span className="min-w-0 flex-1"><span className="block truncate">{o.c.nombre}</span>{o.c.contacto && <span className="block truncate text-[12px] text-texto2">{o.c.contacto}</span>}</span>{o.c.id === valor && <Check className="size-4 text-acento" />}</>)
                : <span className="flex items-center gap-2 font-medium text-acento"><Plus className="size-4" />{o.nuevo ? `Crear «${o.nuevo}»` : "Crear cliente nuevo"}</span>}
            </button>
          ))}
        </div>
      )}
      <Hoja abierta={!!alta} cerrar={() => setAlta(null)} titulo="Nuevo cliente"
        pie={<><Boton onClick={() => setAlta(null)}>Cancelar</Boton><Boton variante="primario" cargando={creando} form="alta-cliente" type="submit">Crear cliente</Boton></>}>
        {alta && (
          <form id="alta-cliente" className="space-y-4" onSubmit={async (e) => {
            e.preventDefault(); setCreando(true);
            const { data, error } = await sb.from("clientes").insert({ empresa_id: empresa!.id, nombre: alta.nombre.trim(), contacto: alta.contacto || null, telefono: alta.telefono || null, email: alta.email || null }).select("*").single();
            setCreando(false);
            if (error) return aviso(textoError(error), "error");
            creado(data as Cliente); setAlta(null); aviso("Cliente creado");
          }}>
            <Campo etiqueta="Nombre o empresa"><input className="campo" required value={alta.nombre} onChange={(e) => setAlta({ ...alta, nombre: e.target.value })} /></Campo>
            <Campo etiqueta="Persona de contacto"><input className="campo" value={alta.contacto} onChange={(e) => setAlta({ ...alta, contacto: e.target.value })} /></Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Teléfono"><input className="campo" type="tel" value={alta.telefono} onChange={(e) => setAlta({ ...alta, telefono: e.target.value })} /></Campo>
              <Campo etiqueta="Email"><input className="campo" type="email" value={alta.email} onChange={(e) => setAlta({ ...alta, email: e.target.value })} /></Campo>
            </div>
            <p className="text-[12px] text-texto2">El resto de datos (NIF, dirección, facturación) los puedes completar después en Clientes.</p>
          </form>
        )}
      </Hoja>
    </div>
  );
}

/* ───────── Prenda con matriz de tallas ───────── */
function TarjetaLinea({ l, n, margen, t, proveedores, cambiar, duplicar, quitar }: {
  l: LineaEd; n: number; margen: number; t?: { unidades: number; ventaUd: number; venta: number }; proveedores: { id: string; nombre: string }[];
  cambiar: (c: Partial<LineaEd>) => void; duplicar: () => void; quitar: () => void;
}) {
  const { empresa } = useSesion();
  const { aviso } = useAvisos();
  const [nino, setNino] = useState(() => Object.keys(l.tallas).some((k) => TALLAS_NINO.includes(k)));
  const [img, setImg] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [nuevaTalla, setNuevaTalla] = useState("");
  useEffect(() => { urlArchivo(l.imagen_path).then(setImg); }, [l.imagen_path]);
  const base = nino ? TALLAS_NINO : TALLAS;
  const tallas = [...base, ...Object.keys(l.tallas).filter((k) => !base.includes(k))].sort((a, b) => ordenTalla(a) - ordenTalla(b));
  const pvSugerido = precioVentaUd({ precio_compra: l.precio_compra, precio_venta: null }, margen) / 100;

  return (
    <div className="tarjeta animar">
      <div className="flex items-start gap-3 border-b border-borde px-4 py-3 sm:px-5">
        <label className="relative grid size-14 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl bg-suave text-texto2 hover:ring-2 hover:ring-acento/40" title="Imagen de la prenda">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {img ? <img src={img} alt="" className="size-full object-cover" /> : subiendo ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          <input type="file" accept="image/*" className="sr-only" aria-label="Subir imagen de la prenda" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return; setSubiendo(true);
            try { cambiar({ imagen_path: await subirArchivo(empresa!.id, "prendas", f) }); } catch (err) { aviso(textoError(err), "error"); } finally { setSubiendo(false); }
          }} />
        </label>
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-4">
          <input className="campo font-medium" list="tipos-prenda" aria-label={`Tipo de prenda ${n}`} placeholder="Tipo de prenda" value={l.tipo} onChange={(e) => cambiar({ tipo: e.target.value })} />
          <input className="campo" aria-label="Marca" placeholder="Marca" value={l.marca} onChange={(e) => cambiar({ marca: e.target.value })} />
          <input className="campo" aria-label="Modelo o referencia" placeholder="Modelo / ref." value={l.modelo} onChange={(e) => cambiar({ modelo: e.target.value })} />
          <input className="campo" aria-label="Color" placeholder="Color" value={l.color} onChange={(e) => cambiar({ color: e.target.value })} />
        </div>
        <datalist id="tipos-prenda">{TIPOS_PRENDA.map((x) => <option key={x} value={x} />)}</datalist>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-medium text-texto2">Cantidades por talla</span>
          <div className="flex rounded-lg bg-suave p-0.5 text-[12px]">
            <button className={cx("rounded-md px-2 py-0.5", !nino && "bg-superficie shadow-sm")} onClick={() => setNino(false)}>Adulto</button>
            <button className={cx("rounded-md px-2 py-0.5", nino && "bg-superficie shadow-sm")} onClick={() => setNino(true)}>Niño</button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {tallas.map((k) => (
            <label key={k} className="flex w-[58px] flex-col items-center gap-1">
              <span className="text-[11px] font-semibold text-texto2">{k}</span>
              <input type="number" inputMode="numeric" min={0} className={cx("campo sin-flechas num h-10 px-1 text-center", (l.tallas[k] ?? 0) > 0 && "border-acento/50 bg-acento-suave font-semibold")}
                value={l.tallas[k] || ""} placeholder="0" aria-label={`Cantidad talla ${k}`}
                onFocus={(e) => e.target.select()}
                onChange={(e) => { const v = Math.max(0, Math.floor(Number(e.target.value) || 0)); const nt = { ...l.tallas }; if (v) nt[k] = v; else delete nt[k]; cambiar({ tallas: nt }); }} />
            </label>
          ))}
          <form className="flex w-[70px] flex-col items-center gap-1" onSubmit={(e) => { e.preventDefault(); const k = nuevaTalla.trim(); if (k && !(k in l.tallas)) { cambiar({ tallas: { ...l.tallas, [k]: 0 } }); } setNuevaTalla(""); }}>
            <span className="text-[11px] text-texto2">Otra</span>
            <input className="campo h-10 px-1 text-center text-[12px]" placeholder="Única" value={nuevaTalla} onChange={(e) => setNuevaTalla(e.target.value)} aria-label="Añadir otra talla" onBlur={(e) => e.currentTarget.form?.requestSubmit()} />
          </form>
          <div className="ml-auto flex h-10 items-center rounded-xl bg-suave px-3 text-[13px]"><span className="text-texto2">Total</span><b className="num ml-2 text-[16px]">{t?.unidades ?? 0}</b><span className="ml-1 text-texto2">uds</span></div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Campo etiqueta="Proveedor">
            <select className="campo" value={l.proveedor_id ?? ""} onChange={(e) => cambiar({ proveedor_id: e.target.value || null })}>
              <option value="">—</option>{proveedores.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Precio compra / ud"><CampoImporte valor={l.precio_compra || null} cambiar={(v) => cambiar({ precio_compra: v ?? 0 })} /></Campo>
          <Campo etiqueta="Precio venta / ud" ayuda={l.precio_venta === null ? `Con tu margen (${margen} %)` : undefined}>
            <CampoImporte valor={l.precio_venta} placeholder={pvSugerido.toFixed(2).replace(".", ",")} cambiar={(v) => cambiar({ precio_venta: v })} />
          </Campo>
          <div className="flex flex-col justify-end"><span className="mb-1.5 text-[12px] font-medium text-texto2">Importe</span><span className="num flex h-10 items-center justify-end text-[15px] font-semibold">{euros(t?.venta ?? 0)}</span></div>
        </div>
        <input className="campo mt-3" placeholder="Observaciones de esta prenda" value={l.notas} onChange={(e) => cambiar({ notas: e.target.value })} aria-label="Observaciones de la prenda" />
      </div>
      <div className="flex flex-wrap gap-1 border-t border-borde px-3 py-2">
        <Boton tam="s" variante="fantasma" onClick={duplicar}><Copy className="size-3.5" />Duplicar con otro color</Boton>
        <Boton tam="s" variante="fantasma" className="ml-auto hover:text-red-600" onClick={quitar}><Trash2 className="size-3.5" />Quitar</Boton>
      </div>
    </div>
  );
}

/* ───────── Personalización ───────── */
function TarjetaPers({ z, lineas, calc, tecnicas, cambiar, quitar, usarTarifa }: {
  z: PersEd; lineas: LineaEd[]; calc?: { unidades: number; coste: number; venta: number }; tecnicas: { id: string; nombre: string }[];
  cambiar: (c: Partial<PersEd>) => void; quitar: () => void; usarTarifa: () => void;
}) {
  const { empresa } = useSesion();
  const { aviso } = useAvisos();
  const [subiendo, setSubiendo] = useState(false);
  const [img, setImg] = useState<string | null>(null);
  useEffect(() => { urlArchivo(z.diseno_path).then(setImg); }, [z.diseno_path]);
  const alternar = (k: string) => cambiar({ lineas: z.lineas.includes(k) ? z.lineas.filter((x) => x !== k) : [...z.lineas, k] });

  return (
    <div className="tarjeta animar p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_100px]">
        <Campo etiqueta="Técnica">
          <select className="campo" value={z.tecnica_id ?? ""} onChange={(e) => { const tc = tecnicas.find((x) => x.id === e.target.value); cambiar({ tecnica_id: tc?.id ?? null, tecnica: tc?.nombre ?? z.tecnica, precio_manual: false }); }}>
            {tecnicas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Ubicación"><input className="campo" list="ubicaciones" value={z.ubicacion} onChange={(e) => cambiar({ ubicacion: e.target.value })} /></Campo>
        <Campo etiqueta="Nº aplic."><input type="number" min={1} className="campo num text-center" value={z.aplicaciones} onChange={(e) => cambiar({ aplicaciones: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} /></Campo>
        <datalist id="ubicaciones">{UBICACIONES.map((x) => <option key={x} value={x} />)}</datalist>
      </div>

      <p className="mb-2 mt-4 text-[12px] font-medium text-texto2">Se aplica a</p>
      <div className="flex flex-wrap gap-2">
        {lineas.map((l) => {
          const on = z.lineas.includes(l.clave);
          return (
            <button key={l.clave} onClick={() => alternar(l.clave)} aria-pressed={on}
              className={cx("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium", on ? "border-acento bg-acento-suave text-acento" : "border-borde text-texto2")}>
              {on && <Check className="size-3.5" />}{[l.tipo, l.color].filter(Boolean).join(" · ") || "Prenda"}
            </button>
          );
        })}
        {lineas.length > 1 && <button className="h-8 px-2 text-[12px] text-acento" onClick={() => cambiar({ lineas: z.lineas.length === lineas.length ? [] : lineas.map((l) => l.clave) })}>{z.lineas.length === lineas.length ? "Ninguna" : "Todas"}</button>}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <Campo etiqueta="Coste / ud"><CampoImporte valor={z.coste_ud} cambiar={(v) => cambiar({ coste_ud: v ?? 0, precio_manual: true })} /></Campo>
        <Campo etiqueta="Precio / ud" ayuda={z.precio_manual ? undefined : `Tarifa para ${calc?.unidades ?? 0} uds`}><CampoImporte valor={z.precio_ud} cambiar={(v) => cambiar({ precio_ud: v ?? 0, precio_manual: true })} /></Campo>
        <div className="flex flex-col justify-end"><span className="mb-1.5 text-[12px] font-medium text-texto2">Importe</span><span className="num flex h-10 items-center text-[15px] font-semibold">{euros(calc?.venta ?? 0)}</span></div>
        <div className="flex items-end">{z.precio_manual && <Boton tam="s" variante="fantasma" onClick={usarTarifa}>Usar tarifa</Boton>}</div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-dashed border-borde px-3 py-2 text-[13px] text-texto2 hover:bg-suave">
          {subiendo ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
          {z.diseno_path ? "Cambiar diseño" : "Adjuntar diseño o logotipo"}
          <input type="file" accept="image/*,.pdf,.ai,.eps,.svg,.dst,.emb,.pes" className="sr-only" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return; setSubiendo(true);
            try { cambiar({ diseno_path: await subirArchivo(empresa!.id, "disenos", f) }); } catch (err) { aviso(textoError(err), "error"); } finally { setSubiendo(false); }
          }} />
        </label>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {img && (/\.(png|jpe?g|gif|webp|svg)$/i.test(z.diseno_path ?? "") ? <a href={img} target="_blank" rel="noreferrer"><img src={img} alt="Diseño" className="h-10 rounded-lg border border-borde object-contain" /></a> : <a href={img} target="_blank" rel="noreferrer" className="text-[13px] text-acento">Ver archivo</a>)}
        {z.diseno_path && <button aria-label="Quitar diseño" className="text-texto2 hover:text-red-600" onClick={() => cambiar({ diseno_path: null })}><X className="size-4" /></button>}
        <input className="campo min-w-[180px] flex-1" placeholder="Observaciones (colores de hilo, medidas…)" value={z.notas} onChange={(e) => cambiar({ notas: e.target.value })} aria-label="Observaciones de la personalización" />
        <Boton tam="s" variante="fantasma" className="hover:text-red-600" onClick={quitar}><Trash2 className="size-3.5" />Quitar</Boton>
      </div>
    </div>
  );
}

/* ───────── Catálogo ───────── */
function Catalogo({ abierto, cerrar, elegir, margen }: { abierto: boolean; cerrar: () => void; elegir: (p: Prenda, color: string) => void; margen: number }) {
  const { empresa } = useSesion();
  const [lista, setLista] = useState<Prenda[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => { if (abierto) sb.from("catalogo").select("*").eq("empresa_id", empresa!.id).order("tipo").then(({ data }) => setLista((data ?? []) as Prenda[])); }, [abierto, empresa]);
  const f = (lista ?? []).filter((p) => !q || [p.tipo, p.marca, p.modelo].join(" ").toLowerCase().includes(q.toLowerCase()));
  return (
    <Hoja abierta={abierto} cerrar={cerrar} titulo="Prendas del catálogo">
      <input className="campo mb-4" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
      {!lista ? <Loader2 className="mx-auto size-5 animate-spin text-texto2" /> : !f.length ? <p className="py-8 text-center text-[13px] text-texto2">No hay prendas en el catálogo. Añádelas en Catálogo para tenerlas a un clic.</p> : (
        <ul className="space-y-2">
          {f.map((p) => (
            <li key={p.id} className="rounded-xl border border-borde p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{[p.tipo, p.marca, p.modelo].filter(Boolean).join(" · ")}</span>
                <span className="num text-[12px] text-texto2">{euros(Math.round(Number(p.precio_compra) * 100))} → {euros(precioVentaUd({ precio_compra: Number(p.precio_compra), precio_venta: p.precio_venta === null ? null : Number(p.precio_venta) }, margen))}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(p.colores.length ? p.colores : [""]).map((c) => (
                  <button key={c || "sin"} onClick={() => elegir(p, c)} className="h-7 rounded-full border border-borde px-3 text-[12px] hover:border-acento hover:text-acento">{c || "Añadir"}</button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Hoja>
  );
}
