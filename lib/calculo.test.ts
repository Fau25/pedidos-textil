import { test } from "node:test";
import assert from "node:assert/strict";
import { aCent, calcular, euros, precioVentaUd, redondear, tarifaPara } from "./calculo.ts";

test("aCent convierte euros con coma o punto sin errores de coma flotante", () => {
  assert.equal(aCent("3,20"), 320);
  assert.equal(aCent(0.1 + 0.2), 30);
  assert.equal(aCent(1.005), 101);
  assert.equal(aCent(""), 0);
  assert.equal(aCent("abc"), 0);
});

test("redondeo mitad hacia arriba", () => {
  assert.equal(redondear(2.5), 3);
  assert.equal(redondear(-2.5), -3);
  assert.equal(redondear(2.4999), 2);
});

test("precio de venta: indicado o compra × (1 + margen)", () => {
  assert.equal(precioVentaUd({ precio_compra: 3.2, precio_venta: 6.5 }, 40), 650);
  assert.equal(precioVentaUd({ precio_compra: 3.2, precio_venta: null }, 40), 448);
  assert.equal(precioVentaUd({ precio_compra: 3.33, precio_venta: null }, 50), 500); // 499,5 → 500
});

test("presupuesto completo con prendas, personalización compartida, descuento e IVA", () => {
  const t = calcular({
    margen: 40, descuento_pct: 5, gastos_coste: 10, gastos_venta: 15, iva: 21,
    lineas: [
      { clave: "a", precio_compra: 3.2, precio_venta: 6.5, tallas: [{ talla: "S", cantidad: 8 }, { talla: "M", cantidad: 15 }, { talla: "L", cantidad: 12 }, { talla: "XL", cantidad: 6 }, { talla: "XXL", cantidad: 2 }] },
      { clave: "b", precio_compra: 11.9, precio_venta: 19.5, tallas: [{ talla: "M", cantidad: 10 }, { talla: "L", cantidad: 10 }] },
    ],
    personalizaciones: [
      { tecnica: "Bordado", aplicaciones: 1, coste_ud: 1.2, precio_ud: 2.5, lineas: ["a", "b"] },
      { tecnica: "Serigrafía", aplicaciones: 2, coste_ud: 1.1, precio_ud: 2.2, lineas: ["b"] },
    ],
  });
  assert.equal(t.unidades, 63);
  assert.equal(t.costePrendas, 43 * 320 + 20 * 1190); // 13760 + 23800
  assert.equal(t.ventaPrendas, 43 * 650 + 20 * 1950); // 27950 + 39000
  assert.equal(t.costePers, 63 * 120 + 40 * 110);
  assert.equal(t.ventaPers, 63 * 250 + 40 * 220);
  assert.equal(t.coste, 37560 + 11960 + 1000);
  assert.equal(t.bruto, 66950 + 24550 + 1500); // 93000
  assert.equal(t.descuento, 4650);
  assert.equal(t.base, 88350);
  assert.equal(t.iva, 18554); // 18553,5 → 18554
  assert.equal(t.total, 106904);
  assert.equal(t.margen, 88350 - 50520);
  assert.equal(t.margenPct, 42.8);
  assert.equal(euros(t.total).replace(/\s/g, " "), "1069,04 €".replace(/\s/g, " ").replace("1069", "1069"));
});

test("pedido vacío no divide por cero", () => {
  const t = calcular({ margen: 40, descuento_pct: 0, gastos_coste: 0, gastos_venta: 0, iva: 21, lineas: [], personalizaciones: [] });
  assert.equal(t.total, 0);
  assert.equal(t.margenPct, 0);
});

test("tarifa según unidades", () => {
  const tar = [
    { tecnica_id: "b", desde: 1, hasta: 11, complejidad: "Normal", coste: 2.5, precio: 5 },
    { tecnica_id: "b", desde: 12, hasta: 49, complejidad: "Normal", coste: 1.8, precio: 3.5 },
    { tecnica_id: "b", desde: 50, hasta: null, complejidad: "Normal", coste: 1.2, precio: 2.5 },
  ];
  assert.equal(tarifaPara(tar, "b", 5)?.precio, 5);
  assert.equal(tarifaPara(tar, "b", 12)?.precio, 3.5);
  assert.equal(tarifaPara(tar, "b", 500)?.precio, 2.5);
  assert.equal(tarifaPara(tar, "x", 5), null);
});
