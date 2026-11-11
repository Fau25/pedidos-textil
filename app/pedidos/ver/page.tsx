"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Copy, Trash2, Download, Check, Paperclip, Phone, Mail, Undo2, Ticket as IconoTicket } from "lucide-react";
import { useSesion } from "@/components/sesion";
import { Boton, Cargando, Tarjeta, Vacio, cx, fecha, useAvisos } from "@/components/ui";
import { sb, textoError, urlArchivo } from "@/lib/supabase";
import { useCarga, useParam } from "@/lib/usar";
import { calcular, euros } from "@/lib/calculo";
import { aCalc, cargarPedido, describirLinea, marcarEntregado, textoTallas } from "@/lib/pedidos";
import { compartirPDF, ticketDe } from "@/lib/presupuestos";
import { Ticket } from "@/components/ticket";
import type { Cliente } from "@/lib/tipos";

export default function Ficha() {
  const pid = useParam("id");
  const { empresa } = useSesion();
  const { aviso, confirmar } = useAvisos();
  const router = useRouter();
  const [ocupado, setOcupado] = useState("");
  const [verTicket, setVerTicket] = useState(false);

  const { datos, recargar, error } = useCarga(async () => {
    if (!pid) return null;
    const r = await cargarPedido(pid);
    if (!r) return { falta: true as const };
    const cli = r.ed.cliente_id ? await sb.from("clientes").select("*").eq("id", r.ed.cliente_id).maybeSingle() : { data: null };
    return { ...r, cliente: cli.data as Cliente | null };
  }, [pid]);

  const t = useMemo(() => (datos && !("falta" in datos) ? calcular(aCalc(datos.ed, Number(empresa!.margen))) : null), [datos, empresa]);
  if (!pid || !datos) return <Cargando error={error} reintentar={recargar} />;
  if ("falta" in datos) return <Vacio titulo="Este pedido no existe o se ha borrado" accion={<Link href="/pedidos/"><Boton>Ver pedidos</Boton></Link>} />;
  const { ed, pedido, cliente } = datos;
  const nombres = new Map(ed.lineas.map((l) => [l.clave, [l.tipo, l.color].filter(Boolean).join(" · ")]));

  async function entregar(v: boolean) {
    setOcupado("entrega");
    try { await marcarEntregado([ed.id], v); aviso(v ? "Marcado como entregado" : "Vuelve a pendientes"); recargar(); }
    catch (e) { aviso(textoError(e), "error"); } finally { setOcupado(""); }
  }
  async function pdf() {
    setOcupado("pdf");
    try { const r = await compartirPDF(ed.id, empresa!); if (r === "descargado") aviso("PDF descargado"); }
    catch (e) { aviso(textoError(e), "error"); } finally { setOcupado(""); }
  }
  async function borrar() {
    if (!(await confirmar({ titulo: `¿Eliminar ${ed.numero}?`, texto: "Se borran sus prendas y personalizaciones. No se puede deshacer.", ok: "Eliminar", peligro: true }))) return;
    const { error } = await sb.from("pedidos").delete().eq("id", ed.id);
    if (error) return aviso(textoError(error), "error");
    aviso("Pedido eliminado"); router.push("/pedidos/");
  }

  return (
    <>
      <Link href="/pedidos/" className="-ml-1 mb-1 inline-flex h-10 items-center px-1 text-[13px] text-texto2 hover:text-texto">← Pedidos</Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-[24px] font-semibold tracking-[-0.02em] sm:text-[28px]">
              {cliente ? <Link href={`/clientes/ver/?id=${cliente.id}`} className="hover:underline">{cliente.nombre}</Link> : "Sin cliente"}
            </h1>
            <p className="text-texto2"><span className="num">{ed.numero}</span>{ed.referencia && <> · {ed.referencia}</>} · {t?.unidades ?? 0} uds</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/pedidos/nuevo/?id=${ed.id}`}><Boton><Pencil className="size-4" />Editar</Boton></Link>
          <Boton onClick={() => setVerTicket(true)}><IconoTicket className="size-4" />Ticket</Boton>
          <Boton cargando={ocupado === "pdf"} onClick={pdf}><Download className="size-4" />Presupuesto</Boton>
          <Link href={`/pedidos/nuevo/?duplicar=${ed.id}`}><Boton variante="fantasma" aria-label="Duplicar"><Copy className="size-4" /></Boton></Link>
          <Boton variante="fantasma" aria-label="Eliminar" className="hover:text-red-600" onClick={borrar}><Trash2 className="size-4" /></Boton>
        </div>
      </div>

      {/* Estado: un toque */}
      <div className={cx("tarjeta mb-6 flex flex-wrap items-center gap-4 p-4", ed.entregado && "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30")}>
        <div className="flex-1">
          {ed.entregado ? (
            <><p className="font-semibold text-emerald-800 dark:text-emerald-300">Entregado {pedido.entregado_en ? "el " + fecha(pedido.entregado_en, true) : ""}</p><p className="text-[13px] text-texto2">Trabajo terminado.</p></>
          ) : (
            <><p className="font-semibold">Pendiente</p>
              <p className="text-[13px] text-texto2">Pedido el {fecha(ed.fecha, true)}</p></>
          )}
        </div>
        {ed.entregado
          ? <Boton cargando={ocupado === "entrega"} onClick={() => entregar(false)}><Undo2 className="size-4" />Volver a pendiente</Boton>
          : <Boton variante="primario" cargando={ocupado === "entrega"} onClick={() => entregar(true)} className="bg-emerald-600 hover:bg-emerald-700"><Check className="size-4" />Marcar entregado</Boton>}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <Tarjeta titulo="Prendas" sinPadding>
            {!ed.lineas.length ? <p className="px-5 pb-5 text-texto2">Sin prendas.</p> : (
              <ul className="divide-y divide-borde">
                {ed.lineas.map((l) => (
                  <li key={l.clave} className="flex items-center gap-3 px-5 py-3.5">
                    <ImagenPrenda path={l.imagen_path} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{describirLinea(l)}</p>
                      <p className="num text-[13px] text-texto2">{textoTallas(l.tallas) || "Sin tallas"}</p>
                      {l.notas && <p className="text-[12px] text-texto2">{l.notas}</p>}
                      {ed.pers.filter((z) => z.lineas.includes(l.clave)).map((z) => (
                        <span key={z.clave} className="mr-1.5 mt-1 inline-flex h-6 items-center rounded-full bg-acento-suave px-2 text-[11px] font-medium text-azul">{z.tecnica} · {z.ubicacion}</span>
                      ))}
                    </div>
                    <div className="num text-right text-[13px]"><b>{t?.lineas[l.clave]?.unidades ?? 0}</b> uds<span className="block text-texto2">{euros(t?.lineas[l.clave]?.venta ?? 0)}</span></div>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          {!!ed.pers.length && (
            <Tarjeta titulo="Personalización" sinPadding>
              <ul className="divide-y divide-borde">
                {ed.pers.map((z, i) => (
                  <li key={z.clave} className="flex items-center gap-4 px-5 py-3.5">
                    <Diseno path={z.diseno_path} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{z.tecnica} · {z.ubicacion}{z.aplicaciones > 1 && ` ×${z.aplicaciones}`}</p>
                      <p className="text-[13px] text-texto2">{z.lineas.map((k) => nombres.get(k)).filter(Boolean).join(", ") || "Sin prendas"} · {t?.pers[i]?.unidades ?? 0} uds</p>
                      {z.notas && <p className="text-[12px] text-texto2">{z.notas}</p>}
                    </div>
                    <span className="num text-[13px] font-medium">{euros(t?.pers[i]?.venta ?? 0)}</span>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          )}
          {ed.notas && <Tarjeta titulo="Observaciones"><p className="whitespace-pre-line text-[14px]">{ed.notas}</p></Tarjeta>}
        </div>

        <aside className="space-y-4">
          <Tarjeta titulo="Importe">
            <dl className="space-y-1.5 text-[13px]">
              {t && t.descuento > 0 && <div className="flex justify-between"><dt className="text-texto2">Descuento {ed.descuento_pct} %</dt><dd className="num">−{euros(t.descuento)}</dd></div>}
              <div className="flex justify-between"><dt className="text-texto2">Base imponible</dt><dd className="num">{euros(t?.base ?? 0)}</dd></div>
              <div className="flex justify-between"><dt className="text-texto2">IVA {ed.iva} %</dt><dd className="num">{euros(t?.iva ?? 0)}</dd></div>
              <div className="flex items-baseline justify-between pt-1"><dt className="font-semibold">Total</dt><dd className="num text-[22px] font-semibold">{euros(t?.total ?? 0)}</dd></div>
            </dl>
          </Tarjeta>
          {cliente && (cliente.telefono || cliente.email) && (
            <Tarjeta titulo="Contacto">
              {cliente.contacto && <p className="mb-2 text-[13px]">{cliente.contacto}</p>}
              <div className="flex flex-col gap-1.5 text-[13px]">
                {cliente.telefono && <a href={`tel:${cliente.telefono.replace(/\s/g, "")}`} className="flex min-h-9 items-center gap-2 text-azul"><Phone className="size-3.5" />{cliente.telefono}</a>}
                {cliente.email && <a href={`mailto:${cliente.email}`} className="flex min-h-9 items-center gap-2 truncate text-azul"><Mail className="size-3.5" />{cliente.email}</a>}
              </div>
            </Tarjeta>
          )}
        </aside>
      </div>
      <Ticket abierto={verTicket} cerrar={() => setVerTicket(false)} p={verTicket ? ticketDe(ed, empresa!, cliente ?? null) : null} />
    </>
  );
}

function ImagenPrenda({ path }: { path: string | null }) {
  const [u, setU] = useState<string | null>(null);
  useEffect(() => { urlArchivo(path).then(setU); }, [path]);
  // eslint-disable-next-line @next/next/no-img-element
  return u ? <img src={u} alt="" className="size-11 rounded-lg object-cover" /> : null;
}
function Diseno({ path }: { path: string | null }) {
  const [u, setU] = useState<string | null>(null);
  useEffect(() => { urlArchivo(path).then(setU); }, [path]);
  if (!u) return <div className="grid size-12 place-items-center rounded-xl bg-suave text-texto2"><Paperclip className="size-4" /></div>;
  // eslint-disable-next-line @next/next/no-img-element
  const ext = (path ?? "").split(".").pop()?.toUpperCase() ?? "";
  return <a href={u} target="_blank" rel="noreferrer" title="Abrir el diseño">{/^(PNG|JPE?G|GIF|WEBP|SVG)$/.test(ext) ? <img src={u} alt="Diseño" className="size-12 rounded-xl border border-borde bg-white object-contain p-1" /> : <span className="grid size-12 place-items-center rounded-xl bg-suave text-[11px] font-semibold text-azul">{ext || "Archivo"}</span>}</a>;
}
