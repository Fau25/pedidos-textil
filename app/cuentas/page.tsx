"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ClipboardList, Euro, ShoppingBag } from "lucide-react";
import { useSesion } from "@/components/sesion";
import { Cabecera } from "@/components/marco";
import { Boton, Cargando, cx, fecha, useAvisos } from "@/components/ui";
import { sb, textoError } from "@/lib/supabase";
import { useCarga } from "@/lib/usar";
import { aCent, euros } from "@/lib/calculo";
import { AVISO_SIN_COBROS, conPago, marcarPagado } from "@/lib/pedidos";
import { cobrar, deshacerCobro, pendienteCent, sinTablaTrabajos, type Trabajo } from "@/lib/trabajos";

type FilaPedido = { id: string; numero: string; fecha: string; total: number; pagado_en?: string | null; clientes: { nombre: string } | null };
type FilaTrabajo = Pick<Trabajo, "id" | "numero" | "cliente_nombre" | "total" | "a_cuenta" | "pagado_en" | "creado">;
/** Un cobro o algo por cobrar, de un pedido o de un trabajo */
type Mov = { tipo: "pedido" | "trabajo"; id: string; numero: string; cliente: string; cent: number; cuando: string; aCuenta?: boolean; t?: FilaTrabajo };

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const mesDe = (iso: string) => { const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const nombreMes = (m: string, largo = false) => { const [a, n] = m.split("-").map(Number); if (!largo) return MESES[n - 1]; const t = new Date(a, n - 1, 1).toLocaleDateString("es-ES", { month: "long" }); return `${t[0].toUpperCase()}${t.slice(1)} ${a}`; };
const ultimosMeses = (n: number) => { const d = new Date(); return Array.from({ length: n }, (_, i) => mesDe(new Date(d.getFullYear(), d.getMonth() - (n - 1 - i), 15).toISOString())); };

export default function Cuentas() {
  const { empresa } = useSesion();
  const { aviso } = useAvisos();
  const [vista, setVista] = useState<"cobrar" | "cobrado">("cobrar");
  const meses = useMemo(() => ultimosMeses(12), []);
  const [mes, setMes] = useState(meses[meses.length - 1]);
  const [encima, setEncima] = useState<string | null>(null);

  const { datos, error, recargar } = useCarga(async () => {
    const [pedidos, tr] = await Promise.all([
      conPago<FilaPedido[]>((x) => sb.from("pedidos").select(`id, numero, fecha, total${x}, clientes(nombre)`).eq("empresa_id", empresa!.id).order("fecha", { ascending: false }).limit(5000)),
      (async () => {
        let r = await sb.from("trabajos").select("id, numero, cliente_nombre, total, a_cuenta, pagado_en, creado").eq("empresa_id", empresa!.id).limit(5000);
        if (r.error && /pagado_en/.test(r.error.message)) r = await sb.from("trabajos").select("id, numero, cliente_nombre, total, a_cuenta, creado").eq("empresa_id", empresa!.id).limit(5000) as typeof r;
        if (r.error) { if (sinTablaTrabajos(r.error)) return []; throw r.error; }
        return (r.data ?? []) as FilaTrabajo[];
      })(),
    ]);
    return { pedidos, trabajos: tr, conCobros: !pedidos.length || "pagado_en" in pedidos[0] };
  });

  const c = useMemo(() => {
    const porCobrar: Mov[] = [], cobrados: Mov[] = [];
    for (const p of datos?.pedidos ?? []) {
      const m: Mov = { tipo: "pedido", id: p.id, numero: p.numero, cliente: p.clientes?.nombre ?? "Sin cliente", cent: aCent(p.total), cuando: p.pagado_en ?? p.fecha };
      if (m.cent <= 0) continue;
      (p.pagado_en ? cobrados : porCobrar).push(m);
    }
    for (const t of datos?.trabajos ?? []) {
      const base = { tipo: "trabajo" as const, id: t.id, numero: t.numero ?? "Trabajo", cliente: t.cliente_nombre || "Sin nombre", t };
      const pend = pendienteCent(t), dado = aCent(t.a_cuenta);
      if (pend > 0) porCobrar.push({ ...base, cent: pend, cuando: t.creado });
      // Cobrado del todo: cuenta el día del cobro. Si solo dejó algo a cuenta, cuenta el día que lo trajo.
      if (t.pagado_en) cobrados.push({ ...base, cent: aCent(t.total), cuando: t.pagado_en });
      else if (dado > 0) cobrados.push({ ...base, cent: dado, cuando: t.creado, aCuenta: true });
    }
    const porMes = new Map(meses.map((m) => [m, { pedidos: 0, trabajos: 0 }]));
    for (const m of cobrados) { const x = porMes.get(mesDe(m.cuando)); if (x) x[m.tipo === "pedido" ? "pedidos" : "trabajos"] += m.cent; }
    porCobrar.sort((a, b) => (a.cuando < b.cuando ? -1 : 1));
    cobrados.sort((a, b) => (a.cuando < b.cuando ? 1 : -1));
    const año = String(new Date().getFullYear());
    return {
      porCobrar, cobrados, porMes,
      totalCobrar: porCobrar.reduce((a, m) => a + m.cent, 0),
      totalAño: cobrados.filter((m) => mesDe(m.cuando).startsWith(año)).reduce((a, m) => a + m.cent, 0),
    };
  }, [datos, meses]);

  const actual = meses[meses.length - 1], anterior = meses[meses.length - 2];
  const suma = (m: string) => { const x = c.porMes.get(m); return x ? x.pedidos + x.trabajos : 0; };
  const cambio = suma(anterior) ? Math.round(((suma(actual) - suma(anterior)) / suma(anterior)) * 100) : null;
  const max = Math.max(1, ...meses.map(suma));
  const tope = escala(max);
  const delMes = c.cobrados.filter((m) => mesDe(m.cuando) === mes);
  const verMes = encima ?? mes;
  const x = c.porMes.get(verMes)!;

  async function cobrarMov(m: Mov) {
    try {
      if (m.tipo === "pedido") {
        await marcarPagado([m.id], true);
        aviso(`${m.numero} cobrado: ${euros(m.cent)}`, "ok", { texto: "Deshacer", fn: () => { marcarPagado([m.id], false).then(recargar).catch(() => {}); } });
      } else {
        const t = m.t! as Trabajo;
        await cobrar(t);
        aviso(`${m.numero} cobrado: ${euros(m.cent)}`, "ok", { texto: "Deshacer", fn: () => { deshacerCobro(t).then(recargar).catch(() => {}); } });
      }
      recargar();
    } catch (e) { aviso(textoError(e), "error"); }
  }

  if (!datos) return <><Cabecera titulo="Cuentas" /><Cargando error={error} reintentar={recargar} /></>;
  const lista = vista === "cobrar" ? c.porCobrar : delMes;

  return (
    <>
      <Cabecera titulo="Cuentas" sub="Lo que te deben, lo cobrado y cómo va cada mes (pedidos y trabajos)" />
      {!datos.conCobros && <p role="status" className="tarjeta mb-4 border-amber-300 p-4 text-[13px] text-amber-800 dark:text-amber-300">{AVISO_SIN_COBROS}. Hasta entonces los pedidos salen todos como «sin cobrar».</p>}

      {/* Cifras */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <button onClick={() => setVista("cobrar")} className="col-span-2 flex min-h-[132px] flex-col justify-between rounded-[22px] bg-[#17181c] p-5 text-left text-white shadow-[0_18px_40px_-18px_rgba(16,18,24,0.55)] sm:p-6 lg:col-span-1 dark:bg-[#24262c]">
          <p className="text-[13px] font-medium text-white/60">Por cobrar</p>
          <div><p className="num text-[34px] font-semibold leading-none tracking-[-0.04em] sm:text-[40px]">{euros(c.totalCobrar)}</p>
            <p className="mt-2 text-[13px] text-white/60">{c.porCobrar.length} {c.porCobrar.length === 1 ? "pendiente" : "pendientes"} de cobro</p></div>
        </button>
        <div className="tarjeta flex min-h-[132px] flex-col justify-between p-5 sm:p-6">
          <p className="text-[13px] font-medium text-texto2">Cobrado este mes</p>
          <div><p className="num text-[22px] font-semibold leading-none tracking-[-0.03em] sm:text-[30px]">{euros(suma(actual))}</p>
            <p className="mt-2 text-[13px] text-texto2">{cambio === null ? `En ${nombreMes(actual, true).split(" ")[0].toLowerCase()}` : `${cambio >= 0 ? "▲" : "▼"} ${Math.abs(cambio)} % vs ${nombreMes(anterior)}`}</p></div>
        </div>
        <div className="tarjeta flex min-h-[132px] flex-col justify-between p-5 sm:p-6">
          <p className="text-[13px] font-medium text-texto2">Cobrado este año</p>
          <div><p className="num text-[22px] font-semibold leading-none tracking-[-0.03em] sm:text-[30px]">{euros(c.totalAño)}</p>
            <p className="mt-2 text-[13px] text-texto2">Media {euros(Math.round(c.totalAño / (new Date().getMonth() + 1)))} / mes</p></div>
        </div>
      </div>

      {/* Gráfico mensual */}
      <section className="tarjeta mb-6 p-5 sm:p-6" aria-labelledby="t-grafico">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="t-grafico" className="text-[15px] font-semibold">Ingresos cobrados por mes</h2>
            <p className="text-[12.5px] text-texto2">Toca un mes para ver qué se cobró</p>
          </div>
          <div className="text-right">
            <p className="text-[12px] text-texto2">{nombreMes(verMes, true)}</p>
            <p className="num text-[24px] font-semibold leading-tight tracking-[-0.03em]">{euros(x.pedidos + x.trabajos)}</p>
            <p className="num text-[12px] text-texto2">Pedidos {euros(x.pedidos)} · Trabajos {euros(x.trabajos)}</p>
          </div>
        </div>
        <div className="mb-3 flex gap-4 text-[12px] text-texto2" aria-hidden>
          <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-[var(--serie-pedidos)]" />Pedidos</span>
          <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-[var(--serie-trabajos)]" />Trabajos</span>
        </div>
        <div className="relative h-[190px] pl-12" aria-hidden>
          {[1, 0.5, 0].map((f) => (
            <div key={f} className="absolute inset-x-0 border-t border-borde/70" style={{ bottom: `calc(${f * 100}% * 160 / 190 + 30px)` }}>
              <span className="num absolute -top-2 left-0 text-[10.5px] text-texto2">{corto(tope * f)}</span>
            </div>
          ))}
          <div className="absolute bottom-0 left-12 right-0 flex h-full items-end gap-1 sm:gap-2">
            {meses.map((m) => {
              const v = c.porMes.get(m)!; const alto = (v.pedidos + v.trabajos) / tope;
              return (
                <button key={m} onClick={() => { setMes(m); setVista("cobrado"); }} onMouseEnter={() => setEncima(m)} onMouseLeave={() => setEncima(null)}
                  className={cx("group flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-lg pb-0", m === mes && "bg-suave/70")} tabIndex={-1}>
                  <span className="flex w-full max-w-[34px] flex-col justify-end gap-[2px]" style={{ height: `calc((100% - 30px) * ${alto})` }}>
                    {v.trabajos > 0 && <span className="w-full rounded-t-[4px] bg-[var(--serie-trabajos)] group-hover:opacity-85" style={{ flex: v.trabajos }} />}
                    {v.pedidos > 0 && <span className={cx("w-full bg-[var(--serie-pedidos)] group-hover:opacity-85", !v.trabajos && "rounded-t-[4px]")} style={{ flex: v.pedidos }} />}
                  </span>
                  <span className={cx("mt-1.5 h-[24px] text-[11px]", m === mes ? "font-semibold text-texto" : "text-texto2")}><span className="sm:hidden">{nombreMes(m)[0].toUpperCase()}</span><span className="hidden sm:inline">{nombreMes(m)}</span></span>
                </button>
              );
            })}
          </div>
        </div>
        <table className="sr-only"><caption>Ingresos cobrados por mes</caption>
          <thead><tr><th>Mes</th><th>Pedidos</th><th>Trabajos</th><th>Total</th></tr></thead>
          <tbody>{meses.map((m) => { const v = c.porMes.get(m)!; return <tr key={m}><td>{nombreMes(m, true)}</td><td>{euros(v.pedidos)}</td><td>{euros(v.trabajos)}</td><td>{euros(v.pedidos + v.trabajos)}</td></tr>; })}</tbody>
        </table>
        <label className="mt-3 flex items-center gap-2 text-[13px] text-texto2 sm:hidden">Mes
          <select className="campo w-auto" value={mes} onChange={(e) => { setMes(e.target.value); setVista("cobrado"); }}>{meses.map((m) => <option key={m} value={m}>{nombreMes(m, true)}</option>)}</select>
        </label>
      </section>

      {/* Listas */}
      <div className="mb-3 flex gap-2">
        {([["cobrar", `Por cobrar · ${c.porCobrar.length}`], ["cobrado", `Cobrado en ${nombreMes(mes, true).split(" ")[0].toLowerCase()} · ${delMes.length}`]] as const).map(([v, t]) => (
          <button key={v} onClick={() => setVista(v)} aria-pressed={vista === v}
            className={cx("h-10 rounded-full px-5 text-[13px] font-medium transition-colors", vista === v ? "bg-acento text-sobre-acento" : "bg-superficie text-texto2 hover:text-texto")}>{t}</button>
        ))}
      </div>
      <div className="tarjeta overflow-hidden">
        {!lista.length ? <p className="py-12 text-center text-texto2">{vista === "cobrar" ? "Todo cobrado 🎉" : "Nada cobrado este mes."}</p> : (
          <ul className="divide-y divide-borde">
            {lista.map((m) => (
              <li key={m.tipo + m.id + (m.aCuenta ? "a" : "")} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-suave text-texto2" title={m.tipo === "pedido" ? "Pedido" : "Trabajo"}>
                  {m.tipo === "pedido" ? <ShoppingBag className="size-4" /> : <ClipboardList className="size-4" />}
                </span>
                <Link href={m.tipo === "pedido" ? `/pedidos/ver/?id=${m.id}` : `/trabajos/nuevo/?id=${m.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{m.cliente}</span>
                  <span className="block truncate text-[12px] text-texto2"><span className="num">{m.numero}</span> · {m.tipo === "pedido" ? "Pedido" : "Trabajo"} · {vista === "cobrar" ? `desde ${fecha(m.cuando.slice(0, 10))}` : m.aCuenta ? `a cuenta el ${fecha(m.cuando.slice(0, 10))}` : `cobrado el ${fecha(m.cuando.slice(0, 10))}`}</span>
                </Link>
                <span className="num shrink-0 text-[14px] font-semibold">{euros(m.cent)}</span>
                {vista === "cobrar" && <Boton tam="s" onClick={() => cobrarMov(m)} aria-label={`Cobrar ${m.numero}`}><Euro className="size-3.5" />Cobrar</Boton>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/** Tope redondo del eje (en céntimos) para que las marcas sean números limpios */
function escala(max: number) {
  const e = max / 100, p = Math.pow(10, Math.floor(Math.log10(e || 1)));
  const n = [1, 2, 2.5, 5, 10].find((k) => k * p >= e) ?? 10;
  return n * p * 100;
}
const corto = (cent: number) => { const e = cent / 100; return e >= 1000 ? `${+(e / 1000).toFixed(1)}k €` : `${Math.round(e)} €`; };
