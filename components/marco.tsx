"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Home, ShoppingBag, Users, Shirt, Settings, Plus, Search, Moon, Sun, LogOut, MoreHorizontal, X, Loader2 } from "lucide-react";
import { Logo } from "./logo";
import { cx, Pastilla } from "./ui";
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

type Resultado = { tipo: "Pedido" | "Cliente" | "Prenda"; t: string; s: string; href: string; entregado?: boolean };

function Buscador({ cerrar }: { cerrar: () => void }) {
  const { empresa } = useSesion();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Resultado[]>([]);
  const [sel, setSel] = useState(0);
  const [cargando, setCargando] = useState(false);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  useEffect(() => {
    const term = q.trim().replace(/[%,()]/g, " ");
    if (term.length < 2) { setRes([]); return; }
    setCargando(true);
    const t = setTimeout(async () => {
      const like = `%${term}%`;
      const [p, c, l] = await Promise.all([
        sb.from("pedidos").select("id, numero, referencia, entregado, clientes(nombre)").eq("empresa_id", empresa!.id).or(`numero.ilike.${like},referencia.ilike.${like}`).limit(6),
        sb.from("clientes").select("id, nombre, contacto, telefono").eq("empresa_id", empresa!.id).or(`nombre.ilike.${like},contacto.ilike.${like},email.ilike.${like},telefono.ilike.${like}`).limit(6),
        sb.from("pedido_lineas").select("pedido_id, tipo, marca, modelo, color, pedidos(numero)").eq("empresa_id", empresa!.id).or(`tipo.ilike.${like},marca.ilike.${like},modelo.ilike.${like},color.ilike.${like}`).limit(6),
      ]);
      // También pedidos por nombre de cliente
      const ids = (c.data ?? []).map((x) => x.id);
      const pc = ids.length ? (await sb.from("pedidos").select("id, numero, referencia, entregado, clientes(nombre)").in("cliente_id", ids).order("fecha", { ascending: false }).limit(4)).data ?? [] : [];
      type PR = { id: string; numero: string; referencia: string | null; entregado: boolean; clientes: { nombre: string } | { nombre: string }[] | null };
      const nom = (x: PR) => (Array.isArray(x.clientes) ? x.clientes[0]?.nombre : x.clientes?.nombre) ?? "";
      const vistos = new Set<string>();
      const ped = [...((p.data ?? []) as PR[]), ...(pc as PR[])].filter((x) => !vistos.has(x.id) && vistos.add(x.id));
      setRes([
        ...ped.map((x) => ({ tipo: "Pedido" as const, t: x.numero, s: [nom(x), x.referencia].filter(Boolean).join(" · "), href: `/pedidos/ver/?id=${x.id}`, entregado: x.entregado })),
        ...(c.data ?? []).map((x) => ({ tipo: "Cliente" as const, t: x.nombre, s: [x.contacto, x.telefono].filter(Boolean).join(" · "), href: `/clientes/ver/?id=${x.id}` })),
        ...((l.data ?? []) as unknown as { pedido_id: string; tipo: string; marca: string | null; modelo: string | null; color: string | null; pedidos: { numero: string } | null }[])
          .map((x) => ({ tipo: "Prenda" as const, t: [x.tipo, x.marca, x.modelo].filter(Boolean).join(" "), s: [x.color, x.pedidos?.numero].filter(Boolean).join(" · "), href: `/pedidos/ver/?id=${x.pedido_id}` })),
      ]);
      setSel(0); setCargando(false);
    }, 200);
    return () => clearTimeout(t);
  }, [q, empresa]);

  const ir = (r?: Resultado) => { if (r) { router.push(r.href); cerrar(); } };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-[8vh]" role="dialog" aria-modal="true" aria-label="Buscar">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={cerrar} />
      <div className="animar tarjeta relative w-full max-w-xl overflow-hidden">
        <div className="flex items-center gap-3 border-b border-borde px-4">
          {cargando ? <Loader2 className="size-5 animate-spin text-texto2" /> : <Search className="size-5 text-texto2" />}
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pedido, cliente o prenda…" className="h-14 flex-1 bg-transparent text-[15px] outline-none"
            onKeyDown={(e) => {
              if (e.key === "Escape") cerrar();
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, res.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
              if (e.key === "Enter") ir(res[sel]);
            }} />
          <button onClick={cerrar} aria-label="Cerrar" className="grid size-8 place-items-center rounded-lg text-texto2 hover:bg-suave"><X className="size-4" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {q.trim().length < 2 ? <p className="px-3 py-6 text-center text-[13px] text-texto2">Escribe al menos 2 letras: número de pedido, cliente, teléfono, prenda o color.</p>
            : !cargando && !res.length ? <p className="px-3 py-6 text-center text-[13px] text-texto2">Sin resultados para «{q}».</p>
            : res.map((r, i) => {
              return (
                <button key={r.tipo + r.href + i} onMouseEnter={() => setSel(i)} onClick={() => ir(r)} className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left", i === sel && "bg-suave")}>
                  <span className="w-14 shrink-0 text-[11px] font-medium uppercase tracking-wide text-texto2">{r.tipo}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.t}</span>{r.s && <span className="block truncate text-[12px] text-texto2">{r.s}</span>}</span>
                  {r.entregado !== undefined && <Pastilla color={r.entregado ? "verde" : "ambar"}>{r.entregado ? "Entregado" : "Pendiente"}</Pastilla>}
                </button>
              );
            })}
        </div>
      </div>
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
