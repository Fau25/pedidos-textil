"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Send } from "lucide-react";
import type { Presupuesto } from "@/lib/tipos";
import { compartirDocumento, pdfDocumento } from "@/lib/presupuestos";
import { textoError, urlArchivo } from "@/lib/supabase";
import { Boton, Hoja, useAvisos } from "./ui";

const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const fecha = (f: string) => { try { return new Date(f + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }); } catch { return f; } };

const iniciales = (n?: string | null) => (n ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]!.toUpperCase()).join("") || "·";

/** Ticket o factura del pedido: vista tipo recibo y botones para enviarlo al cliente o descargarlo en PDF */
export function Ticket({ p, abierto, cerrar, tipo = "ticket" }: { p: Presupuesto | null; abierto: boolean; cerrar: () => void; tipo?: "ticket" | "factura" }) {
  const { aviso } = useAvisos();
  const [ocupado, setOcupado] = useState<"" | "enviar" | "pdf">("");
  const [logo, setLogo] = useState<string | null>(null);
  useEffect(() => { if (abierto && p?.datos.empresa.logo_path) urlArchivo(p.datos.empresa.logo_path).then(setLogo); }, [abierto, p]);
  // El PDF se prepara nada más abrir: al pulsar sale al momento (y el móvil deja compartirlo sin esperar)
  const listo = useRef<Promise<Blob> | null>(null);
  useEffect(() => {
    listo.current = null;
    if (!abierto || !p || !(p.datos.lineas.length + p.datos.personalizaciones.length)) return;
    const pr = pdfDocumento(p, tipo); pr.catch(() => {}); listo.current = pr;
  }, [abierto, p, tipo]);
  if (!p) return null;
  const d = p.datos;
  const filas = [...d.lineas, ...d.personalizaciones];
  const vacio = filas.length === 0;

  const doc = tipo;
  async function hacer(que: "enviar" | "pdf") {
    setOcupado(que);
    try {
      const r = await compartirDocumento(p!, doc, que === "pdf", listo.current ?? undefined);
      if (r === "descargado") aviso(tipo === "factura" ? "Factura descargada en PDF" : "Ticket descargado en PDF");
    } catch (e) { aviso(textoError(e), "error"); } finally { setOcupado(""); }
  }

  return (
    <Hoja abierta={abierto} cerrar={cerrar} titulo={tipo === "factura" ? "Factura" : "Ticket del pedido"} ancho="max-w-md"
      pie={<div className="flex gap-2">
        <Boton className="flex-1" cargando={ocupado === "pdf"} disabled={vacio || !!ocupado} onClick={() => hacer("pdf")}><Download className="size-4" />PDF</Boton>
        <Boton className="flex-[2]" variante="primario" cargando={ocupado === "enviar"} disabled={vacio || !!ocupado} onClick={() => hacer("enviar")}><Send className="size-4" />Enviar al cliente</Boton>
      </div>}>
      {vacio ? (
        <p className="rounded-2xl bg-suave p-4 text-[14px] text-texto2">Añade al menos una prenda con unidades.</p>
      ) : (
        <article aria-label={`Vista previa ${tipo === "factura" ? "de la factura" : "del ticket"}`} className="mx-auto max-w-sm overflow-hidden rounded-[14px] bg-white text-[13px] text-[#17181c] shadow-[0_18px_40px_-22px_rgba(20,30,60,.4)] ring-1 ring-black/5">
          {/* Diseño E: franja gris con los datos, título grande y fino, total grande abajo */}
          <header className="bg-[#f5f6f8] px-5 pb-4 pt-5">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logo ? <img src={logo} alt="" className="h-9 max-w-[45%] object-contain" /> : <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#17181c] text-[11px] font-semibold text-white">{iniciales(d.empresa.nombre)}</span>}
              <div className="min-w-0"><p className="truncate font-semibold">{d.empresa.nombre}</p>
                <p className="truncate text-[11.5px] text-[#6b7079]">{[d.empresa.nif && `NIF ${d.empresa.nif}`, d.empresa.telefono].filter(Boolean).join(" · ")}</p></div>
            </div>
            {d.cliente && (
              <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
                <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#6b7079]">Cliente</p>
                  <p className="font-semibold [overflow-wrap:anywhere]">{d.cliente.nombre}</p>
                  {d.cliente.nif && <p className="text-[11.5px] text-[#6b7079]">NIF/CIF {d.cliente.nif}</p>}</div>
                {tipo === "factura" && d.pedido.numero && <div className="text-right"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#6b7079]">Pedido</p><p>{d.pedido.numero}</p></div>}
              </div>
            )}
          </header>
          <div className="px-5 pb-5 pt-5">
            <p className="text-[38px] font-light leading-none tracking-[-0.04em]">{tipo === "factura" ? "Factura" : "Ticket"}</p>
            <p className="mt-2 text-[12px] text-[#6b7079]">Nº <b className="font-semibold text-[#17181c]">{p.numero}</b> · {fecha(p.fecha)}{tipo === "factura" && !d.cliente?.nif ? " · Factura simplificada" : ""}</p>
            {d.pedido.referencia && <p className="text-[12px] text-[#6b7079]">Ref.: {d.pedido.referencia}</p>}
            <ul className="mt-4">
              {filas.map((x, i) => (
                <li key={i} className="flex justify-between gap-3 border-b border-[#e4e6ea] py-2.5">
                  <div className="min-w-0"><p>{x.descripcion}</p>
                    {x.detalle && <p className="text-[11.5px] text-[#6b7079]">{x.detalle}</p>}
                    <p className="num text-[11.5px] text-[#6b7079]">{x.unidades} × {eur(x.precio)}</p></div>
                  <span className="num shrink-0">{eur(x.importe)}</span>
                </li>
              ))}
              {d.gastos > 0 && <li className="flex justify-between border-b border-[#e4e6ea] py-2.5"><span>Otros gastos</span><span className="num">{eur(d.gastos)}</span></li>}
            </ul>
            <div className="mt-6 flex items-end justify-between gap-3 border-t border-[#17181c] pt-3">
              <div className="num text-[11.5px] leading-relaxed text-[#6b7079]">
                {d.descuento > 0 && <p>Descuento {d.descuento_pct} % −{eur(d.descuento)}</p>}
                <p>Base {eur(d.base)}</p><p>IVA {d.iva_pct} % {eur(d.iva)}</p>
              </div>
              <div className="text-right"><p className="text-[11.5px] text-[#6b7079]">Total</p><p className="num text-[30px] font-light leading-tight tracking-[-0.03em]">{eur(d.total)}</p></div>
            </div>
            {tipo !== "factura" && d.condiciones && <p className="mt-4 whitespace-pre-line text-[11px] text-[#6b7079]">{d.condiciones}</p>}
            <p className="mt-3 text-[11.5px] text-[#6b7079]">Gracias por tu confianza.</p>
          </div>
        </article>
      )}
    </Hoja>
  );
}
