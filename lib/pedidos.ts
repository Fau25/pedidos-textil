import { sb } from "./supabase";
import { calcular, aEuros, type Totales, type PedidoCalc } from "./calculo";
import type { Cliente, DatosPresupuesto, Empresa, EstadoLinea, Linea, Personalizacion, Pedido } from "./tipos";

export type LineaEd = {
  clave: string; // = id en la base
  tipo: string; marca: string; modelo: string; color: string;
  proveedor_id: string | null;
  precio_compra: number; precio_venta: number | null;
  notas: string; imagen_path: string | null; estado: EstadoLinea;
  tallas: Record<string, number>;
  tallasModelo?: string[]; // tallas del modelo del catálogo (solo para mostrar)
  tallasExtra: string[]; // tallas fuera de la lista estándar
};
export type PersEd = {
  clave: string; tecnica_id: string | null; tecnica: string; ubicacion: string; aplicaciones: number;
  coste_ud: number; precio_ud: number; precio_manual: boolean; diseno_path: string | null; notas: string;
  estado: Personalizacion["estado"]; lineas: string[];
};
export type PedidoEd = {
  id: string; numero?: string; nuevo: boolean;
  cliente_id: string | null; fecha: string; entrega: string | null; entregado: boolean;
  referencia: string; notas: string; descuento_pct: number; gastos_coste: number; gastos_venta: number; iva: number;
  lineas: LineaEd[]; pers: PersEd[];
};

/** Fecha local (no UTC) en formato AAAA-MM-DD, desplazada n días */
export function diaLocal(n = 0) { const d = new Date(); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
export const hoy = () => diaLocal(0);
/** El borrador de «nuevo pedido» es de cada usuario (por si varios comparten dispositivo) */
export const claveBorrador = (uid: string) => `pedido-borrador-${uid}`;
export const id = () => crypto.randomUUID();

export function lineaVacia(margen: number, base?: Partial<LineaEd>): LineaEd {
  return {
    clave: id(), tipo: "Camiseta", marca: "", modelo: "", color: "", proveedor_id: null,
    precio_compra: 0, precio_venta: null, notas: "", imagen_path: null, estado: "pendiente",
    tallas: {}, tallasExtra: [], ...base,
  };
}

export function aCalc(p: PedidoEd, margen: number): PedidoCalc {
  return {
    margen, descuento_pct: p.descuento_pct, gastos_coste: p.gastos_coste, gastos_venta: p.gastos_venta, iva: p.iva,
    lineas: p.lineas.map((l) => ({
      clave: l.clave, precio_compra: l.precio_compra, precio_venta: l.precio_venta,
      tallas: Object.entries(l.tallas).map(([talla, cantidad]) => ({ talla, cantidad })),
    })),
    personalizaciones: p.pers.map((x) => ({ tecnica: x.tecnica, aplicaciones: x.aplicaciones, coste_ud: x.coste_ud, precio_ud: x.precio_ud, lineas: x.lineas })),
  };
}

/** Último pedido cargado guardado en el dispositivo (para abrir el editor al instante) */
export function pedidoGuardado(pid: string): PedidoEd | null {
  try { return JSON.parse(localStorage.getItem("pedido:" + pid) || "null"); } catch { return null; }
}
export async function cargarPedido(pid: string): Promise<{ ed: PedidoEd; pedido: Pedido } | null> {
  const [p, l, x] = await Promise.all([
    sb.from("pedidos").select("*, clientes(nombre)").eq("id", pid).maybeSingle(),
    sb.from("pedido_lineas").select("*, linea_tallas(talla, cantidad, orden)").eq("pedido_id", pid).order("orden"),
    sb.from("personalizaciones").select("*, personalizacion_lineas(linea_id)").eq("pedido_id", pid).order("orden"),
  ]);
  if (p.error) throw p.error;
  if (!p.data) return null;
  const ped = p.data as Pedido;
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const ed: PedidoEd = {
    id: ped.id, numero: ped.numero, nuevo: false, cliente_id: ped.cliente_id, fecha: ped.fecha, entrega: ped.entrega,
    entregado: ped.entregado, referencia: ped.referencia ?? "", notas: ped.notas ?? "",
    descuento_pct: Number(ped.descuento_pct), gastos_coste: Number(ped.gastos_coste), gastos_venta: Number(ped.gastos_venta), iva: Number(ped.iva),
    lineas: ((l.data ?? []) as Linea[]).map((r) => {
      const tallas: Record<string, number> = {};
      const orden = [...(r.linea_tallas ?? [])].sort((a, b) => a.orden - b.orden);
      for (const t of orden) tallas[t.talla] = t.cantidad;
      return {
        clave: r.id, tipo: r.tipo, marca: r.marca ?? "", modelo: r.modelo ?? "", color: r.color ?? "", proveedor_id: r.proveedor_id,
        precio_compra: Number(r.precio_compra), precio_venta: n(r.precio_venta), notas: r.notas ?? "", imagen_path: r.imagen_path,
        estado: r.estado, tallas, tallasExtra: [],
      };
    }),
    pers: ((x.data ?? []) as Personalizacion[]).map((r) => ({
      clave: r.id, tecnica_id: r.tecnica_id, tecnica: r.tecnica, ubicacion: r.ubicacion, aplicaciones: r.aplicaciones,
      coste_ud: Number(r.coste_ud), precio_ud: Number(r.precio_ud), precio_manual: r.precio_manual, diseno_path: r.diseno_path,
      notas: r.notas ?? "", estado: r.estado, lineas: (r.personalizacion_lineas ?? []).map((z) => z.linea_id),
    })),
  };
  try { localStorage.setItem("pedido:" + pid, JSON.stringify(ed)); } catch { /* sin almacenamiento */ }
  return { ed, pedido: ped };
}

/** Guarda el pedido completo en una sola transacción (función guardar_pedido de la base de datos).
 *  Los guardados se ponen en cola para que nunca se solapen (autoguardado + botón). Devuelve el número. */
let cola: Promise<unknown> = Promise.resolve();
export function guardarPedido(p: PedidoEd, empresa: Pick<Empresa, "id" | "margen">): Promise<string> {
  const r = cola.then(() => guardarAhora(p, empresa));
  cola = r.catch(() => {});
  return r;
}
async function guardarAhora(p: PedidoEd, empresa: Pick<Empresa, "id" | "margen">): Promise<string> {
  const t = calcular(aCalc(p, Number(empresa.margen)));
  const clavesL = new Set(p.lineas.map((l) => l.clave));
  const datos = {
    id: p.id, empresa_id: empresa.id, cliente_id: p.cliente_id, fecha: p.fecha, entrega: p.entrega || null, entregado: p.entregado,
    referencia: p.referencia, notas: p.notas, descuento_pct: p.descuento_pct || 0, gastos_coste: p.gastos_coste || 0,
    gastos_venta: p.gastos_venta || 0, iva: p.iva, coste: aEuros(t.coste), base: aEuros(t.base), total: aEuros(t.total), unidades: t.unidades,
    lineas: p.lineas.map((l, i) => ({
      id: l.clave, orden: i, tipo: l.tipo, marca: l.marca, modelo: l.modelo, color: l.color, proveedor_id: l.proveedor_id,
      precio_compra: l.precio_compra || 0, precio_venta: l.precio_venta, notas: l.notas, imagen_path: l.imagen_path,
      tallas: Object.entries(l.tallas).filter(([, c]) => c > 0).map(([talla, cantidad], k) => ({ talla, cantidad, orden: ordenTalla(talla, k) })),
    })),
    pers: p.pers.map((x, i) => ({
      id: x.clave, orden: i, tecnica_id: x.tecnica_id, tecnica: x.tecnica, ubicacion: x.ubicacion, aplicaciones: x.aplicaciones || 1,
      coste_ud: x.coste_ud || 0, precio_ud: x.precio_ud || 0, precio_manual: x.precio_manual, diseno_path: x.diseno_path, notas: x.notas,
      lineas: x.lineas.filter((k) => clavesL.has(k)),
    })),
  };
  const { data, error } = await sb.rpc("guardar_pedido", { p: datos });
  if (error) throw error;
  return data as string;
}

const ORDEN_TALLAS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"];
export function ordenTalla(t: string, i = 0) {
  const k = ORDEN_TALLAS.indexOf(t.toUpperCase());
  if (k >= 0) return k;
  const n = Number(t);
  return Number.isFinite(n) ? 100 + n : 200 + i;
}

/** Copia del pedido como borrador nuevo */
export function duplicar(ed: PedidoEd): PedidoEd {
  const mapa = new Map(ed.lineas.map((l) => [l.clave, id()]));
  return {
    ...ed, id: id(), numero: undefined, nuevo: true, fecha: hoy(), entrega: null, entregado: false,
    lineas: ed.lineas.map((l) => ({ ...l, clave: mapa.get(l.clave)!, estado: "pendiente", tallas: { ...l.tallas } })),
    pers: ed.pers.map((x) => ({ ...x, clave: id(), estado: "pendiente", lineas: x.lineas.map((k) => mapa.get(k)!).filter(Boolean) })),
  };
}

export const describirLinea = (l: Pick<LineaEd, "tipo" | "marca" | "modelo" | "color">) =>
  [l.tipo, [l.marca, l.modelo].filter(Boolean).join(" "), l.color].filter(Boolean).join(" · ");

export const textoTallas = (t: Record<string, number>) =>
  Object.entries(t).filter(([, c]) => c > 0).sort((a, b) => ordenTalla(a[0]) - ordenTalla(b[0])).map(([k, c]) => `${k} ${c}`).join(" · ");

/** Datos fijos del presupuesto (no cambian aunque luego se edite el pedido) */
export function datosPresupuesto(ed: PedidoEd, t: Totales, empresa: Empresa, cliente: Partial<Cliente> | null): DatosPresupuesto {
  const nombres = new Map(ed.lineas.map((l) => [l.clave, l.tipo]));
  return {
    empresa: { nombre: empresa.nombre, nif: empresa.nif, direccion: empresa.direccion, email: empresa.email, telefono: empresa.telefono, web: empresa.web, logo_path: empresa.logo_path },
    cliente: cliente ? { nombre: cliente.nombre, contacto: cliente.contacto, nif: cliente.nif, direccion: cliente.direccion, email: cliente.email, telefono: cliente.telefono, facturacion: cliente.facturacion } : null,
    pedido: { numero: ed.numero ?? "", referencia: ed.referencia || null, entrega: ed.entrega },
    lineas: ed.lineas.map((l) => {
      const c = t.lineas[l.clave];
      return { descripcion: describirLinea(l), detalle: textoTallas(l.tallas), unidades: c?.unidades ?? 0, precio: aEuros(c?.ventaUd ?? 0), importe: aEuros(c?.venta ?? 0) };
    }).filter((x) => x.unidades > 0),
    personalizaciones: ed.pers.map((x, i) => ({
      descripcion: `${x.tecnica} · ${x.ubicacion}${x.aplicaciones > 1 ? ` ×${x.aplicaciones}` : ""}`,
      detalle: x.lineas.map((k) => nombres.get(k)).filter(Boolean).join(", "),
      unidades: (t.pers[i]?.unidades ?? 0) * Math.max(1, x.aplicaciones), precio: x.precio_ud, importe: aEuros(t.pers[i]?.venta ?? 0),
    })).filter((x) => x.unidades > 0),
    gastos: ed.gastos_venta || 0, bruto: aEuros(t.bruto), descuento_pct: ed.descuento_pct || 0, descuento: aEuros(t.descuento),
    base: aEuros(t.base), iva_pct: ed.iva, iva: aEuros(t.iva), total: aEuros(t.total), condiciones: empresa.condiciones,
  };
}

/** Marca uno o varios pedidos como entregados (o los devuelve a pendientes) */
export async function marcarEntregado(ids: string[], entregado: boolean) {
  const { error } = await sb.from("pedidos").update({ entregado, entregado_en: entregado ? hoy() : null }).in("id", ids);
  if (error) throw error;
}
