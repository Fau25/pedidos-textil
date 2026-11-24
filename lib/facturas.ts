import { sb } from "./supabase";
import type { DatosPresupuesto, Empresa, Presupuesto } from "./tipos";

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
export const facturaComoDoc = (f: Documento): Presupuesto => ({
  id: f.id, pedido_id: f.pedido_id ?? "", numero: f.numero, version: 1, estado: "aceptado", fecha: f.fecha, validez: f.validez ?? null,
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

/* ───── Facturas y presupuestos sueltos (desde Cuentas) y cambios en cualquiera de ellos ───── */
export type TipoDocumento = "factura" | "presupuesto";
/** Factura o presupuesto guardado. Los presupuestos llevan «válido hasta» y, si se facturaron, la factura */
export type Documento = Factura & { validez?: string | null; factura_id?: string | null; editado?: string | null };
const TABLA: Record<TipoDocumento, string> = { factura: "facturas", presupuesto: "presupuestos" };
export const AVISO_SIN_SUELTOS = "Para crear facturas y presupuestos desde Cuentas falta un paso en Supabase: ejecuta el SQL 15.";
const hoy = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const masDias = (f: string, n: number) => { const d = new Date(f + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

/** Factura o presupuesto en blanco con tus datos, tu IVA y (en presupuestos) tus condiciones y validez */
export function documentoNuevo(tipo: TipoDocumento, empresa: Empresa): Documento {
  const fecha = hoy();
  return {
    id: "", pedido_id: null, numero: "", fecha, validez: tipo === "presupuesto" ? masDias(fecha, Number(empresa.validez_dias) || 30) : null,
    base: 0, iva: 0, total: 0,
    datos: {
      empresa: { nombre: empresa.nombre, nif: empresa.nif, direccion: empresa.direccion, email: empresa.email, telefono: empresa.telefono, web: empresa.web, logo_path: empresa.logo_path },
      cliente: {}, pedido: { numero: "", referencia: null, entrega: null },
      lineas: [{ descripcion: "", detalle: "", unidades: 1, precio: 0, importe: 0 }], personalizaciones: [],
      gastos: 0, bruto: 0, descuento_pct: 0, descuento: 0, base: 0, iva_pct: Number(empresa.iva ?? 21), iva: 0, total: 0,
      condiciones: tipo === "presupuesto" ? empresa.condiciones ?? null : null,
    },
  };
}

const errorDe = (e: { code?: string; message?: string }, numero: string) =>
  e.code === "23505" ? new Error(`Ya tienes otro documento con el número ${numero}`)
    : /crear_documento|presupuestos|PGRST20[25]|42883|42P01/.test(`${e.code} ${e.message}`) ? new Error(AVISO_SIN_SUELTOS)
      : /permission|42501/.test(`${e.code} ${e.message}`) ? new Error(AVISO_SIN_EDITAR) : (e as Error);

/** Crea una factura o un presupuesto suelto: con el número siguiente o el que hayas escrito */
export async function crearDocumento(tipo: TipoDocumento, empresaId: string, d: Documento): Promise<Documento> {
  const datos = recalcular(d.datos);
  const { data, error } = await sb.rpc("crear_documento", { p_tipo: tipo, p_empresa: empresaId, p_datos: datos, p_fecha: d.fecha, p_numero: d.numero.trim() || null, p_validez: d.validez ?? null });
  if (error) throw errorDe(error, d.numero.trim());
  return data as Documento;
}

/** Guarda los cambios de una factura o presupuesto (número, fecha, datos…). Devuelve cómo queda. */
export async function guardarDocumento(tipo: TipoDocumento, f: Documento): Promise<Documento> {
  const datos = recalcular(f.datos);
  const fila: Record<string, unknown> = { numero: f.numero.trim(), fecha: f.fecha, datos, base: datos.base, iva: datos.iva, total: datos.total };
  if (tipo === "presupuesto") fila.validez = f.validez ?? null;
  let r = await sb.from(TABLA[tipo]).update({ ...fila, editado: new Date().toISOString() }).eq("id", f.id).select("id");
  if (r.error && /editado/.test(r.error.message)) r = await sb.from(TABLA[tipo]).update(fila).eq("id", f.id).select("id");
  if (r.error) throw errorDe(r.error, String(fila.numero));
  if (!r.data?.length) throw new Error(tipo === "factura" ? AVISO_SIN_EDITAR : AVISO_SIN_SUELTOS); // sin el SQL la base no deja cambiar nada
  return { ...f, ...fila, datos } as Documento;
}
export const guardarFactura = (f: Factura) => guardarDocumento("factura", f);

export async function borrarDocumento(tipo: TipoDocumento, id: string) {
  const r = await sb.from(TABLA[tipo]).delete().eq("id", id).select("id");
  if (r.error) throw errorDe(r.error, "");
  if (!r.data?.length) throw new Error(tipo === "factura" ? AVISO_SIN_EDITAR : AVISO_SIN_SUELTOS);
}
export const borrarFactura = (id: string) => borrarDocumento("factura", id);

/** Un presupuesto pasa a factura (número siguiente) y queda apuntado en el presupuesto */
export async function facturarPresupuesto(empresaId: string, p: Documento): Promise<Documento> {
  const f = await crearDocumento("factura", empresaId, { ...p, id: "", numero: "", fecha: hoy(), validez: null, datos: { ...p.datos, condiciones: null } });
  await sb.from("presupuestos").update({ factura_id: f.id }).eq("id", p.id);
  return f;
}

/** Todos los presupuestos del taller, los últimos primero */
export async function listarPresupuestos(empresaId: string): Promise<Documento[]> {
  const r = await sb.from("presupuestos").select("id, numero, fecha, validez, datos, base, iva, total, factura_id, editado").eq("empresa_id", empresaId).order("fecha", { ascending: false }).order("numero", { ascending: false }).limit(5000);
  if (r.error) { if (/presupuestos|PGRST20[25]|42P01/.test(`${r.error.code} ${r.error.message}`)) return []; throw r.error; }
  return (r.data ?? []).map((x) => ({ ...x, pedido_id: null })) as Documento[];
}

/** Todas las facturas del taller, las últimas primero */
export async function listarFacturas(empresaId: string): Promise<(Factura & { editado?: string | null })[]> {
  let r = await sb.from("facturas").select("id, pedido_id, numero, fecha, datos, base, iva, total, editado").eq("empresa_id", empresaId).order("fecha", { ascending: false }).order("numero", { ascending: false }).limit(5000);
  if (r.error && /editado/.test(r.error.message)) r = await sb.from("facturas").select("id, pedido_id, numero, fecha, datos, base, iva, total").eq("empresa_id", empresaId).order("fecha", { ascending: false }).order("numero", { ascending: false }).limit(5000) as typeof r;
  if (r.error) { if (sinTabla(r.error)) return []; throw r.error; }
  return (r.data ?? []) as Factura[];
}
