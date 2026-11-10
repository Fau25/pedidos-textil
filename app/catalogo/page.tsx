"use client";
import { useEffect, useState } from "react";
import { Plus, Shirt, Trash2, Truck } from "lucide-react";
import { useSesion } from "@/components/sesion";
import { Cabecera } from "@/components/marco";
import { Boton, Campo, CampoImporte, Cargando, Hoja, Pestanas, Tarjeta, Vacio, useAvisos } from "@/components/ui";
import { sb, textoError } from "@/lib/supabase";
import { useCarga } from "@/lib/usar";
import { euros, precioVentaUd } from "@/lib/calculo";
import { TIPOS_PRENDA, type Prenda, type Proveedor, type TarifaFila } from "@/lib/tipos";

export default function Catalogo() {
  const [tab, setTab] = useState<"prendas" | "tarifas" | "proveedores">("prendas");
  useEffect(() => { const t = new URLSearchParams(location.search).get("tab"); if (t === "tarifas" || t === "proveedores") setTab(t); }, []);
  return (
    <>
      <Cabecera titulo="Catálogo" sub="Prendas habituales, tarifas de personalización y proveedores: se usan al crear pedidos." />
      <Pestanas valor={tab} cambiar={setTab} opciones={[{ v: "prendas", t: "Prendas" }, { v: "tarifas", t: "Técnicas y tarifas" }, { v: "proveedores", t: "Proveedores" }]} />
      <div className="mt-5">{tab === "prendas" ? <Prendas /> : tab === "tarifas" ? <Tarifas /> : <Proveedores />}</div>
    </>
  );
}

function Prendas() {
  const { empresa, proveedores } = useSesion();
  const { aviso, confirmar } = useAvisos();
  const [ed, setEd] = useState<Partial<Prenda> | null>(null);
  const [guardando, setGuardando] = useState(false);
  const { datos, recargar } = useCarga(async () => ((await sb.from("catalogo").select("*").eq("empresa_id", empresa!.id).order("tipo")).data ?? []) as Prenda[]);
  const margen = Number(empresa!.margen);

  async function guardar(e: React.FormEvent) {
    e.preventDefault(); if (!ed) return; setGuardando(true);
    const fila = { tipo: ed.tipo || "Prenda", marca: ed.marca || null, modelo: ed.modelo || null, colores: ed.colores ?? [], proveedor_id: ed.proveedor_id || null, precio_compra: ed.precio_compra ?? 0, precio_venta: ed.precio_venta ?? null, notas: ed.notas || null };
    const r = ed.id ? await sb.from("catalogo").update(fila).eq("id", ed.id) : await sb.from("catalogo").insert({ ...fila, empresa_id: empresa!.id });
    setGuardando(false);
    if (r.error) return aviso(textoError(r.error), "error");
    setEd(null); recargar(); aviso("Prenda guardada");
  }

  return (
    <>
      <div className="mb-4 flex justify-end"><Boton variante="primario" onClick={() => setEd({ tipo: "Camiseta", colores: [], precio_compra: 0, precio_venta: null })}><Plus className="size-4" />Añadir prenda</Boton></div>
      {!datos ? <Cargando /> : !datos.length ? <div className="tarjeta"><Vacio icono={<Shirt className="size-5" />} titulo="Catálogo vacío" texto="Guarda aquí las prendas que más usas con sus precios: al hacer un pedido se añaden con un clic." /></div> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {datos.map((p) => (
            <button key={p.id} onClick={() => setEd({ ...p, precio_compra: Number(p.precio_compra), precio_venta: p.precio_venta === null ? null : Number(p.precio_venta) })} className="tarjeta p-4 text-left hover:shadow-md">
              <p className="font-medium">{p.tipo}</p>
              <p className="text-[13px] text-texto2">{[p.marca, p.modelo].filter(Boolean).join(" · ") || "—"}</p>
              <p className="num mt-2 text-[13px]">{euros(Math.round(Number(p.precio_compra) * 100))} <span className="text-texto2">→</span> <b>{euros(precioVentaUd({ precio_compra: Number(p.precio_compra), precio_venta: p.precio_venta === null ? null : Number(p.precio_venta) }, margen))}</b></p>
              {!!p.colores.length && <p className="mt-1 truncate text-[12px] text-texto2">{p.colores.join(", ")}</p>}
            </button>
          ))}
        </div>
      )}
      <Hoja abierta={!!ed} cerrar={() => setEd(null)} titulo={ed?.id ? "Editar prenda" : "Nueva prenda"}
        pie={<>
          {ed?.id && <Boton variante="peligro" className="mr-auto" onClick={async () => { if (!(await confirmar({ titulo: "¿Quitar del catálogo?", ok: "Quitar", peligro: true }))) return; await sb.from("catalogo").delete().eq("id", ed.id!); setEd(null); recargar(); }}><Trash2 className="size-4" /></Boton>}
          <Boton onClick={() => setEd(null)}>Cancelar</Boton><Boton variante="primario" type="submit" form="f-prenda" cargando={guardando}>Guardar</Boton>
        </>}>
        {ed && (
          <form id="f-prenda" onSubmit={guardar} className="space-y-4">
            <Campo etiqueta="Tipo de prenda"><input className="campo" list="tipos-cat" required value={ed.tipo ?? ""} onChange={(e) => setEd({ ...ed, tipo: e.target.value })} /></Campo>
            <datalist id="tipos-cat">{TIPOS_PRENDA.map((x) => <option key={x} value={x} />)}</datalist>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Marca"><input className="campo" value={ed.marca ?? ""} onChange={(e) => setEd({ ...ed, marca: e.target.value })} /></Campo>
              <Campo etiqueta="Modelo / referencia"><input className="campo" value={ed.modelo ?? ""} onChange={(e) => setEd({ ...ed, modelo: e.target.value })} /></Campo>
            </div>
            <Campo etiqueta="Colores disponibles" ayuda="Separados por comas."><input className="campo" value={(ed.colores ?? []).join(", ")} onChange={(e) => setEd({ ...ed, colores: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></Campo>
            <Campo etiqueta="Proveedor">
              <select className="campo" value={ed.proveedor_id ?? ""} onChange={(e) => setEd({ ...ed, proveedor_id: e.target.value || null })}>
                <option value="">—</option>{proveedores.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select>
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Precio de compra"><CampoImporte valor={ed.precio_compra ?? 0} cambiar={(v) => setEd({ ...ed, precio_compra: v ?? 0 })} /></Campo>
              <Campo etiqueta="Precio de venta" ayuda={`Vacío = compra + ${margen} %`}><CampoImporte valor={ed.precio_venta ?? null} cambiar={(v) => setEd({ ...ed, precio_venta: v })} /></Campo>
            </div>
          </form>
        )}
      </Hoja>
    </>
  );
}

function Tarifas() {
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
              <table className="w-full min-w-[520px] text-[13px]">
                <thead className="text-left text-[12px] text-texto2"><tr><th className="pb-2 font-medium">Desde</th><th className="pb-2 font-medium">Hasta</th><th className="pb-2 font-medium">Complejidad</th><th className="pb-2 font-medium">Coste / ud</th><th className="pb-2 font-medium">Precio / ud</th><th /></tr></thead>
                <tbody>
                  {tf.map((t) => (
                    <tr key={t.id}>
                      <td className="py-1 pr-2"><input type="number" min={1} className="campo num h-9 w-20" defaultValue={t.desde} onBlur={(e) => actualizar(t, { desde: Math.max(1, Number(e.target.value) || 1) })} aria-label="Desde unidades" /></td>
                      <td className="py-1 pr-2"><input type="number" min={1} className="campo num h-9 w-20" placeholder="∞" defaultValue={t.hasta ?? ""} onBlur={(e) => actualizar(t, { hasta: e.target.value ? Number(e.target.value) : null })} aria-label="Hasta unidades" /></td>
                      <td className="py-1 pr-2"><input className="campo h-9 w-28" defaultValue={t.complejidad} onBlur={(e) => actualizar(t, { complejidad: e.target.value || "Normal" })} aria-label="Complejidad" /></td>
                      <td className="py-1 pr-2"><CampoImporte className="w-28" valor={t.coste} cambiar={(v) => setFilas((f) => f.map((x) => (x.id === t.id ? { ...x, coste: v ?? 0 } : x)))} aria-label="Coste" /></td>
                      <td className="py-1 pr-2"><CampoImporte className="w-28" valor={t.precio} cambiar={(v) => setFilas((f) => f.map((x) => (x.id === t.id ? { ...x, precio: v ?? 0 } : x)))} aria-label="Precio" /></td>
                      <td className="py-1 text-right">
                        {tarifas.some((o) => o.id === t.id && (o.coste !== t.coste || o.precio !== t.precio)) &&
                          <button className="mr-1 text-[12px] font-medium text-acento" onClick={() => { actualizar(t, { coste: t.coste, precio: t.precio }); aviso("Tarifa guardada"); }}>Guardar</button>}
                        <button aria-label="Quitar tramo" className="p-1 text-texto2 hover:text-red-600" onClick={async () => { await sb.from("tarifas").delete().eq("id", t.id); recargar(); }}><Trash2 className="size-3.5" /></button>
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

function Proveedores() {
  const { empresa, proveedores, recargar } = useSesion();
  const { aviso, confirmar } = useAvisos();
  const [ed, setEd] = useState<Partial<Proveedor> | null>(null);
  return (
    <>
      <div className="mb-4 flex justify-end"><Boton variante="primario" onClick={() => setEd({})}><Plus className="size-4" />Añadir proveedor</Boton></div>
      {!proveedores.length ? <div className="tarjeta"><Vacio icono={<Truck className="size-5" />} titulo="Sin proveedores" texto="Las compras y recepciones por proveedor llegan en la Fase 2." /></div> : (
        <div className="tarjeta divide-y divide-borde">
          {proveedores.map((p) => (
            <button key={p.id} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-suave/60" onClick={() => setEd(p)}>
              <span className="flex-1"><span className="block font-medium">{p.nombre}</span><span className="text-[13px] text-texto2">{[p.contacto, p.telefono, p.email, p.web].filter(Boolean).join(" · ") || "—"}</span></span>
            </button>
          ))}
        </div>
      )}
      <Hoja abierta={!!ed} cerrar={() => setEd(null)} titulo={ed?.id ? "Editar proveedor" : "Nuevo proveedor"}
        pie={<>
          {ed?.id && <Boton variante="peligro" className="mr-auto" aria-label="Eliminar proveedor" onClick={async () => { if (!(await confirmar({ titulo: "¿Eliminar proveedor?", ok: "Eliminar", peligro: true }))) return; await sb.from("proveedores").delete().eq("id", ed.id!); setEd(null); recargar(); }}><Trash2 className="size-4" /></Boton>}
          <Boton onClick={() => setEd(null)}>Cancelar</Boton><Boton variante="primario" type="submit" form="f-prov">Guardar</Boton>
        </>}>
        {ed && (
          <form id="f-prov" className="space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            const fila = { nombre: ed.nombre?.trim() || "Proveedor", contacto: ed.contacto || null, telefono: ed.telefono || null, email: ed.email || null, web: ed.web || null, notas: ed.notas || null };
            const r = ed.id ? await sb.from("proveedores").update(fila).eq("id", ed.id) : await sb.from("proveedores").insert({ ...fila, empresa_id: empresa!.id });
            if (r.error) return aviso(textoError(r.error), "error");
            setEd(null); recargar(); aviso("Proveedor guardado");
          }}>
            <Campo etiqueta="Nombre"><input className="campo" required value={ed.nombre ?? ""} onChange={(e) => setEd({ ...ed, nombre: e.target.value })} /></Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Contacto"><input className="campo" value={ed.contacto ?? ""} onChange={(e) => setEd({ ...ed, contacto: e.target.value })} /></Campo>
              <Campo etiqueta="Teléfono"><input className="campo" type="tel" value={ed.telefono ?? ""} onChange={(e) => setEd({ ...ed, telefono: e.target.value })} /></Campo>
              <Campo etiqueta="Email"><input className="campo" type="email" value={ed.email ?? ""} onChange={(e) => setEd({ ...ed, email: e.target.value })} /></Campo>
              <Campo etiqueta="Web"><input className="campo" value={ed.web ?? ""} onChange={(e) => setEd({ ...ed, web: e.target.value })} /></Campo>
            </div>
            <Campo etiqueta="Observaciones"><textarea className="campo" rows={2} value={ed.notas ?? ""} onChange={(e) => setEd({ ...ed, notas: e.target.value })} /></Campo>
          </form>
        )}
      </Hoja>
    </>
  );
}
