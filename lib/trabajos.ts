import { sb } from "./supabase";
import { aCent, euros } from "./calculo";
import type { Empresa } from "./tipos";

/** «Recibí»: trabajo rápido en el que el cliente deja sus prendas (cunas, toallas, camisetas…) para personalizar */
export type ItemTrabajo = { id: string; que: string; cantidad: number; tecnica: string; ubicaciones?: string[]; detalle: string; diseno_path: string | null };
/** Ubicaciones rápidas (iconos); para lo demás (un cinturón…) está el texto «qué y dónde» */
export const UBICACIONES_TRABAJO = ["Pecho derecho", "Pecho izquierdo", "Pecho centro", "Espalda"];
export const CORTO: Record<string, string> = { "Pecho derecho": "Pecho der.", "Pecho izquierdo": "Pecho izq.", "Pecho centro": "Centrado", "Espalda": "Espalda" };
export type EstadoTrabajo = "pendiente" | "listo" | "entregado";
export type Trabajo = {
  id: string; empresa_id: string; numero: string | null;
  cliente_id: string | null; cliente_nombre: string | null; cliente_telefono: string | null;
  items: ItemTrabajo[]; entrega: string | null; total: number; a_cuenta: number; notas: string | null;
  estado: EstadoTrabajo; listo_en: string | null; entregado_en: string | null; creado: string;
};

export const nuevoItem = (tecnica = "Bordado"): ItemTrabajo => ({ id: crypto.randomUUID(), que: "", cantidad: 1, tecnica, ubicaciones: [], detalle: "", diseno_path: null });
export const nuevoTrabajo = (empresaId: string, tecnica?: string): Trabajo => ({
  id: crypto.randomUUID(), empresa_id: empresaId, numero: null, cliente_id: null, cliente_nombre: "", cliente_telefono: "",
  items: [nuevoItem(tecnica)], entrega: null, total: 0, a_cuenta: 0, notas: null, estado: "pendiente", listo_en: null, entregado_en: null, creado: new Date().toISOString(),
});

/** Lo que falta por cobrar, en céntimos */
export const pendienteCent = (t: Pick<Trabajo, "total" | "a_cuenta">) => Math.max(0, aCent(t.total) - aCent(t.a_cuenta));
export const unidades = (t: Pick<Trabajo, "items">) => t.items.reduce((a, i) => a + (Number(i.cantidad) || 0), 0);
export const resumenItems = (t: Pick<Trabajo, "items">) => t.items.filter((i) => i.que.trim()).map((i) => `${i.que.trim()}${i.cantidad > 1 ? ` ×${i.cantidad}` : ""}`).join(", ");

export const AVISO_SIN_TRABAJOS = "Para usar los trabajos falta un paso en Supabase: ejecuta el SQL 10 (trabajos).";
export const sinTablaTrabajos = (e: { message?: string; code?: string } | null) => !!e && /trabajos|PGRST205|42P01/.test(`${e.code} ${e.message}`);

/** Guarda (crea o actualiza) y devuelve el trabajo con su número */
export async function guardarTrabajo(t: Trabajo): Promise<Trabajo> {
  const fila = {
    id: t.id, empresa_id: t.empresa_id, cliente_id: t.cliente_id, cliente_nombre: t.cliente_nombre?.trim() || null, cliente_telefono: t.cliente_telefono?.trim() || null,
    items: t.items.filter((i) => i.que.trim() || i.detalle.trim()).map((i) => ({ ...i, que: i.que.trim(), detalle: i.detalle.trim(), cantidad: Math.max(1, Number(i.cantidad) || 1) })),
    entrega: t.entrega || null, total: Number(t.total) || 0, a_cuenta: Number(t.a_cuenta) || 0, notas: t.notas?.trim() || null,
  };
  const { data, error } = await sb.from("trabajos").upsert(fila).select("*").single();
  if (error) throw sinTablaTrabajos(error) ? new Error(AVISO_SIN_TRABAJOS) : error;
  return data as Trabajo;
}

export async function cambiarEstado(id: string, estado: EstadoTrabajo) {
  const ahora = new Date().toISOString();
  const c = estado === "listo" ? { estado, listo_en: ahora } : estado === "entregado" ? { estado, entregado_en: ahora } : { estado, listo_en: null, entregado_en: null };
  const { error } = await sb.from("trabajos").update(c).eq("id", id);
  if (error) throw error;
}

/** Mensaje de WhatsApp para avisar de que está listo */
export function mensajeListo(t: Trabajo, empresa: Pick<Empresa, "nombre">) {
  const quien = (t.cliente_nombre ?? "").split(" ")[0];
  const p = pendienteCent(t);
  return `Hola${quien ? " " + quien : ""}, tu trabajo ${t.numero ?? ""} (${resumenItems(t) || "tus prendas"}) ya está listo para recoger.${p ? ` Pendiente: ${euros(p)}.` : ""} ¡Gracias! ${empresa.nombre}`;
}

/** Ticket de recogida en PDF: en móvil abre el menú de compartir (WhatsApp, correo…); en el ordenador se descarga */
export async function compartirTicketTrabajo(t: Trabajo, empresa: Empresa, soloDescargar = false): Promise<"compartido" | "cancelado" | "descargado"> {
  const { pdfTrabajo } = await import("./pdf-trabajo");
  const blob = await pdfTrabajo(t, empresa);
  const nombre = `Ticket ${t.numero ?? ""} ${t.cliente_nombre ?? ""}.pdf`.replace(/\s+/g, " ").trim();
  const archivo = new File([blob], nombre, { type: "application/pdf" });
  if (!soloDescargar && navigator.canShare?.({ files: [archivo] }) && matchMedia("(pointer: coarse)").matches) {
    try { await navigator.share({ files: [archivo], title: `Ticket ${t.numero}` }); return "compartido"; }
    catch (e) { if ((e as Error).name === "AbortError") return "cancelado"; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "descargado";
}
