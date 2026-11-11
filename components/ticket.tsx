"use client";
import { useEffect, useState } from "react";
import { Download, Send } from "lucide-react";
import type { Presupuesto } from "@/lib/tipos";
import { compartirDocumento } from "@/lib/presupuestos";
import { textoError, urlArchivo } from "@/lib/supabase";
import { Boton, Hoja, useAvisos } from "./ui";

const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const fecha = (f: string) => { try { return new Date(f + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }); } catch { return f; } };

/** Ticket del pedido: vista tipo recibo y botones para enviarlo al cliente o descargarlo en PDF */
export function Ticket({ p, abierto, cerrar }: { p: Presupuesto | null; abierto: boolean; cerrar: () => void }) {
  const { aviso } = useAvisos();
  const [ocupado, setOcupado] = useState<"" | "enviar" | "pdf">("");
  const [logo, setLogo] = useState<string | null>(null);
  useEffect(() => { if (abierto && p?.datos.empresa.logo_path) urlArchivo(p.datos.empresa.logo_path).then(setLogo); }, [abierto, p]);
  if (!p) return null;
  const d = p.datos;
  const filas = [...d.lineas, ...d.personalizaciones];
  const vacio = filas.length === 0;

  async function hacer(tipo: "enviar" | "pdf") {
    setOcupado(tipo);
    try {
      const r = await compartirDocumento(p!, "ticket", tipo === "pdf");
      if (r === "descargado") aviso("Ticket descargado en PDF");
    } catch (e) { aviso(textoError(e), "error"); } finally { setOcupado(""); }
  }

  return (
    <Hoja abierta={abierto} cerrar={cerrar} titulo="Ticket del pedido" ancho="max-w-md"
      pie={<div className="flex gap-2">
        <Boton className="flex-1" cargando={ocupado === "pdf"} disabled={vacio || !!ocupado} onClick={() => hacer("pdf")}><Download className="size-4" />PDF</Boton>
        <Boton className="flex-[2]" variante="primario" cargando={ocupado === "enviar"} disabled={vacio || !!ocupado} onClick={() => hacer("enviar")}><Send className="size-4" />Enviar al cliente</Boton>
      </div>}>
      {vacio ? (
        <p className="rounded-2xl bg-suave p-4 text-[14px] text-texto2">Añade al menos una prenda con unidades para generar el ticket.</p>
      ) : (
        <article aria-label="Vista previa del ticket" className="mx-auto max-w-sm rounded-[18px] border border-borde bg-white px-5 py-6 text-[13px] text-[#17181c] shadow-sm">
          <header className="flex flex-col items-center gap-1 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? <img src={logo} alt={d.empresa.nombre ?? "Logotipo"} className="mb-1 h-12 max-w-[60%] object-contain" /> : <p className="text-[17px] font-bold">{d.empresa.nombre}</p>}
            {logo && <p className="font-semibold">{d.empresa.nombre}</p>}
            {d.empresa.nif && <p className="text-[12px] text-[#5f636b]">NIF {d.empresa.nif}</p>}
            {d.empresa.direccion && <p className="text-[12px] text-[#5f636b]">{d.empresa.direccion}</p>}
            {(d.empresa.telefono || d.empresa.email) && <p className="text-[12px] text-[#5f636b]">{[d.empresa.telefono, d.empresa.email].filter(Boolean).join(" · ")}</p>}
          </header>

          <div className="my-4 border-t border-dashed border-[#c9ccd3]" />
          <div className="flex items-end justify-between gap-3">
            <div><p className="text-[11px] font-semibold uppercase tracking-wider text-[#5f636b]">Ticket</p><p className="text-[16px] font-bold">{p.numero}</p></div>
            <p className="text-right text-[12px] text-[#5f636b]">{fecha(p.fecha)}</p>
          </div>
          {d.cliente && (
            <div className="mt-3 rounded-xl bg-[#f1f2f5] px-3 py-2.5">
              <p className="text-[11px] text-[#5f636b]">Cliente</p>
              <p className="font-semibold">{d.cliente.nombre}</p>
              {d.cliente.nif && <p className="text-[12px] text-[#5f636b]">NIF/CIF {d.cliente.nif}</p>}
            </div>
          )}
          {d.pedido.referencia && <p className="mt-2 text-[12px] text-[#5f636b]">Ref.: {d.pedido.referencia}</p>}

          <div className="my-4 border-t border-dashed border-[#c9ccd3]" />
          <ul className="space-y-3">
            {filas.map((x, i) => (
              <li key={i}>
                <div className="flex justify-between gap-3"><span className="min-w-0 font-semibold">{x.descripcion}</span><span className="num shrink-0 font-semibold">{eur(x.importe)}</span></div>
                <div className="flex justify-between gap-3 text-[12px] text-[#5f636b]"><span className="min-w-0 truncate">{x.detalle}</span><span className="num shrink-0">{x.unidades} × {eur(x.precio)}</span></div>
              </li>
            ))}
            {d.gastos > 0 && <li className="flex justify-between"><span>Otros gastos</span><span className="num">{eur(d.gastos)}</span></li>}
          </ul>

          <div className="my-4 border-t border-dashed border-[#c9ccd3]" />
          <dl className="space-y-1">
            {d.descuento > 0 && <>
              <div className="flex justify-between text-[#5f636b]"><dt>Subtotal</dt><dd className="num">{eur(d.bruto)}</dd></div>
              <div className="flex justify-between text-[#5f636b]"><dt>Descuento {d.descuento_pct} %</dt><dd className="num">-{eur(d.descuento)}</dd></div>
            </>}
            <div className="flex justify-between text-[#5f636b]"><dt>Base imponible</dt><dd className="num">{eur(d.base)}</dd></div>
            <div className="flex justify-between text-[#5f636b]"><dt>IVA {d.iva_pct} %</dt><dd className="num">{eur(d.iva)}</dd></div>
            <div className="mt-2 flex items-baseline justify-between border-t border-[#17181c] pt-2 text-[17px] font-bold"><dt>Total</dt><dd className="num">{eur(d.total)}</dd></div>
          </dl>
          {d.condiciones && <p className="mt-4 whitespace-pre-line text-[11px] text-[#5f636b]">{d.condiciones}</p>}
          <p className="mt-4 text-center text-[12px] text-[#5f636b]">¡Gracias por tu pedido!</p>
        </article>
      )}
    </Hoja>
  );
}
