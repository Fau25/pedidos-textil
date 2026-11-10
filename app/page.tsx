"use client";
import Link from "next/link";
import { Plus, ArrowRight, Inbox } from "lucide-react";
import { useSesion } from "@/components/sesion";
import { Cabecera } from "@/components/marco";
import { Boton, Cargando, Pastilla, SelloFecha, Tarjeta, Vacio, cx, diasHasta, fecha } from "@/components/ui";
import { sb } from "@/lib/supabase";
import { useCarga } from "@/lib/usar";
import { aCent, euros } from "@/lib/calculo";
import type { Pedido } from "@/lib/tipos";

export default function Inicio() {
  const { empresa, estados, estadoPor, sesion } = useSesion();
  const { datos } = useCarga(async () => {
    const { data, error } = await sb.from("pedidos").select("id, numero, fecha, entrega, total, estado_id, unidades, actualizado, clientes(nombre)")
      .eq("empresa_id", empresa!.id).order("fecha", { ascending: false }).limit(1000);
    if (error) throw error;
    return data as unknown as Pedido[];
  });

  const finales = new Set(estados.filter((e) => e.final).map((e) => e.id));
  const clave = (p: Pedido) => estadoPor(p.estado_id)?.clave;
  const activos = (datos ?? []).filter((p) => !finales.has(p.estado_id ?? ""));
  const mes = new Date().toISOString().slice(0, 7);
  const cuenta = (c: string) => activos.filter((p) => clave(p) === c);
  const enviados = cuenta("presupuesto_enviado");
  const tarjetas = [
    { t: "Pedidos activos", v: activos.length, f: "activos" },
    { t: "Pendientes de presupuesto", v: cuenta("pte_presupuesto").length + cuenta("borrador").length, f: "pte_presupuesto,borrador" },
    { t: "Pendientes de compra", v: cuenta("pte_compra").length + cuenta("presupuesto_aceptado").length, f: "pte_compra,presupuesto_aceptado" },
    { t: "En personalización", v: cuenta("en_personalizacion").length + cuenta("material_recibido").length, f: "en_personalizacion,material_recibido" },
    { t: "Listos para entregar", v: cuenta("listo").length, f: "listo", alerta: cuenta("listo").length > 0 },
    { t: "Entregados este mes", v: (datos ?? []).filter((p) => clave(p) === "entregado" && (p.actualizado ?? "").startsWith(mes)).length, f: "entregado" },
    { t: "Presupuestos enviados", v: euros(enviados.reduce((a, p) => a + aCent(p.total), 0)), sub: `${enviados.length} sin respuesta`, f: "presupuesto_enviado" },
    { t: "Importe pedidos activos", v: euros(activos.reduce((a, p) => a + aCent(p.total), 0)), sub: "IVA incluido", f: "activos", grande: true },
  ];
  const proximas = activos.filter((p) => p.entrega && clave(p) !== "borrador").sort((a, b) => (a.entrega! < b.entrega! ? -1 : 1)).slice(0, 5);
  const recientes = [...(datos ?? [])].sort((a, b) => (a.actualizado < b.actualizado ? 1 : -1)).slice(0, 8);
  const h = new Date().getHours();
  const saludo = h < 6 ? "Buenas noches" : h < 14 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches";
  const nombre = (sesion?.user.email ?? "").split("@")[0].split(/[._]/)[0];

  return (
    <>
      <Cabecera
        titulo={`${saludo}${nombre ? ", " + nombre.charAt(0).toUpperCase() + nombre.slice(1) : ""}`}
        sub={new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
        acciones={<Link href="/pedidos/nuevo/"><Boton variante="primario"><Plus className="size-4" />Nuevo pedido</Boton></Link>}
      />
      {!datos ? <Cargando /> : (
        <>
          <div className="-mx-4 mb-6 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
            {tarjetas.map((t) => (
              <Link key={t.t} href={`/pedidos/?estado=${t.f}`} className="tarjeta group min-w-[150px] snap-start p-4 transition-shadow hover:shadow-md">
                <p className="text-[12px] font-medium text-texto2">{t.t}</p>
                <p className={cx("num mt-1.5 font-semibold tracking-[-0.02em]", typeof t.v === "number" ? "text-[28px]" : "text-[20px] leading-[42px]", t.alerta && "text-emerald-600 dark:text-emerald-400")}>{t.v}</p>
                {t.sub && <p className="text-[12px] text-texto2">{t.sub}</p>}
              </Link>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <Tarjeta titulo="Pedidos recientes" accion={<Link href="/pedidos/" className="flex items-center gap-1 text-[13px] text-acento">Ver todos <ArrowRight className="size-3.5" /></Link>} sinPadding>
              {!recientes.length ? (
                <Vacio icono={<Inbox className="size-5" />} titulo="Aún no hay pedidos" texto="Crea el primero: cliente, prendas con sus tallas y la personalización. El presupuesto se calcula solo."
                  accion={<Link href="/pedidos/nuevo/"><Boton variante="primario"><Plus className="size-4" />Nuevo pedido</Boton></Link>} />
              ) : (
                <ul className="divide-y divide-borde">
                  {recientes.map((p) => {
                    const e = estadoPor(p.estado_id);
                    return (
                      <li key={p.id}>
                        <Link href={`/pedidos/ver/?id=${p.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-suave/60 sm:grid-cols-[110px_1fr_90px_100px_auto]">
                          <span className="num text-[13px] font-semibold">{p.numero}</span>
                          <span className="order-first col-span-2 truncate font-medium sm:order-none sm:col-span-1">{p.clientes?.nombre ?? "Sin cliente"}</span>
                          <span className="hidden text-[13px] text-texto2 sm:block">{p.entrega ? "Entrega " + fecha(p.entrega) : fecha(p.fecha)}</span>
                          <span className="num text-right text-[13px] font-medium">{euros(aCent(p.total))}</span>
                          {e && <Pastilla color={e.color} className="justify-self-end">{e.nombre}</Pastilla>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Tarjeta>

            <Tarjeta titulo="Próximas entregas">
              {!proximas.length ? <p className="py-6 text-center text-[13px] text-texto2">No hay entregas programadas.</p> : (
                <ul className="space-y-1">
                  {proximas.map((p) => {
                    const d = diasHasta(p.entrega);
                    const e = estadoPor(p.estado_id);
                    return (
                      <li key={p.id}>
                        <Link href={`/pedidos/ver/?id=${p.id}`} className="-mx-2 flex items-center gap-3 rounded-xl p-2 hover:bg-suave/60">
                          <SelloFecha d={p.entrega} alerta={d !== null && d <= 2} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{p.clientes?.nombre ?? p.numero}</span>
                            <span className={cx("block text-[12px]", d !== null && d < 0 ? "text-red-600" : d !== null && d <= 2 ? "text-amber-700 dark:text-amber-400" : "text-texto2")}>
                              {d === null ? "" : d < 0 ? `Retrasado ${-d} día${d === -1 ? "" : "s"}` : d === 0 ? "Hoy" : d === 1 ? "Mañana" : `En ${d} días`} · {p.unidades} uds · {e?.nombre}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Tarjeta>
          </div>
        </>
      )}
    </>
  );
}
