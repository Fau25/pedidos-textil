"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useSesion } from "./sesion";
import { Boton, CampoImporte, Tarjeta, useAvisos } from "./ui";
import { borrarConDeshacer, sb, textoError } from "@/lib/supabase";
import type { TarifaFila } from "@/lib/tipos";

/** Técnicas de personalización y sus tarifas por número de prendas */
export function Tarifas() {
  const { tecnicas, tarifas, recargar, empresa } = useSesion();
  const { aviso, confirmar } = useAvisos();
  const [filas, setFilas] = useState<TarifaFila[]>(tarifas);
  const [nueva, setNueva] = useState("");
  useEffect(() => setFilas(tarifas), [tarifas]);

  const actualizar = async (t: TarifaFila, c: Partial<TarifaFila>) => {
    setFilas((f) => f.map((x) => (x.id === t.id ? { ...x, ...c } : x)));
    const { error } = await sb.from("tarifas").update(c).eq("id", t.id);
    if (error) aviso(textoError(error), "error"); else recargar();
  };

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-texto2">El precio de cada personalización se elige solo según el número de prendas del pedido. Siempre puedes cambiarlo a mano en el pedido.</p>
      {tecnicas.map((tc) => {
        const tf = filas.filter((x) => x.tecnica_id === tc.id).sort((a, b) => a.desde - b.desde);
        return (
          <Tarjeta key={tc.id} titulo={tc.nombre} accion={<Boton tam="s" variante="fantasma" className="hover:text-red-600" aria-label={`Quitar ${tc.nombre}`} onClick={async () => {
            if (!(await confirmar({ titulo: `¿Quitar la técnica ${tc.nombre}?`, texto: "Las personalizaciones ya hechas conservan su nombre y precio.", ok: "Quitar", peligro: true }))) return;
            const { error } = await sb.from("tecnicas").delete().eq("id", tc.id); if (error) aviso(textoError(error), "error"); else recargar();
          }}><Trash2 className="size-4" /></Boton>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[440px] text-[13px]">
                <thead className="text-left text-[12px] text-texto2"><tr><th className="pb-2 font-medium">Desde (uds)</th><th className="pb-2 font-medium">Hasta</th><th className="pb-2 font-medium">Complejidad</th><th className="pb-2 font-medium">Precio / ud</th><th /></tr></thead>
                <tbody>
                  {tf.map((t) => (
                    <tr key={t.id}>
                      <td className="py-1 pr-2"><input type="number" min={1} className="campo num h-9 w-20" defaultValue={t.desde} onBlur={(e) => actualizar(t, { desde: Math.max(1, Number(e.target.value) || 1) })} aria-label="Desde unidades" /></td>
                      <td className="py-1 pr-2"><input type="number" min={1} className="campo num h-9 w-20" placeholder="∞" defaultValue={t.hasta ?? ""} onBlur={(e) => actualizar(t, { hasta: e.target.value ? Number(e.target.value) : null })} aria-label="Hasta unidades" /></td>
                      <td className="py-1 pr-2"><input className="campo h-9 w-28" defaultValue={t.complejidad} onBlur={(e) => actualizar(t, { complejidad: e.target.value || "Normal" })} aria-label="Complejidad" /></td>
                      <td className="py-1 pr-2"><CampoImporte className="w-28" valor={t.precio} cambiar={(v) => setFilas((f) => f.map((x) => (x.id === t.id ? { ...x, precio: v ?? 0 } : x)))} aria-label="Precio" /></td>
                      <td className="py-1 text-right">
                        {tarifas.some((o) => o.id === t.id && o.precio !== t.precio) &&
                          <button className="mr-1 text-[12px] font-medium text-azul" onClick={() => { actualizar(t, { precio: t.precio }); aviso("Tarifa guardada"); }}>Guardar</button>}
                        <button aria-label="Quitar tramo" className="p-1 text-texto2 hover:text-red-600" onClick={() => borrarConDeshacer("tarifas", t, "Tramo quitado", aviso, recargar)}><Trash2 className="size-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Boton tam="s" className="mt-3" onClick={async () => {
              const ult = tf[tf.length - 1];
              const { error } = await sb.from("tarifas").insert({ tecnica_id: tc.id, desde: ult ? (ult.hasta ?? ult.desde) + 1 : 1, hasta: null, coste: 0, precio: 0 });
              if (error) aviso(textoError(error), "error"); else recargar();
            }}><Plus className="size-3.5" />Añadir tramo</Boton>
          </Tarjeta>
        );
      })}
      <form className="tarjeta flex gap-2 p-4" onSubmit={async (e) => {
        e.preventDefault(); if (!nueva.trim()) return;
        const { error } = await sb.from("tecnicas").insert({ empresa_id: empresa!.id, nombre: nueva.trim(), orden: tecnicas.length + 1 });
        if (error) return aviso(textoError(error), "error");
        setNueva(""); recargar(); aviso("Técnica añadida");
      }}>
        <input className="campo" placeholder="Nueva técnica (p. ej. Sublimación, Transfer…)" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <Boton type="submit"><Plus className="size-4" />Añadir</Boton>
      </form>
    </div>
  );
}

