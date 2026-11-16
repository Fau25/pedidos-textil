import { sb } from "./supabase";
import { REFERENCIAS_ROLY, TALLAS_ADULTO, TALLAS_NINO, cargarCatalogoRoly } from "./roly";

/** Pone el catálogo de Roly 2026 en el taller: completa referencias, colores y fotos de lo que ya hay
 *  y da de alta los modelos que falten. Devuelve cuántos ha añadido y cuántos ha corregido. */
export async function ponerRolyAlDia(empresaId: string): Promise<{ nuevos: number; cambios: number }> {
  const CATALOGO_ROLY = await cargarCatalogoRoly();
  const norm = (x?: string | null) => (x ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const { data, error } = await sb.from("catalogo").select("id, modelo, referencia, notas, imagen_path, colores").eq("empresa_id", empresaId).ilike("marca", "roly");
  if (error) throw error;
  const BEBE = ["BD7200", "BD7202", "CA7203", "CA6564"]; // quitadas del catálogo (bebé)
  const fuera = (data ?? []).filter((f) => BEBE.includes(f.referencia ?? ""));
  if (fuera.length) { const { error: e } = await sb.from("catalogo").delete().in("id", fuera.map((f) => f.id)); if (e) throw e; }
  const filas = (data ?? []).filter((f) => !BEBE.includes(f.referencia ?? ""));
  // primero, referencias de los modelos antiguos que no la tenían
  for (const p of filas) { const r = REFERENCIAS_ROLY[p.modelo ?? ""]; if (r && !p.referencia) p.referencia = r; }
  const nuevos = []; const cambios: { id: string; c: Record<string, unknown> }[] = [];
  for (const m of CATALOGO_ROLY) {
    const p = filas.find((f) => f.referencia === m.ref) ?? filas.find((f) => !f.referencia && norm(f.modelo) === norm(m.modelo));
    if (p) {
      const c: Record<string, unknown> = {};
      if (p.referencia !== m.ref) c.referencia = m.ref;
      if (m.colores.length && JSON.stringify(p.colores ?? []) !== JSON.stringify(m.colores)) c.colores = m.colores;
      if (!p.imagen_path) c.imagen_path = "roly:" + m.ref;
      if (p.notas === "Revisa referencia y colores" || (p.notas === "Revisa los colores" && m.colores.length)) c.notas = null;
      if (Object.keys(c).length) cambios.push({ id: p.id, c }); // solo lo que de verdad cambia
    } else nuevos.push({ empresa_id: empresaId, marca: "Roly", tipo: m.tipo, modelo: m.modelo, referencia: m.ref, colores: m.colores,
      tallas: m.ninos ? TALLAS_NINO : TALLAS_ADULTO, favorito: false, precio_compra: 0, imagen_path: "roly:" + m.ref, notas: m.colores.length ? null : "Revisa los colores" });
  }
  for (let i = 0; i < cambios.length; i += 8) {
    const r = await Promise.all(cambios.slice(i, i + 8).map((x) => sb.from("catalogo").update(x.c).eq("id", x.id)));
    const e = r.find((x) => x.error)?.error; if (e) throw e;
  }
  if (nuevos.length) { const { error: e } = await sb.from("catalogo").insert(nuevos); if (e) throw e; }
  return { nuevos: nuevos.length, cambios: cambios.length };
}
