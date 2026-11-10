"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Copy, Trash2, FileText, Download, Send, CheckCircle2, XCircle, Plus, MessageSquarePlus, Paperclip, Phone, Mail } from "lucide-react";
import { useSesion } from "@/components/sesion";
import { Boton, Cargando, Pastilla, Pestanas, SelloFecha, Tarjeta, Vacio, cx, diasHasta, fecha, useAvisos, PUNTOS } from "@/components/ui";
import { sb, textoError, urlArchivo } from "@/lib/supabase";
import { useCarga, useParam } from "@/lib/usar";
import { aCent, calcular, euros } from "@/lib/calculo";
import { aCalc, cargarPedido, describirLinea, textoTallas } from "@/lib/pedidos";
import { crearPresupuesto, compartirOPDF, marcarPresupuesto } from "@/lib/presupuestos";
import { ESTADOS_LINEA, ESTADOS_PERS, ESTADOS_PRESU, type Cliente, type EstadoLinea, type Historial, type Presupuesto } from "@/lib/tipos";

type Tab = "resumen" | "personalizacion" | "presupuesto" | "historial";

export default function Ficha() {
  const pid = useParam("id");
  const { empresa, estados, estadoPor } = useSesion();
  const { aviso, confirmar } = useAvisos();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("resumen");
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState("");
  useEffect(() => { const t = new URLSearchParams(location.search).get("tab") as Tab | null; if (t) setTab(t); }, []);

  const { datos, recargar } = useCarga(async () => {
    if (!pid) return null;
    const r = await cargarPedido(pid);
    if (!r) return { falta: true as const };
    const [cli, hist, pres] = await Promise.all([
      r.ed.cliente_id ? sb.from("clientes").select("*").eq("id", r.ed.cliente_id).single() : Promise.resolve({ data: null }),
      sb.from("pedido_historial").select("*").eq("pedido_id", pid).order("creado", { ascending: false }),
      sb.from("presupuestos").select("*").eq("pedido_id", pid).order("version", { ascending: false }),
    ]);
    return { ...r, cliente: cli.data as Cliente | null, historial: (hist.data ?? []) as Historial[], presupuestos: (pres.data ?? []) as Presupuesto[] };
  }, [pid]);

  const t = useMemo(() => (datos && !("falta" in datos) ? calcular(aCalc(datos.ed, Number(empresa!.margen))) : null), [datos, empresa]);
  if (!pid || !datos) return <Cargando />;
  if ("falta" in datos) return <Vacio titulo="Este pedido no existe o se ha borrado" accion={<Link href="/pedidos/"><Boton>Ver pedidos</Boton></Link>} />;
  const { ed, pedido, cliente, historial, presupuestos } = datos;
  const estado = estadoPor(ed.estado_id);
  const flujo = estados.filter((e) => !e.final || e.clave === "entregado");
  const d = diasHasta(ed.entrega);

  async function cambiarEstado(eid: string) {
    setOcupado("estado");
    const { error } = await sb.rpc("cambiar_estado", { p: ed.id, e: eid, nota: null });
    setOcupado("");
    if (error) return aviso(textoError(error), "error");
    aviso(`Estado: ${estadoPor(eid)?.nombre}`); recargar();
  }
  async function estadoLinea(id: string, estado: EstadoLinea) {
    const { error } = await sb.from("pedido_lineas").update({ estado }).eq("id", id);
    if (error) aviso(textoError(error), "error"); else recargar();
  }
  async function estadoPers(id: string, estado: string) {
    const { error } = await sb.from("personalizaciones").update({ estado }).eq("id", id);
    if (error) aviso(textoError(error), "error"); else recargar();
  }
  async function nuevoPresupuesto() {
    setOcupado("presu");
    try { await crearPresupuesto(ed.id, empresa!); aviso("Presupuesto generado"); setTab("presupuesto"); recargar(); }
    catch (e) { aviso(textoError(e), "error"); } finally { setOcupado(""); }
  }
  async function pdf(p: Presupuesto) {
    setOcupado("pdf" + p.id);
    try { const r = await compartirOPDF(p); if (r === "descargado") aviso("PDF descargado"); }
    catch (e) { aviso(textoError(e), "error"); } finally { setOcupado(""); }
  }
  async function marcar(p: Presupuesto, e: Presupuesto["estado"]) {
    try { await marcarPresupuesto(p, e, estados, ed.estado_id); aviso(e === "aceptado" ? "Presupuesto aceptado: el pedido pasa a confirmado" : `Presupuesto ${ESTADOS_PRESU[e].toLowerCase()}`); recargar(); }
    catch (err) { aviso(textoError(err), "error"); }
  }
  async function borrar() {
    if (!(await confirmar({ titulo: `¿Eliminar ${ed.numero}?`, texto: "Se borrarán sus prendas, personalizaciones, presupuestos e historial. No se puede deshacer.", ok: "Eliminar", peligro: true }))) return;
    const { error } = await sb.from("pedidos").delete().eq("id", ed.id);
    if (error) return aviso(textoError(error), "error");
    aviso("Pedido eliminado"); router.push("/pedidos/");
  }
  async function anotar(e: React.FormEvent) {
    e.preventDefault();
    if (!nota.trim()) return;
    const { error } = await sb.from("pedido_historial").insert({ pedido_id: ed.id, nota: nota.trim() });
    if (error) return aviso(textoError(error), "error");
    setNota(""); recargar();
  }

  const nombres = new Map(ed.lineas.map((l) => [l.clave, [l.tipo, l.color].filter(Boolean).join(" · ")]));

  return (
    <>
      <Link href="/pedidos/" className="mb-2 inline-block text-[13px] text-texto2 hover:text-texto">← Pedidos</Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <SelloFecha d={ed.entrega} alerta={d !== null && d <= 2 && !estado?.final} />
          <div className="min-w-0">
            <h1 className="num text-[24px] font-semibold tracking-[-0.02em] sm:text-[28px]">{ed.numero}</h1>
            <p className="truncate text-texto2">
              {cliente ? <Link href={`/clientes/ver/?id=${cliente.id}`} className="font-medium text-texto hover:underline">{cliente.nombre}</Link> : "Sin cliente"}
              {ed.referencia && <> · {ed.referencia}</>} · {fecha(ed.fecha, true)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Estado del pedido</span>
            <span className={cx("pointer-events-none absolute left-3 top-1/2 size-2 -translate-y-1/2 rounded-full", PUNTOS[estado?.color ?? "gris"])} />
            <select className="campo w-auto pl-7 font-medium" value={ed.estado_id ?? ""} disabled={ocupado === "estado"} onChange={(e) => cambiarEstado(e.target.value)}>
              {estados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </label>
          <Link href={`/pedidos/nuevo/?id=${ed.id}`}><Boton><Pencil className="size-4" />Editar</Boton></Link>
          <Link href={`/pedidos/nuevo/?duplicar=${ed.id}`}><Boton variante="fantasma" aria-label="Duplicar"><Copy className="size-4" /><span className="hidden sm:inline">Duplicar</span></Boton></Link>
          <Boton variante="fantasma" aria-label="Eliminar" className="hover:text-red-600" onClick={borrar}><Trash2 className="size-4" /></Boton>
        </div>
      </div>

      {/* Progreso */}
      {estado?.clave !== "cancelado" && (
        <div className="tarjeta mb-6 overflow-x-auto px-4 py-4">
          <ol className="flex min-w-[640px] items-center">
            {flujo.map((e, i) => {
              const hecho = estado ? e.orden < estado.orden : false;
              const actual = e.id === estado?.id;
              return (
                <li key={e.id} className="flex flex-1 items-center last:flex-none">
                  <button onClick={() => cambiarEstado(e.id)} title={`Cambiar a «${e.nombre}»`} className="flex flex-col items-center gap-1.5">
                    <span className={cx("grid size-6 place-items-center rounded-full border-2 text-[10px] font-bold", actual ? "border-acento bg-acento text-white" : hecho ? "border-acento bg-acento-suave text-acento" : "border-borde text-texto2")}>{hecho ? "✓" : i + 1}</span>
                    <span className={cx("max-w-[76px] text-center text-[10px] leading-tight", actual ? "font-semibold text-texto" : "text-texto2")}>{e.nombre}</span>
                  </button>
                  {i < flujo.length - 1 && <span className={cx("mx-1 mb-5 h-0.5 flex-1 rounded", hecho ? "bg-acento" : "bg-borde")} />}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <Pestanas valor={tab} cambiar={setTab} opciones={[
        { v: "resumen", t: "Resumen" }, { v: "personalizacion", t: "Personalización", n: ed.pers.length },
        { v: "presupuesto", t: "Presupuesto", n: presupuestos.length }, { v: "historial", t: "Historial" },
      ]} />

      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {tab === "resumen" && (
            <Tarjeta titulo={`Prendas · ${t?.unidades ?? 0} uds`} sinPadding>
              {!ed.lineas.length ? <p className="p-5 text-texto2">Sin prendas.</p> : (
                <ul className="divide-y divide-borde">
                  {ed.lineas.map((l) => (
                    <li key={l.clave} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                      <ImagenPrenda path={l.imagen_path} />
                      <div className="min-w-[180px] flex-1">
                        <p className="font-medium">{describirLinea(l)}</p>
                        <p className="num text-[13px] text-texto2">{textoTallas(l.tallas) || "Sin tallas"}</p>
                        {l.notas && <p className="text-[12px] text-texto2">{l.notas}</p>}
                      </div>
                      <div className="num w-24 text-right text-[13px]"><b>{t?.lineas[l.clave]?.unidades ?? 0}</b> uds<span className="block text-texto2">{euros(t?.lineas[l.clave]?.venta ?? 0)}</span></div>
                      <select className="campo h-8 w-auto text-[12px]" aria-label="Estado de la prenda" value={l.estado} onChange={(e) => estadoLinea(l.clave, e.target.value as EstadoLinea)}>
                        {Object.entries(ESTADOS_LINEA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </li>
                  ))}
                </ul>
              )}
              {ed.notas && <p className="border-t border-borde px-5 py-3 text-[13px]"><span className="text-texto2">Observaciones: </span>{ed.notas}</p>}
            </Tarjeta>
          )}

          {tab === "personalizacion" && (
            !ed.pers.length ? <div className="tarjeta"><Vacio titulo="Sin personalización" accion={<Link href={`/pedidos/nuevo/?id=${ed.id}`}><Boton><Plus className="size-4" />Añadir</Boton></Link>} /></div> : (
              <div className="space-y-3">
                {ed.pers.map((z, i) => (
                  <div key={z.clave} className="tarjeta flex flex-wrap items-center gap-4 p-4">
                    <Diseno path={z.diseno_path} />
                    <div className="min-w-[200px] flex-1">
                      <p className="font-medium">{z.tecnica} · {z.ubicacion}{z.aplicaciones > 1 && ` ×${z.aplicaciones}`}</p>
                      <p className="text-[13px] text-texto2">{z.lineas.map((k) => nombres.get(k)).filter(Boolean).join(", ") || "Sin prendas asignadas"} · {t?.pers[i]?.unidades ?? 0} uds</p>
                      {z.notas && <p className="text-[12px] text-texto2">{z.notas}</p>}
                    </div>
                    <span className="num text-[13px] font-medium">{euros(t?.pers[i]?.venta ?? 0)}</span>
                    <select className="campo h-8 w-auto text-[12px]" aria-label="Estado del trabajo" value={z.estado} onChange={(e) => estadoPers(z.clave, e.target.value)}>
                      {Object.entries(ESTADOS_PERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === "presupuesto" && (
            <div className="space-y-3">
              <div className="flex justify-end"><Boton variante={presupuestos.length ? "secundario" : "primario"} cargando={ocupado === "presu"} onClick={nuevoPresupuesto}><FileText className="size-4" />{presupuestos.length ? "Nueva versión con los datos actuales" : "Generar presupuesto"}</Boton></div>
              {!presupuestos.length ? <div className="tarjeta"><Vacio icono={<FileText className="size-5" />} titulo="Aún no hay presupuesto" texto="Se genera con las prendas, personalizaciones y precios actuales del pedido. Después puedes descargarlo en PDF o enviarlo." /></div>
                : presupuestos.map((p) => (
                  <div key={p.id} className="tarjeta p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex-1">
                        <p className="num font-semibold">{p.numero} <span className="font-normal text-texto2">· versión {p.version}</span></p>
                        <p className="text-[13px] text-texto2">{fecha(p.fecha, true)} · válido hasta {fecha(p.validez)}</p>
                      </div>
                      <Pastilla color={{ borrador: "gris", enviado: "azul", aceptado: "verde", rechazado: "rojo" }[p.estado]}>{ESTADOS_PRESU[p.estado]}</Pastilla>
                      <span className="num text-[16px] font-semibold">{euros(aCent(p.total))}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-borde pt-3">
                      <Boton tam="s" cargando={ocupado === "pdf" + p.id} onClick={() => pdf(p)}><Download className="size-3.5" />PDF</Boton>
                      {p.estado === "borrador" && <Boton tam="s" onClick={() => marcar(p, "enviado")}><Send className="size-3.5" />Marcar enviado</Boton>}
                      {p.estado !== "aceptado" && <Boton tam="s" variante="primario" onClick={() => marcar(p, "aceptado")}><CheckCircle2 className="size-3.5" />Aceptado → confirmar pedido</Boton>}
                      {p.estado !== "rechazado" && p.estado !== "aceptado" && <Boton tam="s" variante="fantasma" onClick={() => marcar(p, "rechazado")}><XCircle className="size-3.5" />Rechazado</Boton>}
                      {cliente?.email && <a className="ml-auto" href={`mailto:${cliente.email}?subject=${encodeURIComponent(`Presupuesto ${p.numero} · ${empresa!.nombre}`)}&body=${encodeURIComponent(`Hola${cliente.contacto ? " " + cliente.contacto.split(" ")[0] : ""},\n\nTe adjunto el presupuesto ${p.numero} por importe de ${euros(aCent(p.total))} (IVA incluido).\n\nCualquier duda, me dices.\n\nUn saludo,\n${empresa!.nombre}`)}`}><Boton tam="s" variante="fantasma"><Mail className="size-3.5" />Email</Boton></a>}
                    </div>
                  </div>
                ))}
              {!!presupuestos.length && <p className="text-[12px] text-texto2">Para enviarlo: pulsa PDF (en el móvil se abre «Compartir» para mandarlo por WhatsApp o email) y luego «Marcar enviado».</p>}
            </div>
          )}

          {tab === "historial" && (
            <Tarjeta titulo="Línea temporal">
              <form onSubmit={anotar} className="mb-5 flex gap-2">
                <input className="campo" placeholder="Añadir una nota (llamada, cambio pedido por el cliente…)" value={nota} onChange={(e) => setNota(e.target.value)} />
                <Boton type="submit" aria-label="Añadir nota"><MessageSquarePlus className="size-4" /></Boton>
              </form>
              <ol className="relative ml-2 border-l-2 border-borde">
                {historial.map((h) => (
                  <li key={h.id} className="mb-5 ml-5 last:mb-0">
                    <span className={cx("absolute -left-[7px] mt-1.5 size-3 rounded-full ring-4 ring-superficie", h.estado_nombre ? "bg-acento" : "bg-slate-300 dark:bg-slate-600")} />
                    <p className="text-[12px] text-texto2">{new Date(h.creado).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    {h.estado_nombre && <p className="font-medium">{h.estado_nombre}</p>}
                    {h.nota && <p className={cx("text-[13px]", h.estado_nombre && "text-texto2")}>{h.nota}</p>}
                  </li>
                ))}
              </ol>
            </Tarjeta>
          )}
        </div>

        <aside className="space-y-4">
          <Tarjeta titulo="Importe">
            <dl className="space-y-1.5 text-[13px]">
              <div className="flex justify-between"><dt className="text-texto2">Base imponible</dt><dd className="num">{euros(t?.base ?? 0)}</dd></div>
              <div className="flex justify-between"><dt className="text-texto2">IVA {ed.iva} %</dt><dd className="num">{euros(t?.iva ?? 0)}</dd></div>
              <div className="flex items-baseline justify-between pt-1"><dt className="font-semibold">Total</dt><dd className="num text-[22px] font-semibold">{euros(t?.total ?? 0)}</dd></div>
              <div className="mt-2 flex justify-between rounded-lg bg-suave px-3 py-2"><dt className="text-texto2">Margen bruto</dt><dd className="num font-medium">{euros(t?.margen ?? 0)} · {(t?.margenPct ?? 0).toLocaleString("es-ES")} %</dd></div>
            </dl>
          </Tarjeta>
          {cliente && (
            <Tarjeta titulo="Cliente">
              <p className="font-medium">{cliente.nombre}</p>
              {cliente.contacto && <p className="text-[13px] text-texto2">{cliente.contacto}</p>}
              <div className="mt-3 flex flex-col gap-1.5 text-[13px]">
                {cliente.telefono && <a href={`tel:${cliente.telefono.replace(/\s/g, "")}`} className="flex items-center gap-2 text-acento"><Phone className="size-3.5" />{cliente.telefono}</a>}
                {cliente.email && <a href={`mailto:${cliente.email}`} className="flex items-center gap-2 truncate text-acento"><Mail className="size-3.5" />{cliente.email}</a>}
              </div>
            </Tarjeta>
          )}
          <p className="px-1 text-[12px] text-texto2">Actualizado {new Date(pedido.actualizado).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
        </aside>
      </div>
    </>
  );
}

function ImagenPrenda({ path }: { path: string | null }) {
  const [u, setU] = useState<string | null>(null);
  useEffect(() => { urlArchivo(path).then(setU); }, [path]);
  // eslint-disable-next-line @next/next/no-img-element
  return u ? <img src={u} alt="" className="size-11 rounded-lg object-cover" /> : <div className="size-11 rounded-lg bg-suave" />;
}
function Diseno({ path }: { path: string | null }) {
  const [u, setU] = useState<string | null>(null);
  useEffect(() => { urlArchivo(path).then(setU); }, [path]);
  if (!u) return <div className="grid size-14 place-items-center rounded-xl bg-suave text-texto2"><Paperclip className="size-4" /></div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <a href={u} target="_blank" rel="noreferrer">{/\.(png|jpe?g|gif|webp|svg)$/i.test(path ?? "") ? <img src={u} alt="Diseño" className="size-14 rounded-xl border border-borde bg-white object-contain p-1" /> : <span className="grid size-14 place-items-center rounded-xl bg-suave text-[11px] text-acento">Archivo</span>}</a>;
}
