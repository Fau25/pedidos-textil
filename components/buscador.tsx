"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { cx, Pastilla } from "./ui";
import { useSesion } from "./sesion";
import { sb } from "@/lib/supabase";

type Resultado = { tipo: "Pedido" | "Cliente" | "Prenda"; t: string; s: string; href: string; entregado?: boolean };

export function Buscador({ cerrar }: { cerrar: () => void }) {
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

