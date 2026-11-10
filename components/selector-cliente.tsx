"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Check, ChevronDown, Search } from "lucide-react";
import { useSesion } from "./sesion";
import { Boton, Campo, Hoja, cx, useAvisos } from "./ui";
import { sb, textoError } from "@/lib/supabase";
import type { Cliente } from "@/lib/tipos";

/* ───────── Cliente ───────── */
export function SelectorCliente({ clientes, valor, cambiar, creado, error }: { clientes: Cliente[]; valor: string | null; cambiar: (id: string) => void; creado: (c: Cliente) => void; error?: boolean }) {
  const { empresa } = useSesion();
  const { aviso } = useAvisos();
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [alta, setAlta] = useState<{ nombre: string; telefono: string; email: string; contacto: string } | null>(null);
  const [creando, setCreando] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const actual = clientes.find((c) => c.id === valor);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const lista = clientes.filter((c) => !q || norm([c.nombre, c.contacto, c.telefono, c.email].join(" ")).includes(norm(q))).slice(0, 8);
  const opciones = [...lista.map((c) => ({ c })), ...(q.trim() ? [{ nuevo: q.trim() }] : [{ nuevo: "" }])];

  useEffect(() => {
    const f = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener("mousedown", f);
    return () => document.removeEventListener("mousedown", f);
  }, []);

  const elegir = (o: (typeof opciones)[number]) => {
    if ("c" in o) { cambiar(o.c.id); setAbierto(false); setQ(""); }
    else { setAlta({ nombre: o.nuevo, telefono: "", email: "", contacto: "" }); setAbierto(false); }
  };

  return (
    <div ref={caja} className="relative">
      <span className="mb-1.5 block text-[12px] font-medium text-texto2">Cliente</span>
      <div className={cx("campo flex items-center gap-2 px-3", error && "border-red-500")}>
        <Search className="size-4 shrink-0 text-texto2" />
        <input role="combobox" aria-expanded={abierto} aria-label="Buscar cliente" className="h-full flex-1 bg-transparent outline-none"
          placeholder={actual ? actual.nombre : "Buscar o crear cliente…"} value={abierto ? q : actual?.nombre ?? q}
          onFocus={() => { setAbierto(true); setQ(""); setSel(0); }}
          onChange={(e) => { setQ(e.target.value); setAbierto(true); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, opciones.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter") { e.preventDefault(); elegir(opciones[sel]); }
            if (e.key === "Escape") setAbierto(false);
          }} />
        <ChevronDown className="size-4 text-texto2" />
      </div>
      {error && <span className="mt-1 block text-[12px] text-red-600">Elige o crea un cliente</span>}
      {abierto && (
        <div className="animar absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-borde bg-superficie p-1 shadow-xl" role="listbox">
          {opciones.map((o, i) => (
            <button key={"c" in o ? o.c.id : "nuevo"} role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(o)}
              className={cx("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left", i === sel && "bg-suave")}>
              {"c" in o ? (<><span className="min-w-0 flex-1"><span className="block truncate">{o.c.nombre}</span>{o.c.contacto && <span className="block truncate text-[12px] text-texto2">{o.c.contacto}</span>}</span>{o.c.id === valor && <Check className="size-4 text-acento" />}</>)
                : <span className="flex items-center gap-2 font-medium text-acento"><Plus className="size-4" />{o.nuevo ? `Crear «${o.nuevo}»` : "Crear cliente nuevo"}</span>}
            </button>
          ))}
        </div>
      )}
      <Hoja abierta={!!alta} cerrar={() => setAlta(null)} titulo="Nuevo cliente"
        pie={<><Boton onClick={() => setAlta(null)}>Cancelar</Boton><Boton variante="primario" cargando={creando} form="alta-cliente" type="submit">Crear cliente</Boton></>}>
        {alta && (
          <form id="alta-cliente" className="space-y-4" onSubmit={async (e) => {
            e.preventDefault(); setCreando(true);
            const { data, error } = await sb.from("clientes").insert({ empresa_id: empresa!.id, nombre: alta.nombre.trim(), contacto: alta.contacto || null, telefono: alta.telefono || null, email: alta.email || null }).select("*").single();
            setCreando(false);
            if (error) return aviso(textoError(error), "error");
            creado(data as Cliente); setAlta(null); aviso("Cliente creado");
          }}>
            <Campo etiqueta="Nombre o empresa"><input className="campo" required value={alta.nombre} onChange={(e) => setAlta({ ...alta, nombre: e.target.value })} /></Campo>
            <Campo etiqueta="Persona de contacto"><input className="campo" value={alta.contacto} onChange={(e) => setAlta({ ...alta, contacto: e.target.value })} /></Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Teléfono"><input className="campo" type="tel" value={alta.telefono} onChange={(e) => setAlta({ ...alta, telefono: e.target.value })} /></Campo>
              <Campo etiqueta="Email"><input className="campo" type="email" value={alta.email} onChange={(e) => setAlta({ ...alta, email: e.target.value })} /></Campo>
            </div>
            <p className="text-[12px] text-texto2">El resto de datos (NIF, dirección, facturación) los puedes completar después en Clientes.</p>
          </form>
        )}
      </Hoja>
    </div>
  );
}

