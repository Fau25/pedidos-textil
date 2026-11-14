"use client";
import { useState } from "react";
import { FileText, Loader2, User } from "lucide-react";
import { Hoja, useAvisos } from "./ui";
import { IconoWhatsApp, enlaceWa } from "./whatsapp";
import { iconoTecnica } from "./bloque-personalizacion";
import { useSesion } from "./sesion";
import { euros, aCent } from "@/lib/calculo";
import { CORTO, compartirTicketTrabajo, pendienteCent, type Trabajo } from "@/lib/trabajos";
import { textoError } from "@/lib/supabase";

const fecha = (d: string | null | undefined, larga = false) =>
  d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("es-ES", larga ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" }) : "";

/** Ticket de recogida de un trabajo: vista moderna y botones para enviarlo o sacarlo en PDF */
export function TicketTrabajo({ t, abierto, cerrar }: { t: Trabajo | null; abierto: boolean; cerrar: () => void }) {
  const { empresa } = useSesion();
  const { aviso } = useAvisos();
  const [ocupado, setOcupado] = useState<"" | "enviar" | "pdf">("");
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
      const r = await compartirTicketTrabajo(t!, empresa!, que === "pdf");
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
      <article aria-label="Vista previa del ticket" className="overflow-hidden rounded-[26px] bg-white text-[#17181c] shadow-[0_24px_50px_-24px_rgba(20,30,60,.45)] ring-1 ring-black/5">
        <header className="bg-[#17181c] px-5 pb-5 pt-4 text-white">
          <div className="flex items-center justify-between text-[13px]">
            <b className="truncate">{empresa.nombre}</b>
            <span className="shrink-0 text-white/65">{fecha(t.creado)}</span>
          </div>
          <p className="mt-4 text-[11.5px] font-semibold tracking-[.08em] text-white/65">TICKET DE RECOGIDA</p>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <b className="text-[32px] tracking-tight">{t.numero}</b>
            {t.entrega && <span className="rounded-full bg-[#1d52eb] px-3 py-1 text-[12px] font-bold">Para el {fecha(t.entrega, true)}</span>}
          </div>
        </header>
        <div className="grid gap-3 px-4 py-4">
          <div className="flex items-start gap-2.5">
            <span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-[#f2f3f6]"><User className="size-4" /></span>
            <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[.06em] text-[#6b7079]">Cliente</p>
              <p className="text-[14.5px] font-semibold [overflow-wrap:anywhere]">{[t.cliente_nombre, t.cliente_telefono].filter(Boolean).join(" · ") || "—"}</p></div>
          </div>
          <ul className="grid gap-1.5">
            {items.map((i) => {
              const I = iconoTecnica(i.tecnica);
              return (
                <li key={i.id} className="flex items-start gap-2.5 rounded-[14px] bg-[#f6f7f9] px-3 py-2.5">
                  <b className="grid h-[30px] min-w-[30px] place-items-center rounded-[9px] bg-[#17181c] px-1 text-[13px] text-white">{i.cantidad}</b>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold">{i.que || "Prenda"}</p>
                    {(i.tecnica || !!i.ubicaciones?.length) && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {i.tecnica && <span className="inline-flex items-center gap-1 rounded-full bg-[#eef2ff] px-2 py-0.5 text-[11.5px] font-bold text-[#1d52eb]"><I className="size-3" />{i.tecnica}</span>}
                        {i.ubicaciones?.map((u) => <span key={u} className="rounded-full bg-[#e9ebef] px-2 py-0.5 text-[11.5px] font-semibold">{CORTO[u] ?? u}</span>)}
                      </span>
                    )}
                    {i.detalle && <p className="mt-1 text-[12.5px] leading-snug text-[#565b66] [overflow-wrap:anywhere]">{i.detalle}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
          {t.notas && <p className="text-[12.5px] text-[#565b66]">{t.notas}</p>}
        </div>
        <div className="mx-4 border-t-2 border-dashed border-[#e3e5ea]" />
        <div className="grid gap-1.5 px-4 pb-4 pt-4 text-[14px]">
          <div className="flex justify-between text-[#6b7079]"><span>Total</span><span className="num">{euros(aCent(t.total))}</span></div>
          {Number(t.a_cuenta) > 0 && <div className="flex justify-between text-[#6b7079]"><span>Dejó a cuenta</span><span className="num">−{euros(aCent(t.a_cuenta))}</span></div>}
          <div className="mt-1.5 flex items-center justify-between rounded-2xl bg-[#17181c] px-3.5 py-3 text-white">
            <span className="text-[13px] font-semibold">Pendiente al recoger</span><b className="num text-[24px]">{euros(pendienteCent(t))}</b>
          </div>
          <p className="mt-2 text-center text-[12px] text-[#6b7079]">Enseña este ticket para recoger tus prendas</p>
        </div>
      </article>
    </Hoja>
  );
}
