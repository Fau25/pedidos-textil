import type { Prenda } from "./tipos";

export const HABITUALES = "Habituales";
/** Categoría del menú según el tipo de prenda */
export function categoria(tipo?: string | null): string {
  const t = (tipo ?? "").toLowerCase();
  if (/polo/.test(t)) return "Polos";
  if (/chaleco/.test(t)) return "Chalecos";
  if (/softshell/.test(t)) return "Softshell";
  if (/polar/.test(t)) return "Polares";
  if (/sudadera/.test(t)) return "Sudaderas";
  if (/chaqueta|cazadora|abrigo|parka/.test(t)) return "Chaquetas";
  if (/camiseta|tirantes/.test(t)) return "Camisetas";
  return "Otras";
}
export const ORDEN_CATS = ["Camisetas", "Polos", "Sudaderas", "Chaquetas", "Polares", "Softshell", "Chalecos", "Otras"];
/** Chips del menú: Habituales (si hay) y las categorías con prendas, con su número */
export function categorias(ps: Pick<Prenda, "tipo" | "favorito">[]): { nombre: string; n: number }[] {
  const cuenta = new Map<string, number>();
  for (const p of ps) cuenta.set(categoria(p.tipo), (cuenta.get(categoria(p.tipo)) ?? 0) + 1);
  const fav = ps.filter((p) => p.favorito).length;
  return [...(fav ? [{ nombre: HABITUALES, n: fav }] : []), ...ORDEN_CATS.filter((c) => cuenta.has(c)).map((c) => ({ nombre: c, n: cuenta.get(c)! }))];
}

