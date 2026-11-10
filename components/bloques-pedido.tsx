"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Copy, Loader2, Minus, Paperclip, Pencil, Plus, Printer, Scissors, PaintRoller, Search, Spool, Sparkles, SprayCan, Stamp, Trash2, X } from "lucide-react";
import { useSesion } from "./sesion";
import { Boton, Campo, CampoImporte, cx, useAvisos } from "./ui";
import { Muestra, Prenda as Dibujo } from "./muestra";
import { subirArchivo, textoError, urlArchivo } from "@/lib/supabase";
import { euros, precioVentaUd } from "@/lib/calculo";
import { ordenTalla, type LineaEd, type PersEd } from "@/lib/pedidos";
import { TALLAS, TALLAS_NINO, TIPOS_PRENDA, UBICACIONES, type Prenda } from "@/lib/tipos";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Prenda del catálogo que corresponde a una línea (por marca y modelo) */
export function prendaDe(l: Pick<LineaEd, "marca" | "modelo">, catalogo: Prenda[]) {
  if (!l.modelo) return null;
  return catalogo.find((p) => norm(p.modelo ?? "") === norm(l.modelo) && norm(p.marca ?? "") === norm(l.marca)) ?? null;
}

/** Foto de la prenda (si la hay) o su dibujo teñido con el color elegido */
export function FotoPrenda({ path, tipo, color, className }: { path: string | null; tipo: string; color: string; className?: string }) {
  const [u, setU] = useState<string | null>(null);
  useEffect(() => { let vivo = true; setU(null); urlArchivo(path).then((x) => vivo && setU(x)); return () => { vivo = false; }; }, [path]);
  return (
    <div className={cx("relative grid place-items-center overflow-hidden rounded-[18px] bg-suave", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {u ? <img src={u} alt={tipo} referrerPolicy="no-referrer" onError={() => setU(null)} className="size-full object-contain" /> : <Dibujo tipo={tipo} color={color} className="size-[78%]" />}
    </div>
  );
}

/* ───────── Prenda ───────── */
export function TarjetaLinea({ l, n, margen, t, catalogo, proveedores, cambiar, duplicar, quitar }: {
  l: LineaEd; n: number; margen: number; t?: { unidades: number; ventaUd: number; venta: number }; catalogo: Prenda[];
  proveedores: { id: string; nombre: string }[]; cambiar: (c: Partial<LineaEd>) => void; duplicar: () => void; quitar: () => void;
}) {
  const { empresa } = useSesion();
  const { aviso } = useAvisos();
  const prenda = useMemo(() => prendaDe(l, catalogo), [l, catalogo]);
  const [manual, setManual] = useState(false);
  const [mas, setMas] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [nuevaTalla, setNuevaTalla] = useState("");
  const [otroColor, setOtroColor] = useState(false);
  const tallasModelo = l.tallasModelo?.length ? l.tallasModelo : prenda?.tallas.length ? prenda.tallas : null;
  const [nino, setNino] = useState(() => Object.keys(l.tallas).some((k) => TALLAS_NINO.includes(k) || k.includes("/")));
  const ninoModelo = tallasModelo?.filter((k) => /^\d/.test(k)) ?? [];
  const adultoModelo = tallasModelo?.filter((k) => !/^\d/.test(k)) ?? [];
  const base = tallasModelo ? (nino && ninoModelo.length ? ninoModelo : adultoModelo.length ? adultoModelo : tallasModelo) : nino ? TALLAS_NINO : TALLAS;
  const tallas = [...base, ...Object.keys(l.tallas).filter((k) => !base.includes(k))].sort((a, b) => ordenTalla(a) - ordenTalla(b));
  const colores = prenda?.colores ?? [];
  const pvSugerido = precioVentaUd({ precio_compra: l.precio_compra, precio_venta: null }, margen) / 100;
  const elegida = !!(l.modelo || l.marca) || manual;

  function elegir(p: Prenda) {
    cambiar({
      tipo: p.tipo, marca: p.marca ?? "", modelo: p.modelo ?? "", color: p.colores.includes(l.color) ? l.color : p.colores[0] ?? "",
      proveedor_id: p.proveedor_id, precio_compra: Number(p.precio_compra), imagen_path: p.imagen_path ?? l.imagen_path, tallasModelo: p.tallas,
      precio_venta: p.precio_venta === null ? (l.precio_venta ?? null) : Number(p.precio_venta),
    });
    setManual(false);
  }

  return (
    <div className="tarjeta animar overflow-hidden">
      <div className="px-4 pt-4 sm:px-5 sm:pt-5"><BuscadorPrenda catalogo={catalogo} margen={margen} n={n} elegir={elegir} manual={() => setManual(true)} /></div>
      <div className="flex gap-4 p-4 sm:p-5">
        {/* Foto */}
        <label className="group relative shrink-0 cursor-pointer" title="Cambiar foto">
          <FotoPrenda path={l.imagen_path} tipo={l.tipo} color={l.color} className="size-[96px] sm:size-[128px]" />
          <span className="absolute bottom-1.5 right-1.5 grid size-8 place-items-center rounded-full bg-superficie/95 text-texto2 shadow-sm transition-colors group-hover:text-azul">
            {subiendo ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          </span>
          <input type="file" accept="image/*" className="sr-only" aria-label="Subir foto de la prenda" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return; setSubiendo(true);
            try { cambiar({ imagen_path: await subirArchivo(empresa!.id, "prendas", f) }); } catch (err) { aviso(textoError(err), "error"); } finally { setSubiendo(false); }
          }} />
        </label>

        {/* Buscador y datos */}
        <div className="min-w-0 flex-1">
          {elegida && !manual ? (
            <div className="mt-1">
              <p className="truncate text-[17px] font-semibold leading-tight tracking-[-0.01em]">{[l.marca, l.modelo].filter(Boolean).join(" ") || l.tipo}</p>
              <p className="truncate text-[13px] text-texto2">{l.tipo}{prenda?.referencia ? ` · ${prenda.referencia}` : ""}
                <button className="ml-2 inline-flex items-center gap-1 text-azul" onClick={() => setManual(true)}><Pencil className="size-3" />Editar</button></p>
            </div>
          ) : manual ? (
            <div className="mt-1 grid gap-2 sm:grid-cols-3">
              <input className="campo" list="tipos-prenda" aria-label="Tipo de prenda" placeholder="Tipo" value={l.tipo} onChange={(e) => cambiar({ tipo: e.target.value })} />
              <input className="campo" aria-label="Marca" placeholder="Marca" value={l.marca} onChange={(e) => cambiar({ marca: e.target.value })} />
              <input className="campo" aria-label="Modelo" placeholder="Modelo" value={l.modelo} onChange={(e) => cambiar({ modelo: e.target.value })} />
              <datalist id="tipos-prenda">{TIPOS_PRENDA.map((x) => <option key={x} value={x} />)}</datalist>
              <button className="text-left text-[12px] text-azul sm:col-span-3" onClick={() => setManual(false)}>Listo</button>
            </div>
          ) : <p className="mt-1 text-[13px] text-texto2">Busca la prenda: se rellenan solos el modelo, los colores, las tallas y el precio.</p>}

          {/* Colores */}
          {(colores.length > 0 || elegida) && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {colores.map((c) => (
                <button key={c} onClick={() => cambiar({ color: c })} aria-pressed={l.color === c} title={c}
                  className={cx("inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition-colors", l.color === c ? "border-acento bg-acento font-medium text-sobre-acento" : "border-borde bg-superficie text-texto2 hover:text-texto")}>
                  <Muestra color={c} />{c}
                </button>
              ))}
              {otroColor || (!colores.length && elegida) || (l.color && !colores.includes(l.color)) ? (
                <input className="campo h-8 w-36 rounded-full text-[12px]" placeholder="Color" aria-label="Color" value={l.color} onChange={(e) => cambiar({ color: e.target.value })} />
              ) : <button className="h-8 rounded-full px-2 text-[12px] text-azul" onClick={() => setOtroColor(true)}>Otro color</button>}
            </div>
          )}
        </div>
      </div>

      {/* Tallas */}
      <div className="border-t border-borde px-4 py-4 sm:px-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-medium text-texto2">Cantidades por talla</span>
          {(!tallasModelo || (ninoModelo.length > 0 && adultoModelo.length > 0)) && (
            <div className="flex rounded-full bg-suave p-0.5 text-[12px]">
              <button className={cx("rounded-full px-2.5 py-0.5", !nino && "bg-superficie shadow-sm")} onClick={() => setNino(false)}>Adulto</button>
              <button className={cx("rounded-full px-2.5 py-0.5", nino && "bg-superficie shadow-sm")} onClick={() => setNino(true)}>Niño</button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {tallas.map((k) => (
            <label key={k} className="flex w-[56px] flex-col items-center gap-1">
              <span className="text-[11px] font-semibold text-texto2">{k}</span>
              <input type="number" inputMode="numeric" min={0} className={cx("campo sin-flechas num h-11 px-1 text-center", (l.tallas[k] ?? 0) > 0 && "border-azul/50 bg-azul-suave font-semibold")}
                value={l.tallas[k] || ""} placeholder="0" aria-label={`Cantidad talla ${k}`} onFocus={(e) => e.target.select()}
                onChange={(e) => { const v = Math.max(0, Math.floor(Number(e.target.value) || 0)); const nt = { ...l.tallas }; if (v) nt[k] = v; else delete nt[k]; cambiar({ tallas: nt }); }} />
            </label>
          ))}
          <form className="flex w-[64px] flex-col items-center gap-1" onSubmit={(e) => { e.preventDefault(); const k = nuevaTalla.trim(); if (k && !(k in l.tallas)) cambiar({ tallas: { ...l.tallas, [k]: 0 } }); setNuevaTalla(""); }}>
            <span className="text-[11px] text-texto2">Otra</span>
            <input className="campo h-11 px-1 text-center text-[12px]" placeholder="Única" value={nuevaTalla} onChange={(e) => setNuevaTalla(e.target.value)} aria-label="Añadir otra talla" onBlur={(e) => e.currentTarget.form?.requestSubmit()} />
          </form>
        </div>
      </div>

      {/* Precio y total */}
      <div className="flex flex-wrap items-end gap-3 border-t border-borde bg-suave/40 px-4 py-4 sm:px-5">
        <Campo etiqueta="Precio / ud" className="w-36" ayuda={l.precio_venta === null && l.precio_compra ? "Precio de tarifa" : undefined}>
          <CampoImporte valor={l.precio_venta} placeholder={pvSugerido ? pvSugerido.toFixed(2).replace(".", ",") : "0,00"} cambiar={(v) => cambiar({ precio_venta: v })} />
        </Campo>
        <div className="pb-2"><span className="block text-[12px] text-texto2">{t?.unidades ?? 0} uds</span><span className="num text-[18px] font-semibold">{euros(t?.venta ?? 0)}</span></div>
        <div className="ml-auto flex gap-1">
          <button className="h-9 rounded-full px-3 text-[13px] text-texto2 hover:bg-suave hover:text-texto" onClick={() => setMas((v) => !v)}>{mas ? "Menos" : "Más"}</button>
          <button className="grid size-9 place-items-center rounded-full text-texto2 hover:bg-suave hover:text-texto" title="Duplicar con otro color" aria-label="Duplicar con otro color" onClick={duplicar}><Copy className="size-4" /></button>
          <button className="grid size-9 place-items-center rounded-full text-texto2 hover:bg-suave hover:text-red-600" title="Quitar prenda" aria-label="Quitar prenda" onClick={quitar}><Trash2 className="size-4" /></button>
        </div>
        {mas && (
          <div className="animar grid w-full gap-3 sm:grid-cols-2">
            <Campo etiqueta="Proveedor">
              <select className="campo" value={l.proveedor_id ?? ""} onChange={(e) => cambiar({ proveedor_id: e.target.value || null })}>
                <option value="">—</option>{proveedores.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Observaciones"><input className="campo" value={l.notas} onChange={(e) => cambiar({ notas: e.target.value })} /></Campo>
          </div>
        )}
      </div>
    </div>
  );
}

/** Buscador de prendas del catálogo dentro de la tarjeta */
function BuscadorPrenda({ catalogo, margen, n, elegir, manual }: { catalogo: Prenda[]; margen: number; n: number; elegir: (p: Prenda) => void; manual: () => void }) {
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [sel, setSel] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const f = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener("mousedown", f); return () => document.removeEventListener("mousedown", f);
  }, []);
  const lista = useMemo(() => {
    const t = norm(q.trim());
    return catalogo.filter((p) => (t ? norm([p.marca, p.modelo, p.tipo, p.referencia].join(" ")).includes(t) : p.favorito))
      .sort((a, b) => Number(b.favorito) - Number(a.favorito)).slice(0, 8);
  }, [catalogo, q]);
  const precio = (p: Prenda) => (p.precio_venta !== null && Number(p.precio_venta) ? Number(p.precio_venta) * 100 : Number(p.precio_compra) ? precioVentaUd({ precio_compra: Number(p.precio_compra), precio_venta: null }, margen) : null);
  const ok = (p: Prenda) => { elegir(p); setQ(""); setAbierto(false); };
  return (
    <div ref={caja} className="relative">
      <div className="flex h-12 items-center gap-2 rounded-full bg-suave px-4 ring-azul/40 focus-within:ring-2">
        <Search className="size-4 shrink-0 text-texto2" />
        <input role="combobox" aria-expanded={abierto} aria-label={`Buscar prenda ${n}`} className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-texto2 focus-visible:outline-none"
          placeholder="Buscar prenda: modelo, tipo o referencia" value={q}
          onFocus={() => { setAbierto(true); setSel(0); }} onChange={(e) => { setQ(e.target.value); setAbierto(true); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, lista.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter" && lista[sel]) { e.preventDefault(); ok(lista[sel]); }
            if (e.key === "Escape") setAbierto(false);
          }} />
      </div>
      {abierto && (
        <div className="animar absolute inset-x-0 top-full z-30 mt-1.5 max-h-80 overflow-y-auto rounded-[20px] border border-borde bg-superficie p-1.5 shadow-xl" role="listbox">
          {!lista.length && <p className="px-3 py-3 text-[13px] text-texto2">{q ? "No está en el catálogo." : "Aún no tienes prendas habituales."}</p>}
          {lista.map((p, i) => {
            const pr = precio(p);
            return (
              <button key={p.id} role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => ok(p)}
                className={cx("flex w-full items-center gap-3 rounded-2xl p-2 text-left", i === sel && "bg-suave")}>
                <FotoPrenda path={p.imagen_path} tipo={p.tipo} color={p.colores[0] ?? ""} className="size-12 shrink-0 rounded-xl" />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{[p.marca, p.modelo].filter(Boolean).join(" ")}</span>
                  <span className="block truncate text-[12px] text-texto2">{p.tipo}{p.referencia ? ` · ${p.referencia}` : ""} · {p.colores.length} colores</span></span>
                <span className="num shrink-0 text-[12px] font-medium">{pr !== null ? euros(pr) : ""}</span>
              </button>
            );
          })}
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => { manual(); setAbierto(false); }} className="mt-1 flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-[13px] font-medium text-azul hover:bg-suave">
            <Pencil className="size-4" />{q ? `Escribir «${q}» a mano` : "Escribir la prenda a mano"}
          </button>
        </div>
      )}
    </div>
  );
}

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
  const [otraUbic, setOtraUbic] = useState(() => !!z.ubicacion && !UBICACIONES.slice(0, 6).includes(z.ubicacion));
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
          <p className="mb-2 text-[12px] font-medium text-texto2">Técnica</p>
          <SelectorTecnica tecnicas={tecnicas} valor={z.tecnica_id} elegir={(t) => cambiar({ tecnica_id: t.id, tecnica: t.nombre, precio_manual: false })} />
        </div>

        <div>
          <p className="mb-2 text-[12px] font-medium text-texto2">Ubicación</p>
          <div className="flex flex-wrap gap-1.5">
            {UBICACIONES.slice(0, 6).map((u) => (
              <button key={u} onClick={() => { cambiar({ ubicacion: u }); setOtraUbic(false); }} aria-pressed={z.ubicacion === u}
                className={cx("h-9 rounded-full border px-3.5 text-[13px] transition-colors", z.ubicacion === u && !otraUbic ? "border-acento bg-acento font-medium text-sobre-acento" : "border-borde text-texto2 hover:text-texto")}>{u}</button>
            ))}
            {otraUbic ? <input className="campo h-9 w-44 rounded-full text-[13px]" autoFocus placeholder="Otra ubicación" value={z.ubicacion} onChange={(e) => cambiar({ ubicacion: e.target.value })} aria-label="Otra ubicación" />
              : <button className="h-9 rounded-full px-3 text-[13px] text-azul" onClick={() => { setOtraUbic(true); cambiar({ ubicacion: "" }); }}>Otra…</button>}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-5">
          <div>
            <p className="mb-2 text-[12px] font-medium text-texto2">Nº de aplicaciones</p>
            <div className="flex h-11 items-center rounded-full bg-suave p-1">
              <button aria-label="Una menos" className="grid size-9 place-items-center rounded-full bg-superficie shadow-sm disabled:opacity-40" disabled={z.aplicaciones <= 1} onClick={() => cambiar({ aplicaciones: Math.max(1, z.aplicaciones - 1) })}><Minus className="size-4" /></button>
              <span className="num w-9 text-center font-semibold">{z.aplicaciones}</span>
              <button aria-label="Una más" className="grid size-9 place-items-center rounded-full bg-superficie shadow-sm" onClick={() => cambiar({ aplicaciones: z.aplicaciones + 1 })}><Plus className="size-4" /></button>
            </div>
          </div>
          <Campo etiqueta="Precio / ud" className="w-36" ayuda={z.precio_manual ? undefined : `Tarifa para ${calc?.unidades ?? 0} uds`}>
            <CampoImporte valor={z.precio_ud} cambiar={(v) => cambiar({ precio_ud: v ?? 0, precio_manual: true })} />
          </Campo>
          {z.precio_manual && <Boton tam="s" variante="fantasma" className="mb-1" onClick={usarTarifa}>Usar tarifa</Boton>}
        </div>

        {lineas.length > 0 && (
          <div>
            <p className="mb-2 text-[12px] font-medium text-texto2">Se aplica a</p>
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
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-dashed border-borde px-4 text-[13px] text-texto2 hover:border-azul hover:text-azul">
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
        <input className="campo" placeholder="Observaciones (colores de hilo, medidas…)" value={z.notas} onChange={(e) => cambiar({ notas: e.target.value })} aria-label="Observaciones de la personalización" />
      </div>
    </div>
  );
}
