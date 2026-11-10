"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
const Buscador = dynamic(() => import("./buscador").then((m) => m.Buscador), { ssr: false });
import { Home, ShoppingBag, Users, Shirt, Settings, Plus, Search, Moon, Sun, LogOut, MoreHorizontal } from "lucide-react";
import { Logo } from "./logo";
import { cx } from "./ui";
import { useSesion } from "./sesion";
import { sb } from "@/lib/supabase";

const NAV = [
  { href: "/", t: "Inicio", i: Home },
  { href: "/pedidos/", t: "Pedidos", i: ShoppingBag },
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
    <div className="min-h-dvh lg:pl-[232px]">
      {/* Barra lateral (escritorio) */}
      <aside className="no-imprimir fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-borde bg-superficie px-3 py-5 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-2">
          <Logo />
          <span className="leading-tight"><span className="block text-[14px] font-semibold">Mis pedidos</span><span className="block text-[12px] text-texto2">textiles</span></span>
        </Link>
        <button onClick={() => setBuscar(true)} className="mb-4 flex h-9 items-center gap-2 rounded-[10px] border border-borde px-3 text-[13px] text-texto2 hover:bg-suave">
          <Search className="size-4" /> Buscar <kbd className="ml-auto rounded bg-suave px-1.5 text-[11px]">⌘K</kbd>
        </button>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, t, i: I }) => (
            <Link key={href} href={href} className={cx("flex h-9 items-center gap-3 rounded-[10px] px-3 text-[14px] transition-colors",
              activo(href) ? "bg-acento-suave font-medium text-acento" : "text-texto2 hover:bg-suave hover:text-texto")}>
              <I className="size-[18px]" strokeWidth={1.8} />{t}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-1 border-t border-borde pt-3">
          <p className="truncate px-3 text-[13px] font-medium">{empresa?.nombre}</p>
          <p className="truncate px-3 pb-2 text-[12px] text-texto2">{sesion?.user.email}</p>
          <button onClick={cambiar} className="flex h-9 w-full items-center gap-3 rounded-[10px] px-3 text-[13px] text-texto2 hover:bg-suave">
            {oscuro ? <Sun className="size-4" /> : <Moon className="size-4" />} Modo {oscuro ? "claro" : "oscuro"}
          </button>
          <button onClick={() => sb.auth.signOut()} className="flex h-9 w-full items-center gap-3 rounded-[10px] px-3 text-[13px] text-texto2 hover:bg-suave">
            <LogOut className="size-4" /> Salir
          </button>
        </div>
      </aside>

      {/* Cabecera (móvil) */}
      <header className="no-imprimir sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-borde bg-superficie/90 px-4 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2"><Logo /><span className="font-semibold">Mis pedidos</span></Link>
        <button onClick={() => setBuscar(true)} aria-label="Buscar" className="ml-auto grid size-9 place-items-center rounded-full hover:bg-suave"><Search className="size-5" /></button>
      </header>

      <main className="mx-auto w-full max-w-[1240px] px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">{children}</main>

      {/* Barra inferior (móvil) */}
      <nav className="no-imprimir fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t border-borde bg-superficie lg:hidden">
        {[NAV[0], NAV[1]].map(({ href, t, i: I }) => (
          <Link key={href} href={href} className={cx("flex flex-col items-center justify-center gap-0.5 text-[11px]", activo(href) ? "text-acento" : "text-texto2")}><I className="size-[22px]" strokeWidth={1.8} />{t}</Link>
        ))}
        <Link href="/pedidos/nuevo/" aria-label="Nuevo pedido" className="flex items-center justify-center"><span className="grid size-12 place-items-center rounded-full bg-acento text-white shadow-lg"><Plus className="size-6" /></span></Link>
        <Link href="/clientes/" className={cx("flex flex-col items-center justify-center gap-0.5 text-[11px]", activo("/clientes/") ? "text-acento" : "text-texto2")}><Users className="size-[22px]" strokeWidth={1.8} />Clientes</Link>
        <button onClick={() => setMas(true)} className={cx("flex flex-col items-center justify-center gap-0.5 text-[11px]", ["/catalogo/", "/ajustes/"].some(activo) ? "text-acento" : "text-texto2")}><MoreHorizontal className="size-[22px]" />Más</button>
      </nav>
      {mas && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMas(false)}>
          <div className="absolute inset-0 bg-black/25" />
          <div className="animar absolute inset-x-3 bottom-20 rounded-2xl bg-superficie p-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {NAV.slice(3).map(({ href, t, i: I }) => (
              <Link key={href} href={href} className="flex h-12 items-center gap-3 rounded-xl px-3 hover:bg-suave"><I className="size-5 text-texto2" />{t}</Link>
            ))}
            <button onClick={cambiar} className="flex h-12 w-full items-center gap-3 rounded-xl px-3 hover:bg-suave">{oscuro ? <Sun className="size-5 text-texto2" /> : <Moon className="size-5 text-texto2" />}Modo {oscuro ? "claro" : "oscuro"}</button>
            <button onClick={() => sb.auth.signOut()} className="flex h-12 w-full items-center gap-3 rounded-xl px-3 hover:bg-suave"><LogOut className="size-5 text-texto2" />Salir</button>
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
      {volver && <Link href={volver.href} className="mb-2 inline-block text-[13px] text-texto2 hover:text-texto">← {volver.t}</Link>}
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
