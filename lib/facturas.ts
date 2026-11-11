import { sb } from "./supabase";
import type { DatosPresupuesto, Presupuesto } from "./tipos";

/** Factura emitida: número correlativo (F-2026-0001…) y copia fija de lo facturado. No se cambia ni se borra. */
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
