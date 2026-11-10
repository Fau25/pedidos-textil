import { sb } from "./supabase";
import { textoTallas } from "./pedidos";
import { diaLocal } from "./pedidos";

/** Copia de seguridad en Excel: pedidos, prendas, personalizaciones, clientes y catálogo */
export async function descargarCopia(empresaId: string, nombre: string) {
  const q = async <T,>(tabla: string, sel = "*") => {
    const { data, error } = await sb.from(tabla).select(sel).eq("empresa_id", empresaId).limit(20000);
    if (error) throw error;
    return (data ?? []) as T[];
  };
  type R = Record<string, unknown>;
  const [pedidos, lineas, tallas, pers, clientes, catalogo] = await Promise.all([
    q<R>("pedidos", "*, clientes(nombre)"), q<R>("pedido_lineas"), q<R>("linea_tallas"), q<R>("personalizaciones"), q<R>("clientes"), q<R>("catalogo"),
  ]);
  const num = new Map(pedidos.map((p) => [p.id, p.numero]));
  const tallasDe = new Map<unknown, Record<string, number>>();
  for (const t of tallas) { const m = tallasDe.get(t.linea_id) ?? {}; m[String(t.talla)] = Number(t.cantidad); tallasDe.set(t.linea_id, m); }
  const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const cab = (xs: string[]) => xs.map((value) => ({ value, fontWeight: "bold" as const }));
  const hojas = [
    { sheet: "Pedidos", data: [cab(["Número", "Fecha", "Cliente", "Estado", "Entregado el", "Unidades", "Base", "IVA %", "Total", "Referencia", "Notas"]),
      ...pedidos.map((p) => [s(p.numero), s(p.fecha), s((p.clientes as R | null)?.nombre), p.entregado ? "Entregado" : "Pendiente", s(p.entregado_en), n(p.unidades), n(p.base), n(p.iva), n(p.total), s(p.referencia), s(p.notas)])] },
    { sheet: "Prendas", data: [cab(["Pedido", "Tipo", "Marca", "Modelo", "Color", "Tallas", "Precio compra", "Precio venta", "Notas"]),
      ...lineas.map((l) => [s(num.get(l.pedido_id)), s(l.tipo), s(l.marca), s(l.modelo), s(l.color), textoTallas(tallasDe.get(l.id) ?? {}), n(l.precio_compra), n(l.precio_venta), s(l.notas)])] },
    { sheet: "Personalización", data: [cab(["Pedido", "Técnica", "Ubicación", "Aplicaciones", "Coste/ud", "Precio/ud", "Notas"]),
      ...pers.map((x) => [s(num.get(x.pedido_id)), s(x.tecnica), s(x.ubicacion), n(x.aplicaciones), n(x.coste_ud), n(x.precio_ud), s(x.notas)])] },
    { sheet: "Clientes", data: [cab(["Nombre", "Contacto", "Teléfono", "Email", "NIF", "Dirección", "Facturación", "Notas"]),
      ...clientes.map((c) => [s(c.nombre), s(c.contacto), s(c.telefono), s(c.email), s(c.nif), s(c.direccion), s(c.facturacion), s(c.notas)])] },
    { sheet: "Catálogo", data: [cab(["Marca", "Modelo", "Tipo", "Referencia", "Colores", "Tallas", "Precio compra", "Precio venta", "Habitual"]),
      ...catalogo.map((c) => [s(c.marca), s(c.modelo), s(c.tipo), s(c.referencia), ((c.colores as string[]) ?? []).join(", "), ((c.tallas as string[]) ?? []).join(", "), n(c.precio_compra), n(c.precio_venta), c.favorito ? "Sí" : "No"])] },
  ];
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  await writeExcelFile(hojas.map((h) => ({ ...h, stickyRowsCount: 1 }))).toFile(`Copia ${nombre} ${diaLocal(0)}.xlsx`);
  try { localStorage.setItem(`ultima-copia-${empresaId}`, diaLocal(0)); } catch {}
}
