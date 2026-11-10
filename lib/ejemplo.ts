import { sb } from "./supabase";
import { guardarPedido, hoy, id, lineaVacia, type PedidoEd, type PersEd } from "./pedidos";
import { tarifaPara } from "./calculo";
import type { Estado, TarifaFila, Tecnica } from "./tipos";

export const MARCA_EJEMPLO = "[ejemplo]";

const dias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

/** Datos de ejemplo realistas. Se marcan con [ejemplo] en las notas para poder borrarlos. */
export async function cargarEjemplo(empresaId: string) {
  const { data: emp } = await sb.from("empresas").select("id, margen").eq("id", empresaId).single();
  const est = ((await sb.from("estados").select("*").eq("empresa_id", empresaId)).data ?? []) as Estado[];
  const tec = ((await sb.from("tecnicas").select("*").eq("empresa_id", empresaId)).data ?? []) as Tecnica[];
  const tar = ((await sb.from("tarifas").select("*").eq("empresa_id", empresaId)).data ?? []) as TarifaFila[];
  const E = (c: string) => est.find((e) => e.clave === c)?.id ?? null;
  const T = (n: string) => tec.find((t) => t.nombre === n);

  const prov = (await sb.from("proveedores").insert([
    { empresa_id: empresaId, nombre: "Roly", web: "roly.es", notas: MARCA_EJEMPLO },
    { empresa_id: empresaId, nombre: "Sol's", web: "sols-europe.com", notas: MARCA_EJEMPLO },
    { empresa_id: empresaId, nombre: "Beechfield", notas: MARCA_EJEMPLO },
  ]).select("id, nombre")).data ?? [];
  const P = (n: string) => prov.find((p) => p.nombre === n)?.id ?? null;

  await sb.from("catalogo").insert([
    { empresa_id: empresaId, tipo: "Camiseta", marca: "Roly", modelo: "Atomic 150", colores: ["Blanco", "Negro", "Azul royal", "Rojo"], proveedor_id: P("Roly"), precio_compra: 1.95, precio_venta: 4.5, notas: MARCA_EJEMPLO },
    { empresa_id: empresaId, tipo: "Camiseta técnica", marca: "Roly", modelo: "Montecarlo", colores: ["Azul royal", "Negro", "Blanco"], proveedor_id: P("Roly"), precio_compra: 3.2, precio_venta: 6.5, notas: MARCA_EJEMPLO },
    { empresa_id: empresaId, tipo: "Polo", marca: "Sol's", modelo: "Summer II", colores: ["Marino", "Blanco", "Gris"], proveedor_id: P("Sol's"), precio_compra: 5.4, precio_venta: 10.9, notas: MARCA_EJEMPLO },
    { empresa_id: empresaId, tipo: "Sudadera", marca: "Sol's", modelo: "Snake capucha", colores: ["Negro", "Gris jaspeado", "Marino"], proveedor_id: P("Sol's"), precio_compra: 11.9, precio_venta: 19.5, notas: MARCA_EJEMPLO },
    { empresa_id: empresaId, tipo: "Gorra", marca: "Beechfield", modelo: "B15 5 paneles", colores: ["Negro", "Marino", "Blanco"], proveedor_id: P("Beechfield"), precio_compra: 2.6, precio_venta: 5.5, notas: MARCA_EJEMPLO },
  ]);

  const cli = (await sb.from("clientes").insert([
    { empresa_id: empresaId, nombre: "Club Deportivo Arenal", contacto: "Marta Gil", telefono: "612 345 678", email: "secretaria@cdarenal.es", nif: "G12345678", direccion: "C/ del Puerto 12, 46011 Valencia", notas: MARCA_EJEMPLO },
    { empresa_id: empresaId, nombre: "Bar La Esquina", contacto: "Javier Ruiz", telefono: "655 112 233", email: "laesquina@gmail.com", nif: "B98765432", direccion: "Plaza Mayor 3, 46001 Valencia", notas: MARCA_EJEMPLO },
    { empresa_id: empresaId, nombre: "Colegio San José", contacto: "Ana Pérez (AMPA)", telefono: "963 000 111", email: "ampa@colegiosanjose.es", nif: "G46000111", direccion: "Av. Blasco Ibáñez 50, 46010 Valencia", notas: MARCA_EJEMPLO },
    { empresa_id: empresaId, nombre: "Taller Mecánico Ruiz", contacto: "Pedro Ruiz", telefono: "699 887 766", email: "talleresruiz@hotmail.com", nif: "B46888777", notas: MARCA_EJEMPLO },
    { empresa_id: empresaId, nombre: "Peña Ciclista Norte", contacto: "Luis Navarro", telefono: "644 556 677", email: "pcnorte@gmail.com", notas: MARCA_EJEMPLO },
  ]).select("id, nombre")).data ?? [];
  const C = (n: string) => cli.find((c) => c.nombre === n)?.id ?? null;

  const pers = (tecnica: string, ubicacion: string, lineas: string[], unidades: number, aplicaciones = 1): PersEd => {
    const t = T(tecnica);
    const tf = tarifaPara(tar.map((x) => ({ ...x, coste: Number(x.coste), precio: Number(x.precio) })), t?.id ?? null, unidades);
    return { clave: id(), tecnica_id: t?.id ?? null, tecnica, ubicacion, aplicaciones, coste_ud: tf?.coste ?? 0, precio_ud: tf?.precio ?? 0, precio_manual: false, diseno_path: null, notas: "", estado: "pendiente", lineas };
  };
  const margen = Number(emp?.margen ?? 40);
  const base = (cliente: string, estado: string, entrega: number, extra: Partial<PedidoEd> = {}): PedidoEd => ({
    id: id(), nuevo: true, cliente_id: C(cliente), fecha: dias(-Math.abs(entrega) - 6), entrega: dias(entrega), estado_id: E(estado),
    referencia: "", notas: MARCA_EJEMPLO, descuento_pct: 0, gastos_coste: 0, gastos_venta: 0, iva: 21, lineas: [], pers: [], ...extra,
  });

  // 1 · Club: camisetas técnicas + sudaderas, bordado común y serigrafía en espalda
  const a = lineaVacia(margen, { tipo: "Camiseta técnica", marca: "Roly", modelo: "Montecarlo", color: "Azul royal", proveedor_id: P("Roly"), precio_compra: 3.2, precio_venta: 6.5, estado: "pedido", tallas: { S: 8, M: 15, L: 12, XL: 6, XXL: 2 } });
  const b = lineaVacia(margen, { tipo: "Sudadera", marca: "Sol's", modelo: "Snake capucha", color: "Negro", proveedor_id: P("Sol's"), precio_compra: 11.9, precio_venta: 19.5, estado: "recibido_parcial", tallas: { M: 8, L: 8, XL: 4 } });
  const p1 = base("Club Deportivo Arenal", "pedido_proveedor", 9, { referencia: "Temporada 26/27", lineas: [a, b], pers: [pers("Bordado", "Pecho izquierdo", [a.clave, b.clave], 63), pers("Serigrafía", "Espalda", [b.clave], 20)] });

  // 2 · Bar: polos bordados, listo
  const c = lineaVacia(margen, { tipo: "Polo", marca: "Sol's", modelo: "Summer II", color: "Marino", proveedor_id: P("Sol's"), precio_compra: 5.4, precio_venta: 10.9, estado: "listo", tallas: { S: 2, M: 3, L: 3, XL: 2 } });
  const p2 = base("Bar La Esquina", "listo", 1, { lineas: [c], pers: [pers("Bordado", "Pecho izquierdo", [c.clave], 10)] });

  // 3 · Colegio: camisetas infantiles DTF, presupuesto enviado
  const d = lineaVacia(margen, { tipo: "Camiseta", marca: "Roly", modelo: "Atomic 150 niño", color: "Blanco", proveedor_id: P("Roly"), precio_compra: 1.75, precio_venta: 3.9, tallas: { "4": 18, "6": 22, "8": 25, "10": 20, "12": 15 } });
  const p3 = base("Colegio San José", "presupuesto_enviado", 20, { referencia: "Fiesta fin de curso", descuento_pct: 5, lineas: [d], pers: [pers("DTF", "Pecho centro", [d.clave], 100)] });

  // 4 · Taller: gorras y camisetas, en personalización
  const e = lineaVacia(margen, { tipo: "Gorra", marca: "Beechfield", modelo: "B15 5 paneles", color: "Negro", proveedor_id: P("Beechfield"), precio_compra: 2.6, precio_venta: 5.5, estado: "en_personalizacion", tallas: { Única: 15 } });
  const f = lineaVacia(margen, { tipo: "Camiseta", marca: "Roly", modelo: "Atomic 150", color: "Negro", proveedor_id: P("Roly"), precio_compra: 1.95, precio_venta: 4.5, estado: "en_personalizacion", tallas: { M: 4, L: 6, XL: 5 } });
  const p4 = base("Taller Mecánico Ruiz", "en_personalizacion", 4, { lineas: [e, f], pers: [pers("Bordado", "Frontal gorra", [e.clave], 15), pers("Vinilo textil", "Espalda", [f.clave], 15)] });

  // 5 · Peña: pendiente de presupuesto
  const g = lineaVacia(margen, { tipo: "Camiseta técnica", marca: "Roly", modelo: "Montecarlo", color: "Rojo", proveedor_id: P("Roly"), precio_compra: 3.2, precio_venta: null, tallas: { M: 10, L: 12, XL: 8 } });
  const p5 = base("Peña Ciclista Norte", "pte_presupuesto", 25, { lineas: [g], pers: [pers("Serigrafía", "Espalda", [g.clave], 30)] });

  // 6 · Bar: entregado el mes pasado
  const h = lineaVacia(margen, { tipo: "Delantal", marca: "", modelo: "Delantal largo", color: "Negro", precio_compra: 4.1, precio_venta: 8.9, estado: "entregado", tallas: { Única: 6 } });
  const p6 = base("Bar La Esquina", "entregado", -18, { lineas: [h], pers: [pers("Bordado", "Pecho centro", [h.clave], 6)] });

  for (const p of [p6, p5, p4, p3, p2, p1]) await guardarPedido(p, { id: empresaId, margen });
}

export async function borrarEjemplo(empresaId: string) {
  await sb.from("pedidos").delete().eq("empresa_id", empresaId).eq("notas", MARCA_EJEMPLO);
  await sb.from("clientes").delete().eq("empresa_id", empresaId).eq("notas", MARCA_EJEMPLO);
  await sb.from("catalogo").delete().eq("empresa_id", empresaId).eq("notas", MARCA_EJEMPLO);
  await sb.from("proveedores").delete().eq("empresa_id", empresaId).eq("notas", MARCA_EJEMPLO);
}
export { hoy };
