"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Inbox, ArrowUpDown, Check } from "lucide-react";
import { useSesion } from "@/components/sesion";
import { Cabecera } from "@/components/marco";
import { Boton, Cargando, Vacio, cx, diasHasta, fecha, useAvisos } from "@/components/ui";
import { sb, textoError } from "@/lib/supabase";
import { useCarga, useParam } from "@/lib/usar";
import { aCent, euros } from "@/lib/calculo";
import { marcarEntregado } from "@/lib/pedidos";
import type { Pedido } from "@/lib/tipos";

type Orden = "entrega" | "fecha" | "total" | "cliente";
type Filtro = "pendientes" | "entregados" | "todos";

export default function Pedidos() {
  const { empresa } = useSesion();
  const { aviso } = useAvisos();
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [texto, setTexto] = useState("");
  const [orden, setOrden] = useState<Orden>("entrega");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const ver = useParam("ver");
  useEffect(() => { if (ver === "entregados" || ver === "todos") { setFiltro(ver); setOrden("fecha"); } }, [ver]);

  const { datos, setDatos, error, recargar } = useCarga(async () => {
    const { data, error } = await sb.from("pedidos").select("id, numero, fecha, entrega, total, unidades, referencia, entregado, entregado_en, actualizado, clientes(nombre)")
      .eq("empresa_id", empresa!.id).order("fecha", { ascending: false }).limit(2000);
    if (error) throw error;
    return data as unknown as Pedido[];
  });

  const lista = useMemo(() => {
    let l = (datos ?? []).filter((p) => filtro === "todos" || (filtro === "entregados" ? p.entregado : !p.entregado));
    const q = texto.trim().toLowerCase();
    if (q) l = l.filter((p) => [p.numero, p.referencia, p.clientes?.nombre].some((v) => v?.toLowerCase().includes(q)));
    const f = {
      entrega: (a: Pedido, b: Pedido) => ((a.entrega ?? "9999") < (b.entrega ?? "9999") ? -1 : (a.entrega ?? "9999") > (b.entrega ?? "9999") ? 1 : a.numero < b.numero ? -1 : 1),
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

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex rounded-[10px] border border-borde bg-superficie p-0.5" role="tablist">
          {(["pendientes", "entregados", "todos"] as Filtro[]).map((f) => (
            <button key={f} role="tab" aria-selected={filtro === f} onClick={() => { setFiltro(f); setSel(new Set()); setOrden(f === "pendientes" ? "entrega" : "fecha"); }}
              className={cx("h-8 flex-1 rounded-lg px-3 text-[13px] font-medium capitalize sm:flex-none", filtro === f ? "bg-acento-suave text-acento" : "text-texto2")}>
              {f} <span className="num ml-0.5 text-[12px] opacity-70">{datos ? n(f) : ""}</span>
            </button>
          ))}
        </div>
        <input className="campo sm:max-w-xs" placeholder="Buscar nº, cliente o referencia" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <label className="flex items-center gap-2 text-[13px] text-texto2 sm:ml-auto"><ArrowUpDown className="size-4" />
          <select className="campo w-auto" value={orden} onChange={(e) => setOrden(e.target.value as Orden)} aria-label="Ordenar por">
            <option value="entrega">Fecha de entrega</option><option value="fecha">Más recientes</option><option value="total">Importe</option><option value="cliente">Cliente</option>
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
              <button className="text-acento" onClick={() => setSel(new Set())}>Cancelar</button>
            </div>
          )}
          {!lista.length ? <p className="py-12 text-center text-texto2">{texto ? "Sin resultados." : filtro === "pendientes" ? "¡Nada pendiente! 🎉" : "No hay pedidos aquí."}</p> : (
            <ul className="divide-y divide-borde">
              {lista.map((p) => {
                const d = diasHasta(p.entrega);
                const urgente = !p.entregado && d !== null && d <= 2;
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-suave/60">
                    <input type="checkbox" aria-label={`Seleccionar ${p.numero}`} className="size-4 shrink-0 accent-[var(--acento)]" checked={sel.has(p.id)}
                      onChange={(e) => setSel((s) => { const x = new Set(s); if (e.target.checked) x.add(p.id); else x.delete(p.id); return x; })} />
                    <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => router.push(`/pedidos/ver/?id=${p.id}`)}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.clientes?.nombre ?? "Sin cliente"}</span>
                        <span className="block truncate text-[12px] text-texto2"><span className="num">{p.numero}</span> · {p.unidades} uds{p.referencia ? " · " + p.referencia : ""}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="num block text-[13px] font-medium">{euros(aCent(p.total))}</span>
                        <span className={cx("block text-[12px]", p.entregado ? "text-emerald-700 dark:text-emerald-400" : d !== null && d < 0 ? "font-medium text-red-600" : urgente ? "font-medium text-amber-700 dark:text-amber-400" : "text-texto2")}>
                          {p.entregado ? `Entregado ${fecha(p.entregado_en)}` : p.entrega ? (d === 0 ? "Hoy" : d === 1 ? "Mañana" : d! < 0 ? `Atrasado ${fecha(p.entrega)}` : fecha(p.entrega)) : "Sin fecha"}
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
