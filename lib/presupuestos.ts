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

/** Enviar (menú de compartir del móvil: WhatsApp, correo…) o descargar el PDF */
export async function compartirDocumento(p: Presupuesto, tipo: "presupuesto" | "ticket" | "factura", soloDescargar = false) {
  const { generarPDF } = await import("./pdf");
  const blob = await generarPDF(p, tipo);
  const titulo = ({ ticket: "Ticket", factura: "Factura", presupuesto: "Presupuesto" })[tipo] + " " + p.numero;
  const nombre = `${titulo} ${p.datos.cliente?.nombre ?? ""}.pdf`.trim();
  const archivo = new File([blob], nombre, { type: "application/pdf" });
  // En móvil/tablet se abre el menú de compartir (WhatsApp, correo…); en el ordenador se descarga
  if (!soloDescargar && navigator.canShare?.({ files: [archivo] }) && matchMedia("(pointer: coarse)").matches) {
    try { await navigator.share({ files: [archivo], title: titulo }); return "compartido"; }
    catch (e) { if ((e as Error).name === "AbortError") return "cancelado"; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "descargado";
}
