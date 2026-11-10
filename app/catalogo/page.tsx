"use client";
import { useEffect, useState } from "react";
import { Camera, Loader2, Plus, Shirt, Trash2, Truck } from "lucide-react";
import { useSesion } from "@/components/sesion";
import { Cabecera } from "@/components/marco";
import { Boton, Campo, CampoImporte, Cargando, Hoja, Pestanas, Tarjeta, Vacio, cx, useAvisos } from "@/components/ui";
import { ImportarTarifa } from "@/components/importar-tarifa";
import { Muestra } from "@/components/muestra";
import { sb, subirArchivo, textoError } from "@/lib/supabase";
import { FotoPrenda } from "@/components/bloques-pedido";
import { useCarga } from "@/lib/usar";
import { TIPOS_PRENDA, type Prenda, type Proveedor, type TarifaFila } from "@/lib/tipos";

export default function Catalogo() {
  const [tab, setTab] = useState<"prendas" | "tarifas" | "proveedores">("prendas");
  useEffect(() => { const t = new URLSearchParams(location.search).get("tab"); if (t === "tarifas" || t === "proveedores") setTab(t); }, []);
  return (
    <>
      <Cabecera titulo="Catálogo" sub="Tus prendas habituales (★) salen primero al crear pedidos." />
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
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const { datos, recargar, setDatos, error } = useCarga(async () => ((await sb.from("catalogo").select("*").eq("empresa_id", empresa!.id).order("marca").order("modelo").limit(5000)).data ?? []) as Prenda[]);
  const n = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const cats = categorias(datos ?? []);
  const actual = cat && cats.some((c) => c.nombre === cat) ? cat : cats[0]?.nombre ?? null;
  const lista = (datos ?? []).filter((p) => (q ? n([p.marca, p.modelo, p.tipo, p.referencia].join(" ")).includes(n(q))
    : actual === HABITUALES ? p.favorito : categoria(p.tipo) === actual))
    .sort((a, b) => Number(b.favorito) - Number(a.favorito) || (a.modelo ?? "").localeCompare(b.modelo ?? "", "es")); // habituales primero
  const total = datos?.length ?? 0;

  async function estrella(p: Prenda) {
    setDatos((d) => d?.map((x) => (x.id === p.id ? { ...x, favorito: !x.favorito } : x)) ?? null);
    const { error } = await sb.from("catalogo").update({ favorito: !p.favorito }).eq("id", p.id);
    if (error) { aviso(textoError(error), "error"); recargar(); }
  }
  async function guardar(e: React.FormEvent) {
    e.preventDefault(); if (!ed) return; setGuardando(true);
    const fila = { tipo: ed.tipo || "Prenda", marca: ed.marca || null, modelo: ed.modelo || null, referencia: ed.referencia || null, colores: ed.colores ?? [], tallas: ed.tallas ?? [], proveedor_id: ed.proveedor_id || null, precio_compra: ed.precio_compra ?? 0, precio_venta: ed.precio_venta ?? null, notas: ed.notas || null, imagen_path: ed.imagen_path ?? null };
    const r = ed.id ? await sb.from("catalogo").update(fila).eq("id", ed.id) : await sb.from("catalogo").insert({ ...fila, empresa_id: empresa!.id, favorito: true });
    setGuardando(false);
    if (r.error) return aviso(textoError(r.error), "error");
    setEd(null); recargar(); aviso("Prenda guardada");
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className="campo w-full sm:w-auto sm:flex-1 sm:max-w-sm" placeholder={`Buscar en ${total} modelos…`} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex gap-2 sm:ml-auto">
          <ImportarTarifa hecho={recargar} />
          <Boton variante="primario" onClick={() => setEd({ tipo: "Camiseta", marca: "Roly", colores: [], tallas: [], precio_compra: 0, precio_venta: null })}><Plus className="size-4" />Añadir</Boton>
        </div>
      </div>
      {!q && cats.length > 0 && (
        <nav aria-label="Categorías" className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
          {cats.map((c) => (
            <button key={c.nombre} onClick={() => setCat(c.nombre)} aria-pressed={c.nombre === actual}
              className={cx("flex h-11 shrink-0 items-center gap-2 rounded-full px-[18px] text-[14px] font-semibold transition-colors",
                c.nombre === actual ? "bg-acento text-sobre-acento" : "bg-superficie text-texto hover:bg-acento-suave")}>
              {c.nombre === HABITUALES && <span aria-hidden="true" className={c.nombre === actual ? "" : "text-azul"}>★</span>}
              {c.nombre}<span className={cx("text-[12px] font-medium", c.nombre === actual ? "opacity-70" : "text-texto2")}>{c.n}</span>
            </button>
          ))}
        </nav>
      )}
      {!datos ? <Cargando error={error} reintentar={recargar} /> : !lista.length ? <div className="tarjeta"><Vacio icono={<Shirt className="size-5" />} titulo={q ? "Sin resultados" : "Aún no hay prendas"} texto={q ? undefined : "Añade una prenda o importa la tarifa de tu proveedor."} /></div> : (
        <>
          {q && <p className="mb-3 text-[13px] text-texto2">{lista.length} resultado{lista.length === 1 ? "" : "s"}</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 xl:gap-4">
            {lista.slice(0, 300).map((p) => (
              <article key={p.id} className="tarjeta relative flex flex-col gap-2.5 p-2.5">
                <button className="flex flex-col gap-2.5 text-left" onClick={() => setEd({ ...p, precio_compra: Number(p.precio_compra), precio_venta: p.precio_venta === null ? null : Number(p.precio_venta) })}>
                  <FotoPrenda path={p.imagen_path} tipo={p.tipo} color={p.colores[0] ?? ""} cubrir className="aspect-square w-full rounded-2xl" />
                  <span className="flex flex-col gap-1.5 px-1 pb-1">
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-bold">{p.modelo || p.tipo}</span>
                      <span className="block truncate text-[12px] text-texto2">{[p.referencia, p.marca !== "Roly" ? p.marca : null].filter(Boolean).join(" · ") || p.tipo}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      {p.colores.slice(0, 5).map((c) => <Muestra key={c} color={c} />)}
                      {p.colores.length > 5 && <span className="ml-0.5 text-[11px] text-texto2">+{p.colores.length - 5}</span>}
                      {!p.colores.length && <span className="text-[11px] text-texto2">Sin colores</span>}
                    </span>
                  </span>
                </button>
                <button aria-label={p.favorito ? "Quitar de habituales" : "Marcar como habitual"} title={p.favorito ? "Habitual" : "Marcar como habitual"} onClick={() => estrella(p)}
                  className={cx("absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-superficie text-[16px] shadow-sm", p.favorito ? "text-azul" : "text-texto2/50 hover:text-azul")}>{p.favorito ? "★" : "☆"}</button>
              </article>
            ))}
          </div>
          {lista.length > 300 && <p className="px-4 py-3 text-center text-[12px] text-texto2">Mostrando 300 de {lista.length}. Afina la búsqueda.</p>}
        </>
      )}
      <Hoja abierta={!!ed} cerrar={() => setEd(null)} titulo={ed?.id ? "Editar prenda" : "Nueva prenda"}
        pie={<>
          {ed?.id && <Boton variante="peligro" className="mr-auto" aria-label="Eliminar prenda" onClick={async () => { if (!(await confirmar({ titulo: "¿Quitar del catálogo?", ok: "Quitar", peligro: true }))) return; await sb.from("catalogo").delete().eq("id", ed.id!); setEd(null); recargar(); }}><Trash2 className="size-4" /></Boton>}
          <Boton onClick={() => setEd(null)}>Cancelar</Boton><Boton variante="primario" type="submit" form="f-prenda" cargando={guardando}>Guardar</Boton>
        </>}>
        {ed && (
          <form id="f-prenda" onSubmit={guardar} className="space-y-4">
            <label className="group relative mx-auto block w-fit cursor-pointer" title="Foto del producto">
              <FotoPrenda path={ed.imagen_path ?? null} tipo={ed.tipo ?? ""} color={ed.colores?.[0] ?? ""} className="size-36" />
              <span className="absolute bottom-2 right-2 grid size-9 place-items-center rounded-full bg-superficie text-texto2 shadow group-hover:text-azul">{subiendoFoto ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}</span>
              <input type="file" accept="image/*" className="sr-only" aria-label="Subir foto del producto" onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return; setSubiendoFoto(true);
                try { const path = await subirArchivo(empresa!.id, "catalogo", f); setEd((x) => (x ? { ...x, imagen_path: path } : x)); } catch (err) { aviso(textoError(err), "error"); } finally { setSubiendoFoto(false); }
              }} />
            </label>
            <p className="-mt-2 text-center text-[12px] text-texto2">Foto del producto: sale al elegir esta prenda en un pedido.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Marca"><input className="campo" value={ed.marca ?? ""} onChange={(e) => setEd({ ...ed, marca: e.target.value })} /></Campo>
              <Campo etiqueta="Modelo"><input className="campo" value={ed.modelo ?? ""} onChange={(e) => setEd({ ...ed, modelo: e.target.value })} /></Campo>
              <Campo etiqueta="Tipo de prenda"><input className="campo" list="tipos-cat" required value={ed.tipo ?? ""} onChange={(e) => setEd({ ...ed, tipo: e.target.value })} /></Campo>
              <Campo etiqueta="Referencia"><input className="campo uppercase" value={ed.referencia ?? ""} onChange={(e) => setEd({ ...ed, referencia: e.target.value })} /></Campo>
            </div>
            <datalist id="tipos-cat">{TIPOS_PRENDA.map((x) => <option key={x} value={x} />)}</datalist>
            <Campo etiqueta="Colores" ayuda="Separados por comas."><textarea className="campo" rows={2} value={(ed.colores ?? []).join(", ")} onChange={(e) => setEd({ ...ed, colores: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></Campo>
            <Campo etiqueta="Tallas" ayuda="Separadas por comas, en orden. Vacío = tallas estándar."><input className="campo" value={(ed.tallas ?? []).join(", ")} onChange={(e) => setEd({ ...ed, tallas: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></Campo>
            <Campo etiqueta="Proveedor">
              <select className="campo" value={ed.proveedor_id ?? ""} onChange={(e) => setEd({ ...ed, proveedor_id: e.target.value || null })}>
                <option value="">—</option>{proveedores.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Notas"><input className="campo" value={ed.notas ?? ""} onChange={(e) => setEd({ ...ed, notas: e.target.value })} /></Campo>
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



const HABITUALES = "Habituales";
/** Categoría del menú según el tipo de prenda */
function categoria(tipo?: string | null): string {
  const t = (tipo ?? "").toLowerCase();
  if (/body|beb/.test(t)) return "Bebé";
  if (/polo/.test(t)) return "Polos";
  if (/chaleco/.test(t)) return "Chalecos";
  if (/softshell/.test(t)) return "Softshell";
  if (/polar/.test(t)) return "Polares";
  if (/sudadera/.test(t)) return "Sudaderas";
  if (/chaqueta|cazadora|abrigo|parka/.test(t)) return "Chaquetas";
  if (/camiseta|tirantes/.test(t)) return "Camisetas";
  return "Otras";
}
const ORDEN_CATS = ["Camisetas", "Polos", "Sudaderas", "Chaquetas", "Polares", "Softshell", "Chalecos", "Bebé", "Otras"];
/** Chips del menú: Habituales (si hay) y las categorías con prendas, con su número */
function categorias(ps: Prenda[]): { nombre: string; n: number }[] {
  const cuenta = new Map<string, number>();
  for (const p of ps) cuenta.set(categoria(p.tipo), (cuenta.get(categoria(p.tipo)) ?? 0) + 1);
  const fav = ps.filter((p) => p.favorito).length;
  return [...(fav ? [{ nombre: HABITUALES, n: fav }] : []), ...ORDEN_CATS.filter((c) => cuenta.has(c)).map((c) => ({ nombre: c, n: cuenta.get(c)! }))];
}
