"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, LayoutList, Columns3, Inbox, ArrowUpDown } from "lucide-react";
import { useSesion } from "@/components/sesion";
import { Cabecera } from "@/components/marco";
import { Boton, Cargando, Pastilla, Vacio, cx, diasHasta, fecha, useAvisos, PUNTOS } from "@/components/ui";
import { sb, textoError } from "@/lib/supabase";
import { useCarga } from "@/lib/usar";
import { aCent, euros } from "@/lib/calculo";
import type { Pedido } from "@/lib/tipos";

type Orden = "fecha" | "entrega" | "total" | "cliente";

export default function Pedidos() {
  const { empresa, estados, estadoPor } = useSesion();
  const { aviso } = useAvisos();
  const router = useRouter();
  const [filtro, setFiltro] = useState<string[]>([]);
  const [texto, setTexto] = useState("");
  const [orden, setOrden] = useState<Orden>("fecha");
  const [vista, setVista] = useState<"lista" | "tablero">("lista");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [arrastrando, setArrastrando] = useState<string | null>(null);

  useEffect(() => {
    const e = new URLSearchParams(location.search).get("estado");
    if (e) setFiltro(e.split(","));
    try { const v = localStorage.getItem("vistaPedidos"); if (v === "tablero" || v === "lista") setVista(v); } catch {}
  }, []);
  const cambiarVista = (v: "lista" | "tablero") => { setVista(v); try { localStorage.setItem("vistaPedidos", v); } catch {} };

  const { datos, setDatos } = useCarga(async () => {
    const { data, error } = await sb.from("pedidos").select("id, numero, fecha, entrega, total, estado_id, unidades, referencia, actualizado, clientes(nombre)")
      .eq("empresa_id", empresa!.id).order("fecha", { ascending: false }).limit(2000);
    if (error) throw error;
    return data as unknown as Pedido[];
  });

  const finales = useMemo(() => new Set(estados.filter((e) => e.final).map((e) => e.id)), [estados]);
  const lista = useMemo(() => {
    let l = datos ?? [];
    if (filtro.length) {
      l = l.filter((p) => filtro.includes("activos") ? !finales.has(p.estado_id ?? "") || filtro.includes(estadoPor(p.estado_id)?.clave ?? "") : filtro.includes(estadoPor(p.estado_id)?.clave ?? "") || filtro.includes(p.estado_id ?? ""));
    }
    const q = texto.trim().toLowerCase();
    if (q) l = l.filter((p) => [p.numero, p.referencia, p.clientes?.nombre].some((v) => v?.toLowerCase().includes(q)));
    const f = {
      fecha: (a: Pedido, b: Pedido) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : a.numero < b.numero ? 1 : -1),
      entrega: (a: Pedido, b: Pedido) => (a.entrega ?? "9999") < (b.entrega ?? "9999") ? -1 : 1,
      total: (a: Pedido, b: Pedido) => Number(b.total) - Number(a.total),
      cliente: (a: Pedido, b: Pedido) => (a.clientes?.nombre ?? "").localeCompare(b.clientes?.nombre ?? "", "es"),
    }[orden];
    return [...l].sort(f);
  }, [datos, filtro, texto, orden, finales, estadoPor]);

  async function cambiarEstado(ids: string[], estado: string) {
    const prev = datos;
    setDatos((d) => d?.map((p) => (ids.includes(p.id) ? { ...p, estado_id: estado } : p)) ?? null);
    for (const i of ids) {
      const { error } = await sb.rpc("cambiar_estado", { p: i, e: estado, nota: ids.length > 1 ? "Cambio masivo" : null });
      if (error) { setDatos(prev); return aviso(textoError(error), "error"); }
    }
    aviso(ids.length > 1 ? `${ids.length} pedidos movidos a «${estadoPor(estado)?.nombre}»` : `Movido a «${estadoPor(estado)?.nombre}»`);
    setSel(new Set());
  }

  const chips = [{ v: "activos", t: "Activos" }, ...estados.map((e) => ({ v: e.clave ?? e.id, t: e.nombre, color: e.color }))];
  const alternar = (v: string) => setFiltro((f) => (f.includes(v) ? f.filter((x) => x !== v) : [...f.filter((x) => (v === "activos" ? false : x !== "activos")), v]));

  return (
    <>
      <Cabecera titulo="Pedidos" sub={datos ? `${lista.length} de ${datos.length}` : undefined}
        acciones={<>
          <div className="flex rounded-[10px] border border-borde bg-superficie p-0.5">
            <button aria-label="Vista lista" onClick={() => cambiarVista("lista")} className={cx("grid h-8 w-9 place-items-center rounded-lg", vista === "lista" ? "bg-suave text-texto" : "text-texto2")}><LayoutList className="size-4" /></button>
            <button aria-label="Vista tablero" onClick={() => cambiarVista("tablero")} className={cx("grid h-8 w-9 place-items-center rounded-lg", vista === "tablero" ? "bg-suave text-texto" : "text-texto2")}><Columns3 className="size-4" /></button>
          </div>
          <Link href="/pedidos/nuevo/"><Boton variante="primario"><Plus className="size-4" />Nuevo pedido</Boton></Link>
        </>} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input className="campo sm:max-w-xs" placeholder="Filtrar por nº, cliente o referencia" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <label className="flex items-center gap-2 text-[13px] text-texto2"><ArrowUpDown className="size-4" />
          <select className="campo w-auto" value={orden} onChange={(e) => setOrden(e.target.value as Orden)} aria-label="Ordenar por">
            <option value="fecha">Más recientes</option><option value="entrega">Fecha de entrega</option><option value="total">Importe</option><option value="cliente">Cliente</option>
          </select>
        </label>
      </div>
      {vista === "lista" && (
        <div className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {chips.map((c) => (
            <button key={c.v} onClick={() => alternar(c.v)} className={cx("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors",
              filtro.includes(c.v) ? "border-acento bg-acento-suave text-acento" : "border-borde bg-superficie text-texto2 hover:text-texto")}>
              {"color" in c && <span className={cx("size-1.5 rounded-full", PUNTOS[c.color as string])} />}{c.t}
            </button>
          ))}
          {!!filtro.length && <button onClick={() => setFiltro([])} className="h-8 shrink-0 px-2 text-[12px] text-acento">Quitar filtros</button>}
        </div>
      )}

      {!datos ? <Cargando /> : !datos.length ? (
        <div className="tarjeta"><Vacio icono={<Inbox className="size-5" />} titulo="Aún no hay pedidos" accion={<Link href="/pedidos/nuevo/"><Boton variante="primario"><Plus className="size-4" />Nuevo pedido</Boton></Link>} /></div>
      ) : vista === "lista" ? (
        <div className="tarjeta overflow-hidden">
          {sel.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-borde bg-acento-suave px-4 py-2.5 text-[13px]">
              <b>{sel.size} seleccionado{sel.size > 1 ? "s" : ""}</b>
              <select className="campo h-8 w-auto" value="" onChange={(e) => e.target.value && cambiarEstado([...sel], e.target.value)} aria-label="Cambiar estado de los seleccionados">
                <option value="">Cambiar estado a…</option>
                {estados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
              <button className="text-acento" onClick={() => setSel(new Set())}>Cancelar</button>
            </div>
          )}
          {!lista.length ? <p className="py-12 text-center text-texto2">Ningún pedido con estos filtros.</p> : (
            <table className="w-full text-left">
              <thead className="hidden border-b border-borde text-[12px] text-texto2 md:table-header-group">
                <tr>
                  <th className="w-10 py-2.5 pl-4"><input type="checkbox" aria-label="Seleccionar todos" className="size-4 accent-[var(--acento)]" checked={sel.size === lista.length} onChange={(e) => setSel(e.target.checked ? new Set(lista.map((p) => p.id)) : new Set())} /></th>
                  <th className="py-2.5 font-medium">Pedido</th><th className="font-medium">Cliente</th><th className="font-medium">Fecha</th><th className="font-medium">Entrega</th>
                  <th className="text-right font-medium">Uds</th><th className="text-right font-medium">Importe</th><th className="pr-4 text-right font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {lista.map((p) => {
                  const e = estadoPor(p.estado_id);
                  const d = diasHasta(p.entrega);
                  const urgente = d !== null && d <= 2 && !e?.final;
                  return (
                    <tr key={p.id} className="cursor-pointer hover:bg-suave/60" onClick={() => router.push(`/pedidos/ver/?id=${p.id}`)}>
                      <td className="hidden py-3 pl-4 md:table-cell" onClick={(ev) => ev.stopPropagation()}>
                        <input type="checkbox" aria-label={`Seleccionar ${p.numero}`} className="size-4 accent-[var(--acento)]" checked={sel.has(p.id)} onChange={(ev) => setSel((s) => { const n = new Set(s); if (ev.target.checked) n.add(p.id); else n.delete(p.id); return n; })} />
                      </td>
                      <td className="py-3 pl-4 md:pl-0">
                        <Link href={`/pedidos/ver/?id=${p.id}`} className="num text-[13px] font-semibold" onClick={(ev) => ev.stopPropagation()}>{p.numero}</Link>
                        <span className="block truncate text-[13px] md:hidden">{p.clientes?.nombre}</span>
                        {p.referencia && <span className="hidden text-[12px] text-texto2 md:block">{p.referencia}</span>}
                      </td>
                      <td className="hidden max-w-[220px] truncate font-medium md:table-cell">{p.clientes?.nombre ?? "—"}</td>
                      <td className="hidden text-[13px] text-texto2 md:table-cell">{fecha(p.fecha)}</td>
                      <td className={cx("hidden text-[13px] md:table-cell", urgente ? "font-medium text-amber-700 dark:text-amber-400" : "text-texto2")}>{fecha(p.entrega)}</td>
                      <td className="num hidden text-right text-[13px] md:table-cell">{p.unidades}</td>
                      <td className="num text-right text-[13px] font-medium">{euros(aCent(p.total))}<span className="block text-[12px] font-normal text-texto2 md:hidden">{p.entrega ? "Entrega " + fecha(p.entrega) : ""}</span></td>
                      <td className="py-3 pr-4 text-right">{e && <Pastilla color={e.color}>{e.nombre}</Pastilla>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {estados.filter((e) => e.clave !== "cancelado").map((e) => {
            const col = lista.filter((p) => p.estado_id === e.id);
            return (
              <div key={e.id} className={cx("flex w-[270px] shrink-0 flex-col rounded-2xl bg-suave/70 p-2 transition-colors", arrastrando && "ring-1 ring-borde")}
                onDragOver={(ev) => ev.preventDefault()}
                onDrop={(ev) => { ev.preventDefault(); const pid = ev.dataTransfer.getData("text/plain"); setArrastrando(null); if (pid && datos.find((p) => p.id === pid)?.estado_id !== e.id) cambiarEstado([pid], e.id); }}>
                <div className="flex items-center gap-2 px-2 py-2 text-[13px] font-semibold"><span className={cx("size-2 rounded-full", PUNTOS[e.color])} />{e.nombre}<span className="ml-auto font-normal text-texto2">{col.length}</span></div>
                <div className="flex min-h-16 flex-col gap-2">
                  {col.map((p) => {
                    const d = diasHasta(p.entrega);
                    return (
                      <Link key={p.id} href={`/pedidos/ver/?id=${p.id}`} draggable onDragStart={(ev) => { ev.dataTransfer.setData("text/plain", p.id); setArrastrando(p.id); }} onDragEnd={() => setArrastrando(null)}
                        className={cx("tarjeta block p-3 transition-shadow hover:shadow-md", arrastrando === p.id && "opacity-50")}>
                        <div className="flex items-center justify-between text-[12px] text-texto2"><span className="num font-semibold text-texto">{p.numero}</span><span className="num">{euros(aCent(p.total))}</span></div>
                        <p className="mt-1 truncate font-medium">{p.clientes?.nombre ?? "Sin cliente"}</p>
                        <p className={cx("mt-1 text-[12px]", d !== null && d <= 2 && !e.final ? "text-amber-700 dark:text-amber-400" : "text-texto2")}>{p.unidades} uds{p.entrega ? " · entrega " + fecha(p.entrega) : ""}</p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
