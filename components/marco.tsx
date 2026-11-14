"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
const Buscador = dynamic(() => import("./buscador").then((m) => m.Buscador), { ssr: false });
import { Home, ShoppingBag, Users, Shirt, Settings, Plus, Search, Moon, Sun, LogOut, MoreHorizontal, ClipboardList } from "lucide-react";
import { Logo } from "./logo";
import { cx } from "./ui";
import { useSesion } from "./sesion";
import { salir } from "@/lib/supabase";

const NAV = [
  { href: "/", t: "Inicio", i: Home },
  { href: "/pedidos/", t: "Pedidos", i: ShoppingBag },
  { href: "/trabajos/", t: "Trabajos", i: ClipboardList },
  { href: "/clientes/", t: "Clientes", i: Users },
  { href: "/catalogo/", t: "Catálogo", i: Shirt },
  { href: "/ajustes/", t: "Ajustes", i: Settings },
];

export function useTema() {
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => setOscuro(document.documentElement.classList.contains("dark")), []);
  const cambiar = () => {
    const v = !oscuro; setOscuro(v);
    document.documentElement.classList.toggle("dark", v);
    try { localStorage.setItem("tema", v ? "oscuro" : "claro"); } catch {}
  };
  return { oscuro, cambiar };
}

export function Marco({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const { empresa, sesion } = useSesion();
  const { oscuro, cambiar } = useTema();
  const [buscar, setBuscar] = useState(false);
  const [mas, setMas] = useState(false);
  const activo = (h: string) => (h === "/" ? ruta === "/" : ruta.startsWith(h));

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setBuscar(true); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => setMas(false), [ruta]);

  return (
    <div className="min-h-dvh lg:pl-[244px]">
      {/* Barra lateral (escritorio) */}
      <aside className="cristal no-imprimir fixed inset-y-3 left-3 z-30 hidden w-[220px] flex-col rounded-[26px] px-3 py-5 shadow-[0_10px_30px_-12px_rgba(16,18,24,0.12)] lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-2">
          <Logo />
          <span className="leading-tight"><span className="block text-[14px] font-semibold">Mis pedidos</span><span className="block text-[12px] text-texto2">textiles</span></span>
        </Link>
        <button onClick={() => setBuscar(true)} className="mb-4 flex h-9 items-center gap-2 rounded-full border border-borde px-3 text-[13px] text-texto2 hover:bg-suave">
          <Search className="size-4" /> Buscar <kbd className="ml-auto rounded bg-suave px-1.5 text-[11px]">⌘K</kbd>
        </button>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, t, i: I }) => (
            <Link key={href} href={href} className={cx("flex h-10 items-center gap-3 rounded-full px-3.5 text-[14px] transition-colors",
              activo(href) ? "bg-acento font-medium text-sobre-acento" : "text-texto2 hover:bg-suave hover:text-texto")}>
              <I className="size-[18px]" strokeWidth={1.8} />{t}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-1 border-t border-borde pt-3">
          <p className="truncate px-3 text-[13px] font-medium">{empresa?.nombre}</p>
          <p className="truncate px-3 pb-2 text-[12px] text-texto2">{sesion?.user.email}</p>
          <button onClick={cambiar} className="flex h-9 w-full items-center gap-3 rounded-full px-3 text-[13px] text-texto2 hover:bg-suave">
            {oscuro ? <Sun className="size-4" /> : <Moon className="size-4" />} Modo {oscuro ? "claro" : "oscuro"}
          </button>
          <button onClick={() => salir()} className="flex h-9 w-full items-center gap-3 rounded-full px-3 text-[13px] text-texto2 hover:bg-suave">
            <LogOut className="size-4" /> Salir
          </button>
        </div>
      </aside>

      {/* Cabecera (móvil) */}
      <header className={cx("cristal no-imprimir sticky top-0 z-20 flex h-14 items-center gap-3 !border-x-0 !border-t-0 px-4 lg:hidden", ruta === "/" && "hidden")}>
        <Link href="/" className="flex items-center gap-2"><Logo /><span className="font-semibold">Mis pedidos</span></Link>
        <button onClick={() => setBuscar(true)} aria-label="Buscar" className="ml-auto grid size-10 place-items-center rounded-full bg-superficie shadow-sm"><Search className="size-[18px]" /></button>
      </header>

      <main className="mx-auto w-full max-w-[1240px] px-4 pb-32 pt-3 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">{children}</main>

      {/* Barra inferior flotante (móvil) */}
      <nav className="cristal no-imprimir fixed inset-x-4 bottom-4 z-30 flex h-16 items-center justify-around rounded-full px-2 text-texto shadow-[0_12px_30px_-10px_rgba(16,18,24,0.25)] lg:hidden">
        {[NAV[0], NAV[1]].map(({ href, t, i: I }) => (
          <Link key={href} href={href} aria-label={t} className={cx("grid size-12 place-items-center rounded-full transition-colors", activo(href) ? "bg-acento text-sobre-acento" : "text-texto2")}><I className="size-[22px]" strokeWidth={1.9} /></Link>
        ))}
        <Link href="/pedidos/nuevo/" aria-label="Nuevo pedido" className="grid size-12 place-items-center rounded-full bg-azul text-white shadow-[0_6px_16px_-6px_rgba(31,91,255,0.7)]"><Plus className="size-6" /></Link>
        <Link href="/catalogo/" aria-label="Catálogo" className={cx("grid size-12 place-items-center rounded-full transition-colors", activo("/catalogo/") ? "bg-acento text-sobre-acento" : "text-texto2")}><Shirt className="size-[22px]" strokeWidth={1.9} /></Link>
        <button onClick={() => setMas(true)} aria-label="Más" className={cx("grid size-12 place-items-center rounded-full", ["/trabajos/", "/clientes/", "/ajustes/"].some(activo) ? "bg-acento text-sobre-acento" : "text-texto2")}><MoreHorizontal className="size-[22px]" /></button>
      </nav>
      {mas && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMas(false)}>
          <div className="absolute inset-0 bg-black/25" />
          <div className="cristal animar absolute inset-x-4 bottom-24 rounded-[24px] p-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {NAV.filter((n) => ["/trabajos/", "/clientes/", "/ajustes/"].includes(n.href)).map(({ href, t, i: I }) => (
              <Link key={href} href={href} className="flex h-12 items-center gap-3 rounded-xl px-3 hover:bg-suave"><I className="size-5 text-texto2" />{t}</Link>
            ))}
            <button onClick={cambiar} className="flex h-12 w-full items-center gap-3 rounded-xl px-3 hover:bg-suave">{oscuro ? <Sun className="size-5 text-texto2" /> : <Moon className="size-5 text-texto2" />}Modo {oscuro ? "claro" : "oscuro"}</button>
            <button onClick={() => salir()} className="flex h-12 w-full items-center gap-3 rounded-xl px-3 hover:bg-suave"><LogOut className="size-5 text-texto2" />Salir</button>
          </div>
        </div>
      )}
      {buscar && <Buscador cerrar={() => setBuscar(false)} />}
    </div>
  );
}

export function Cabecera({ titulo, sub, acciones, volver }: { titulo: ReactNode; sub?: ReactNode; acciones?: ReactNode; volver?: { href: string; t: string } }) {
  return (
    <div className="mb-6">
      {volver && <Link href={volver.href} className="-ml-1 mb-1 inline-flex h-10 items-center px-1 text-[13px] text-texto2 hover:text-texto">← {volver.t}</Link>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] sm:text-[28px]">{titulo}</h1>
          {sub && <div className="mt-1 text-texto2">{sub}</div>}
        </div>
        {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
      </div>
    </div>
  );
}
