import { entregarPDF } from "./entregar-pdf";
import { sb } from "./supabase";
import { calcular } from "./calculo";
import { aCalc, cargarPedido, datosPresupuesto, diaLocal, type PedidoEd } from "./pedidos";
import type { Cliente, Empresa, Presupuesto } from "./tipos";

/** Presupuesto en PDF con los datos actuales del pedido (sin seguimiento) */
export async function presupuestoDe(pedidoId: string, empresa: Empresa): Promise<Presupuesto> {
  const r = await cargarPedido(pedidoId);
  if (!r) throw new Error("Pedido no encontrado");
  const { ed } = r;
  const cli = ed.cliente_id ? ((await sb.from("clientes").select("*").eq("id", ed.cliente_id).single()).data as Cliente) : null;
  const t = calcular(aCalc(ed, Number(empresa.margen)));
  const hoy = new Date();
  const datos = datosPresupuesto(ed, t, empresa, cli);
  return {
    id: ed.id, pedido_id: ed.id, numero: ed.numero ?? "", version: 1, estado: "borrador",
    fecha: diaLocal(0), validez: diaLocal(Number(empresa.validez_dias || 30)), datos,
    base: datos.base, iva: datos.iva, total: datos.total, notas: null, creado: hoy.toISOString(),
  };
}

export async function compartirPDF(pedidoId: string, empresa: Empresa) {
  return compartirDocumento(await presupuestoDe(pedidoId, empresa), "presupuesto");
}

/** Ticket con lo que hay ahora mismo en el editor (aunque no se haya guardado) */
export function ticketDe(ed: PedidoEd, empresa: Empresa, cli: Partial<Cliente> | null): Presupuesto {
  const t = calcular(aCalc(ed, Number(empresa.margen)));
  const datos = datosPresupuesto(ed, t, empresa, cli);
  return {
    id: ed.id, pedido_id: ed.id, numero: ed.numero ?? "Pedido nuevo", version: 1, estado: "borrador",
    fecha: ed.fecha, validez: null, datos, base: datos.base, iva: datos.iva, total: datos.total, notas: ed.notas || null, creado: new Date().toISOString(),
  };
}

type TipoDocumento = "presupuesto" | "ticket" | "factura";
/** Genera el PDF (se puede llamar antes de que el usuario pulse, para que salga al momento) */
export async function pdfDocumento(p: Presupuesto, tipo: TipoDocumento) {
  const { generarPDF } = await import("./pdf");
  return generarPDF(p, tipo);
}
/** Enviar (menú de compartir del móvil: WhatsApp, correo…) o descargar el PDF */
export async function compartirDocumento(p: Presupuesto, tipo: TipoDocumento, soloDescargar = false, hecho?: Promise<Blob>) {
  const blob = await (hecho ?? pdfDocumento(p, tipo));
  const titulo = ({ ticket: "Ticket", factura: "Factura", presupuesto: "Presupuesto" })[tipo] + " " + p.numero;
  return entregarPDF(blob, `${titulo} ${p.datos.cliente?.nombre ?? ""}.pdf`.trim(), titulo, soloDescargar);
}
