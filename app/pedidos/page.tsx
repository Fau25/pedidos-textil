"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Inbox, ArrowUpDown, Check } from "lucide-react";
import { useSesion } from "@/components/sesion";
import { Cabecera } from "@/components/marco";
import { Boton, Cargando, Vacio, cx, fecha, useAvisos } from "@/components/ui";
import { sb, textoError } from "@/lib/supabase";
import { useCarga, useParam } from "@/lib/usar";
import { aCent, euros } from "@/lib/calculo";
import { marcarEntregado } from "@/lib/pedidos";
import type { Pedido } from "@/lib/tipos";

type Orden = "antiguos" | "fecha" | "total" | "cliente";
type Filtro = "pendientes" | "entregados" | "todos";

export default function Pedidos() {
  const { empresa } = useSesion();
  const { aviso } = useAvisos();
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [texto, setTexto] = useState("");
  const [orden, setOrden] = useState<Orden>("antiguos");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const ver = useParam("ver");
  useEffect(() => { if (ver === "entregados" || ver === "todos") { setFiltro(ver); setOrden("fecha"); } }, [ver]);

  const { datos, setDatos, error, recargar } = useCarga(async () => {
    const { data, error } = await sb.from("pedidos").select("id, numero, fecha, total, unidades, referencia, entregado, entregado_en, actualizado, clientes(nombre)")
      .eq("empresa_id", empresa!.id).order("fecha", { ascending: false }).limit(2000);
    if (error) throw error;
    return data as unknown as Pedido[];
  });

  const lista = useMemo(() => {
    let l = (datos ?? []).filter((p) => filtro === "todos" || (filtro === "entregados" ? p.entregado : !p.entregado));
    const q = texto.trim().toLowerCase();
    if (q) l = l.filter((p) => [p.numero, p.referencia, p.clientes?.nombre].some((v) => v?.toLowerCase().includes(q)));
    const f = {
      antiguos: (a: Pedido, b: Pedido) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.numero < b.numero ? -1 : 1),
      fecha: (a: Pedido, b: Pedido) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : a.numero < b.numero ? 1 : -1),
      total: (a: Pedido, b: Pedido) => Number(b.total) - Number(a.total),
      cliente: (a: Pedido, b: Pedido) => (a.clientes?.nombre ?? "").localeCompare(b.clientes?.nombre ?? "", "es"),
    }[orden];
    return [...l].sort(f);
  }, [datos, filtro, texto, orden]);

  const n = (f: Filtro) => (datos ?? []).filter((p) => f === "todos" || (f === "entregados" ? p.entregado : !p.entregado)).length;

  async function entregar(ids: string[], v: boolean) {
    const prev = datos;
    setDatos((d) => d?.map((p) => (ids.includes(p.id) ? { ...p, entregado: v } : p)) ?? null);
    try {
      await marcarEntregado(ids, v);
      aviso(v ? (ids.length > 1 ? `${ids.length} pedidos entregados` : "Marcado como entregado") : "Vuelve a pendientes", "ok",
        { texto: "Deshacer", fn: async () => { await marcarEntregado(ids, !v); recargar(); } });
      setSel(new Set());
    }
    catch (e) { setDatos(prev); aviso(textoError(e), "error"); }
  }

  return (
    <>
      <Cabecera titulo="Pedidos" acciones={<Link href="/pedidos/nuevo/"><Boton variante="primario"><Plus className="size-4" />Nuevo pedido</Boton></Link>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-full border border-borde bg-superficie p-0.5" role="tablist">
          {(["pendientes", "entregados", "todos"] as Filtro[]).map((f) => (
            <button key={f} role="tab" aria-selected={filtro === f} onClick={() => { setFiltro(f); setSel(new Set()); setOrden(f === "pendientes" ? "antiguos" : "fecha"); }}
              className={cx("h-9 flex-1 rounded-full px-3 text-[13px] font-medium capitalize sm:flex-none", filtro === f ? "bg-acento text-sobre-acento" : "text-texto2")}>
              {f} <span className="num ml-0.5 text-[12px] opacity-70">{datos ? n(f) : ""}</span>
            </button>
          ))}
        </div>
        <input className="campo order-last w-full xl:order-none xl:w-auto xl:max-w-xs xl:flex-1" placeholder="Buscar nº, cliente o referencia" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <label className="ml-auto flex items-center gap-2 text-[13px] text-texto2"><ArrowUpDown className="size-4" />
          <select className="campo w-auto" value={orden} onChange={(e) => setOrden(e.target.value as Orden)} aria-label="Ordenar por">
            <option value="antiguos">Más antiguos primero</option><option value="fecha">Más recientes primero</option><option value="total">Importe</option><option value="cliente">Cliente</option>
          </select>
        </label>
      </div>

      {!datos ? <Cargando error={error} reintentar={recargar} /> : !datos.length ? (
        <div className="tarjeta"><Vacio icono={<Inbox className="size-5" />} titulo="Aún no hay pedidos" accion={<Link href="/pedidos/nuevo/"><Boton variante="primario"><Plus className="size-4" />Nuevo pedido</Boton></Link>} /></div>
      ) : (
        <div className="tarjeta overflow-hidden">
          {sel.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-borde bg-acento-suave px-4 py-2.5 text-[13px]">
              <b>{sel.size} seleccionado{sel.size > 1 ? "s" : ""}</b>
              {filtro !== "entregados" && <Boton tam="s" variante="primario" onClick={() => entregar([...sel], true)}><Check className="size-3.5" />Marcar entregados</Boton>}
              {filtro !== "pendientes" && <Boton tam="s" onClick={() => entregar([...sel], false)}>Volver a pendientes</Boton>}
              <button className="text-azul" onClick={() => setSel(new Set())}>Cancelar</button>
            </div>
          )}
          {!lista.length ? <p className="py-12 text-center text-texto2">{texto ? "Sin resultados." : filtro === "pendientes" ? "¡Nada pendiente! 🎉" : "No hay pedidos aquí."}</p> : (
            <ul className="divide-y divide-borde">
              {lista.map((p) => {
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-suave/60">
                    <label className="-m-2 grid size-10 shrink-0 cursor-pointer place-items-center"><input type="checkbox" aria-label={`Seleccionar ${p.numero}`} className="size-[18px] accent-[var(--acento)]" checked={sel.has(p.id)}
                      onChange={(e) => setSel((s) => { const x = new Set(s); if (e.target.checked) x.add(p.id); else x.delete(p.id); return x; })} /></label>
                    <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => router.push(`/pedidos/ver/?id=${p.id}`)}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.clientes?.nombre ?? "Sin cliente"}</span>
                        <span className="block truncate text-[12px] text-texto2"><span className="num">{p.numero}</span> · {p.unidades} uds{p.referencia ? " · " + p.referencia : ""}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="num block text-[13px] font-medium">{euros(aCent(p.total))}</span>
                        <span className={cx("block text-[12px]", p.entregado ? "text-emerald-700 dark:text-emerald-400" : "text-texto2")}>
                          {p.entregado ? `Entregado ${fecha(p.entregado_en)}` : `Pedido ${fecha(p.fecha)}`}
                        </span>
                      </span>
                    </button>
                    {!p.entregado && (
                      <button title="Marcar como entregado" aria-label={`Marcar ${p.numero} como entregado`} onClick={() => entregar([p.id], true)}
                        className="grid size-9 shrink-0 place-items-center rounded-full border border-borde text-texto2 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40">
                        <Check className="size-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
