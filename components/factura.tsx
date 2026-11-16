"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Boton, CampoImporte, Hoja, useAvisos } from "@/components/ui";
import { Ticket } from "@/components/ticket";
import { textoError } from "@/lib/supabase";
import { borrarFactura, facturaComoDoc, guardarFactura, recalcular, type Factura } from "@/lib/facturas";
import type { DatosPresupuesto } from "@/lib/tipos";

const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const etq = "mb-1 block text-[12px] font-medium text-texto2";

/** Ver una factura (vista, enviar, PDF) con la opción de modificarla o borrarla */
export function VerFactura({ f, abierto, cerrar, cambiar, borrada }: { f: Factura | null; abierto: boolean; cerrar: () => void; cambiar: (f: Factura) => void; borrada?: () => void }) {
  const [editando, setEditando] = useState(false);
  const doc = useMemo(() => (f ? facturaComoDoc(f) : null), [f]); // estable: el PDF se prepara una sola vez
  return (
    <>
      <Ticket tipo="factura" abierto={abierto && !editando} cerrar={cerrar} p={abierto ? doc : null} editar={() => setEditando(true)} />
      <EditarFactura f={f} abierta={abierto && editando} cerrar={() => setEditando(false)}
        guardada={(n) => { cambiar(n); setEditando(false); }} borrada={() => { setEditando(false); cerrar(); borrada?.(); }} />
    </>
  );
}

/** Modificar todos los datos de una factura: número, fecha, cliente, conceptos, gastos, descuento, IVA y tus datos */
export function EditarFactura({ f, abierta, cerrar, guardada, borrada }: { f: Factura | null; abierta: boolean; cerrar: () => void; guardada: (f: Factura) => void; borrada: () => void }) {
  const { aviso, confirmar } = useAvisos();
  const [x, setX] = useState<Factura | null>(null);
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
    if (!x!.numero.trim()) return aviso("Pon un número de factura", "error");
    setOcupado("guardar");
    try { const n = await guardarFactura(x!); guardada(n); aviso(`Factura ${n.numero} guardada`); }
    catch (e) { aviso(textoError(e), "error"); } finally { setOcupado(""); }
  }
  async function borrar() {
    if (!(await confirmar({ titulo: `¿Borrar la factura ${x!.numero}?`, texto: "Desaparece de tus facturas. El pedido se queda como está y podrás volver a facturarlo (con el número siguiente).", ok: "Borrar factura", peligro: true }))) return;
    setOcupado("borrar");
    try { await borrarFactura(x!.id); aviso(`Factura ${x!.numero} borrada`); borrada(); }
    catch (e) { aviso(textoError(e), "error"); } finally { setOcupado(""); }
  }

  return (
    <Hoja abierta={abierta} cerrar={cerrar} titulo={`Modificar factura ${f?.numero ?? ""}`} ancho="max-w-xl"
      pie={<div className="flex gap-2">
        <Boton onClick={borrar} cargando={ocupado === "borrar"} disabled={!!ocupado} aria-label="Borrar factura" className="text-red-600"><Trash2 className="size-4" /></Boton>
        <Boton className="flex-1" onClick={cerrar} disabled={!!ocupado}>Cancelar</Boton>
        <Boton className="flex-[2]" variante="primario" cargando={ocupado === "guardar"} disabled={!!ocupado} onClick={guardar}>Guardar cambios</Boton>
      </div>}>
      <div className="space-y-5 text-[14px]">
        <section className="grid grid-cols-2 gap-3">
          <label><span className={etq}>Nº de factura</span><input className="campo num font-semibold" value={x.numero} onChange={(e) => setX({ ...x, numero: e.target.value })} /></label>
          <label><span className={etq}>Fecha</span><input className="campo" type="date" value={x.fecha} onChange={(e) => setX({ ...x, fecha: e.target.value || x.fecha })} /></label>
        </section>

        <section>
          <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[.06em] text-texto2">Cliente</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2"><span className={etq}>Nombre o empresa</span><input className="campo" value={x.datos.cliente?.nombre ?? ""} onChange={(e) => setCli({ nombre: e.target.value })} /></label>
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

        <details className="rounded-2xl border border-borde p-3">
          <summary className="cursor-pointer text-[13px] font-semibold">Tus datos en esta factura</summary>
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
