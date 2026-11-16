"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Plus, Search, ArrowUpRight, Sparkles, CalendarDays } from "lucide-react";
import { useSesion } from "@/components/sesion";
import { Cargando, cx, fecha, useAvisos } from "@/components/ui";
import { Prenda } from "@/components/muestra";
import { sb, textoError } from "@/lib/supabase";
import { useCarga } from "@/lib/usar";
import { aCent, euros } from "@/lib/calculo";
import { conPago, marcarEntregado } from "@/lib/pedidos";
import { ESTILO_ESTADO, NOMBRE_ESTADO, cuando, resumenItems, sinTablaTrabajos, type Trabajo } from "@/lib/trabajos";

type Linea = { tipo: string; marca: string | null; modelo: string | null; color: string | null; orden: number };
type Fila = {
  id: string; numero: string; fecha: string; total: number; unidades: number; referencia: string | null;
  entregado: boolean; entregado_en: string | null; pagado_en?: string | null; clientes: { nombre: string } | null;
  pedido_lineas: Linea[]; personalizaciones: { tecnica: string }[];
};
type Vista = "pendientes" | "entregados";

export default function Inicio() {
  const { empresa, sesion } = useSesion();
  const { aviso } = useAvisos();
  const [vista, setVista] = useState<Vista>("pendientes");
  // Trabajos («Recibí») por hacer o listos para recoger
  const { datos: trabajos } = useCarga(async () => {
    const { data, error } = await sb.from("trabajos").select("id, numero, cliente_nombre, entrega, estado, items")
      .eq("empresa_id", empresa!.id).neq("estado", "entregado").order("entrega", { ascending: true, nullsFirst: false }).limit(200);
    if (error) { if (sinTablaTrabajos(error)) return []; throw error; }
    return (data ?? []) as Pick<Trabajo, "id" | "numero" | "cliente_nombre" | "entrega" | "estado" | "items">[];
  });
  const { datos, setDatos, error, recargar } = useCarga(async () => {
    return conPago<Fila[]>((x) => sb.from("pedidos")
      .select(`id, numero, fecha, total, unidades, referencia, entregado, entregado_en${x}, clientes(nombre), pedido_lineas(tipo, marca, modelo, color, orden), personalizaciones(tecnica)`)
      .eq("empresa_id", empresa!.id).order("fecha", { ascending: false }).limit(300));
  });

  const pendientes = useMemo(() => (datos ?? []).filter((p) => !p.entregado).sort((a, b) => (a.fecha < b.fecha ? -1 : 1)), [datos]);
  const entregados = useMemo(() => (datos ?? []).filter((p) => p.entregado).sort((a, b) => ((a.entregado_en ?? "") < (b.entregado_en ?? "") ? 1 : -1)), [datos]);
  const lista = vista === "pendientes" ? pendientes : entregados.slice(0, 24);

  async function cambiar(p: Fila, v: boolean) {
    setDatos((d) => d?.map((x) => (x.id === p.id ? { ...x, entregado: v, entregado_en: v ? new Date().toISOString().slice(0, 10) : null } : x)) ?? null);
    try {
      await marcarEntregado([p.id], v);
      aviso(v ? `${p.clientes?.nombre ?? p.numero}: entregado` : "Vuelve a pendientes", "ok", { texto: "Deshacer", fn: async () => { await marcarEntregado([p.id], !v); recargar(); } });
    } catch (e) { aviso(textoError(e), "error"); recargar(); }
  }

  const nombre = (sesion?.user.email ?? "").split("@")[0].split(/[._\d]/)[0];
  const inicial = (empresa?.nombre ?? nombre ?? "?").trim().charAt(0).toUpperCase();
  const h = new Date().getHours();
  const saludo = h < 6 ? "Buenas noches" : h < 14 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches";

  return (
    <>
      {/* Cabecera grande */}
      <div className="mb-5 flex items-start justify-between gap-4 pt-3 lg:pt-0">
        <div>
          <p className="text-[14px] text-texto2">{saludo}{nombre ? `, ${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}` : ""}</p>
          <h1 className="mt-1 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[38px]">Tus pedidos<br />del taller</h1>
        </div>
        <Link href="/ajustes/" aria-label="Ajustes del taller" className="grid size-12 shrink-0 place-items-center rounded-full bg-acento text-[17px] font-semibold text-sobre-acento shadow-sm">{inicial}</Link>
      </div>

      {/* Crear: dos pastillas */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:flex">
        <Link href="/pedidos/nuevo/" className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-acento px-5 text-[14.5px] font-semibold text-sobre-acento shadow-[0_10px_24px_-12px_rgba(16,18,24,0.55)] transition-transform active:scale-[0.98]">
          <Plus className="size-[18px]" />Nuevo pedido
        </Link>
        <Link href="/trabajos/nuevo/" className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-azul px-5 text-[14.5px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(29,82,235,0.7)] transition-transform active:scale-[0.98]">
          <Plus className="size-[18px]" />Nuevo trabajo
        </Link>
      </div>

      {/* Buscar */}
      <button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
        className="mb-6 flex h-[52px] w-full items-center gap-3 rounded-full bg-superficie px-5 text-left text-[14px] text-texto2 shadow-[0_6px_20px_-12px_rgba(16,18,24,0.18)] lg:max-w-md">
        <Search className="size-[18px]" />Buscar pedido, cliente o prenda
      </button>

      {/* Trabajos pendientes */}
      {!!trabajos?.length && (
        <section className="mb-8" aria-labelledby="t-trabajos">
          <div className="mb-3 flex items-center gap-2">
            <h2 id="t-trabajos" className="text-[15px] font-semibold">Trabajos pendientes <span className="num font-medium text-texto2">· {trabajos.length}</span></h2>
            <Link href="/trabajos/" className="ml-auto flex h-10 items-center gap-1 px-1 text-[13px] font-medium text-azul">Ver todos <ArrowUpRight className="size-3.5" /></Link>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {trabajos.slice(0, 6).map((t) => {
              const tarde = t.estado === "pendiente" && !!t.entrega && t.entrega < new Date().toISOString().slice(0, 10);
              return (
                <Link key={t.id} href={`/trabajos/nuevo/?id=${t.id}`} className="tarjeta flex items-center gap-3 p-4 transition-shadow hover:shadow-[0_16px_36px_-16px_rgba(16,18,24,0.22)]">
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[15px]">{t.cliente_nombre || "Sin nombre"}</b>
                    <span className="block truncate text-[12.5px] text-texto2"><span className="num">{t.numero}</span> · {resumenItems(t) || "—"}</span>
                    <span className={cx("mt-1 flex items-center gap-1 text-[12.5px]", tarde ? "font-semibold text-red-600" : "text-texto2")}><CalendarDays className="size-3.5" />{cuando(t.entrega)}</span>
                  </span>
                  <span className={cx("shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold", ESTILO_ESTADO[t.estado])}>{NOMBRE_ESTADO[t.estado]}</span>
                </Link>
              );
            })}
          </div>
          {trabajos.length > 6 && <Link href="/trabajos/" className="mt-2.5 block text-center text-[13px] font-medium text-azul">Ver los {trabajos.length - 6} restantes</Link>}
        </section>
      )}

      {/* Chips */}
      <div className="mb-4 flex items-center gap-2">
        {([["pendientes", `Pendientes · ${pendientes.length}`], ["entregados", "Entregados"]] as [Vista, string][]).map(([v, t]) => (
          <button key={v} onClick={() => setVista(v)} aria-pressed={vista === v}
            className={cx("h-10 whitespace-nowrap rounded-full px-4 text-[13px] font-medium transition-colors", vista === v ? "bg-acento text-sobre-acento" : "bg-superficie text-texto2 hover:text-texto")}>{t}</button>
        ))}
        <Link href={`/pedidos/${vista === "entregados" ? "?ver=entregados" : ""}`} className="ml-auto flex h-10 items-center gap-1 whitespace-nowrap px-1 text-[13px] font-medium text-azul">Ver lista <ArrowUpRight className="size-3.5" /></Link>
      </div>

      {/* Tarjetas de pedidos */}
      {!datos ? <Cargando error={error} reintentar={recargar} /> : !lista.length ? (
        <div className="tarjeta flex flex-col items-center px-6 py-14 text-center">
          <Prenda tipo="Camiseta" color="Blanco" className="mb-3 size-20" />
          <p className="font-semibold">{vista === "pendientes" ? "Nada pendiente" : "Aún no hay entregados"}</p>
          <p className="mt-1 text-[13px] text-texto2">{vista === "pendientes" ? "Crea uno con «Nuevo pedido», arriba." : "Cuando marques un pedido como entregado aparecerá aquí."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
          {lista.map((p) => <TarjetaPedido key={p.id} p={p} cambiar={cambiar} />)}
        </div>
      )}
    </>
  );
}

function TarjetaPedido({ p, cambiar }: { p: Fila; cambiar: (p: Fila, v: boolean) => void }) {
  const lineas = [...(p.pedido_lineas ?? [])].sort((a, b) => a.orden - b.orden);
  const l = lineas[0];
  const tecnicas = [...new Set((p.personalizaciones ?? []).map((x) => x.tecnica))];
  return (
    <div className="tarjeta group relative flex flex-col p-2.5 transition-shadow hover:shadow-[0_16px_36px_-16px_rgba(16,18,24,0.22)]">
      <Link href={`/pedidos/ver/?id=${p.id}`} className="relative grid aspect-[4/3.4] place-items-center overflow-hidden rounded-[18px] bg-suave">
        {lineas.length > 1 && l && <Prenda tipo={lineas[1].tipo} color={lineas[1].color} className="absolute right-[12%] top-[16%] size-[46%] opacity-80" />}
        <Prenda tipo={l?.tipo} color={l?.color} className={cx("relative transition-transform group-hover:scale-[1.04]", lineas.length > 1 ? "-translate-x-[12%] size-[66%]" : "size-[72%]")} />
        {tecnicas[0] && (
          <span className="absolute left-2 top-2 inline-flex h-6 items-center gap-1 rounded-full bg-superficie/95 px-2 text-[11px] font-medium">
            <Sparkles className="size-3 text-azul" />{tecnicas[0]}{tecnicas.length > 1 ? ` +${tecnicas.length - 1}` : ""}
          </span>
        )}
        <span className="num absolute bottom-2 left-2 rounded-full bg-superficie/95 px-2 py-0.5 text-[11px] font-semibold">{p.unidades} uds</span>
      </Link>
      <div className="flex items-end gap-2 px-1.5 pb-1 pt-3">
        <Link href={`/pedidos/ver/?id=${p.id}`} className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold leading-tight">{p.clientes?.nombre ?? "Sin cliente"}</p>
          <p className="truncate text-[12px] text-texto2">{l ? [l.tipo, l.modelo].filter(Boolean).join(" ") : "Sin prendas"}{lineas.length > 1 ? ` +${lineas.length - 1}` : ""}</p>
          <p className="num mt-1 text-[15px] font-semibold">{euros(aCent(p.total))}</p>
        </Link>
        {p.entregado ? (
          <button onClick={() => cambiar(p, false)} aria-label={`Volver a pendiente ${p.numero}`} title={`Entregado ${fecha(p.entregado_en)} · tocar para deshacer`}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"><Check className="size-4" strokeWidth={3} /></button>
        ) : (
          <button onClick={() => cambiar(p, true)} aria-label={`Marcar ${p.numero} como entregado`} title="Marcar entregado"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-acento text-sobre-acento transition-colors hover:bg-emerald-500 hover:text-white"><Check className="size-4" strokeWidth={2.5} /></button>
        )}
      </div>
    </div>
  );
}
