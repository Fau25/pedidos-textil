"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Users, ChevronRight } from "lucide-react";
import { useSesion } from "@/components/sesion";
import { Cabecera } from "@/components/marco";
import { Boton, Cargando, Vacio } from "@/components/ui";
import { FormCliente } from "@/components/form-cliente";
import { sb } from "@/lib/supabase";
import { useCarga } from "@/lib/usar";
import { aCent, euros } from "@/lib/calculo";
import type { Cliente } from "@/lib/tipos";

export default function Clientes() {
  const { empresa } = useSesion();
  const [q, setQ] = useState("");
  const [form, setForm] = useState(false);
  const { datos, recargar } = useCarga(async () => {
    const [c, p] = await Promise.all([
      sb.from("clientes").select("*").eq("empresa_id", empresa!.id).order("nombre"),
      sb.from("pedidos").select("cliente_id, total").eq("empresa_id", empresa!.id),
    ]);
    if (c.error) throw c.error;
    const r = new Map<string, { n: number; t: number }>();
    for (const x of p.data ?? []) { const a = r.get(x.cliente_id) ?? { n: 0, t: 0 }; a.n++; a.t += aCent(x.total); r.set(x.cliente_id, a); }
    return { clientes: c.data as Cliente[], resumen: r };
  });
  const lista = useMemo(() => {
    const n = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return (datos?.clientes ?? []).filter((c) => !q || n([c.nombre, c.contacto, c.telefono, c.email, c.nif].join(" ")).includes(n(q)));
  }, [datos, q]);

  return (
    <>
      <Cabecera titulo="Clientes" sub={datos ? `${datos.clientes.length} clientes` : undefined} acciones={<Boton variante="primario" onClick={() => setForm(true)}><Plus className="size-4" />Nuevo cliente</Boton>} />
      <input className="campo mb-4 sm:max-w-sm" placeholder="Buscar por nombre, contacto, teléfono, email o NIF" value={q} onChange={(e) => setQ(e.target.value)} />
      {!datos ? <Cargando /> : !datos.clientes.length ? (
        <div className="tarjeta"><Vacio icono={<Users className="size-5" />} titulo="Aún no hay clientes" texto="También puedes crearlos directamente al hacer un pedido." accion={<Boton variante="primario" onClick={() => setForm(true)}><Plus className="size-4" />Nuevo cliente</Boton>} /></div>
      ) : (
        <div className="tarjeta divide-y divide-borde">
          {!lista.length && <p className="py-10 text-center text-texto2">Sin resultados.</p>}
          {lista.map((c) => {
            const r = datos.resumen.get(c.id);
            return (
              <Link key={c.id} href={`/clientes/ver/?id=${c.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-suave/60">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-acento-suave text-[13px] font-semibold text-acento">{c.nombre.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.nombre}</span>
                  <span className="block truncate text-[13px] text-texto2">{[c.contacto, c.telefono, c.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}</span>
                </span>
                <span className="hidden text-right text-[13px] sm:block"><span className="num block font-medium">{euros(r?.t ?? 0)}</span><span className="text-texto2">{r?.n ?? 0} pedidos</span></span>
                <ChevronRight className="size-4 text-texto2" />
              </Link>
            );
          })}
        </div>
      )}
      <FormCliente abierto={form} cerrar={() => setForm(false)} guardado={recargar} />
    </>
  );
}
