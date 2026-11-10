"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Sparkles, ArrowRight } from "lucide-react";
import { useSesion } from "./sesion";
import { Boton, CampoImporte, cx, useAvisos } from "./ui";
import { SelectorCliente } from "./editor-pedido";
import { sb, textoError } from "@/lib/supabase";
import { calcular, euros, precioVentaUd, tarifaPara } from "@/lib/calculo";
import { aCalc, claveBorrador, diaLocal, guardarPedido, hoy, id, lineaVacia, type PedidoEd } from "@/lib/pedidos";
import { TALLAS, type Cliente, type Prenda } from "@/lib/tipos";

const UBIC = ["Pecho izquierdo", "Pecho centro", "Espalda", "Manga"];
const masDias = diaLocal;

type Bloque = { clave: string; prenda: Prenda | null; color: string; tallas: Record<string, number>; precio: number | null; recordar: boolean };

/** Formulario corto para crear un pedido desde el panel principal */
export function TrabajoRapido() {
  const { empresa, tecnicas, tarifas, tocar, sesion } = useSesion();
  const { aviso } = useAvisos();
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [catalogo, setCatalogo] = useState<Prenda[]>([]);
  const [cliente, setCliente] = useState<string | null>(null);
  const [entrega, setEntrega] = useState<string>(masDias(7));
  const [bloques, setBloques] = useState<Bloque[]>([{ clave: id(), prenda: null, color: "", tallas: {}, precio: null, recordar: true }]);
  const [tecnica, setTecnica] = useState<string | null>(null);
  const [ubicacion, setUbicacion] = useState("Pecho izquierdo");
  const [guardando, setGuardando] = useState(false);
  const [errorCli, setErrorCli] = useState(false);

  useEffect(() => {
    sb.from("clientes").select("*").eq("empresa_id", empresa!.id).order("nombre").then(({ data }) => setClientes((data ?? []) as Cliente[]));
    sb.from("catalogo").select("*").eq("empresa_id", empresa!.id).eq("favorito", true).order("tipo").then(({ data }) => setCatalogo((data ?? []) as Prenda[]));
  }, [empresa]);

  const margen = Number(empresa!.margen);
  const ped: PedidoEd = useMemo(() => {
    const lineas = bloques.filter((b) => b.prenda).map((b) => lineaVacia(margen, {
      clave: b.clave, tipo: b.prenda!.tipo, marca: b.prenda!.marca ?? "", modelo: b.prenda!.modelo ?? "", color: b.color, proveedor_id: b.prenda!.proveedor_id,
      precio_compra: Number(b.prenda!.precio_compra), precio_venta: b.precio, tallas: b.tallas, tallasModelo: b.prenda!.tallas,
    }));
    const tc = tecnicas.find((x) => x.id === tecnica);
    const uds = lineas.reduce((a, l) => a + Object.values(l.tallas).reduce((x, y) => x + y, 0), 0);
    const tf = tarifaPara(tarifas, tc?.id ?? null, uds);
    return {
      id: "", nuevo: true, cliente_id: cliente, fecha: hoy(), entrega, entregado: false, referencia: "", notas: "",
      descuento_pct: 0, gastos_coste: 0, gastos_venta: 0, iva: Number(empresa!.iva), lineas,
      pers: tc ? [{ clave: "p", tecnica_id: tc.id, tecnica: tc.nombre, ubicacion, aplicaciones: 1, coste_ud: tf?.coste ?? 0, precio_ud: tf?.precio ?? 0, precio_manual: false, diseno_path: null, notas: "", estado: "pendiente" as const, lineas: lineas.map((l) => l.clave) }] : [],
    };
  }, [bloques, tecnica, ubicacion, cliente, entrega, tecnicas, tarifas, empresa, margen]);
  const t = calcular(aCalc(ped, margen));
  const setB = (k: string, c: Partial<Bloque>) => setBloques((bs) => bs.map((b) => (b.clave === k ? { ...b, ...c } : b)));

  function reiniciar() {
    setCliente(null); setEntrega(masDias(7)); setTecnica(null); setUbicacion("Pecho izquierdo");
    setBloques([{ clave: id(), prenda: null, color: "", tallas: {}, precio: null, recordar: true }]);
  }

  async function crear() {
    if (!cliente) { setErrorCli(true); return aviso("Elige el cliente", "error"); }
    if (!t.unidades) return aviso("Pon alguna cantidad en las tallas", "error");
    setGuardando(true);
    const nuevo = { ...ped, id: id(), pers: ped.pers.map((x) => ({ ...x, clave: id() })) };
    try {
      await guardarPedido(nuevo, empresa!);
      // Recordar en el catálogo el precio de las prendas que no tenían
      for (const b of bloques) if (b.prenda && b.precio !== null && b.recordar && !Number(b.prenda.precio_venta) && !Number(b.prenda.precio_compra)) {
        await sb.from("catalogo").update({ precio_venta: b.precio }).eq("id", b.prenda.id);
        setCatalogo((c) => c.map((x) => (x.id === b.prenda!.id ? { ...x, precio_venta: b.precio } : x)));
      }
      aviso("Pedido creado"); reiniciar(); tocar();
    }
    catch (e) { aviso(textoError(e), "error"); } finally { setGuardando(false); }
  }

  function masOpciones() {
    const borrador = { ...ped, id: id(), pers: ped.pers.map((x) => ({ ...x, clave: id() })), lineas: ped.lineas.length ? ped.lineas : [lineaVacia(margen)] };
    try { localStorage.setItem(claveBorrador(sesion!.user.id), JSON.stringify(borrador)); } catch {}
    router.push("/pedidos/nuevo/");
  }

  return (
    <section className="tarjeta p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[16px] font-semibold">Nuevo pedido</h2>
        <button className="flex items-center gap-1 text-[13px] text-acento" onClick={masOpciones}>Más opciones <ArrowRight className="size-3.5" /></button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <SelectorCliente clientes={clientes} valor={cliente} error={errorCli}
          cambiar={(c) => { setCliente(c); setErrorCli(false); }}
          creado={(c) => { setClientes((l) => [...l, c].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))); setCliente(c.id); setErrorCli(false); }} />
        <div>
          <span className="mb-1.5 block text-[12px] font-medium text-texto2">Entrega</span>
          <div className="flex gap-1.5">
            <input type="date" className="campo min-w-0 flex-1 sm:w-[150px] sm:flex-none" value={entrega} min={hoy()} onChange={(e) => setEntrega(e.target.value)} aria-label="Fecha de entrega" />
            {[[3, "3d"], [7, "1 sem"], [14, "2 sem"]].map(([n, txt]) => (
              <button key={n} onClick={() => setEntrega(masDias(n as number))} className={cx("h-10 shrink-0 whitespace-nowrap rounded-[10px] border px-2 text-[12px]", entrega === masDias(n as number) ? "border-acento bg-acento-suave text-acento" : "border-borde text-texto2 hover:bg-suave")}>{txt}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {bloques.map((b, i) => {
          const tallas = b.prenda?.tallas.length ? b.prenda.tallas.filter((x) => !/^\d/.test(x)) : TALLAS.slice(0, 7);
          const ninos = b.prenda?.tallas.filter((x) => /^\d/.test(x)) ?? [];
          return (
            <div key={b.clave} className="rounded-xl bg-suave/70 p-3">
              <div className="flex items-center gap-2">
                <select className="campo flex-1 font-medium" value={b.prenda?.id ?? ""} aria-label={`Prenda ${i + 1}`}
                  onChange={(e) => { const p = catalogo.find((x) => x.id === e.target.value) ?? null; setB(b.clave, { prenda: p, color: p?.colores[0] ?? "", tallas: {}, precio: precioDe(p, margen), recordar: true }); }}>
                  <option value="">Elige la prenda…</option>
                  {catalogo.map((p) => <option key={p.id} value={p.id}>{[p.marca, p.modelo].filter(Boolean).join(" ")} · {p.tipo}</option>)}
                </select>
                {b.prenda && <CampoImporte className="w-28 shrink-0" valor={b.precio} placeholder="Precio" aria-label="Precio por unidad" cambiar={(v) => setB(b.clave, { precio: v })} />}
                {bloques.length > 1 && <button aria-label="Quitar prenda" className="grid size-9 place-items-center rounded-lg text-texto2 hover:bg-superficie" onClick={() => setBloques((bs) => bs.filter((x) => x.clave !== b.clave))}><X className="size-4" /></button>}
              </div>
              {b.prenda && (
                <>
                  {b.precio === null ? <p className="mt-2 text-[12px] text-amber-700 dark:text-amber-400">Esta prenda no tiene precio: escríbelo arriba (precio por unidad, sin IVA).</p>
                    : !Number(b.prenda.precio_venta) && !Number(b.prenda.precio_compra) && (
                      <label className="mt-2 flex items-center gap-2 text-[12px] text-texto2"><input type="checkbox" className="size-3.5 accent-[var(--acento)]" checked={b.recordar} onChange={(e) => setB(b.clave, { recordar: e.target.checked })} />Guardar este precio en el catálogo</label>)}
                  {!!b.prenda.colores.length && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {b.prenda.colores.map((c) => (
                        <button key={c} onClick={() => setB(b.clave, { color: c })} className={cx("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px]", b.color === c ? "border-acento bg-superficie font-medium text-acento" : "border-transparent bg-superficie text-texto2")}>
                          <Muestra color={c} />{c}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {[...tallas, ...ninos].map((k) => (
                      <label key={k} className="flex w-[52px] flex-col items-center gap-0.5">
                        <span className="text-[11px] font-semibold text-texto2">{k}</span>
                        <input type="number" inputMode="numeric" min={0} aria-label={`Cantidad talla ${k}`} placeholder="0" onFocus={(e) => e.target.select()}
                          className={cx("campo sin-flechas num h-9 px-1 text-center", (b.tallas[k] ?? 0) > 0 && "border-acento/50 bg-acento-suave font-semibold")}
                          value={b.tallas[k] || ""} onChange={(e) => { const v = Math.max(0, Math.floor(Number(e.target.value) || 0)); const nt = { ...b.tallas }; if (v) nt[k] = v; else delete nt[k]; setB(b.clave, { tallas: nt }); }} />
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
        <button className="flex items-center gap-1.5 text-[13px] text-acento" onClick={() => setBloques((bs) => [...bs, { clave: id(), prenda: null, color: "", tallas: {}, precio: null, recordar: true }])}><Plus className="size-3.5" />Otra prenda</button>
      </div>

      <div className="mt-4">
        <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-texto2"><Sparkles className="size-3.5" />Personalización</span>
        <div className="flex flex-wrap gap-1.5">
          <Chip activo={!tecnica} onClick={() => setTecnica(null)}>Ninguna</Chip>
          {tecnicas.map((x) => <Chip key={x.id} activo={tecnica === x.id} onClick={() => setTecnica(x.id)}>{x.nombre}</Chip>)}
        </div>
        {tecnica && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {UBIC.map((u) => <Chip key={u} activo={ubicacion === u} onClick={() => setUbicacion(u)} suave>{u}</Chip>)}
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center gap-3 border-t border-borde pt-4">
        <div className="flex-1">
          <p className="text-[12px] text-texto2">{t.unidades} uds{ped.pers[0] ? ` · ${ped.pers[0].tecnica} ${euros(Math.round(ped.pers[0].precio_ud * 100))}/ud` : ""}</p>
          <p className="num text-[20px] font-semibold leading-tight">{euros(t.total)} <span className="text-[12px] font-normal text-texto2">IVA incl.</span></p>
        </div>
        <Boton variante="primario" cargando={guardando} onClick={crear}><Plus className="size-4" />Crear pedido</Boton>
      </div>
    </section>
  );
}

function Chip({ activo, onClick, children, suave }: { activo: boolean; onClick: () => void; children: React.ReactNode; suave?: boolean }) {
  return (
    <button onClick={onClick} aria-pressed={activo} className={cx("h-8 rounded-full border px-3 text-[12px] font-medium transition-colors",
      activo ? "border-acento bg-acento-suave text-acento" : suave ? "border-transparent bg-suave text-texto2" : "border-borde text-texto2 hover:text-texto")}>{children}</button>
  );
}

const COLORES_TELA: Record<string, string> = {
  blanco: "#ffffff", negro: "#1d1d1f", marino: "#1f2a44", "azul royal": "#2449a8", rojo: "#c8232c", "gris vigoré": "#b9bcc0", "gris jaspeado": "#a9adb2",
  "gris plomo": "#55595f", "verde botella": "#1f4d36", "verde kelly": "#1f9a4a", naranja: "#f07b1a", amarillo: "#f5c518", granate: "#6e1f2a", celeste: "#8fc1e8",
  turquesa: "#1fa5b5", chocolate: "#4a2c22", "rosa claro": "#f4c2cf", fucsia: "#d62f84", morado: "#5b2a86", "blanco perla": "#f2efe8", "azul eléctrico": "#2f6fe0",
  ébano: "#2b2622", "verde militar": "#4b5233", aguamarina: "#55c2b5", lima: "#b6d43a", "verde fluor": "#7cf24a", "amarillo fluor": "#e8f53a", "naranja fluor": "#ff7a2a",
};
export function Muestra({ color }: { color: string }) {
  const c = COLORES_TELA[color.toLowerCase()];
  return <span className="inline-block size-3 shrink-0 rounded-full border border-black/10" style={{ background: c ?? "conic-gradient(#ddd 0 25%, #fff 0 50%, #ddd 0 75%, #fff 0)" }} />;
}

/** Precio de venta por unidad que propone el catálogo (o null si no tiene) */
function precioDe(p: Prenda | null, margen: number): number | null {
  if (!p) return null;
  if (p.precio_venta !== null && Number(p.precio_venta)) return Number(p.precio_venta);
  if (Number(p.precio_compra)) return precioVentaUd({ precio_compra: Number(p.precio_compra), precio_venta: null }, margen) / 100;
  return null;
}
