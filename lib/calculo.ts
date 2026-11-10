// Cálculo de presupuestos. Todo en céntimos enteros para evitar errores de decimales.
// Redondeo: mitad hacia arriba, a 2 decimales, en cada línea y en el IVA.

export type TallaCant = { talla: string; cantidad: number };

export type LineaCalc = {
  clave: string;
  precio_compra: number; // euros
  precio_venta: number | null; // euros; null = compra × (1 + margen)
  tallas: TallaCant[];
};

export type PersCalc = {
  tecnica: string;
  aplicaciones: number;
  coste_ud: number; // euros por aplicación y prenda
  precio_ud: number;
  lineas: string[]; // claves de las líneas a las que se aplica
};

export type PedidoCalc = {
  lineas: LineaCalc[];
  personalizaciones: PersCalc[];
  margen: number; // % por defecto de la empresa
  descuento_pct: number;
  gastos_coste: number;
  gastos_venta: number;
  iva: number; // %
};

export type Totales = {
  unidades: number;
  costePrendas: number;
  costePers: number;
  coste: number;
  ventaPrendas: number;
  ventaPers: number;
  bruto: number;
  descuento: number;
  base: number;
  margen: number;
  margenPct: number;
  iva: number;
  total: number;
  lineas: Record<string, { unidades: number; ventaUd: number; venta: number; coste: number }>;
  pers: { unidades: number; coste: number; venta: number }[];
};

/** Euros (número o texto con coma) → céntimos enteros */
export function aCent(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return redondear(n * 100);
}

/** Redondeo mitad hacia arriba (también para negativos, simétrico) */
export function redondear(x: number): number {
  const s = Math.sign(x);
  return s * Math.round(Math.abs(x) + 1e-9);
}

export const sumaUnidades = (t: TallaCant[]) => t.reduce((a, b) => a + (Number(b.cantidad) || 0), 0);

export function precioVentaUd(l: Pick<LineaCalc, "precio_compra" | "precio_venta">, margen: number): number {
  if (l.precio_venta !== null && l.precio_venta !== undefined && String(l.precio_venta) !== "") return aCent(l.precio_venta);
  return redondear(aCent(l.precio_compra) * (1 + margen / 100));
}

export function calcular(p: PedidoCalc): Totales {
  const lineas: Totales["lineas"] = {};
  let unidades = 0, costePrendas = 0, ventaPrendas = 0;
  for (const l of p.lineas) {
    const u = sumaUnidades(l.tallas);
    const ventaUd = precioVentaUd(l, p.margen);
    const coste = u * aCent(l.precio_compra);
    const venta = u * ventaUd;
    lineas[l.clave] = { unidades: u, ventaUd, venta, coste };
    unidades += u; costePrendas += coste; ventaPrendas += venta;
  }
  let costePers = 0, ventaPers = 0;
  const pers = p.personalizaciones.map((x) => {
    const u = x.lineas.reduce((a, k) => a + (lineas[k]?.unidades ?? 0), 0);
    const n = u * Math.max(1, Number(x.aplicaciones) || 1);
    const coste = n * aCent(x.coste_ud);
    const venta = n * aCent(x.precio_ud);
    costePers += coste; ventaPers += venta;
    return { unidades: u, coste, venta };
  });
  const coste = costePrendas + costePers + aCent(p.gastos_coste);
  const bruto = ventaPrendas + ventaPers + aCent(p.gastos_venta);
  const descuento = redondear((bruto * (Number(p.descuento_pct) || 0)) / 100);
  const base = bruto - descuento;
  const margen = base - coste;
  const margenPct = base > 0 ? Math.round((margen / base) * 1000) / 10 : 0;
  const iva = redondear((base * (Number(p.iva) || 0)) / 100);
  return {
    unidades, costePrendas, costePers, coste, ventaPrendas, ventaPers, bruto, descuento,
    base, margen, margenPct, iva, total: base + iva, lineas, pers,
  };
}

export type Tarifa = { tecnica_id: string; desde: number; hasta: number | null; complejidad: string; coste: number; precio: number };

/** Tarifa que corresponde a un número de prendas (y complejidad) */
export function tarifaPara(tarifas: Tarifa[], tecnicaId: string | null, unidades: number, complejidad = "Normal"): Tarifa | null {
  if (!tecnicaId) return null;
  const de = tarifas.filter((t) => t.tecnica_id === tecnicaId);
  const tramos = de.filter((t) => t.complejidad === complejidad).length ? de.filter((t) => t.complejidad === complejidad) : de;
  const u = Math.max(1, unidades);
  return tramos.find((t) => u >= t.desde && (t.hasta === null || u <= t.hasta))
    ?? tramos.sort((a, b) => a.desde - b.desde)[0] ?? null;
}

const fmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
/** Céntimos → "1.234,56 €" */
export const euros = (c: number) => fmt.format(c / 100);
/** Céntimos → número en euros (para guardar en la base) */
export const aEuros = (c: number) => Math.round(c) / 100;
