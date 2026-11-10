"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useSesion } from "./sesion";
import { Hoja } from "./ui";
import { sb } from "@/lib/supabase";
import { euros, precioVentaUd } from "@/lib/calculo";
import type { Prenda } from "@/lib/tipos";

/* ───────── Catálogo ───────── */
export function Catalogo({ abierto, cerrar, elegir, margen }: { abierto: boolean; cerrar: () => void; elegir: (p: Prenda, color: string) => void; margen: number }) {
  const { empresa } = useSesion();
  const [lista, setLista] = useState<Prenda[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => { if (abierto) sb.from("catalogo").select("*").eq("empresa_id", empresa!.id).order("tipo").then(({ data }) => setLista((data ?? []) as Prenda[])); }, [abierto, empresa]);
  const f = (lista ?? []).filter((p) => (q ? [p.tipo, p.marca, p.modelo, p.referencia].join(" ").toLowerCase().includes(q.toLowerCase()) : p.favorito))
    .sort((a, b) => Number(b.favorito) - Number(a.favorito));
  return (
    <Hoja abierta={abierto} cerrar={cerrar} titulo="Prendas del catálogo">
      <input className="campo mb-4" placeholder="Buscar modelo o referencia (también en toda la tarifa)…" value={q} onChange={(e) => setQ(e.target.value)} />
      {!q && <p className="-mt-2 mb-3 text-[12px] text-texto2">Tus prendas habituales. Escribe para buscar en todo el catálogo.</p>}
      {!lista ? <Loader2 className="mx-auto size-5 animate-spin text-texto2" /> : !f.length ? <p className="py-8 text-center text-[13px] text-texto2">No hay prendas en el catálogo. Añádelas en Catálogo para tenerlas a un clic.</p> : (
        <ul className="space-y-2">
          {f.map((p) => (
            <li key={p.id} className="rounded-xl border border-borde p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{[p.marca, p.modelo].filter(Boolean).join(" ")}<span className="font-normal text-texto2"> · {p.tipo}{p.referencia ? " · " + p.referencia : ""}</span></span>
                <span className="num text-[12px] font-medium">{Number(p.precio_venta) || Number(p.precio_compra) ? euros(precioVentaUd({ precio_compra: Number(p.precio_compra), precio_venta: p.precio_venta === null ? null : Number(p.precio_venta) }, margen)) : "Sin precio"}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(p.colores.length ? p.colores : [""]).map((c) => (
                  <button key={c || "sin"} onClick={() => elegir(p, c)} className="h-7 rounded-full border border-borde px-3 text-[12px] hover:border-acento hover:text-azul">{c || "Añadir"}</button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Hoja>
  );
}
