"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useSesion } from "@/components/sesion";
import { Cargando, Tarjeta, cx, diasHasta, useAvisos } from "@/components/ui";
import { TrabajoRapido } from "@/components/trabajo-rapido";
import { sb, textoError } from "@/lib/supabase";
import { useCarga } from "@/lib/usar";
import { aCent, euros } from "@/lib/calculo";
import { hoy, marcarEntregado } from "@/lib/pedidos";
import type { Pedido } from "@/lib/tipos";

export default function Inicio() {
  const { empresa } = useSesion();
  const { aviso } = useAvisos();
  const { datos, setDatos, error, recargar } = useCarga(async () => {
    const { data, error } = await sb.from("pedidos").select("id, numero, fecha, entrega, total, unidades, referencia, entregado, entregado_en, clientes(nombre)")
      .eq("empresa_id", empresa!.id).eq("entregado", false).order("entrega", { ascending: true, nullsFirst: false }).limit(500);
    if (error) throw error;
    return data as unknown as Pedido[];
  });

  async function entregar(p: Pedido) {
    setDatos((d) => d?.filter((x) => x.id !== p.id) ?? null);
    try {
      await marcarEntregado([p.id], true);
      aviso(`${p.clientes?.nombre ?? p.numero}: entregado`, "ok", { texto: "Deshacer", fn: async () => { await marcarEntregado([p.id], false); recargar(); } });
    } catch (e) { aviso(textoError(e), "error"); recargar(); }
  }

  const grupos = useMemo(() => {
    const g: { t: string; tono?: string; l: Pedido[] }[] = [
      { t: "Atrasados", tono: "text-red-600", l: [] }, { t: "Hoy", tono: "text-amber-700 dark:text-amber-400", l: [] }, { t: "Mañana", tono: "text-amber-700 dark:text-amber-400", l: [] },
      { t: "Esta semana", l: [] }, { t: "Más adelante", l: [] }, { t: "Sin fecha", l: [] },
    ];
    for (const p of datos ?? []) {
      const d = diasHasta(p.entrega);
      g[d === null ? 5 : d < 0 ? 0 : d === 0 ? 1 : d === 1 ? 2 : d <= 7 ? 3 : 4].l.push(p);
    }
    return g.filter((x) => x.l.length);
  }, [datos]);

  const h = new Date().getHours();
  const saludo = h < 6 ? "Buenas noches" : h < 14 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches";

  return (
    <>
      <div className="mb-5">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] sm:text-[28px]">{saludo}</h1>
        <p className="text-texto2">{new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} · {datos ? (datos.length ? `${datos.length} pedido${datos.length > 1 ? "s" : ""} pendiente${datos.length > 1 ? "s" : ""}` : "nada pendiente") : ""}</p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <TrabajoRapido />
          <Tarjeta titulo="Pendientes" accion={<Link href="/pedidos/?ver=entregados" className="text-[13px] text-acento">Entregados</Link>} sinPadding>
            {!datos ? <Cargando error={error} reintentar={recargar} /> : !datos.length ? <p className="px-5 pb-8 pt-4 text-center text-texto2">No hay nada pendiente. 🎉</p> : (
              <div className="pb-2">
                {grupos.map((g) => (
                  <div key={g.t}>
                    <p className={cx("px-5 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-wide", g.tono ?? "text-texto2")}>{g.t} · {g.l.length}</p>
                    <ul>
                      {g.l.map((p) => (
                        <li key={p.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-suave/60">
                          <button onClick={() => entregar(p)} aria-label={`Marcar ${p.numero} como entregado`} title="Marcar entregado"
                            className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-borde text-transparent transition-colors hover:border-emerald-500 hover:text-emerald-600">
                            <Check className="size-3.5" strokeWidth={3} />
                          </button>
                          <Link href={`/pedidos/ver/?id=${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{p.clientes?.nombre ?? "Sin cliente"}</span>
                              <span className="block truncate text-[12px] text-texto2">{p.unidades} uds{p.referencia ? " · " + p.referencia : ""} · <span className="num">{p.numero}</span></span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="block text-[12px] font-medium">{p.entrega ? new Date(p.entrega + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }) : "—"}</span>
                              <span className="num block text-[12px] text-texto2">{euros(aCent(p.total))}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Tarjeta>
        </div>
        <Calendario pedidos={datos ?? []} />
      </div>
    </>
  );
}

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function Calendario({ pedidos }: { pedidos: Pedido[] }) {
  const [vista, setVista] = useState<"semana" | "mes">("semana");
  const [ref, setRef] = useState(() => new Date());
  const porDia = useMemo(() => {
    const m = new Map<string, Pedido[]>();
    for (const p of pedidos) if (p.entrega) m.set(p.entrega, [...(m.get(p.entrega) ?? []), p]);
    return m;
  }, [pedidos]);
  const hoyS = hoy();

  const lunes = (d: Date) => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  let dias: Date[] = [];
  let titulo = "";
  if (vista === "semana") {
    const l = lunes(ref);
    dias = Array.from({ length: 7 }, (_, i) => { const x = new Date(l); x.setDate(l.getDate() + i); return x; });
    titulo = `${dias[0].toLocaleDateString("es-ES", { day: "numeric", month: "short" })} – ${dias[6].toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;
  } else {
    const ini = lunes(new Date(ref.getFullYear(), ref.getMonth(), 1, 12));
    dias = Array.from({ length: 42 }, (_, i) => { const x = new Date(ini); x.setDate(ini.getDate() + i); return x; });
    if (dias[35].getMonth() !== ref.getMonth()) dias = dias.slice(0, 35);
    titulo = ref.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  }
  const mover = (n: number) => setRef((r) => { const x = new Date(r); if (vista === "semana") x.setDate(x.getDate() + 7 * n); else x.setMonth(x.getMonth() + n, 1); return x; });

  return (
    <section className="tarjeta p-4 xl:sticky xl:top-8">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex-1 text-[15px] font-semibold first-letter:uppercase">{titulo}</h2>
        <button aria-label="Anterior" className="grid size-8 place-items-center rounded-lg text-texto2 hover:bg-suave" onClick={() => mover(-1)}><ChevronLeft className="size-4" /></button>
        <button className="h-8 rounded-lg px-2 text-[12px] text-texto2 hover:bg-suave" onClick={() => setRef(new Date())}>Hoy</button>
        <button aria-label="Siguiente" className="grid size-8 place-items-center rounded-lg text-texto2 hover:bg-suave" onClick={() => mover(1)}><ChevronRight className="size-4" /></button>
        <div className="ml-1 flex rounded-lg bg-suave p-0.5 text-[12px]">
          {(["semana", "mes"] as const).map((v) => <button key={v} onClick={() => setVista(v)} className={cx("rounded-md px-2 py-1 capitalize", vista === v && "bg-superficie font-medium shadow-sm")}>{v}</button>)}
        </div>
      </div>

      {vista === "semana" ? (
        <ul className="space-y-1">
          {dias.map((d) => {
            const s = iso(d); const l = porDia.get(s) ?? [];
            return (
              <li key={s} className={cx("flex gap-3 rounded-xl p-2", s === hoyS && "bg-acento-suave")}>
                <div className="w-10 shrink-0 text-center leading-tight">
                  <p className="text-[11px] uppercase text-texto2">{d.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "")}</p>
                  <p className={cx("num text-[18px] font-semibold", s === hoyS && "text-acento")}>{d.getDate()}</p>
                </div>
                <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                  {!l.length ? <p className="pt-2 text-[12px] text-texto2/60">—</p> : l.map((p) => (
                    <Link key={p.id} href={`/pedidos/ver/?id=${p.id}`} className={cx("block truncate rounded-lg border px-2.5 py-1.5 text-[13px] hover:shadow-sm", s < hoyS ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" : "border-borde bg-superficie")}>
                      <b className="font-medium">{p.clientes?.nombre ?? p.numero}</b> <span className="text-texto2">· {p.unidades} uds</span>
                    </Link>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <div className="grid grid-cols-7 text-center text-[11px] font-medium text-texto2">{DIAS.map((d) => <span key={d} className="pb-1">{d}</span>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {dias.map((d) => {
              const s = iso(d); const l = porDia.get(s) ?? []; const fuera = d.getMonth() !== ref.getMonth();
              return (
                <div key={s} className={cx("min-h-[64px] rounded-lg p-1", s === hoyS ? "bg-acento-suave" : "bg-suave/50", fuera && "opacity-40")}>
                  <p className={cx("num text-right text-[11px]", s === hoyS ? "font-bold text-acento" : "text-texto2")}>{d.getDate()}</p>
                  {l.slice(0, 2).map((p) => (
                    <Link key={p.id} href={`/pedidos/ver/?id=${p.id}`} title={p.clientes?.nombre ?? p.numero}
                      className={cx("mt-0.5 block truncate rounded px-1 text-[10px] leading-4", s < hoyS ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" : "bg-acento text-white")}>{p.clientes?.nombre ?? p.numero}</Link>
                  ))}
                  {l.length > 2 && <p className="mt-0.5 text-[10px] text-texto2">+{l.length - 2}</p>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
