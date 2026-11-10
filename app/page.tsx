"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Plus, Search, ArrowUpRight, Sparkles } from "lucide-react";
import { useSesion } from "@/components/sesion";
import { Cargando, cx, fecha, useAvisos } from "@/components/ui";
import { Prenda } from "@/components/muestra";
import { sb, textoError } from "@/lib/supabase";
import { useCarga } from "@/lib/usar";
import { aCent, euros } from "@/lib/calculo";
import { marcarEntregado } from "@/lib/pedidos";

type Linea = { tipo: string; marca: string | null; modelo: string | null; color: string | null; orden: number };
type Fila = {
  id: string; numero: string; fecha: string; total: number; unidades: number; referencia: string | null;
  entregado: boolean; entregado_en: string | null; clientes: { nombre: string } | null;
  pedido_lineas: Linea[]; personalizaciones: { tecnica: string }[];
};
type Vista = "pendientes" | "entregados";

export default function Inicio() {
  const { empresa, sesion } = useSesion();
  const { aviso } = useAvisos();
  const [vista, setVista] = useState<Vista>("pendientes");
  const { datos, setDatos, error, recargar } = useCarga(async () => {
    const { data, error } = await sb.from("pedidos")
      .select("id, numero, fecha, total, unidades, referencia, entregado, entregado_en, clientes(nombre), pedido_lineas(tipo, marca, modelo, color, orden), personalizaciones(tecnica)")
      .eq("empresa_id", empresa!.id).order("fecha", { ascending: false }).limit(300);
    if (error) throw error;
    return data as unknown as Fila[];
  });

  const pendientes = useMemo(() => (datos ?? []).filter((p) => !p.entregado).sort((a, b) => (a.fecha < b.fecha ? -1 : 1)), [datos]);
  const entregados = useMemo(() => (datos ?? []).filter((p) => p.entregado).sort((a, b) => ((a.entregado_en ?? "") < (b.entregado_en ?? "") ? 1 : -1)), [datos]);
  const importePendiente = pendientes.reduce((a, p) => a + aCent(p.total), 0);
  const udsPendientes = pendientes.reduce((a, p) => a + (p.unidades || 0), 0);
  const mes = new Date().toISOString().slice(0, 7);
  const entregadosMes = entregados.filter((p) => (p.entregado_en ?? "").startsWith(mes));
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

      {/* Buscar */}
      <button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
        className="mb-6 flex h-[52px] w-full items-center gap-3 rounded-full bg-superficie px-5 text-left text-[14px] text-texto2 shadow-[0_6px_20px_-12px_rgba(16,18,24,0.18)] lg:max-w-md">
        <Search className="size-[18px]" />Buscar pedido, cliente o prenda
      </button>

      {/* Ficha «Nuevo pedido» + resumen */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-[1.25fr_1fr_1fr]">
        <Link href="/pedidos/nuevo/" className="group relative col-span-2 flex min-h-[168px] flex-col justify-between overflow-hidden rounded-[26px] bg-[#17181c] p-6 text-white shadow-[0_18px_40px_-18px_rgba(16,18,24,0.55)] transition-transform active:scale-[0.99] lg:col-span-1 dark:bg-[#24262c]">
          <div className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-white/[0.06]" />
          <div className="pointer-events-none absolute -bottom-16 right-10 size-40 rounded-full bg-[#1f5bff]/30 blur-2xl" />
          <span className="grid size-12 place-items-center rounded-full bg-white text-[#17181c] transition-transform group-hover:rotate-90"><Plus className="size-6" /></span>
          <div className="relative">
            <p className="text-[22px] font-semibold tracking-[-0.02em]">Nuevo pedido</p>
            <p className="mt-0.5 text-[13px] text-white/60">Cliente, prendas, tallas y personalización</p>
          </div>
        </Link>
        <div className="tarjeta flex min-h-[132px] flex-col justify-between p-5 sm:p-6">
          <p className="text-[13px] font-medium text-texto2">Pendientes</p>
          <div>
            <p className="num text-[36px] font-semibold leading-none tracking-[-0.04em] sm:text-[44px]">{datos ? pendientes.length : "–"}</p>
            <p className="mt-2 text-[13px] text-texto2">{udsPendientes} {udsPendientes === 1 ? "prenda" : "prendas"} por hacer</p>
          </div>
        </div>
        <div className="tarjeta flex min-h-[132px] flex-col justify-between p-5 sm:p-6">
          <p className="text-[13px] font-medium text-texto2">Por cobrar</p>
          <div>
            <p className="num text-[22px] font-semibold leading-none tracking-[-0.03em] sm:text-[30px]">{euros(importePendiente)}</p>
            <p className="mt-2 text-[13px] text-texto2">{entregadosMes.length === 1 ? "1 entregado" : `${entregadosMes.length} entregados`} este mes</p>
          </div>
        </div>
      </div>

      {/* Chips */}
      <div className="mb-4 flex items-center gap-2">
        {([["pendientes", `Pendientes · ${pendientes.length}`], ["entregados", "Entregados"]] as [Vista, string][]).map(([v, t]) => (
          <button key={v} onClick={() => setVista(v)} aria-pressed={vista === v}
            className={cx("h-10 rounded-full px-5 text-[13px] font-medium transition-colors", vista === v ? "bg-acento text-sobre-acento" : "bg-superficie text-texto2 hover:text-texto")}>{t}</button>
        ))}
        <Link href={`/pedidos/${vista === "entregados" ? "?ver=entregados" : ""}`} className="ml-auto flex items-center gap-1 text-[13px] font-medium text-azul">Ver lista <ArrowUpRight className="size-3.5" /></Link>
      </div>

      {/* Tarjetas de pedidos */}
      {!datos ? <Cargando error={error} reintentar={recargar} /> : !lista.length ? (
        <div className="tarjeta flex flex-col items-center px-6 py-14 text-center">
          <Prenda tipo="Camiseta" color="Blanco" className="mb-3 size-20" />
          <p className="font-semibold">{vista === "pendientes" ? "Nada pendiente" : "Aún no hay entregados"}</p>
          <p className="mt-1 text-[13px] text-texto2">{vista === "pendientes" ? "Crea un pedido nuevo desde la tarjeta negra." : "Cuando marques un pedido como entregado aparecerá aquí."}</p>
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
          <span className="absolute left-2 top-2 inline-flex h-6 items-center gap-1 rounded-full bg-superficie/90 px-2 text-[11px] font-medium backdrop-blur">
            <Sparkles className="size-3 text-azul" />{tecnicas[0]}{tecnicas.length > 1 ? ` +${tecnicas.length - 1}` : ""}
          </span>
        )}
        <span className="num absolute bottom-2 left-2 rounded-full bg-superficie/90 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">{p.unidades} uds</span>
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
