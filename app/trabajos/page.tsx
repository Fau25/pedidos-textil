"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, Check, ClipboardList, Plus, Search, Ticket as IconoTicket, Undo2 } from "lucide-react";
import { useSesion } from "@/components/sesion";
import { Cabecera } from "@/components/marco";
import { Cargando, Vacio, cx, useAvisos } from "@/components/ui";
import { IconoWhatsApp, enlaceWa } from "@/components/whatsapp";
import { TicketTrabajo } from "@/components/ticket-trabajo";
import { sb, textoError } from "@/lib/supabase";
import { useCarga } from "@/lib/usar";
import { euros } from "@/lib/calculo";
import { AVISO_SIN_TRABAJOS, cambiarEstado, mensajeListo, pendienteCent, resumenItems, sinTablaTrabajos, unidades, type EstadoTrabajo, type Trabajo } from "@/lib/trabajos";

const FILTROS: { v: EstadoTrabajo; t: string }[] = [{ v: "pendiente", t: "Por hacer" }, { v: "listo", t: "Listos" }, { v: "entregado", t: "Entregados" }];
const ESTILO: Record<EstadoTrabajo, string> = {
  pendiente: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  listo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  entregado: "bg-suave text-texto2",
};
const NOMBRE: Record<EstadoTrabajo, string> = { pendiente: "Por hacer", listo: "Listo", entregado: "Entregado" };

/** Para cuándo: hoy, mañana, ayer o la fecha corta */
function cuando(d: string | null) {
  if (!d) return "Sin fecha";
  const hoy = new Date(); hoy.setHours(12, 0, 0, 0);
  const dias = Math.round((new Date(d + "T12:00:00").getTime() - hoy.getTime()) / 864e5);
  if (dias === 0) return "Para hoy"; if (dias === 1) return "Para mañana"; if (dias === -1) return "Era para ayer";
  const txt = new Date(d + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
  return dias < 0 ? `Era para el ${txt}` : `Para el ${txt}`;
}

export default function Trabajos() {
  const { empresa, rol } = useSesion();
  const { aviso } = useAvisos();
  const [filtro, setFiltro] = useState<EstadoTrabajo>("pendiente");
  const [q, setQ] = useState("");
  const [ticket, setTicket] = useState<Trabajo | null>(null);
  const editar = rol !== "lector";
  const { datos, setDatos, error, recargar } = useCarga(async () => {
    const { data, error } = await sb.from("trabajos").select("*").eq("empresa_id", empresa!.id).order("creado", { ascending: false }).limit(2000);
    if (error) throw sinTablaTrabajos(error) ? new Error(AVISO_SIN_TRABAJOS) : error;
    return (data ?? []) as Trabajo[];
  });

  const cuenta = useMemo(() => {
    const c = { pendiente: 0, listo: 0, entregado: 0, cobrar: 0 };
    for (const t of datos ?? []) { c[t.estado]++; if (t.estado !== "entregado") c.cobrar += pendienteCent(t); }
    return c;
  }, [datos]);
  const lista = useMemo(() => {
    const n = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    let l = (datos ?? []).filter((t) => t.estado === filtro);
    if (q.trim()) l = (datos ?? []).filter((t) => n([t.numero, t.cliente_nombre, t.cliente_telefono, resumenItems(t)].join(" ")).includes(n(q.trim())));
    // Por hacer: lo más urgente primero; el resto, lo último primero
    return filtro === "pendiente" && !q.trim() ? [...l].sort((a, b) => (a.entrega ?? "9999").localeCompare(b.entrega ?? "9999")) : l;
  }, [datos, filtro, q]);

  async function mover(t: Trabajo, estado: EstadoTrabajo) {
    const antes = t.estado;
    setDatos((d) => d?.map((x) => (x.id === t.id ? { ...x, estado } : x)) ?? d);
    try {
      await cambiarEstado(t.id, estado);
      aviso(estado === "listo" ? `${t.numero} listo para recoger` : estado === "entregado" ? `${t.numero} entregado` : `${t.numero} vuelve a «Por hacer»`, "ok",
        { texto: "Deshacer", fn: () => { cambiarEstado(t.id, antes).then(recargar).catch(() => {}); } });
    } catch (e) { aviso(textoError(e), "error"); recargar(); }
  }

  return (
    <>
      <Cabecera titulo="Trabajos" sub="Encargos en los que el cliente deja sus prendas: apúntalos, márcalos listos y avisa."
        acciones={editar ? <Link href="/trabajos/nuevo/" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-acento px-5 text-[14px] font-semibold text-sobre-acento"><Plus className="size-4" />Recibí</Link> : undefined} />

      {!datos ? <Cargando error={error} reintentar={recargar} /> : (
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="tarjeta p-3"><p className="text-[11.5px] font-bold text-orange-700 dark:text-orange-300">Por hacer</p><b className="num text-[24px]">{cuenta.pendiente}</b></div>
            <div className="tarjeta p-3"><p className="text-[11.5px] font-bold text-emerald-700 dark:text-emerald-300">Listos</p><b className="num text-[24px]">{cuenta.listo}</b></div>
            <div className="tarjeta p-3"><p className="text-[11.5px] font-bold text-texto2">Por cobrar</p><b className="num text-[20px] leading-[36px]">{euros(cuenta.cobrar)}</b></div>
          </div>

          <label className="relative">
            <span className="sr-only">Buscar trabajo</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-texto2" aria-hidden="true" />
            <input className="campo !rounded-full pl-10" placeholder="Buscar por cliente, teléfono o número" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>

          {!q.trim() && (
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label="Estado">
              {FILTROS.map((f) => (
                <button key={f.v} role="tab" aria-selected={filtro === f.v} onClick={() => setFiltro(f.v)}
                  className={cx("h-10 shrink-0 rounded-full px-4 text-[13px] font-semibold", filtro === f.v ? "bg-acento text-sobre-acento" : "cristal")}>
                  {f.t}{f.v !== "entregado" && <span className="num ml-1 opacity-60">{cuenta[f.v]}</span>}
                </button>
              ))}
            </div>
          )}

          {!lista.length ? (
            <Vacio icono={<ClipboardList className="size-6" />} titulo={q.trim() ? "Nada coincide con la búsqueda" : filtro === "pendiente" ? "No hay trabajos por hacer" : filtro === "listo" ? "No hay trabajos listos" : "Aún no hay trabajos entregados"}
              texto={filtro === "pendiente" && !q.trim() ? "Cuando un cliente te deje prendas, pulsa «Recibí» y apúntalo en un minuto." : undefined} />
          ) : (
            <ul className="grid gap-2.5 md:grid-cols-2">
              {lista.map((t) => {
                const p = pendienteCent(t);
                const tarde = t.estado === "pendiente" && t.entrega && t.entrega < new Date().toISOString().slice(0, 10);
                return (
                  <li key={t.id} className="tarjeta flex flex-col gap-2.5 p-3.5">
                    <Link href={`/trabajos/nuevo/?id=${t.id}`} className="flex items-start gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-suave text-[13px] font-bold">{unidades(t)}</span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[15px]">{t.cliente_nombre || "Sin nombre"}</b>
                        <span className="block truncate text-[12.5px] text-texto2">{t.numero} · {resumenItems(t) || "—"}</span>
                      </span>
                      <span className={cx("shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold", ESTILO[t.estado])}>{NOMBRE[t.estado]}</span>
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px] text-texto2">
                      <span className={cx("flex items-center gap-1", tarde && "font-semibold text-red-600")}><CalendarDays className="size-3.5" />{cuando(t.entrega)}</span>
                      <span>Pendiente <b className="num text-texto">{euros(p)}</b></span>
                      <span className="ml-auto flex gap-1.5">
                        <button aria-label={`Ver ticket ${t.numero}`} title="Ticket" onClick={() => setTicket(t)} className="grid size-9 place-items-center rounded-full border border-borde bg-superficie text-texto"><IconoTicket className="size-4" /></button>
                        {editar && t.estado === "pendiente" && <button onClick={() => mover(t, "listo")} className="flex h-9 items-center gap-1.5 rounded-full bg-acento px-3.5 text-[12.5px] font-bold text-sobre-acento"><Check className="size-4" />Marcar listo</button>}
                        {t.estado === "listo" && t.cliente_telefono && empresa && (
                          <a href={enlaceWa(t.cliente_telefono, mensajeListo(t, empresa))} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center gap-1.5 rounded-full bg-azul px-3.5 text-[12.5px] font-bold text-white"><IconoWhatsApp className="size-4" />Avisar</a>
                        )}
                        {editar && t.estado === "listo" && <button onClick={() => mover(t, "entregado")} className="flex h-9 items-center gap-1.5 rounded-full border border-borde bg-superficie px-3.5 text-[12.5px] font-bold text-texto">Entregado</button>}
                        {editar && t.estado === "entregado" && <button aria-label={`Volver ${t.numero} a por hacer`} title="Volver a «Por hacer»" onClick={() => mover(t, "pendiente")} className="grid size-9 place-items-center rounded-full border border-borde bg-superficie text-texto"><Undo2 className="size-4" /></button>}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      <TicketTrabajo t={ticket} abierto={!!ticket} cerrar={() => setTicket(null)} />
    </>
  );
}
