export type Empresa = {
  id: string; nombre: string; nif: string | null; direccion: string | null; email: string | null;
  telefono: string | null; web: string | null; logo_path: string | null;
  iva: number; margen: number; validez_dias: number; condiciones: string | null;
};
export type Estado = { id: string; clave: string | null; nombre: string; orden: number; color: string; final: boolean };
export type Tecnica = { id: string; nombre: string; orden: number };
export type TarifaFila = { id: string; tecnica_id: string; desde: number; hasta: number | null; complejidad: string; coste: number; precio: number };
export type Cliente = {
  id: string; empresa_id: string; nombre: string; contacto: string | null; telefono: string | null; email: string | null;
  direccion: string | null; nif: string | null; facturacion: string | null; notas: string | null; creado: string;
};
export type Proveedor = { id: string; nombre: string; contacto: string | null; telefono: string | null; email: string | null; web: string | null; notas: string | null };
export type Prenda = {
  id: string; tipo: string; marca: string | null; modelo: string | null; colores: string[]; proveedor_id: string | null;
  precio_compra: number; precio_venta: number | null; imagen_path: string | null; notas: string | null;
  referencia: string | null; tallas: string[]; favorito: boolean;
};
export type Pedido = {
  id: string; empresa_id: string; numero: string; cliente_id: string | null; fecha: string; entrega: string | null;
  referencia: string | null; notas: string | null; descuento_pct: number; gastos_coste: number;
  gastos_venta: number; iva: number; coste: number; base: number; total: number; unidades: number; creado: string; actualizado: string;
  entregado: boolean; entregado_en: string | null; editado?: string | null;
  clientes?: { nombre: string } | null;
};
export type Linea = {
  id: string; pedido_id: string; orden: number; tipo: string; marca: string | null; modelo: string | null; color: string | null;
  proveedor_id: string | null; precio_compra: number; precio_venta: number | null; imagen_path: string | null; notas: string | null;
  estado: EstadoLinea; linea_tallas?: { talla: string; cantidad: number; orden: number }[];
};
export type EstadoLinea = "pendiente" | "pedido" | "recibido_parcial" | "recibido" | "en_personalizacion" | "listo" | "entregado";
export type Personalizacion = {
  id: string; pedido_id: string; orden: number; tecnica_id: string | null; tecnica: string; ubicacion: string; aplicaciones: number;
  diseno_path: string | null; coste_ud: number; precio_ud: number; precio_manual: boolean; notas: string | null;
  estado: "pendiente" | "en_proceso" | "hecho"; personalizacion_lineas?: { linea_id: string }[];
};
export type Historial = { id: string; estado_nombre: string | null; nota: string | null; creado: string };
export type Presupuesto = {
  id: string; pedido_id: string; numero: string; version: number; estado: "borrador" | "enviado" | "aceptado" | "rechazado";
  fecha: string; validez: string | null; datos: DatosPresupuesto; base: number; iva: number; total: number; notas: string | null; creado: string;
};
export type DatosPresupuesto = {
  empresa: Partial<Empresa>;
  cliente: Partial<Cliente> | null;
  pedido: { numero: string; referencia: string | null; entrega: string | null };
  lineas: { descripcion: string; detalle: string; unidades: number; precio: number; importe: number }[];
  personalizaciones: { descripcion: string; detalle: string; unidades: number; precio: number; importe: number }[];
  gastos: number; bruto: number; descuento_pct: number; descuento: number; base: number; iva_pct: number; iva: number; total: number;
  condiciones: string | null;
};

export const TALLAS = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];
export const TALLAS_NINO = ["2", "4", "6", "8", "10", "12", "14", "16"];
export const TIPOS_PRENDA = ["Camiseta", "Polo", "Sudadera", "Chaqueta", "Pantalón", "Gorra", "Chaleco", "Camisa", "Delantal", "Mochila", "Toalla"];
export const UBICACIONES = ["Pecho izquierdo", "Pecho derecho", "Pecho centro", "Espalda", "Espalda alta", "Manga izquierda", "Manga derecha", "Nuca", "Frontal gorra", "Lateral gorra"];

export const ESTADOS_LINEA: Record<EstadoLinea, string> = {
  pendiente: "Pendiente de pedir", pedido: "Pedida", recibido_parcial: "Recibida parcial", recibido: "Recibida",
  en_personalizacion: "En personalización", listo: "Lista", entregado: "Entregada",
};
export const ESTADOS_PERS = { pendiente: "Pendiente", en_proceso: "En proceso", hecho: "Hecho" } as const;
export const ESTADOS_PRESU = { borrador: "Borrador", enviado: "Enviado", aceptado: "Aceptado", rechazado: "Rechazado" } as const;
