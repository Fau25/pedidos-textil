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
  admins: [{ user_id: "u1" }],
  trabajos: [
    { id: "tr1", empresa_id: E, numero: "T-0007", cliente_id: null, cliente_nombre: "Laura Gómez", cliente_telefono: "612345678", items: [{ id: "i1", que: "Juego de cuna", cantidad: 2, tecnica: "Bordado", detalle: "Nombre en la esquina", diseno_path: null }], entrega: "2026-11-20", total: 36, a_cuenta: 10, notas: null, estado: "pendiente", listo_en: null, entregado_en: null, creado: "2026-11-14T10:00:00Z" },
    { id: "tr2", empresa_id: E, numero: "T-0006", cliente_id: null, cliente_nombre: "Mario Ruiz", cliente_telefono: "600111222", items: [{ id: "i2", que: "Mochila", cantidad: 1, tecnica: "Vinilo", detalle: "", diseno_path: null }], entrega: "2026-11-14", total: 8, a_cuenta: 0, notas: null, estado: "listo", listo_en: null, entregado_en: null, creado: "2026-11-13T10:00:00Z" },
  ],
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
async function abrir({ caido = false, conflicto = false } = {}) {
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, locale: "es-ES", timezoneId: "Europe/Madrid" });
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), ["sb-sqartxsdlynecelkufyq-auth-token", JSON.stringify(sesion)]);
  const escrituras = [];
  await ctx.route("**/*.supabase.co/**", async (r) => {
    if (caido) return r.abort("internetdisconnected");
    const req = r.request(); const u = new URL(req.url()); const tabla = u.pathname.match(/rest\/v1\/(?:rpc\/)?(\w+)/)?.[1];
    if (req.method() !== "GET" && tabla === "guardar_pedido" && conflicto && !req.postDataJSON()?.p?.forzar) { escrituras.push({ tabla, metodo: "POST", cuerpo: req.postDataJSON(), rechazado: true }); return r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0409", message: "CONFLICTO: otra persona guardó este pedido mientras lo editabas" }) }); }
    if (req.method() !== "GET") { escrituras.push({ tabla, url: req.url(), metodo: req.method(), cuerpo: (() => { try { return req.postDataJSON(); } catch { return null; } })() }); return r.fulfill({ status: 200, contentType: "application/json", body: tabla === "guardar_pedido" ? '"P-2026-0009"' : tabla === "trabajos" && req.method() === "POST" ? JSON.stringify({ numero: "T-0008", creado: "2026-11-14T12:00:00Z", estado: "pendiente", ...req.postDataJSON() }) : tabla === "emitir_factura" ? JSON.stringify({ id: "f1", pedido_id: req.postDataJSON().p_pedido, numero: "F-2026-0001", fecha: "2026-11-11", datos: req.postDataJSON().p_datos, base: 100, iva: 21, total: 121 }) : "[]" }); }
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
  for (const r of ["", "pedidos/", "pedidos/ver/?id=p1", "pedidos/nuevo/", "clientes/", "clientes/ver/?id=k1", "catalogo/", "trabajos/", "trabajos/nuevo/", "ajustes/"]) await ir(p, r);
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
  // en un pedido nuevo los bloques empiezan plegados
  assert.equal(await p.getByLabel("Buscar cliente").count(), 0, "bloques plegados al empezar");
  await p.getByRole("button", { name: /^Cliente/ }).click();
  await p.getByLabel("Buscar cliente").click(); await p.getByRole("option", { name: /Club Deportivo/ }).click();
  await p.getByRole("button", { name: /^Prendas/ }).click();
  await p.getByLabel("Buscar prenda 1").fill("beagle");
  await p.getByRole("option", { name: /Roly Beagle/ }).click();
  assert.match(await p.locator("main").innerText(), /Roly Beagle/, "rellena el modelo");
  await p.getByRole("button", { name: "Blanco", exact: true }).click();
  await p.getByLabel("Cantidad talla M").fill("10"); await p.getByLabel("Cantidad talla L").fill("5");
  await p.getByLabel("Precio / ud").fill("4,50");
  await p.getByRole("button", { name: /^Personalización/ }).click();
  await p.getByRole("radio", { name: "Bordado" }).click();
  assert.match(await p.locator("main").innerText(), /Ubicación/i, "al elegir la técnica salen sus características");
  await p.getByRole("button", { name: "Pecho centro" }).click();
  assert.equal(await p.getByRole("button", { name: "Pecho centro" }).getAttribute("aria-pressed"), "true", "ubicación con icono");
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
  const [d] = await Promise.all([p.waitForEvent("download", { timeout: 30000 }), p.getByRole("button", { name: "Presupuesto" }).click()]);
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
  assert.equal(ins.length, 92, "añade los modelos que faltan (sin bebé)");
  assert.ok(!ins.some((n) => ["BD7200", "BD7202", "CA7203", "CA6564"].includes(n.referencia)), "sin prendas de bebé");
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
    for (const ruta of ["", "pedidos/", "pedidos/ver/?id=p1", "pedidos/nuevo/?id=p1", "clientes/", "clientes/ver/?id=k1", "catalogo/", "trabajos/", "trabajos/nuevo/?id=tr1", "ajustes/"]) {
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
  await p.getByRole("button", { name: /^Cliente/ }).click();
  await p.getByLabel("Referencia interna (opcional)").fill("Cambio de prueba"); await p.waitForTimeout(1500);
  assert.equal(escrituras.filter((x) => x.tabla === "guardar_pedido").length, 0, "no se guarda solo");
  await p.getByRole("button", { name: "Cancelar" }).first().click();
  await p.getByRole("button", { name: "Salir sin guardar" }).click(); await p.waitForURL(/pedidos\/ver/);
  assert.equal(escrituras.filter((x) => x.tabla === "guardar_pedido").length, 0, "cancelar no guarda");
  assert.deepEqual(errores, []); await ctx.close();
});
await prueba("los cambios sin guardar de un pedido se recuperan al volver a abrirlo", async () => {
  const { ctx, p, errores } = await abrir();
  await ir(p, "pedidos/nuevo/?id=p1");
  await p.getByRole("button", { name: /^Cliente/ }).click();
  await p.getByLabel("Referencia interna (opcional)").fill("No lo guardé"); await p.waitForTimeout(700);
  await ir(p, "pedidos/nuevo/?id=p1"); // como si se hubiera cerrado la app
  await p.getByText("Hemos recuperado los cambios que no guardaste").waitFor();
  await p.getByRole("button", { name: /^Cliente/ }).click();
  assert.equal(await p.getByLabel("Referencia interna (opcional)").inputValue(), "No lo guardé");
  assert.deepEqual(errores, []); await ctx.close();
});
await prueba("si otra persona guardó el pedido antes, avisa y deja elegir", async () => {
  const { ctx, p, escrituras } = await abrir({ conflicto: true });
  await ir(p, "pedidos/nuevo/?id=p1");
  await p.getByRole("button", { name: /^Cliente/ }).click();
  await p.getByLabel("Referencia interna (opcional)").fill("Mis cambios");
  await p.getByRole("button", { name: "Guardar" }).last().click();
  await p.getByText("Otra persona ha cambiado este pedido").waitFor();
  await p.getByRole("alertdialog").getByRole("button", { name: "Guardar los míos" }).click();
  await p.waitForURL(/pedidos\/ver/);
  const g = escrituras.filter((x) => x.tabla === "guardar_pedido");
  assert.equal(g.length, 2); assert.equal(g[1].cuerpo.p.forzar, true);
  await ctx.close();
});
await prueba("en el catálogo la foto se ve en grande y el lápiz abre los datos", async () => {
  const { ctx, p, errores } = await abrir();
  await ir(p, "catalogo/");
  await p.getByRole("button", { name: /Beagle.*ver en grande/ }).click();
  assert.equal(await p.getByText("Editar prenda").count(), 0, "los datos no salen de primeras");
  await p.getByRole("button", { name: "Editar los datos de la prenda" }).click();
  await p.getByText("Editar prenda").waitFor();
  assert.deepEqual(errores, []); await ctx.close();
});
await prueba("al escribir en una hoja el foco no salta a otro campo", async () => {
  const { ctx, p, errores } = await abrir();
  await ir(p, "catalogo/");
  await p.getByRole("button", { name: /Beagle.*ver en grande/ }).click();
  await p.getByRole("button", { name: "Editar los datos de la prenda" }).click();
  const c = p.getByRole("dialog").locator("input[type=text], input:not([type])").nth(1);
  const antes = await c.inputValue(); await c.click(); await c.press("End"); await c.pressSequentially("xyz", { delay: 60 });
  assert.equal(await c.inputValue(), antes + "xyz");
  assert.deepEqual(errores, []); await ctx.close();
});
await prueba("quitar una prenda del catálogo la borra al momento y se puede deshacer", async () => {
  const { ctx, p, errores, escrituras } = await abrir();
  await ir(p, "catalogo/");
  await p.getByRole("button", { name: /Beagle.*ver en grande/ }).click();
  await p.getByRole("button", { name: "Editar los datos de la prenda" }).click();
  await p.getByRole("button", { name: "Eliminar prenda" }).click();
  await p.getByRole("button", { name: "Deshacer" }).click({ timeout: 3000 });
  await p.waitForTimeout(400);
  assert.ok(escrituras.some((x) => x.tabla === "catalogo" && x.metodo === "DELETE"), "borra");
  const vuelta = escrituras.find((x) => x.tabla === "catalogo" && x.metodo === "POST");
  assert.equal(vuelta?.cuerpo?.id ?? vuelta?.cuerpo?.[0]?.id, "c1", "deshacer la vuelve a insertar");
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

await prueba("si una foto no tiene miniatura, se ve la original", async () => {
  const { ctx, p, errores } = await abrir();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  await ctx.route("**/storage/v1/object/sign/roly", async (r) => { const { paths } = r.request().postDataJSON();
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(paths.map((x) => x.startsWith("mini/") ? { path: x, signedURL: null, error: "Object not found" } : { path: x, signedURL: "/object/sign/roly/" + x + "?token=t", error: null })) }); });
  await ctx.route("**/storage/v1/object/sign/roly/*.jpg*", (r) => r.fulfill({ status: 200, contentType: "image/png", body: png }));
  T.catalogo[0] = { ...T.catalogo[0], imagen_path: "roly:CA6554" };
  await ir(p, "catalogo/"); await p.waitForTimeout(800);
  assert.equal(await p.locator('main img[src*="roly/CA6554.jpg"]').count(), 1);
  T.catalogo[0] = { ...T.catalogo[0], imagen_path: null };
  assert.deepEqual(errores, []); await ctx.close();
});
await prueba("un fallo inesperado queda apuntado en el registro de errores", async () => {
  const { ctx, p, escrituras } = await abrir();
  await ir(p, "");
  await p.evaluate(() => setTimeout(() => { throw new Error("fallo de prueba"); }));
  await p.waitForTimeout(800);
  const e = escrituras.find((x) => x.tabla === "errores");
  assert.ok(e, "se apunta"); assert.match(JSON.stringify(e.cuerpo), /fallo de prueba/); assert.match(JSON.stringify(e.cuerpo), /2\.\d+\.\d+/);
  await ctx.close();
});
await prueba("se quita una vez la técnica Serigrafía del taller del administrador", async () => {
  T.tecnicas.push({ id: "t9", nombre: "Serigrafía", orden: 2 });
  const { ctx, p, escrituras } = await abrir();
  await ir(p, ""); await p.waitForTimeout(800);
  T.tecnicas.pop();
  assert.ok(escrituras.some((x) => x.tabla === "tecnicas" && x.metodo === "DELETE" && /t9/.test(x.url ?? JSON.stringify(x))), "borra Serigrafía");
  await ctx.close();
});
await prueba("generar factura: pide el NIF del taller, confirma, emite y la enseña", async () => {
  const { ctx, p, errores, escrituras } = await abrir();
  await ir(p, "pedidos/nuevo/?id=p1");
  await p.getByRole("button", { name: "Generar factura" }).click();
  await p.getByText("añade el NIF de tu taller").waitFor();
  assert.ok(!escrituras.some((x) => x.tabla === "emitir_factura"));
  await ctx.close();
  T.empresas[0].nif = "B12345678";
  try {
    const b = await abrir();
    await ir(b.p, "pedidos/nuevo/?id=p1");
    await b.p.getByRole("button", { name: "Generar factura" }).click();
    await b.p.getByRole("alertdialog").getByRole("button", { name: "Emitir factura" }).click();
    await b.p.getByRole("dialog", { name: "Factura" }).getByText("F-2026-0001").waitFor();
    const e = b.escrituras.find((x) => x.tabla === "emitir_factura");
    assert.equal(e.cuerpo.p_pedido, "p1"); assert.ok(e.cuerpo.p_datos.total > 0, "lleva los totales");
    assert.ok(await b.p.getByRole("button", { name: "Ver factura" }).isVisible());
    assert.deepEqual(b.errores, []); await b.ctx.close();
  } finally { T.empresas[0].nif = null; }
  assert.deepEqual(errores, []);
});
await prueba("recibí: apuntar un trabajo con prendas libres genera su ticket", async () => {
  const { ctx, p, errores, escrituras } = await abrir();
  await ir(p, "trabajos/nuevo/");
  await p.getByRole("button", { name: /Guardar y generar ticket/ }).click();
  await p.getByText("Escribe el nombre del cliente").waitFor();
  await p.getByPlaceholder("Nombre", { exact: true }).fill("Ana Pérez");
  await p.getByPlaceholder("Teléfono").fill("611222333");
  await p.getByLabel("Prenda 1").getByPlaceholder("Juego de cuna, toalla, mochila…").fill("Juego de cuna");
  await p.getByLabel("Prenda 1").locator('input[type="number"]').fill("2");
  await p.getByLabel("Prenda 1").getByPlaceholder(/Qué y dónde/).fill("Nombre «Lucía» en la esquina");
  await p.getByRole("button", { name: "Añadir otra prenda" }).click();
  await p.getByLabel("Prenda 2").getByPlaceholder("Juego de cuna, toalla, mochila…").fill("Toalla");
  await p.getByLabel("Prenda 2").getByRole("radio", { name: "Bordado" }).click(); // sin personalización
  await p.getByLabel("Precio total").fill("36"); await p.getByLabel("Deja a cuenta").fill("10");
  await p.getByText("26,00 €").first().waitFor();
  await p.getByRole("button", { name: /Guardar y generar ticket/ }).click();
  const hoja = p.getByRole("dialog", { name: "Ticket de recogida" });
  await hoja.getByText("T-0008").waitFor();
  assert.ok(await hoja.getByText("Juego de cuna").isVisible());
  const g = escrituras.find((x) => x.tabla === "trabajos" && x.metodo === "POST").cuerpo;
  assert.equal(g.cliente_nombre, "Ana Pérez"); assert.equal(g.items.length, 2); assert.equal(g.items[0].cantidad, 2);
  assert.equal(g.items[0].tecnica, "Bordado"); assert.equal(g.items[1].tecnica, ""); assert.equal(g.total, 36); assert.equal(g.a_cuenta, 10);
  await hoja.getByRole("button", { name: /PDF/ }).click();
  await p.getByText("Ticket descargado en PDF").waitFor({ timeout: 15000 });
  assert.deepEqual(errores, []); await ctx.close();
});
await prueba("trabajos: lista por estado, marcar listo y avisar por WhatsApp", async () => {
  const { ctx, p, errores, escrituras } = await abrir();
  await ir(p, "trabajos/");
  await p.getByText("Laura Gómez").waitFor();
  await p.getByRole("button", { name: "Marcar listo" }).click();
  await p.waitForTimeout(300);
  const m = escrituras.find((x) => x.tabla === "trabajos" && x.metodo === "PATCH");
  assert.equal(m?.cuerpo?.estado, "listo");
  await p.getByRole("tab", { name: /Listos/ }).click();
  const hrefs = await p.getByRole("link", { name: "Avisar" }).evaluateAll((as) => as.map((a) => a.href));
  assert.ok(hrefs.some((h) => /wa\.me\/34600111222\?text=.*listo/.test(h)), hrefs.join(" "));
  assert.deepEqual(errores, []); await ctx.close();
});
await prueba("las fotos del catálogo se firman en un solo lote y se ven", async () => {
  const { ctx, p, errores } = await abrir();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  let firmas = 0;
  await ctx.route("**/storage/v1/object/sign/roly", async (r) => { firmas++; const { paths } = r.request().postDataJSON();
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(paths.map((x) => ({ path: x, signedURL: "/object/sign/roly/" + x + "?token=t", error: null }))) }); });
  await ctx.route("**/storage/v1/object/sign/roly/mini/*.webp*", (r) => r.fulfill({ status: 200, contentType: "image/png", body: png }));
  T.catalogo.push({ ...T.catalogo[0], id: "c2", modelo: "Samoyedo", referencia: "CA6503", imagen_path: "roly:CA6503" });
  T.catalogo[0] = { ...T.catalogo[0], imagen_path: "roly:CA6554" };
  await ir(p, "catalogo/"); await p.waitForTimeout(800);
  assert.equal(firmas, 1, "un solo lote de firmas");
  assert.equal(await p.locator('main img[src*="roly/mini/CA6554.webp"]').count(), 1, "en las fichas, la miniatura");
  T.catalogo = T.catalogo.slice(0, 1); T.catalogo[0] = { ...T.catalogo[0], imagen_path: null };
  assert.deepEqual(errores, []); await ctx.close();
});

await prueba("el ticket del pedido se genera y se puede enviar o descargar", async () => {
  const { ctx, p, errores } = await abrir();
  await ir(p, "pedidos/nuevo/?id=p1");
  await p.getByRole("button", { name: "Ticket", exact: true }).click();
  const tk = p.getByRole("article", { name: "Vista previa del ticket" });
  await tk.waitFor();
  const txt = await tk.innerText();
  assert.match(txt, /P-2026-0001/); assert.match(txt, /Club Deportivo Arenal/); assert.match(txt, /Total/); assert.match(txt, /IVA 21/);
  assert.ok(await p.getByRole("button", { name: /Enviar al cliente/ }).isEnabled());
  const descarga = p.waitForEvent("download", { timeout: 30000 });
  await p.getByRole("button", { name: /^PDF$/ }).click();
  assert.match((await descarga).suggestedFilename(), /^Ticket P-2026-0001/);
  await p.keyboard.press("Escape");
  await ir(p, "pedidos/ver/?id=p1"); await p.getByRole("button", { name: "Ticket" }).click();
  await p.getByRole("article", { name: "Vista previa del ticket" }).waitFor();
  assert.deepEqual(errores, []); await ctx.close();
});

await prueba("borrar la cuenta pide escribir BORRAR, borra los archivos y llama a borrar_mi_cuenta", async () => {
  const { ctx, p, escrituras, errores } = await abrir();
  await ctx.route("**/storage/v1/object/list/archivos", async (r) => { const { prefix } = r.request().postDataJSON();
    const d = { [E]: [{ name: "logo", id: null }, { name: "disenos", id: null }], [E + "/logo"]: [{ name: "a.png", id: "1" }], [E + "/disenos"]: [{ name: "b.pdf", id: "2" }] };
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d[prefix] ?? []) }); });
  let borrados = null;
  await ctx.route("**/storage/v1/object/archivos", async (r) => { if (r.request().method() === "DELETE") borrados = r.request().postDataJSON().prefixes; r.fulfill({ status: 200, contentType: "application/json", body: "[]" }); });
  await ir(p, "ajustes/");
  await p.getByRole("button", { name: "Borrar mi cuenta" }).click();
  const boton = p.getByRole("button", { name: "Borrar definitivamente" });
  assert.ok(await boton.isDisabled(), "sin escribir BORRAR no se puede");
  await p.getByLabel("Escribe BORRAR para confirmar").fill("borrar");
  await boton.click(); await p.waitForTimeout(1500);
  assert.deepEqual(borrados?.sort(), [E + "/disenos/b.pdf", E + "/logo/a.png"]);
  assert.ok(escrituras.some((x) => /rpc\/borrar_mi_cuenta/.test(x.url)), "llama a la función de borrado");
  await ctx.close();
});

await navegador.close(); servidor.close();
if (fallos) { console.log(`\n${fallos} prueba(s) fallida(s)`); process.exit(1); }
console.log("\nTodas las pruebas de pantalla pasan");
