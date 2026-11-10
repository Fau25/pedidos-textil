import { sb } from "./supabase";
import { calcular } from "./calculo";
import { aCalc, cargarPedido, datosPresupuesto } from "./pedidos";
import type { Cliente, Empresa, Presupuesto } from "./tipos";

/** Presupuesto en PDF con los datos actuales del pedido (sin seguimiento) */
export async function presupuestoDe(pedidoId: string, empresa: Empresa): Promise<Presupuesto> {
  const r = await cargarPedido(pedidoId);
  if (!r) throw new Error("Pedido no encontrado");
  const { ed } = r;
  const cli = ed.cliente_id ? ((await sb.from("clientes").select("*").eq("id", ed.cliente_id).single()).data as Cliente) : null;
  const t = calcular(aCalc(ed, Number(empresa.margen)));
  const hoy = new Date();
  const val = new Date(); val.setDate(val.getDate() + Number(empresa.validez_dias || 30));
  const datos = datosPresupuesto(ed, t, empresa, cli);
  return {
    id: ed.id, pedido_id: ed.id, numero: ed.numero ?? "", version: 1, estado: "borrador",
    fecha: hoy.toISOString().slice(0, 10), validez: val.toISOString().slice(0, 10), datos,
    base: datos.base, iva: datos.iva, total: datos.total, notas: null, creado: hoy.toISOString(),
  };
}

export async function compartirPDF(pedidoId: string, empresa: Empresa) {
  const p = await presupuestoDe(pedidoId, empresa);
  const { generarPDF } = await import("./pdf");
  const blob = await generarPDF(p);
  const nombre = `Presupuesto ${p.numero} ${p.datos.cliente?.nombre ?? ""}.pdf`.trim();
  const archivo = new File([blob], nombre, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [archivo] }) && matchMedia("(pointer: coarse)").matches) {
    try { await navigator.share({ files: [archivo], title: `Presupuesto ${p.numero}` }); return "compartido"; }
    catch (e) { if ((e as Error).name === "AbortError") return "cancelado"; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "descargado";
}
