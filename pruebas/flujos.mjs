// Pruebas de pantallas con datos simulados (sin tocar la base de datos real).
// Uso: npm run build && node pruebas/flujos.mjs   (necesita Google Chrome instalado)
import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const RAIZ = path.resolve("out");
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };
const servidor = http.createServer((q, r) => {
  let f = path.join(RAIZ, decodeURIComponent(q.url.split("?")[0]).replace(/^\/pedidos-textil/, ""));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": TIPOS[path.extname(f)] ?? "application/octet-stream" }); fs.createReadStream(f).pipe(r);
}).listen(0);
const BASE = `http://localhost:${servidor.address().port}/pedidos-textil/`;

const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const E = "00000000-0000-0000-0000-0000000000e1";
const ped = (i, uds, entrega, cliente, extra = {}) => ({ id: "p" + i, numero: "P-2026-000" + i, fecha: dia(-5), entrega, total: "123.40", unidades: uds, referencia: null, entregado: false, entregado_en: null, actualizado: new Date().toISOString(), clientes: { nombre: cliente }, cliente_id: "k1", empresa_id: E, descuento_pct: 0, gastos_coste: 0, gastos_venta: 0, iva: 21, coste: 0, base: 100, notas: null, ...extra });
const T = {
  miembros: [{ empresa_id: E, rol: "propietario" }],
  empresas: [{ id: E, nombre: "Bordados Prueba", iva: 21, margen: 40, validez_dias: 30, condiciones: "Condiciones", nif: null, direccion: null, email: null, telefono: null, web: null, logo_path: null }],
  tecnicas: [{ id: "t1", nombre: "Bordado", orden: 1 }],
  tarifas: [{ id: "r1", tecnica_id: "t1", desde: 1, hasta: null, complejidad: "Normal", coste: 1, precio: 2.5 }],
  proveedores: [],
  invitados: [{ email: "prueba@ejemplo.es", creado: "2026-11-10" }],
  catalogo: [{ id: "c1", tipo: "Camiseta", marca: "Roly", modelo: "Beagle", referencia: "CA6554", colores: ["Blanco", "Negro"], tallas: ["S", "M", "L", "XL"], favorito: true, precio_compra: 0, precio_venta: null, proveedor_id: null, imagen_path: null, notas: null }],
  clientes: [{ id: "k1", nombre: "Club Deportivo Arenal", contacto: "Marta", telefono: "612", email: "a@b.es" }],
  pedidos: [ped(1, 43, dia(-1), "Club Deportivo Arenal", { descuento_pct: 5 }), ped(2, 10, dia(0), "Bar La Esquina"), ped(3, 30, null, "Peña Ciclista")],
  pedido_lineas: [{ id: "l1", pedido_id: "p1", orden: 0, tipo: "Camiseta", marca: "Roly", modelo: "Beagle", color: "Marino", proveedor_id: null, precio_compra: 2, precio_venta: 4.5, imagen_path: null, notas: null, estado: "pendiente", linea_tallas: [{ talla: "M", cantidad: 20, orden: 3 }, { talla: "L", cantidad: 23, orden: 4 }] }],
  personalizaciones: [{ id: "x1", pedido_id: "p1", orden: 0, tecnica_id: "t1", tecnica: "Bordado", ubicacion: "Pecho izquierdo", aplicaciones: 1, diseno_path: null, coste_ud: 1, precio_ud: 2.5, precio_manual: false, notas: null, estado: "pendiente", personalizacion_lineas: [{ linea_id: "l1" }] }],
};
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const sesion = { access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "u1", exp, role: "authenticated" })}.x`, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: exp, user: { id: "u1", email: "prueba@ejemplo.es", aud: "authenticated", role: "authenticated" } };

const navegador = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
async function abrir({ caido = false } = {}) {
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, locale: "es-ES", timezoneId: "Europe/Madrid" });
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), ["sb-sqartxsdlynecelkufyq-auth-token", JSON.stringify(sesion)]);
  const escrituras = [];
  await ctx.route("**/*.supabase.co/**", async (r) => {
    if (caido) return r.abort("internetdisconnected");
    const req = r.request(); const u = new URL(req.url()); const tabla = u.pathname.match(/rest\/v1\/(?:rpc\/)?(\w+)/)?.[1];
    if (req.method() !== "GET") { escrituras.push({ tabla, url: req.url(), metodo: req.method(), cuerpo: (() => { try { return req.postDataJSON(); } catch { return null; } })() }); return r.fulfill({ status: 200, contentType: "application/json", body: tabla === "guardar_pedido" ? '"P-2026-0009"' : "[]" }); }
    if (!tabla) return r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    let filas = T[tabla] ?? [];
    for (const [k, v] of u.searchParams) if (v.startsWith("eq.") && ["id", "pedido_id", "favorito", "entregado"].includes(k)) filas = filas.filter((x) => String(x[k]) === v.slice(3));
    const uno = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(uno ? filas[0] ?? null : filas) });
  });
  const p = await ctx.newPage(); const errores = [];
  p.on("pageerror", (e) => errores.push(e.message));
  p.on("console", (m) => m.type() === "error" && !/WebSocket|realtime|ERR_INTERNET_DISCONNECTED|Failed to load resource/i.test(m.text()) && errores.push(m.text()));
  return { ctx, p, errores, escrituras };
}
const ir = async (p, ruta) => { await p.goto(BASE + ruta, { waitUntil: "networkidle" }); await p.waitForTimeout(500); };
let fallos = 0;
async function prueba(nombre, fn) {
  try { await fn(); console.log("ok -", nombre); }
  catch (e) { fallos++; console.log("FALLO -", nombre, "\n   ", e.message.split("\n").slice(0, 14).join("\n    ")); }
}

await prueba("todas las pantallas cargan sin errores", async () => {
  const { ctx, p, errores } = await abrir();
  for (const r of ["", "pedidos/", "pedidos/ver/?id=p1", "pedidos/nuevo/", "clientes/", "clientes/ver/?id=k1", "catalogo/", "ajustes/"]) await ir(p, r);
  assert.deepEqual(errores, []); await ctx.close();
});
await prueba("al saltar de un pedido a otro con el buscador se ve el nuevo", async () => {
  const { ctx, p } = await abrir();
  await ir(p, "pedidos/ver/?id=p1");
  assert.match(await p.locator("h1").innerText(), /Club Deportivo/);
  await p.keyboard.press("Control+k"); await p.getByPlaceholder(/Buscar pedido/).fill("Bar"); await p.waitForTimeout(800);
  await p.locator("[role=dialog] button", { hasText: "Bar La Esquina" }).first().click(); await p.waitForTimeout(800);
  await p.getByText("P-2026-0002").first().waitFor({ timeout: 5000 });
  assert.doesNotMatch(await p.locator("main").innerText(), /P-2026-0001/); await ctx.close();
});
await prueba("la ficha «Nuevo pedido» abre el editor y guarda todo en una sola llamada", async () => {
  const { ctx, p, escrituras, errores } = await abrir();
  await ir(p, "");
  await p.getByRole("link", { name: /Nuevo pedido/ }).first().click();
  await p.waitForURL(/pedidos\/nuevo/); await p.waitForTimeout(800);
  assert.equal(await p.getByText("Entrega prevista").count(), 0, "sin fecha de entrega");
  assert.equal(await p.getByText(/Precio de compra|Coste \/ ud/).count(), 0, "sin precio de coste");
  await p.getByLabel("Buscar cliente").click(); await p.getByRole("option", { name: /Club Deportivo/ }).click();
  await p.getByLabel("Buscar prenda 1").fill("beagle");
  await p.getByRole("option", { name: /Roly Beagle/ }).click();
  assert.match(await p.locator("main").innerText(), /Roly Beagle/, "rellena el modelo");
  await p.getByRole("button", { name: "Blanco", exact: true }).click();
  await p.getByLabel("Cantidad talla M").fill("10"); await p.getByLabel("Cantidad talla L").fill("5");
  await p.getByLabel("Precio / ud").fill("4,50");
  await p.getByRole("radio", { name: "Bordado" }).click();
  assert.match(await p.locator("main").innerText(), /Ubicación/, "al elegir la técnica salen sus características");
  await p.getByRole("button", { name: "Guardar pedido" }).click(); await p.waitForTimeout(1000);
  const g = escrituras.filter((x) => x.tabla === "guardar_pedido");
  assert.equal(g.length, 1, "una sola llamada");
  const d = g[0].cuerpo.p;
  assert.equal(d.entrega, null);
  assert.deepEqual(d.lineas[0].tallas.map((t) => `${t.talla}=${t.cantidad}`), ["M=10", "L=5"]);
  assert.equal(d.lineas[0].precio_venta, 4.5);
  assert.equal(d.lineas[0].color, "Blanco");
  assert.equal(d.pers[0].tecnica, "Bordado");
  assert.equal(d.total, 127.05, "total " + d.total); // (15×4,50 + 15×2,50) × 1,21
  assert.deepEqual(errores, []); await ctx.close();
});
await prueba("marcar entregado ofrece deshacer", async () => {
  const { ctx, p, escrituras } = await abrir();
  await ir(p, "");
  await p.getByRole("button", { name: /Marcar P-2026-0002 como entregado/ }).click();
  await p.getByRole("button", { name: "Deshacer" }).click(); await p.waitForTimeout(400);
  const e = escrituras.filter((x) => x.tabla === "pedidos").map((x) => x.cuerpo.entregado);
  assert.deepEqual(e, [true, false]); await ctx.close();
});
await prueba("el PDF del presupuesto se descarga", async () => {
  const { ctx, p } = await abrir();
  await ir(p, "pedidos/ver/?id=p1");
  const [d] = await Promise.all([p.waitForEvent("download", { timeout: 30000 }), p.getByRole("button", { name: "PDF" }).click()]);
  const f = await d.path(); assert.ok(fs.statSync(f).size > 2000); await ctx.close();
});
await prueba("sin conexión avisa en vez de pedir crear el taller", async () => {
  const { ctx, p } = await abrir({ caido: true });
  await p.goto(BASE, { waitUntil: "load" }); await p.getByText("Sin conexión").first().waitFor({ timeout: 20000 }).catch(() => {});
  const t = await p.locator("body").innerText();
  assert.match(t, /Sin conexión/); assert.doesNotMatch(t, /Tu taller/); await ctx.close();
});

await prueba("importar una tarifa en Excel agrupa modelos, colores y tallas", async () => {
  const { default: escribir } = await import("write-excel-file/node");
  const f = path.join(fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "tarifa-")), "tarifa.xlsx");
  const filas = [["Referencia", "Descripción", "Color", "Talla", "Precio"],
    ["CA6554", "Camiseta Beagle", "Blanco", "S", 1.5], ["CA6554", "Camiseta Beagle", "Negro", "M", 1.75], ["SU1109", "Sudadera Aneto", "Marino", "L", 9.9]];
  await escribir(filas).toFile(f);
  const { ctx, p, escrituras, errores } = await abrir();
  await ir(p, "catalogo/");
  await p.locator("input[type=file]").setInputFiles(f);
  await p.getByRole("button", { name: /Importar 3 filas/ }).click(); await p.waitForTimeout(1000);
  const ins = escrituras.filter((x) => x.tabla === "catalogo");
  const nuevos = ins.flatMap((x) => (Array.isArray(x.cuerpo) ? x.cuerpo : [x.cuerpo]));
  assert.ok(nuevos.some((n) => n.referencia === "SU1109" && n.precio_compra === 9.9), JSON.stringify(nuevos).slice(0, 200));
  assert.ok(ins.length >= 2, "actualiza Beagle e inserta Aneto");
  assert.deepEqual(errores, []); await ctx.close();
});
await prueba("la copia de seguridad se descarga en Excel", async () => {
  const { ctx, p } = await abrir();
  await ir(p, "ajustes/");
  const [d] = await Promise.all([p.waitForEvent("download", { timeout: 30000 }), p.getByRole("button", { name: "Descargar copia en Excel" }).click()]);
  assert.match(d.suggestedFilename(), /^Copia .*\.xlsx$/); assert.ok(fs.statSync(await d.path()).size > 3000); await ctx.close();
});

await prueba("el catálogo de Roly se completa con colores y fotos, y las fotos se suben en bloque", async () => {
  const { ctx, p, errores, escrituras } = await abrir();
  await ir(p, "");
  await p.waitForTimeout(5500);
  const ins = escrituras.filter((x) => x.tabla === "catalogo" && x.metodo === "POST").flatMap((x) => x.cuerpo);
  const beagle = escrituras.find((x) => x.tabla === "catalogo" && x.metodo === "PATCH");
  assert.equal(ins.length, 96, "añade los modelos que faltan");
  assert.ok(ins.every((n) => n.imagen_path === "roly:" + n.referencia && n.favorito === false));
  assert.equal(beagle.cuerpo.colores.length, 36); assert.equal(beagle.cuerpo.imagen_path, "roly:CA6554");
  await ir(p, "ajustes/");
  await p.getByLabel("Subir fotos de Roly").setInputFiles([{ name: "Camiseta CA6554.jpg", mimeType: "image/jpeg", buffer: Buffer.from([255, 216, 255]) }, { name: "logo.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") }]);
  await p.getByText(/1 fotos subidas/).waitFor();
  assert.ok(escrituras.some((x) => /storage\/v1\/object\/roly\/CA6554\.jpg/.test(x.url)));
  assert.deepEqual(errores, []); await ctx.close();
});

await prueba("ninguna pantalla se sale de lado en móvil ni tablet", async () => {
  const { ctx, p, errores } = await abrir();
  for (const w of [360, 390, 768, 1024]) {
    await p.setViewportSize({ width: w, height: 900 });
    for (const ruta of ["", "pedidos/", "pedidos/ver/?id=p1", "pedidos/nuevo/?id=p1", "clientes/", "clientes/ver/?id=k1", "catalogo/", "ajustes/"]) {
      await ir(p, ruta);
      const sobra = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(sobra <= 1, `${ruta || "inicio"} a ${w}px se sale ${sobra}px`);
    }
  }
  assert.deepEqual(errores, []); await ctx.close();
});

await prueba("editar un pedido no guarda hasta pulsar Guardar; Cancelar sale sin guardar", async () => {
  const { ctx, p, escrituras, errores } = await abrir();
  await ir(p, "pedidos/nuevo/?id=p1");
  assert.equal(await p.getByRole("button", { name: /Desde el catálogo/ }).count(), 0, "sin botón azul de catálogo");
  await p.getByRole("button", { name: /Cliente y fecha/ }).click();
  await p.getByLabel("Referencia interna (opcional)").fill("Cambio de prueba"); await p.waitForTimeout(1500);
  assert.equal(escrituras.filter((x) => x.tabla === "guardar_pedido").length, 0, "no se guarda solo");
  await p.getByRole("button", { name: "Cancelar" }).first().click();
  await p.getByRole("button", { name: "Salir sin guardar" }).click(); await p.waitForURL(/pedidos\/ver/);
  assert.equal(escrituras.filter((x) => x.tabla === "guardar_pedido").length, 0, "cancelar no guarda");
  assert.deepEqual(errores, []); await ctx.close();
});
await prueba("en el catálogo la foto se ve en grande y el lápiz abre los datos", async () => {
  const { ctx, p, errores } = await abrir();
  await ir(p, "catalogo/");
  await p.getByRole("button", { name: "Ver Beagle en grande" }).click();
  assert.equal(await p.getByText("Editar prenda").count(), 0, "los datos no salen de primeras");
  await p.getByRole("button", { name: "Editar los datos de la prenda" }).click();
  await p.getByText("Editar prenda").waitFor();
  assert.deepEqual(errores, []); await ctx.close();
});
await prueba("en pantallas táctiles los campos tienen 16px (sin zoom al escribir)", async () => {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), ["sb-sqartxsdlynecelkufyq-auth-token", JSON.stringify(sesion)]);
  await ctx.route("**/*.supabase.co/**", (r) => { const t = new URL(r.request().url()).pathname.match(/rest\/v1\/(\w+)/)?.[1]; r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(T[t] ?? []) }); });
  const p = await ctx.newPage(); await ir(p, "pedidos/");
  const tam = await p.evaluate(() => [...document.querySelectorAll("input, select, textarea")].filter((e) => e.offsetParent).map((e) => parseFloat(getComputedStyle(e).fontSize)));
  assert.ok(tam.length && tam.every((x) => x >= 16), JSON.stringify(tam)); await ctx.close();
});

await prueba("las fotos del catálogo se firman en un solo lote y se ven", async () => {
  const { ctx, p, errores } = await abrir();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  let firmas = 0;
  await ctx.route("**/storage/v1/object/sign/roly", async (r) => { firmas++; const { paths } = r.request().postDataJSON();
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(paths.map((x) => ({ path: x, signedURL: "/object/sign/roly/" + x + "?token=t", error: null }))) }); });
  await ctx.route("**/storage/v1/object/sign/roly/*.jpg*", (r) => r.fulfill({ status: 200, contentType: "image/png", body: png }));
  T.catalogo.push({ ...T.catalogo[0], id: "c2", modelo: "Samoyedo", referencia: "CA6503", imagen_path: "roly:CA6503" });
  T.catalogo[0] = { ...T.catalogo[0], imagen_path: "roly:CA6554" };
  await ir(p, "catalogo/"); await p.waitForTimeout(800);
  assert.equal(firmas, 1, "un solo lote de firmas");
  assert.equal(await p.locator('main img[src*="roly/CA6554"]').count(), 1);
  T.catalogo = T.catalogo.slice(0, 1); T.catalogo[0] = { ...T.catalogo[0], imagen_path: null };
  assert.deepEqual(errores, []); await ctx.close();
});

await navegador.close(); servidor.close();
if (fallos) { console.log(`\n${fallos} prueba(s) fallida(s)`); process.exit(1); }
console.log("\nTodas las pruebas de pantalla pasan");
