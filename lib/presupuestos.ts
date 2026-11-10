import { sb } from "./supabase";
import { calcular } from "./calculo";
import { aCalc, cargarPedido, datosPresupuesto } from "./pedidos";
import type { Cliente, Empresa, Estado, Presupuesto } from "./tipos";

export async function crearPresupuesto(pedidoId: string, empresa: Empresa): Promise<Presupuesto> {
  const r = await cargarPedido(pedidoId);
  if (!r) throw new Error("Pedido no encontrado");
  const { ed } = r;
  const cli = ed.cliente_id ? ((await sb.from("clientes").select("*").eq("id", ed.cliente_id).single()).data as Cliente) : null;
  const t = calcular(aCalc(ed, Number(empresa.margen)));
  const { count } = await sb.from("presupuestos").select("id", { count: "exact", head: true }).eq("pedido_id", pedidoId);
  const val = new Date(); val.setDate(val.getDate() + Number(empresa.validez_dias || 30));
  const datos = datosPresupuesto(ed, t, empresa, cli);
  const { data, error } = await sb.from("presupuestos").insert({
    pedido_id: pedidoId, version: (count ?? 0) + 1, validez: val.toISOString().slice(0, 10), datos,
    base: datos.base, iva: datos.iva, total: datos.total,
  }).select("*").single();
  if (error) throw error;
  return data as Presupuesto;
}

/** Cambia el estado del presupuesto y, si toca, el del pedido */
export async function marcarPresupuesto(p: Presupuesto, estado: Presupuesto["estado"], estados: Estado[], estadoPedidoActual: string | null) {
  const { error } = await sb.from("presupuestos").update({ estado }).eq("id", p.id);
  if (error) throw error;
  const clave = { enviado: "presupuesto_enviado", aceptado: "presupuesto_aceptado", rechazado: "cancelado", borrador: null }[estado];
  const destino = clave ? estados.find((e) => e.clave === clave) : null;
  const actual = estados.find((e) => e.id === estadoPedidoActual);
  // Solo avanza el pedido si aún no ha pasado de esa fase
  if (destino && (!actual || actual.orden < destino.orden || (estado === "rechazado" && !actual.final))) {
    const nota = { enviado: `Presupuesto ${p.numero} enviado`, aceptado: `Presupuesto ${p.numero} aceptado`, rechazado: `Presupuesto ${p.numero} rechazado` }[estado as "enviado"];
    const r = await sb.rpc("cambiar_estado", { p: p.pedido_id, e: destino.id, nota });
    if (r.error) throw r.error;
  }
}

export async function descargarPDF(p: Presupuesto) {
  const { generarPDF } = await import("./pdf");
  const blob = await generarPDF(p);
  const nombre = `${p.numero} ${p.datos.cliente?.nombre ?? ""}.pdf`.trim();
  return { blob, nombre };
}

export async function compartirOPDF(p: Presupuesto) {
  const { blob, nombre } = await descargarPDF(p);
  const archivo = new File([blob], nombre, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo], title: `Presupuesto ${p.numero}` }); return "compartido"; }
    catch (e) { if ((e as Error).name === "AbortError") return "cancelado"; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "descargado";
}
