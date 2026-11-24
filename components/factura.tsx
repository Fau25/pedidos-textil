"use client";
import { useEffect, useMemo, useState } from "react";
import { FileText, Plus, Trash2, X } from "lucide-react";
import { Boton, CampoImporte, Hoja, useAvisos } from "@/components/ui";
import { Ticket } from "@/components/ticket";
import { sb, textoError } from "@/lib/supabase";
import { useSesion } from "@/components/sesion";
import { borrarDocumento, crearDocumento, facturaComoDoc, facturarPresupuesto, guardarDocumento, recalcular, type Documento, type TipoDocumento } from "@/lib/facturas";
import type { DatosPresupuesto } from "@/lib/tipos";

const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const etq = "mb-1 block text-[12px] font-medium text-texto2";

const NOMBRE: Record<TipoDocumento, string> = { factura: "factura", presupuesto: "presupuesto" };

/** Ver una factura o presupuesto (vista, enviar, PDF) con la opción de modificarlo o borrarlo.
 *  Un presupuesto se puede convertir en factura. */
export function VerDocumento({ tipo, f, abierto, cerrar, cambiar, borrada, facturado }: { tipo: TipoDocumento; f: Documento | null; abierto: boolean; cerrar: () => void; cambiar: (f: Documento) => void; borrada?: () => void; facturado?: (factura: Documento) => void }) {
  const { empresa } = useSesion();
  const { aviso, confirmar } = useAvisos();
  const [editando, setEditando] = useState(false);
  const [facturando, setFacturando] = useState(false);
  const doc = useMemo(() => (f ? facturaComoDoc(f) : null), [f]); // estable: el PDF se prepara una sola vez
  async function aFactura() {
    if (!f || !empresa) return;
    if (!(await confirmar({ titulo: `¿Convertir ${f.numero} en factura?`, texto: "Se crea una factura con los mismos datos y el número siguiente. El presupuesto se queda como está.", ok: "Crear factura" }))) return;
    setFacturando(true);
    try { const n = await facturarPresupuesto(empresa.id, f); cambiar({ ...f, factura_id: n.id }); aviso(`Factura ${n.numero} creada`); facturado?.(n); }
    catch (e) { aviso(textoError(e), "error"); } finally { setFacturando(false); }
  }
  return (
    <>
      <Ticket tipo={tipo} abierto={abierto && !editando} cerrar={cerrar} p={abierto ? doc : null} editar={() => setEditando(true)}
        acciones={tipo === "presupuesto" && f && !f.factura_id ? <Boton className="w-full" cargando={facturando} onClick={aFactura}><FileText className="size-4" />Convertir en factura</Boton> : undefined} />
      <EditarDocumento tipo={tipo} f={f} abierta={abierto && editando} cerrar={() => setEditando(false)}
        guardada={(n) => { cambiar(n); setEditando(false); }} borrada={() => { setEditando(false); cerrar(); borrada?.(); }} />
    </>
  );
}
export const VerFactura = (p: { f: Documento | null; abierto: boolean; cerrar: () => void; cambiar: (f: Documento) => void; borrada?: () => void }) => <VerDocumento tipo="factura" {...p} />;

/** Crear o modificar una factura o presupuesto: número, fecha, cliente, conceptos, gastos, descuento, IVA y tus datos.
 *  Sin «id» es uno nuevo: al guardar recibe el número siguiente (o el que se escriba). */
export function EditarDocumento({ tipo, f, abierta, cerrar, guardada, borrada }: { tipo: TipoDocumento; f: Documento | null; abierta: boolean; cerrar: () => void; guardada: (f: Documento) => void; borrada: () => void }) {
  const { empresa } = useSesion();
  const { aviso, confirmar } = useAvisos();
  const [x, setX] = useState<Documento | null>(null);
  const [clientes, setClientes] = useState<{ nombre: string; nif: string | null; telefono: string | null; direccion: string | null; email: string | null }[]>([]);
  const nuevo = !f?.id;
  const nombre = NOMBRE[tipo];
  // Tus clientes, para rellenar sus datos al escribir el nombre
  useEffect(() => {
    if (!abierta || !empresa) return;
    sb.from("clientes").select("nombre, nif, telefono, direccion, email").eq("empresa_id", empresa.id).order("nombre").limit(2000)
      .then(({ data }) => setClientes((data ?? []) as typeof clientes));
  }, [abierta, empresa]);
  const [ocupado, setOcupado] = useState<"" | "guardar" | "borrar">("");
  // Al abrir: copia editable, con prendas y personalizaciones juntas como «conceptos»
  useEffect(() => {
    if (abierta && f) setX({ ...f, datos: { ...f.datos, cliente: { ...(f.datos.cliente ?? {}) }, empresa: { ...f.datos.empresa }, lineas: [...f.datos.lineas, ...f.datos.personalizaciones].map((l) => ({ ...l })), personalizaciones: [] } });
  }, [abierta, f]);
  if (!x) return null;
  const d = recalcular(x.datos);
  const setD = (c: Partial<DatosPresupuesto>) => setX({ ...x, datos: { ...x.datos, ...c } });
  const setCli = (c: Record<string, string>) => setD({ cliente: { ...(x.datos.cliente ?? {}), ...c } });
  const setEmp = (c: Record<string, string>) => setD({ empresa: { ...x.datos.empresa, ...c } });
  const setLinea = (i: number, c: Partial<DatosPresupuesto["lineas"][number]>) => setD({ lineas: x.datos.lineas.map((l, j) => (j === i ? { ...l, ...c } : l)) });

  async function guardar() {
    if (!nuevo && !x!.numero.trim()) return aviso(`Pon un número de ${nombre}`, "error");
    if (!x!.datos.cliente?.nombre?.trim()) return aviso("Escribe el nombre del cliente", "error");
    if (!x!.datos.lineas.some((l) => l.descripcion.trim())) return aviso("Añade al menos un concepto", "error");
    setOcupado("guardar");
    try {
      const limpio = { ...x!, datos: { ...x!.datos, lineas: x!.datos.lineas.filter((l) => l.descripcion.trim() || Number(l.precio)) } };
      const n = nuevo ? await crearDocumento(tipo, empresa!.id, limpio) : await guardarDocumento(tipo, limpio);
      guardada(n); aviso(`${tipo === "factura" ? "Factura" : "Presupuesto"} ${n.numero} ${nuevo ? "creado" : "guardado"}`.replace(/o$/, tipo === "factura" ? "a" : "o"));
    } catch (e) { aviso(textoError(e), "error"); } finally { setOcupado(""); }
  }
  async function borrar() {
    const texto = tipo === "factura"
      ? (x!.pedido_id ? "Desaparece de tus facturas. El pedido se queda como está y podrás volver a facturarlo (con el número siguiente)." : "Desaparece de tus facturas.")
      : "Desaparece de tus presupuestos.";
    if (!(await confirmar({ titulo: `¿Borrar ${tipo === "factura" ? "la factura" : "el presupuesto"} ${x!.numero}?`, texto, ok: `Borrar ${nombre}`, peligro: true }))) return;
    setOcupado("borrar");
    try { await borrarDocumento(tipo, x!.id); aviso(`${tipo === "factura" ? "Factura" : "Presupuesto"} ${x!.numero} borrad${tipo === "factura" ? "a" : "o"}`); borrada(); }
    catch (e) { aviso(textoError(e), "error"); } finally { setOcupado(""); }
  }
  // Al escribir el nombre de un cliente tuyo, se rellenan sus datos (si están vacíos)
  function nombreCliente(v: string) {
    const c = clientes.find((k) => k.nombre.toLowerCase() === v.trim().toLowerCase());
    const actual = x!.datos.cliente ?? {};
    setCli(c ? { nombre: v, nif: actual.nif || c.nif || "", telefono: actual.telefono || c.telefono || "", direccion: actual.direccion || c.direccion || "", email: actual.email || c.email || "" } : { nombre: v });
  }

  return (
    <Hoja abierta={abierta} cerrar={cerrar} titulo={nuevo ? `Nuevo ${tipo === "factura" ? "factura" : "presupuesto"}`.replace("Nuevo factura", "Nueva factura") : `Modificar ${nombre} ${f?.numero ?? ""}`} ancho="max-w-xl"
      pie={<div className="flex gap-2">
        {!nuevo && <Boton onClick={borrar} cargando={ocupado === "borrar"} disabled={!!ocupado} aria-label={`Borrar ${nombre}`} className="text-red-600"><Trash2 className="size-4" /></Boton>}
        <Boton className="flex-1" onClick={cerrar} disabled={!!ocupado}>Cancelar</Boton>
        <Boton className="flex-[2]" variante="primario" cargando={ocupado === "guardar"} disabled={!!ocupado} onClick={guardar}>{nuevo ? `Crear ${nombre}` : "Guardar cambios"}</Boton>
      </div>}>
      <div className="space-y-5 text-[14px]">
        <section className="grid grid-cols-2 gap-3">
          <label><span className={etq}>Nº de {nombre}</span><input className="campo num font-semibold" placeholder={nuevo ? "Automático" : ""} value={x.numero} onChange={(e) => setX({ ...x, numero: e.target.value })} /></label>
          <label><span className={etq}>Fecha</span><input className="campo" type="date" value={x.fecha} onChange={(e) => setX({ ...x, fecha: e.target.value || x.fecha })} /></label>
          {nuevo && <p className="col-span-2 -mt-1 text-[12px] text-texto2">Déjalo vacío y se pone el número siguiente; o escribe el que quieras.</p>}
          {tipo === "presupuesto" && <label className="col-span-2"><span className={etq}>Válido hasta</span><input className="campo" type="date" value={x.validez ?? ""} onChange={(e) => setX({ ...x, validez: e.target.value || null })} /></label>}
        </section>

        <section>
          <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[.06em] text-texto2">Cliente</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2"><span className={etq}>Nombre o empresa</span><input className="campo" list="clientes-doc" value={x.datos.cliente?.nombre ?? ""} onChange={(e) => nombreCliente(e.target.value)} />
              <datalist id="clientes-doc">{clientes.map((c) => <option key={c.nombre} value={c.nombre} />)}</datalist></label>
            <label><span className={etq}>NIF / CIF</span><input className="campo" value={x.datos.cliente?.nif ?? ""} onChange={(e) => setCli({ nif: e.target.value })} /></label>
            <label><span className={etq}>Teléfono</span><input className="campo" type="tel" value={x.datos.cliente?.telefono ?? ""} onChange={(e) => setCli({ telefono: e.target.value })} /></label>
            <label className="col-span-2"><span className={etq}>Dirección</span><textarea className="campo min-h-[60px] py-2.5" rows={2} value={x.datos.cliente?.direccion ?? ""} onChange={(e) => setCli({ direccion: e.target.value })} /></label>
            <label className="col-span-2"><span className={etq}>Email</span><input className="campo" type="email" value={x.datos.cliente?.email ?? ""} onChange={(e) => setCli({ email: e.target.value })} /></label>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[.06em] text-texto2">Conceptos</h3>
          <ul className="space-y-2.5">
            {x.datos.lineas.map((l, i) => (
              <li key={i} className="rounded-2xl border border-borde p-3" aria-label={`Concepto ${i + 1}`}>
                <div className="flex gap-2">
                  <input className="campo flex-1 font-medium" placeholder="Descripción" aria-label="Descripción" value={l.descripcion} onChange={(e) => setLinea(i, { descripcion: e.target.value })} />
                  <button type="button" aria-label={`Quitar concepto ${i + 1}`} onClick={() => setD({ lineas: x.datos.lineas.filter((_, j) => j !== i) })} className="grid size-11 shrink-0 place-items-center rounded-full text-texto2 hover:text-red-600"><X className="size-4" /></button>
                </div>
                <input className="campo mt-2 text-[13px]" placeholder="Detalle (opcional): tallas, color, ubicación…" aria-label="Detalle" value={l.detalle} onChange={(e) => setLinea(i, { detalle: e.target.value })} />
                <div className="mt-2 grid grid-cols-[80px_1fr_auto] items-end gap-2">
                  <label><span className={etq}>Uds</span><input className="campo num text-center" type="number" inputMode="decimal" min={0} value={l.unidades || ""} onChange={(e) => setLinea(i, { unidades: Number(e.target.value) || 0 })} /></label>
                  <label><span className={etq}>Precio/ud</span><CampoImporte valor={l.precio || null} cambiar={(v) => setLinea(i, { precio: v ?? 0 })} aria-label="Precio por unidad" /></label>
                  <p className="num pb-3 text-right font-semibold">{eur(d.lineas[i]?.importe ?? 0)}</p>
                </div>
              </li>
            ))}
          </ul>
          <Boton className="mt-2.5 w-full" onClick={() => setD({ lineas: [...x.datos.lineas, { descripcion: "", detalle: "", unidades: 1, precio: 0, importe: 0 }] })}><Plus className="size-4" />Añadir concepto</Boton>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <label><span className={etq}>Otros gastos</span><CampoImporte valor={x.datos.gastos || null} cambiar={(v) => setD({ gastos: v ?? 0 })} aria-label="Otros gastos" /></label>
          <label><span className={etq}>Descuento %</span><input className="campo num" type="number" inputMode="decimal" min={0} max={100} value={x.datos.descuento_pct || ""} onChange={(e) => setD({ descuento_pct: Number(e.target.value) || 0 })} /></label>
          <label><span className={etq}>IVA %</span><input className="campo num" type="number" inputMode="decimal" min={0} value={x.datos.iva_pct ?? 0} onChange={(e) => setD({ iva_pct: Number(e.target.value) || 0 })} /></label>
        </section>

        <section className="resumen-oscuro tarjeta p-4 text-[13.5px]" aria-label="Totales">
          {d.descuento > 0 && <p className="flex justify-between text-white/70"><span>Descuento {d.descuento_pct} %</span><span className="num">−{eur(d.descuento)}</span></p>}
          <p className="flex justify-between text-white/70"><span>Base imponible</span><span className="num">{eur(d.base)}</span></p>
          <p className="flex justify-between text-white/70"><span>IVA {d.iva_pct} %</span><span className="num">{eur(d.iva)}</span></p>
          <p className="mt-2 flex items-end justify-between border-t border-white/20 pt-2"><span>Total</span><span className="num text-[24px] font-semibold">{eur(d.total)}</span></p>
        </section>

        {tipo === "presupuesto" && (
          <label className="block"><span className={etq}>Condiciones (plazo, forma de pago…)</span>
            <textarea className="campo min-h-[72px] py-2.5" rows={3} value={x.datos.condiciones ?? ""} onChange={(e) => setD({ condiciones: e.target.value || null })} /></label>
        )}

        <details className="rounded-2xl border border-borde p-3">
          <summary className="cursor-pointer text-[13px] font-semibold">Tus datos en {tipo === "factura" ? "esta factura" : "este presupuesto"}</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="col-span-2"><span className={etq}>Nombre del taller</span><input className="campo" value={x.datos.empresa.nombre ?? ""} onChange={(e) => setEmp({ nombre: e.target.value })} /></label>
            <label><span className={etq}>NIF</span><input className="campo" value={x.datos.empresa.nif ?? ""} onChange={(e) => setEmp({ nif: e.target.value })} /></label>
            <label><span className={etq}>Teléfono</span><input className="campo" value={x.datos.empresa.telefono ?? ""} onChange={(e) => setEmp({ telefono: e.target.value })} /></label>
            <label className="col-span-2"><span className={etq}>Dirección</span><textarea className="campo min-h-[60px] py-2.5" rows={2} value={x.datos.empresa.direccion ?? ""} onChange={(e) => setEmp({ direccion: e.target.value })} /></label>
          </div>
        </details>
      </div>
    </Hoja>
  );
}
