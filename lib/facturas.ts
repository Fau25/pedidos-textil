import { sb } from "./supabase";
import type { DatosPresupuesto, Presupuesto } from "./tipos";

/** Factura emitida: número correlativo (F-2026-0001…) y copia de lo facturado. Se puede modificar y borrar (SQL 13). */
export type Factura = { id: string; pedido_id: string | null; numero: string; fecha: string; datos: DatosPresupuesto; base: number; iva: number; total: number };

const sinTabla = (e: { message?: string; code?: string }) => /facturas|emitir_factura|PGRST20[25]|42P01|42883/.test(`${e.code} ${e.message}`);
export const AVISO_SIN_FACTURAS = "Para emitir facturas falta un paso en Supabase: ejecuta el SQL 09 (facturas).";

/** La factura de un pedido, si ya se emitió */
export async function facturaDe(pedidoId: string): Promise<Factura | null> {
  const { data, error } = await sb.from("facturas").select("id, pedido_id, numero, fecha, datos, base, iva, total").eq("pedido_id", pedidoId).maybeSingle();
  if (error) { if (sinTabla(error)) return null; throw error; }
  return (data as Factura) ?? null;
}

/** Emite la factura del pedido (o devuelve la que ya tenía) con los datos tal como están ahora */
export async function emitirFactura(pedidoId: string, datos: DatosPresupuesto): Promise<Factura> {
  const { data, error } = await sb.rpc("emitir_factura", { p_pedido: pedidoId, p_datos: datos });
  if (error) throw sinTabla(error) ? new Error(AVISO_SIN_FACTURAS) : error;
  return data as Factura;
}

/** Para reutilizar la vista y el PDF del ticket */
export const facturaComoDoc = (f: Factura): Presupuesto => ({
  id: f.id, pedido_id: f.pedido_id ?? "", numero: f.numero, version: 1, estado: "aceptado", fecha: f.fecha, validez: null,
  datos: f.datos, base: Number(f.base), iva: Number(f.iva), total: Number(f.total), notas: null, creado: f.fecha,
});

export const AVISO_SIN_EDITAR = "Para modificar o borrar facturas falta un paso en Supabase: ejecuta el SQL 13 (facturas editables).";
type Fila = DatosPresupuesto["lineas"][number];

/** Recalcula importes y totales a partir de unidades, precios, gastos, descuento e IVA (en céntimos, sin errores de decimales) */
export function recalcular(d: DatosPresupuesto): DatosPresupuesto {
  const c = (x: number) => Math.round((Number(x) || 0) * 100);
  const fila = (l: Fila): Fila => ({ ...l, unidades: Number(l.unidades) || 0, precio: Number(l.precio) || 0, importe: Math.round((Number(l.unidades) || 0) * c(l.precio)) / 100 });
  const lineas = d.lineas.map(fila), personalizaciones = d.personalizaciones.map(fila);
  const bruto = [...lineas, ...personalizaciones].reduce((a, l) => a + c(l.importe), 0) + c(d.gastos);
  const descuento = Math.round((bruto * (Number(d.descuento_pct) || 0)) / 100);
  const base = bruto - descuento, iva = Math.round((base * (Number(d.iva_pct) || 0)) / 100);
  return { ...d, lineas, personalizaciones, bruto: bruto / 100, descuento: descuento / 100, base: base / 100, iva: iva / 100, total: (base + iva) / 100 };
}

/** Guarda los cambios de una factura (número, fecha, datos). Devuelve la factura tal como queda. */
export async function guardarFactura(f: Factura): Promise<Factura> {
  const datos = recalcular(f.datos);
  const fila = { numero: f.numero.trim(), fecha: f.fecha, datos, base: datos.base, iva: datos.iva, total: datos.total };
  let r = await sb.from("facturas").update({ ...fila, editado: new Date().toISOString() }).eq("id", f.id).select("id");
  if (r.error && /editado/.test(r.error.message)) r = await sb.from("facturas").update(fila).eq("id", f.id).select("id");
  if (r.error) {
    if (r.error.code === "23505") throw new Error(`Ya tienes otra factura con el número ${fila.numero}`);
    throw /permission|42501/.test(`${r.error.code} ${r.error.message}`) ? new Error(AVISO_SIN_EDITAR) : r.error;
  }
  if (!r.data?.length) throw new Error(AVISO_SIN_EDITAR); // sin el SQL 13 la base no deja cambiar nada
  return { ...f, ...fila };
}

export async function borrarFactura(id: string) {
  const r = await sb.from("facturas").delete().eq("id", id).select("id");
  if (r.error) throw /permission|42501/.test(`${r.error.code} ${r.error.message}`) ? new Error(AVISO_SIN_EDITAR) : r.error;
  if (!r.data?.length) throw new Error(AVISO_SIN_EDITAR);
}

/** Todas las facturas del taller, las últimas primero */
export async function listarFacturas(empresaId: string): Promise<(Factura & { editado?: string | null })[]> {
  let r = await sb.from("facturas").select("id, pedido_id, numero, fecha, datos, base, iva, total, editado").eq("empresa_id", empresaId).order("fecha", { ascending: false }).order("numero", { ascending: false }).limit(5000);
  if (r.error && /editado/.test(r.error.message)) r = await sb.from("facturas").select("id, pedido_id, numero, fecha, datos, base, iva, total").eq("empresa_id", empresaId).order("fecha", { ascending: false }).order("numero", { ascending: false }).limit(5000) as typeof r;
  if (r.error) { if (sinTabla(r.error)) return []; throw r.error; }
  return (r.data ?? []) as Factura[];
}
