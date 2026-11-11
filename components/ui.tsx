"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { createPortal } from "react-dom";

export function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(" "); }

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primario" | "secundario" | "fantasma" | "peligro"; tam?: "s" | "m"; cargando?: boolean };
export function Boton({ variante = "secundario", tam = "m", cargando, className, children, disabled, ...p }: BtnProps) {
  return (
    <button
      {...p}
      disabled={disabled || cargando}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background,transform] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap select-none",
        tam === "m" ? "h-11 px-5 text-[14px]" : "h-9 px-3.5 text-[13px]",
        variante === "primario" && "bg-acento text-sobre-acento hover:bg-acento-h shadow-[0_6px_16px_-6px_rgba(16,18,24,0.35)]",
        variante === "secundario" && "bg-superficie border border-borde hover:bg-suave",
        variante === "fantasma" && "text-texto2 hover:bg-suave hover:text-texto",
        variante === "peligro" && "bg-superficie border border-borde text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40",
        className,
      )}
    >
      {cargando && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Campo({ etiqueta, ayuda, error, children, className }: { etiqueta: string; ayuda?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-[12px] font-medium text-texto2">{etiqueta}</span>
      {children}
      {error ? <span className="mt-1 block text-[12px] text-red-600">{error}</span> : ayuda ? <span className="mt-1 block text-[12px] text-texto2">{ayuda}</span> : null}
    </label>
  );
}

export function Tarjeta({ titulo, accion, children, className, sinPadding }: { titulo?: ReactNode; accion?: ReactNode; children: ReactNode; className?: string; sinPadding?: boolean }) {
  return (
    <section className={cx("tarjeta", className)}>
      {(titulo || accion) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-2">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{titulo}</h2>
          {accion}
        </div>
      )}
      <div className={sinPadding ? "" : "px-5 pb-5 pt-2"}>{children}</div>
    </section>
  );
}

export const COLORES: Record<string, string> = {
  gris: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  ambar: "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  azul: "bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  violeta: "bg-violet-50 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300",
  verde: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  rojo: "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300",
};
export const PUNTOS: Record<string, string> = { gris: "bg-slate-400", ambar: "bg-amber-500", azul: "bg-blue-500", violeta: "bg-violet-500", verde: "bg-emerald-500", rojo: "bg-red-500" };

export function Pastilla({ color = "gris", children, className }: { color?: string; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap", COLORES[color] ?? COLORES.gris, className)}>
      <span className={cx("size-1.5 rounded-full", PUNTOS[color] ?? PUNTOS.gris)} />
      {children}
    </span>
  );
}

export function Vacio({ icono, titulo, texto, accion }: { icono?: ReactNode; titulo: string; texto?: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icono && <div className="mb-3 grid size-14 place-items-center rounded-[20px] bg-suave text-texto2">{icono}</div>}
      <p className="font-semibold">{titulo}</p>
      {texto && <p className="mt-1 max-w-sm text-[13px] text-texto2">{texto}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

export function Cargando({ texto = "Cargando…", error, reintentar }: { texto?: string; error?: string | null; reintentar?: () => void }) {
  if (error) return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center" role="alert">
      <AlertCircle className="size-6 text-red-500" />
      <p className="font-medium">No se han podido cargar los datos</p>
      <p className="max-w-sm text-[13px] text-texto2">{error} Comprueba la conexión a internet.</p>
      {reintentar && <Boton onClick={reintentar}>Reintentar</Boton>}
    </div>
  );
  return <div className="flex items-center justify-center gap-2 py-16 text-texto2" role="status"><Loader2 className="size-4 animate-spin" />{texto}</div>;
}

/** Hoja lateral (escritorio) / inferior (móvil). Cierra con Escape y devuelve el foco. */
export function Hoja({ abierta, cerrar, titulo, children, pie, ancho = "max-w-lg" }: { abierta: boolean; cerrar: () => void; titulo: string; children: ReactNode; pie?: ReactNode; ancho?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const cerrarRef = useRef(cerrar);
  useEffect(() => { cerrarRef.current = cerrar; });
  useEffect(() => {
    if (!abierta) return;
    const cerrar = () => cerrarRef.current();
    const previo = document.activeElement as HTMLElement | null;
    const k = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    setTimeout(() => ref.current?.querySelector<HTMLElement>("input,select,textarea,button:not([data-cerrar])")?.focus(), 30);
    // El resto de la página queda inerte mientras la hoja está abierta y el tabulador no sale de ella
    const fondo = [...document.body.children].filter((el) => !el.contains(ref.current) && !el.hasAttribute("aria-live") && !el.hasAttribute("data-encima")) as HTMLElement[];
    for (const el of fondo) el.inert = true;
    const tab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !ref.current) return;
      const f = [...ref.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex='-1'])")];
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    };
    document.addEventListener("keydown", tab);
    return () => { document.removeEventListener("keydown", k); document.removeEventListener("keydown", tab); for (const el of fondo) el.inert = false; document.body.style.overflow = ""; previo?.focus?.(); };
  }, [abierta]); // cerrar va en una ref: si cambiara en cada tecla, el foco saltaría al primer campo
  if (!abierta) return null;
  return createPortal(
    <div data-hoja className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={cerrar} />
      <div ref={ref} className={cx("cristal animar relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] shadow-2xl sm:max-h-none sm:rounded-none sm:rounded-l-[28px]", ancho)}>
        <div className="flex items-center justify-between border-b border-borde px-5 py-4">
          <h2 className="text-[16px] font-semibold">{titulo}</h2>
          <button data-cerrar onClick={cerrar} aria-label="Cerrar" className="-mr-1 grid size-10 place-items-center rounded-full text-texto2 hover:bg-suave"><X className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {pie && <div className="flex justify-end gap-2 border-t border-borde px-5 py-3">{pie}</div>}
      </div>
    </div>
  , document.body);
}

/** Confirmación propia (sin alert/confirm del navegador) */
type Confirm = { titulo: string; texto?: string; ok?: string; peligro?: boolean; resolver: (v: boolean) => void };
type Accion = { texto: string; fn: () => void };
type Toast = { id: number; texto: string; tipo: "ok" | "error"; accion?: Accion };
const Ctx = createContext<{ aviso: (t: string, tipo?: "ok" | "error", accion?: Accion) => void; confirmar: (o: Omit<Confirm, "resolver">) => Promise<boolean> } | null>(null);
export const useAvisos = () => useContext(Ctx)!;

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [conf, setConf] = useState<Confirm | null>(null);
  const aviso = useCallback((texto: string, tipo: "ok" | "error" = "ok", accion?: Accion) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, texto, tipo, accion }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tipo === "error" || accion ? 6000 : 3000);
  }, []);
  const confirmar = useCallback((o: Omit<Confirm, "resolver">) => new Promise<boolean>((resolver) => setConf({ ...o, resolver })), []);
  const cerrar = (v: boolean) => { conf?.resolver(v); setConf(null); };
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  return (
    <Ctx.Provider value={{ aviso, confirmar }}>
      {children}
      {montado && createPortal(<>
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="animar pointer-events-auto flex max-w-md items-center gap-2 rounded-xl bg-[#1e2024] px-4 py-3 text-[13px] text-white shadow-lg dark:bg-[#ecedef] dark:text-[#1e2024]">
            {t.tipo === "ok" ? <CheckCircle2 className="size-4 text-emerald-400 dark:text-emerald-600" /> : <AlertCircle className="size-4 text-red-400 dark:text-red-600" />}
            {t.texto}
            {t.accion && <button className="ml-2 font-semibold text-[#8fb0ff] underline-offset-2 hover:underline dark:text-[#2b59c3]" onClick={() => { t.accion!.fn(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>{t.accion.texto}</button>}
          </div>
        ))}
      </div>
      {conf && (
        <div data-encima="" className="fixed inset-0 z-[70] grid place-items-center p-4" role="alertdialog" aria-modal="true" onKeyDown={(e) => e.key === "Escape" && cerrar(false)}>
          <div className="absolute inset-0 bg-black/30" onClick={() => cerrar(false)} />
          <div className="cristal animar relative w-full max-w-sm rounded-[22px] p-5 shadow-2xl">
            <p className="text-[16px] font-semibold">{conf.titulo}</p>
            {conf.texto && <p className="mt-1.5 text-[13px] text-texto2">{conf.texto}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Boton onClick={() => cerrar(false)}>Cancelar</Boton>
              <Boton autoFocus variante={conf.peligro ? "peligro" : "primario"} onClick={() => cerrar(true)}>{conf.ok ?? "Aceptar"}</Boton>
            </div>
          </div>
        </div>
      )}
      </>, document.body)}
    </Ctx.Provider>
  );
}

/** Campo de importe en euros que acepta coma decimal */
export function CampoImporte({ valor, cambiar, className, placeholder, oscuro, ...p }: { valor: number | null; cambiar: (v: number | null) => void; className?: string; placeholder?: string; "aria-label"?: string; oscuro?: boolean }) {
  const [txt, setTxt] = useState(valor === null || valor === undefined ? "" : String(valor).replace(".", ","));
  const foco = useRef(false);
  useEffect(() => { if (!foco.current) setTxt(valor === null || valor === undefined ? "" : Number(valor).toFixed(2).replace(".", ",")); }, [valor]);
  return (
    <div className={cx("relative", className)}>
      <input
        {...p}
        inputMode="decimal"
        className={oscuro ? "num h-8 w-full bg-transparent pr-4 text-center text-[19px] font-bold text-sobre-acento outline-none placeholder:text-sobre-acento/50" : "campo num pr-7 text-right"}
        value={txt}
        placeholder={placeholder ?? "0,00"}
        onFocus={(e) => { foco.current = true; e.target.select(); }}
        onBlur={() => { foco.current = false; setTxt(valor === null ? "" : Number(valor).toFixed(2).replace(".", ",")); }}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d,.-]/g, "");
          setTxt(t);
          if (t.trim() === "") return cambiar(null);
          const n = Number(t.replace(/\./g, "").replace(",", "."));
          if (Number.isFinite(n)) cambiar(Math.round(n * 100) / 100);
        }}
      />
      <span className={cx("pointer-events-none absolute top-1/2 -translate-y-1/2", oscuro ? "right-1 text-[15px] font-semibold text-sobre-acento/80" : "right-3 text-texto2")}>€</span>
    </div>
  );
}

export function Pestanas<T extends string>({ valor, cambiar, opciones }: { valor: T; cambiar: (v: T) => void; opciones: { v: T; t: string; n?: number }[] }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
      {opciones.map((o) => (
        <button key={o.v} role="tab" aria-selected={valor === o.v} onClick={() => cambiar(o.v)}
          className={cx("h-9 shrink-0 whitespace-nowrap rounded-full px-4 text-[13px] font-medium transition-colors",
            valor === o.v ? "bg-acento text-sobre-acento" : "bg-superficie text-texto2 hover:text-texto")}>
          {o.t}{o.n !== undefined && <span className="ml-1.5 text-[11px] opacity-70">{o.n}</span>}
        </button>
      ))}
    </div>
  );
}

export const fecha = (d?: string | null, larga = false) =>
  d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("es-ES", larga ? { day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "short" }) : "—";

export function diasHasta(d?: string | null) {
  if (!d) return null;
  const hoy = new Date(); hoy.setHours(12, 0, 0, 0);
  return Math.round((new Date(d + "T12:00:00").getTime() - hoy.getTime()) / 86400000);
}

export function SelloFecha({ d, alerta }: { d: string | null; alerta?: boolean }) {
  if (!d) return <div className="grid size-11 place-items-center rounded-xl bg-suave text-texto2">—</div>;
  const f = new Date(d + "T12:00:00");
  return (
    <div className={cx("flex size-11 shrink-0 flex-col items-center justify-center rounded-xl leading-none", alerta ? "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" : "bg-suave")}>
      <span className="text-[10px] font-semibold uppercase">{f.toLocaleDateString("es-ES", { month: "short" }).replace(".", "")}</span>
      <span className="num text-[17px] font-semibold">{f.getDate()}</span>
    </div>
  );
}
