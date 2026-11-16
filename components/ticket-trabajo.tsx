"use client";
import { useEffect, useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Hoja, useAvisos } from "./ui";
import { IconoWhatsApp, enlaceWa } from "./whatsapp";
import { useSesion } from "./sesion";
import { euros, aCent } from "@/lib/calculo";
import { CORTO, compartirTicketTrabajo, pdfTicketTrabajo, pendienteCent, type Trabajo } from "@/lib/trabajos";
import { textoError } from "@/lib/supabase";

const fecha = (d: string | null | undefined, larga = false) =>
  d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("es-ES", larga ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" }) : "";

const iniciales = (n?: string | null) => (n ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]!.toUpperCase()).join("") || "·";

/** Ticket de recogida de un trabajo: vista moderna y botones para enviarlo o sacarlo en PDF */
export function TicketTrabajo({ t, abierto, cerrar }: { t: Trabajo | null; abierto: boolean; cerrar: () => void }) {
  const { empresa } = useSesion();
  const { aviso } = useAvisos();
  const [ocupado, setOcupado] = useState<"" | "enviar" | "pdf">("");
  // El PDF se prepara nada más abrir, así al pulsar sale al momento
  const listo = useRef<Promise<Blob> | null>(null);
  useEffect(() => {
    listo.current = null;
    if (!abierto || !t || !empresa) return;
    // Se prepara al terminar la animación de abrir (el motor de PDF ocupa el procesador un momento)
    const espera = setTimeout(() => { const pr = pdfTicketTrabajo(t, empresa); pr.catch(() => {}); listo.current = pr; }, 450);
    return () => clearTimeout(espera);
  }, [abierto, t, empresa]);
  if (!t || !empresa) return null;
  const items = t.items.filter((i) => i.que || i.detalle);

  async function hacer(que: "enviar" | "pdf") {
    setOcupado(que);
    try {
      // En el ordenador, «Enviar» abre WhatsApp con el resumen si hay teléfono
      if (que === "enviar" && t!.cliente_telefono && !matchMedia("(pointer: coarse)").matches) {
        const txt = `Hola, aquí tienes el ticket de tu trabajo ${t!.numero}: ${items.map((i) => `${i.cantidad} × ${i.que}`).join(", ")}. Para el ${fecha(t!.entrega, true) || "día acordado"}. Pendiente al recoger: ${euros(pendienteCent(t!))}. ${empresa!.nombre}`;
        window.open(enlaceWa(t!.cliente_telefono, txt), "_blank", "noopener");
        return;
      }
      const r = await compartirTicketTrabajo(t!, empresa!, que === "pdf", listo.current ?? undefined);
      if (r === "descargado") aviso("Ticket descargado en PDF");
    } catch (e) { aviso(textoError(e), "error"); } finally { setOcupado(""); }
  }

  return (
    <Hoja abierta={abierto} cerrar={cerrar} titulo="Ticket de recogida" pie={
      <div className="grid w-full grid-cols-2 gap-2">
        <button onClick={() => hacer("enviar")} disabled={!!ocupado} className="flex h-12 items-center justify-center gap-2 rounded-full bg-azul text-[14.5px] font-semibold text-white disabled:opacity-60">
          {ocupado === "enviar" ? <Loader2 className="size-[18px] animate-spin" /> : <IconoWhatsApp className="size-[18px]" />}Enviar
        </button>
        <button onClick={() => hacer("pdf")} disabled={!!ocupado} className="flex h-12 items-center justify-center gap-2 rounded-full border border-borde bg-superficie text-[14.5px] font-semibold disabled:opacity-60">
          {ocupado === "pdf" ? <Loader2 className="size-[18px] animate-spin" /> : <FileText className="size-[18px]" />}PDF / imprimir
        </button>
      </div>
    }>
      <article aria-label="Vista previa del ticket" className="overflow-hidden rounded-[14px] bg-white text-[15px] text-[#17181c] shadow-[0_18px_40px_-22px_rgba(20,30,60,.4)] ring-1 ring-black/5">
        {/* Diseño E, tamaño grande (propuesta 3): cantidades en caja, texto grande */}
        <header className="bg-[#f5f6f8] px-5 pb-4 pt-5">
          <div className="flex items-start gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#17181c] text-[11px] font-semibold text-white">{iniciales(empresa.nombre)}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-[16.5px] font-semibold">{empresa.nombre}</p>{empresa.telefono && <p className="text-[13.5px] text-[#6b7079]">{empresa.telefono}</p>}</div>
            {/* El número va en la franja gris: ahorra espacio */}
            <div className="shrink-0 text-right"><p className="num text-[36px] font-light leading-none tracking-[-0.04em]">{t.numero}</p>
              <p className="mt-1 text-[11.5px] text-[#6b7079]">Ticket · {fecha(t.creado)}</p></div>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
            <div className="min-w-0"><p className="text-[10.5px] font-semibold uppercase tracking-[.1em] text-[#6b7079]">Cliente</p>
              <p className="text-[16.5px] font-semibold [overflow-wrap:anywhere]">{t.cliente_nombre || "—"}</p>{t.cliente_telefono && <p className="text-[13.5px] text-[#6b7079]">{t.cliente_telefono}</p>}</div>
            {t.entrega && <div className="text-right"><p className="text-[10.5px] font-semibold uppercase tracking-[.1em] text-[#6b7079]">Recoger el</p><p className="text-[16.5px] font-semibold">{fecha(t.entrega, true)}</p></div>}
          </div>
        </header>
        <div className="px-5 pb-5 pt-2">
          <ul>
            {items.map((i) => (
              <li key={i.id} className="flex items-start gap-3 border-b border-[#e4e6ea] py-3">
                <span className="num grid h-9 min-w-9 shrink-0 place-items-center rounded-lg bg-[#f5f6f8] px-1.5 text-[18px] font-bold">{i.cantidad}</span>
                <div className="min-w-0">
                  <p className="text-[18px] font-bold leading-tight [overflow-wrap:anywhere]">{i.que || "Trabajo"}</p>
                  {(i.tecnica || !!i.ubicaciones?.length) && <p className="mt-0.5 text-[13.5px] text-[#6b7079]">{[i.tecnica, ...(i.ubicaciones ?? []).map((u) => CORTO[u] ?? u)].filter(Boolean).join(" · ")}</p>}
                  {i.detalle && <p className="text-[13.5px] text-[#6b7079] [overflow-wrap:anywhere]">{i.detalle}</p>}
                </div>
              </li>
            ))}
          </ul>
          {t.notas && <p className="mt-2 text-[13.5px] text-[#6b7079]">{t.notas}</p>}
          <div className="mt-6 flex items-end justify-between gap-3 border-t border-[#17181c] pt-3">
            <div className="num text-[13.5px] leading-relaxed text-[#6b7079]"><p>Total {euros(aCent(t.total))}</p>{Number(t.a_cuenta) > 0 && <p>A cuenta {euros(aCent(t.a_cuenta))}</p>}</div>
            <div className="text-right"><p className="text-[13.5px] text-[#6b7079]">Pendiente</p><p className="num text-[40px] font-light leading-tight tracking-[-0.03em]">{euros(pendienteCent(t))}</p></div>
          </div>
          <p className="mt-3 text-center text-[11.5px] text-[#6b7079]">Presenta este ticket para recoger tus prendas</p>
        </div>
      </article>
    </Hoja>
  );
}
