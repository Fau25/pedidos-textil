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
  { tipo: "Camiseta técnica", modelo: "Mónaco", referencia: null, tallas: ADULTO, colores: [...BASICOS, "Verde fluor", "Amarillo fluor", "Naranja fluor"], notas: "Revisa referencia y colores" },
  { tipo: "Sudadera con capucha", modelo: "Urban", referencia: null, tallas: ADULTO, colores: ["Blanco", "Negro", "Marino", "Azul royal", "Rojo", "Gris jaspeado", "Celeste", "Rosa claro", "Verde kelly", "Granate", "Verde botella"] },
  { tipo: "Sudadera", modelo: "Clásica", referencia: null, tallas: [...ADULTO, "3/4", "5/6", "7/8", "9/10", "11/12"], colores: [...BASICOS, "Verde botella", "Granate", "Celeste"], notas: "Revisa referencia y colores" },
  { tipo: "Sudadera media cremallera", modelo: "Aneto", referencia: "SU1109", tallas: ADULTO, colores: ["Blanco", "Negro", "Marino", "Azul royal", "Rojo", "Granate", "Gris jaspeado", "Verde botella"] },
  { tipo: "Sudadera oversize", modelo: "Otto", referencia: null, tallas: ADULTO, colores: ["Blanco", "Negro", "Marino", "Gris jaspeado"], notas: "Revisa referencia y colores" },
  { tipo: "Chaqueta softshell", modelo: "Antártida", referencia: null, tallas: ADULTO, colores: ["Negro", "Marino", "Rojo", "Verde botella", "Blanco perla", "Gris plomo"] },
  { tipo: "Chaqueta acolchada", modelo: "Finland", referencia: null, tallas: ADULTO, colores: ["Negro", "Marino", "Rojo", "Granate", "Azul eléctrico", "Ébano", "Verde militar"] },
  { tipo: "Chaqueta acolchada", modelo: "Norway", referencia: null, tallas: ADULTO, colores: ["Negro", "Marino"] },
  { tipo: "Chaqueta softshell", modelo: "Nebraska", referencia: null, tallas: ADULTO, colores: ["Negro", "Marino", "Azul royal", "Rojo", "Verde botella", "Aguamarina", "Lima"] },
  { tipo: "Chaqueta sudadera", modelo: "Ulan", referencia: "6439", tallas: ["XS", ...ADULTO], colores: ["Blanco", "Negro", "Marino", "Azul royal", "Rojo", "Gris jaspeado"] },
];
