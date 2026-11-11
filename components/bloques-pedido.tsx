"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ChevronDown, Copy, Loader2, Pencil, Search, Trash2 } from "lucide-react";
import { useSesion } from "./sesion";
import { Campo, CampoImporte, cx, useAvisos } from "./ui";
import { Muestra, Prenda as Dibujo, colorTela } from "./muestra";
import { miniDe, subirArchivo, textoError, urlArchivo, urlCacheada } from "@/lib/supabase";
import { euros, precioVentaUd } from "@/lib/calculo";
import { ordenTalla, type LineaEd } from "@/lib/pedidos";
import { TALLAS, TALLAS_NINO, TIPOS_PRENDA, type Prenda } from "@/lib/tipos";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Prenda del catálogo que corresponde a una línea (por marca y modelo) */
export function prendaDe(l: Pick<LineaEd, "marca" | "modelo">, catalogo: Prenda[]) {
  if (!l.modelo) return null;
  return catalogo.find((p) => norm(p.modelo ?? "") === norm(l.modelo) && norm(p.marca ?? "") === norm(l.marca)) ?? null;
}

/** Foto de la prenda (si la hay) o su dibujo teñido con el color elegido */
export function FotoPrenda({ path: original, tipo, color, className, cubrir, mini }: { path: string | null; tipo: string; color: string; className?: string; cubrir?: boolean; mini?: boolean }) {
  // Con «mini» se usa la miniatura (si existe) y, si no, la original. Si ya estaba firmada se pinta al momento
  const [sinMini, setSinMini] = useState(false);
  const path = mini && !sinMini ? miniDe(original) ?? original : original;
  const [u, setU] = useState<string | null>(() => urlCacheada(path));
  const [falla, setFalla] = useState(false);
  const [lista, setLista] = useState(false);
  useEffect(() => { setSinMini(false); }, [original]);
  useEffect(() => {
    let vivo = true; setFalla(false); setLista(false);
    const ya = urlCacheada(path); setU(ya);
    const sinFoto = () => (path !== original ? setSinMini(true) : setFalla(true));
    if (!ya && path) urlArchivo(path).then((x) => { if (!vivo) return; setU(x); if (!x) sinFoto(); });
    return () => { vivo = false; };
  }, [path, original]);
  const dibujo = !path || falla;
  return (
    <div className={cx("relative grid place-items-center overflow-hidden rounded-[18px] bg-suave", className)}>
      {dibujo ? <Dibujo tipo={tipo} color={color} className="size-[78%]" /> : u ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={u} alt={tipo} loading="lazy" decoding="async" referrerPolicy="no-referrer" onLoad={() => setLista(true)} onError={() => (path !== original ? setSinMini(true) : setFalla(true))}
          className={cx("size-full transition-opacity duration-200", lista ? "opacity-100" : "opacity-0", cubrir ? "object-cover object-top" : "object-contain")} />
      ) : null}
    </div>
  );
}

/* ───────── Prenda ───────── */
export function TarjetaLinea({ l, n, margen, t, catalogo, proveedores, cambiar, duplicar, quitar, abierta = true, alternar }: {
  l: LineaEd; n: number; margen: number; t?: { unidades: number; ventaUd: number; venta: number }; catalogo: Prenda[];
  proveedores: { id: string; nombre: string }[]; cambiar: (c: Partial<LineaEd>) => void; duplicar: () => void; quitar: () => void;
  abierta?: boolean; alternar?: () => void;
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

  const bloqueColores = (
<div className="mt-3">
            {colores.length > 0 && <p className="mb-1.5 text-[12px] text-texto2">Color: <span className="font-medium text-texto">{l.color || "elige uno"}</span>{colores.length > 8 && <span> · {colores.length} colores</span>}</p>}
            <div className="flex flex-wrap items-center gap-1.5">
              {colores.map((c) => colorTela(c) ? (
                <button key={c} onClick={() => cambiar({ color: c })} aria-pressed={l.color === c} title={c} aria-label={c}
                  className={cx("grid size-9 place-items-center rounded-full border-2 transition-colors", l.color === c ? "border-acento" : "border-transparent hover:border-borde")}>
                  <span className="size-6 rounded-full border border-black/10" style={{ background: colorTela(c)! }} />
                </button>
              ) : (
                <button key={c} onClick={() => cambiar({ color: c })} aria-pressed={l.color === c} title={c}
                  className={cx("inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] transition-colors", l.color === c ? "border-acento bg-acento font-medium text-sobre-acento" : "border-borde bg-superficie text-texto2 hover:text-texto")}>
                  <Muestra color={c} />{c}
                </button>
              ))}
              {otroColor || (!colores.length && elegida) || (l.color && !colores.includes(l.color)) ? (
                <input className="campo h-9 w-36 rounded-full text-[12px]" placeholder="Color" aria-label="Color" value={l.color} onChange={(e) => cambiar({ color: e.target.value })} />
              ) : <button className="h-9 rounded-full px-2 text-[12px] text-azul" onClick={() => setOtroColor(true)}>Otro color</button>}
            </div>
            </div>
  );

  function elegir(p: Prenda) {
    cambiar({
      tipo: p.tipo, marca: p.marca ?? "", modelo: p.modelo ?? "", color: p.colores.includes(l.color) ? l.color : p.colores[0] ?? "",
      proveedor_id: p.proveedor_id, precio_compra: Number(p.precio_compra), imagen_path: p.imagen_path ?? l.imagen_path, tallasModelo: p.tallas,
      precio_venta: p.precio_venta === null ? (l.precio_venta ?? null) : Number(p.precio_venta),
    });
    setManual(false);
  }

  if (!abierta) return (
    <button type="button" onClick={alternar} aria-expanded={false} className="tarjeta flex w-full items-center gap-3 p-3 text-left sm:p-3.5">
      <FotoPrenda path={l.imagen_path} tipo={l.tipo} color={l.color} cubrir mini className="size-14 shrink-0 rounded-[14px]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{[l.marca, l.modelo].filter(Boolean).join(" ") || l.tipo || `Prenda ${n}`}</span>
        <span className="flex items-center gap-1.5 truncate text-[12px] text-texto2">{l.color && <><Muestra color={l.color} />{l.color} · </>}{t?.unidades ?? 0} uds</span>
      </span>
      {t && t.venta > 0 && <span className="num shrink-0 text-[14px] font-semibold">{euros(t.venta)}</span>}
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-suave text-texto2"><ChevronDown className="size-4" /></span>
    </button>
  );

  return (
    <div className="tarjeta animar overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0 flex-1"><BuscadorPrenda catalogo={catalogo} margen={margen} n={n} elegir={elegir} manual={() => setManual(true)} /></div>
        {alternar && <button type="button" onClick={alternar} aria-expanded={true} aria-label={`Plegar prenda ${n}`} className="grid size-11 shrink-0 place-items-center rounded-full bg-suave text-texto2 hover:text-texto"><ChevronDown className="size-4 rotate-180" /></button>}
      </div>
      <div className="flex gap-4 p-4 sm:p-5">
        {/* Foto */}
        <label className="group relative shrink-0 self-start cursor-pointer" title="Cambiar foto">
          <FotoPrenda path={l.imagen_path} tipo={l.tipo} color={l.color} mini className="size-[96px] sm:size-[128px]" />
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
                <button className="ml-1 inline-flex h-8 items-center gap-1 px-1 text-azul" onClick={() => setManual(true)}><Pencil className="size-3" />Editar</button></p>
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

          {colores.length > 0 || elegida ? <div className="hidden sm:block">{bloqueColores}</div> : null}
        </div>
      </div>

      {(colores.length > 0 || elegida) && <div className="-mt-1 px-4 pb-4 sm:hidden">{bloqueColores}</div>}

      {/* Tallas */}
      <div className="border-t border-borde px-4 py-4 sm:px-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-medium text-texto2">Cantidades por talla</span>
          {(!tallasModelo || (ninoModelo.length > 0 && adultoModelo.length > 0)) && (
            <div className="flex rounded-full bg-suave p-0.5 text-[12px]">
              <button className={cx("h-9 rounded-full px-3.5", !nino && "bg-superficie shadow-sm")} onClick={() => setNino(false)}>Adulto</button>
              <button className={cx("h-9 rounded-full px-3.5", nino && "bg-superficie shadow-sm")} onClick={() => setNino(true)}>Niño</button>
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
        <input role="combobox" aria-expanded={abierto} aria-controls={`prendas-${n}`} aria-autocomplete="list" aria-label={`Buscar prenda ${n}`} className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-texto2 focus-visible:outline-none"
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
        <div className="animar absolute inset-x-0 top-full z-30 mt-1.5 max-h-80 overflow-y-auto rounded-[20px] border border-borde bg-superficie p-1.5 shadow-xl" role="listbox" id={`prendas-${n}`}>
          {!lista.length && <p className="px-3 py-3 text-[13px] text-texto2">{q ? "No está en el catálogo." : "Aún no tienes prendas habituales."}</p>}
          {lista.map((p, i) => {
            const pr = precio(p);
            return (
              <button key={p.id} role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => ok(p)}
                className={cx("flex w-full items-center gap-3 rounded-2xl p-2 text-left", i === sel && "bg-suave")}>
                <FotoPrenda path={p.imagen_path} tipo={p.tipo} color={p.colores[0] ?? ""} mini className="size-12 shrink-0 rounded-xl" />
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
