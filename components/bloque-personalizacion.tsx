"use client";
import { useEffect, useState } from "react";
import { Check, Loader2, Minus, Paperclip, Plus, Printer, Scissors, PaintRoller, Spool, Sparkles, SprayCan, Stamp, StickyNote, Euro, Trash2, X } from "lucide-react";
import { Prenda as Dibujo } from "./muestra";
import { useSesion } from "./sesion";
import { CampoImporte, cx, useAvisos } from "./ui";
import { subirArchivo, textoError, urlArchivo } from "@/lib/supabase";
import { euros } from "@/lib/calculo";
import type { LineaEd, PersEd } from "@/lib/pedidos";

/* ───────── Personalización ───────── */
const ICONOS: [RegExp, typeof Spool][] = [[/bord/i, Spool], [/serig/i, PaintRoller], [/vinil/i, Scissors], [/dtf|impres/i, Printer], [/sublim/i, SprayCan], [/transfer|tampo/i, Stamp]];
export const iconoTecnica = (nombre: string) => ICONOS.find(([r]) => r.test(nombre))?.[1] ?? Sparkles;

/** Fila de técnicas como iconos redondos */
export function SelectorTecnica({ tecnicas, valor, elegir, grande }: { tecnicas: { id: string; nombre: string }[]; valor?: string | null; elegir: (t: { id: string; nombre: string }) => void; grande?: boolean }) {
  return (
    <div className="flex flex-wrap gap-3 sm:gap-4" role="radiogroup" aria-label="Técnica de personalización">
      {tecnicas.map((t) => {
        const I = iconoTecnica(t.nombre); const on = valor === t.id;
        return (
          <button key={t.id} role="radio" aria-checked={on} onClick={() => elegir(t)} className="group flex w-[72px] flex-col items-center gap-1.5">
            <span className={cx("grid place-items-center rounded-full transition-all", grande ? "size-16" : "size-14",
              on ? "bg-acento text-sobre-acento shadow-[0_8px_20px_-8px_rgba(16,18,24,0.5)]" : "bg-superficie text-texto shadow-[0_4px_14px_-8px_rgba(16,18,24,0.25)] ring-1 ring-borde group-hover:ring-azul/40")}>
              <I className={grande ? "size-7" : "size-6"} strokeWidth={1.7} />
            </span>
            <span className={cx("text-center text-[12px] leading-tight", on ? "font-semibold" : "text-texto2")}>{t.nombre}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TarjetaPers({ z, lineas, calc, tecnicas, cambiar, quitar, usarTarifa }: {
  z: PersEd; lineas: LineaEd[]; calc?: { unidades: number; venta: number }; tecnicas: { id: string; nombre: string }[];
  cambiar: (c: Partial<PersEd>) => void; quitar: () => void; usarTarifa: () => void;
}) {
  const { empresa } = useSesion();
  const { aviso } = useAvisos();
  const [subiendo, setSubiendo] = useState(false);
  const [img, setImg] = useState<string | null>(null);
  const [otraUbic, setOtraUbic] = useState(() => !!z.ubicacion && !ZONAS.some((x) => x.nombre === z.ubicacion));
  useEffect(() => { urlArchivo(z.diseno_path).then(setImg); }, [z.diseno_path]);
  const I = iconoTecnica(z.tecnica);
  const alternar = (k: string) => cambiar({ lineas: z.lineas.includes(k) ? z.lineas.filter((x) => x !== k) : [...z.lineas, k] });

  return (
    <div className="tarjeta animar overflow-hidden">
      <div className="flex items-center gap-3 border-b border-borde px-4 py-3 sm:px-5">
        <span className="grid size-11 place-items-center rounded-full bg-acento text-sobre-acento"><I className="size-5" strokeWidth={1.8} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{z.tecnica}</p>
          <p className="text-[12px] text-texto2">{calc?.unidades ?? 0} uds · {euros(calc?.venta ?? 0)}</p>
        </div>
        <button className="grid size-9 place-items-center rounded-full text-texto2 hover:bg-suave hover:text-red-600" aria-label="Quitar personalización" onClick={quitar}><Trash2 className="size-4" /></button>
      </div>

      <div className="space-y-5 px-4 py-4 sm:px-5">
        <div>
          <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-texto2">Técnica</p>
          <SelectorTecnica tecnicas={tecnicas} valor={z.tecnica_id} elegir={(t) => cambiar({ tecnica_id: t.id, tecnica: t.nombre, precio_manual: false })} />
        </div>

        <div>
          <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-texto2">Ubicación</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {ZONAS.map((zn) => {
              const on = z.ubicacion === zn.nombre && !otraUbic;
              return (
                <button key={zn.nombre} type="button" onClick={() => { cambiar({ ubicacion: zn.nombre }); setOtraUbic(false); }} aria-pressed={on} title={zn.nombre}
                  className={cx("flex flex-col items-center gap-0.5 rounded-2xl px-0.5 pb-2 pt-1.5 transition-colors", on ? "border-2 border-acento bg-superficie" : "border border-borde hover:border-texto2")}>
                  <IconoZona z={zn} activa={on} />
                  <span className={cx("text-center text-[11px] leading-tight", on ? "font-bold text-texto" : "text-texto2")}>{zn.corto}</span>
                </button>
              );
            })}
          </div>
          {otraUbic
            ? <input className="campo mt-2 rounded-full" autoFocus placeholder="Otra ubicación (ej.: bolsillo, gorra…)" value={z.ubicacion} onChange={(e) => cambiar({ ubicacion: e.target.value })} aria-label="Otra ubicación" />
            : <button type="button" className="mt-1 h-10 px-1 text-[13px] font-semibold text-azul" onClick={() => { setOtraUbic(true); cambiar({ ubicacion: "" }); }}>+ Otra ubicación</button>}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold">Nº de aplicaciones</p>
            <p className="text-[12px] text-texto2">Veces que se aplica en cada prenda</p>
          </div>
          <div className="shrink-0">
            <div className="flex h-11 items-center rounded-full bg-suave p-1">
              <button aria-label="Una menos" className="grid size-9 place-items-center rounded-full bg-superficie shadow-sm disabled:opacity-40" disabled={z.aplicaciones <= 1} onClick={() => cambiar({ aplicaciones: Math.max(1, z.aplicaciones - 1) })}><Minus className="size-4" /></button>
              <span className="num w-9 text-center font-semibold">{z.aplicaciones}</span>
              <button aria-label="Una más" className="grid size-9 place-items-center rounded-full bg-superficie shadow-sm" onClick={() => cambiar({ aplicaciones: z.aplicaciones + 1 })}><Plus className="size-4" /></button>
            </div>
          </div>
        </div>

        {lineas.length > 0 && (
          <div>
            <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-texto2">Se aplica a</p>
            <div className="flex flex-wrap gap-2">
              {lineas.map((l) => {
                const on = z.lineas.includes(l.clave);
                return (
                  <button key={l.clave} onClick={() => alternar(l.clave)} aria-pressed={on}
                    className={cx("inline-flex h-10 items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 text-[12px] font-medium transition-colors", on ? "border-acento bg-acento text-sobre-acento" : "border-borde text-texto2")}>
                    <span className="grid size-8 place-items-center overflow-hidden rounded-full bg-suave"><Dibujo tipo={l.tipo} color={l.color} className="size-7" /></span>
                    {[l.modelo || l.tipo, l.color].filter(Boolean).join(" · ") || "Prenda"}{on && <Check className="size-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex h-14 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-borde px-4 text-[14px] text-texto2 hover:border-azul hover:text-azul">
            {subiendo ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
            {z.diseno_path ? "Cambiar diseño" : "Adjuntar diseño o logotipo"}
            <input type="file" accept="image/*,.pdf,.ai,.eps,.svg,.dst,.emb,.pes" className="sr-only" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return; setSubiendo(true);
              try { cambiar({ diseno_path: await subirArchivo(empresa!.id, "disenos", f) }); } catch (err) { aviso(textoError(err), "error"); } finally { setSubiendo(false); }
            }} />
          </label>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {img && (/\.(png|jpe?g|gif|webp|svg)$/i.test(z.diseno_path ?? "") ? <a href={img} target="_blank" rel="noreferrer"><img src={img} alt="Diseño" className="h-10 rounded-xl border border-borde bg-white object-contain p-0.5" /></a> : <a href={img} target="_blank" rel="noreferrer" className="text-[13px] text-azul">Ver archivo</a>)}
          {z.diseno_path && <button aria-label="Quitar diseño" className="text-texto2 hover:text-red-600" onClick={() => cambiar({ diseno_path: null })}><X className="size-4" /></button>}
        </div>
      </div>

      {/* Pie: observaciones y precio */}
      <div className="grid grid-cols-[minmax(0,1fr)_128px] items-end gap-2.5 border-t border-borde bg-suave/50 px-4 pb-4 pt-3.5 sm:px-5">
        <label className="flex min-w-0 flex-col gap-1.5 text-[12px] text-texto2">
          <span className="flex items-center gap-1.5"><StickyNote className="size-3.5" />Observaciones</span>
          <textarea className="campo h-[68px] min-h-0 resize-none py-2.5 text-[14px] text-texto" placeholder="Hilo, tamaño, colores…" value={z.notas} onChange={(e) => cambiar({ notas: e.target.value })} aria-label="Observaciones de la personalización" />
        </label>
        <div className="flex flex-col gap-1.5 text-[12px] text-texto2">
          <span className="flex items-center gap-1.5"><Euro className="size-3.5" />Precio / ud</span>
          <div className="flex h-[68px] flex-col items-center justify-center rounded-[14px] bg-acento px-2 text-sobre-acento">
            <CampoImporte valor={z.precio_ud} cambiar={(v) => cambiar({ precio_ud: v ?? 0, precio_manual: true })} aria-label="Precio por unidad de la personalización" oscuro className="w-full" />
            {z.precio_manual
              ? <button type="button" onClick={usarTarifa} className="text-[11px] underline opacity-80">Usar tarifa</button>
              : <span className="text-[11px] opacity-70">tarifa {calc?.unidades ?? 0} uds</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Zonas de marcaje con su icono: punto o zona azul sobre una camiseta (izq./der. = de quien la lleva puesta) */
type Zona = { nombre: string; corto: string; vista: "delante" | "detras"; marca: [number, number, number] | [number, number, number, number] };
const ZONAS: Zona[] = [
  { nombre: "Pecho izquierdo", corto: "Pecho izq.", vista: "delante", marca: [30, 17, 3.2] },
  { nombre: "Pecho derecho", corto: "Pecho der.", vista: "delante", marca: [18, 17, 3.2] },
  { nombre: "Pecho centro", corto: "Pecho centro", vista: "delante", marca: [24, 19, 3.6] },
  { nombre: "Espalda", corto: "Espalda", vista: "detras", marca: [17, 18, 14, 14] },
  { nombre: "Espalda alta", corto: "Espalda alta", vista: "detras", marca: [17, 13, 14, 5] },
  { nombre: "Manga izquierda", corto: "Manga izq.", vista: "delante", marca: [41, 16, 3] },
  { nombre: "Manga derecha", corto: "Manga der.", vista: "delante", marca: [7, 16, 3] },
  { nombre: "Nuca", corto: "Nuca", vista: "detras", marca: [24, 9, 2.6] },
];
const CAMISETA = { delante: "M17 7l-9 4-4 10 6 3 3-5v22h22V19l3 5 6-3-4-10-9-4c-1 3-4 5-7 5s-6-2-7-5z", detras: "M17 7l-9 4-4 10 6 3 3-5v22h22V19l3 5 6-3-4-10-9-4c-2 1.5-4.5 2-7 2s-5-.5-7-2z" };
function IconoZona({ z, activa }: { z: Zona; activa: boolean }) {
  const m = z.marca;
  return (
    <svg viewBox="0 0 48 48" className="size-11" aria-hidden="true">
      <path d={CAMISETA[z.vista]} fill="#fff" stroke={activa ? "var(--acento)" : "#9aa0a8"} strokeWidth="1.6" strokeLinejoin="round" />
      {m.length === 3 ? <circle cx={m[0]} cy={m[1]} r={m[2]} fill="var(--azul)" /> : <rect x={m[0]} y={m[1]} width={m[2]} height={m[3]} rx="2" fill="var(--azul)" />}
    </svg>
  );
}
