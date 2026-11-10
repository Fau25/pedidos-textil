// Modelos de Roly que se usan habitualmente en el taller.
// Referencias y colores tomados de fichas y tiendas públicas; el precio de compra lo pone cada uno
// (depende del distribuidor). Si se importa la tarifa en Excel, se completan colores y precios.
export type ModeloRoly = { tipo: string; modelo: string; referencia: string | null; colores: string[]; tallas: string[]; notas?: string };

const ADULTO = ["S", "M", "L", "XL", "XXL", "3XL"];
const BASICOS = ["Blanco", "Negro", "Marino", "Azul royal", "Rojo", "Gris vigoré"];

export const MODELOS_ROLY: ModeloRoly[] = [
  { tipo: "Camiseta", modelo: "Beagle", referencia: "CA6554", tallas: [...ADULTO, "4XL", "1/2", "3/4", "5/6", "7/8", "9/10", "11/12"],
    colores: [...BASICOS, "Verde botella", "Verde kelly", "Naranja", "Amarillo", "Granate", "Celeste", "Turquesa", "Chocolate", "Rosa claro", "Fucsia", "Morado", "Gris plomo"] },
  { tipo: "Camiseta cuello pico", modelo: "Samoyedo", referencia: "CA6503", tallas: ADULTO, colores: [...BASICOS, "Verde botella", "Granate"], notas: "Revisa los colores" },
  { tipo: "Camiseta técnica", modelo: "Mónaco", referencia: "CA6401", tallas: ADULTO, colores: [...BASICOS, "Verde fluor", "Amarillo fluor", "Naranja fluor"] },
  { tipo: "Sudadera con capucha", modelo: "Urban", referencia: "SU1067", tallas: ADULTO, colores: ["Blanco", "Negro", "Marino", "Azul royal", "Rojo", "Gris jaspeado", "Celeste", "Rosa claro", "Verde kelly", "Granate", "Verde botella"] },
  { tipo: "Sudadera", modelo: "Clásica", referencia: "SU1070", tallas: [...ADULTO, "3/4", "5/6", "7/8", "9/10", "11/12"], colores: [...BASICOS, "Verde botella", "Granate", "Celeste"], notas: "Revisa los colores" },
  { tipo: "Sudadera media cremallera", modelo: "Aneto", referencia: "SU1109", tallas: ADULTO, colores: ["Blanco", "Negro", "Marino", "Azul royal", "Rojo", "Granate", "Gris jaspeado", "Verde botella"] },
  { tipo: "Sudadera oversize", modelo: "Otto", referencia: "SU6702", tallas: ADULTO, colores: ["Blanco", "Negro", "Marino", "Gris jaspeado"], notas: "Revisa los colores" },
  { tipo: "Chaqueta softshell", modelo: "Antártida", referencia: "SS6432", tallas: ADULTO, colores: ["Negro", "Marino", "Rojo", "Verde botella", "Blanco perla", "Gris plomo"] },
  { tipo: "Chaqueta acolchada", modelo: "Finland", referencia: null, tallas: ADULTO, colores: ["Negro", "Marino", "Rojo", "Granate", "Azul eléctrico", "Ébano", "Verde militar"] },
  { tipo: "Chaqueta acolchada", modelo: "Norway", referencia: null, tallas: ADULTO, colores: ["Negro", "Marino"] },
  { tipo: "Chaqueta softshell", modelo: "Nebraska", referencia: "SS6436", tallas: ADULTO, colores: ["Negro", "Marino", "Azul royal", "Rojo", "Verde botella", "Aguamarina", "Lima"] },
  { tipo: "Chaqueta sudadera", modelo: "Ulan", referencia: "CQ6439", tallas: ["XS", ...ADULTO], colores: ["Blanco", "Negro", "Marino", "Azul royal", "Rojo", "Gris jaspeado"] },
];

/** Referencias comprobadas en roly.eu (nov 2026): corrigen catálogos creados antes sin ellas */
export const REFERENCIAS_ROLY: Record<string, string> = Object.fromEntries(
  MODELOS_ROLY.filter((m) => m.referencia).map((m) => [m.modelo, m.referencia!]));

import datos from "./roly-catalogo.json";
export type ModeloCatalogoRoly = { ref: string; modelo: string; tipo: string; colores: string[]; ninos: boolean };
/** 95 modelos (camisetas, polos, sudaderas, abrigos) con colores del catálogo Roly 2026 */
export const CATALOGO_ROLY = datos.modelos as ModeloCatalogoRoly[];
/** Color real de cada nombre de la carta de colores de Roly (en minúsculas) */
export const HEX_ROLY = datos.hex as Record<string, string>;
export const TALLAS_ADULTO = ["S", "M", "L", "XL", "XXL", "3XL"];
export const TALLAS_NINO = ["1/2", "3/4", "5/6", "7/8", "9/10", "11/12"];
