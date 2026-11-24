// Pruebas de la base de datos (permisos entre talleres, conflictos, borrar cuenta…) con PGlite: Postgres en memoria
import { PGlite } from "@electric-sql/pglite"; import fs from "node:fs"; import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`create role authenticated; create role anon; create role supabase_auth_admin; create schema auth;
create table auth.users(id uuid primary key, email text, created_at timestamptz default now());
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create schema storage; create table storage.buckets(id text primary key, name text, public bool); create table storage.objects(id serial, bucket_id text, name text);
alter table storage.objects enable row level security; grant select, insert, update on storage.objects to authenticated; grant usage, select on sequence storage.objects_id_seq to authenticated;
create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n,'/') $$; create publication supabase_realtime;
grant usage on schema public, auth, storage to authenticated, anon; grant execute on function auth.uid() to authenticated;
grant select on auth.users to supabase_auth_admin;`);
const u = "11111111-1111-1111-1111-111111111111", v = "22222222-2222-2222-2222-222222222222", w = "33333333-3333-3333-3333-333333333333";
await db.exec(`insert into auth.users(id,email,created_at) values ('${u}','fau@x.es','2026-01-01'),('${v}','otra@x.es','2026-02-01'),('${w}','ayuda@x.es','2026-03-01')`);
const P = new URL("../supabase/", import.meta.url);
for (const f of ["esquema.sql", "02-simplificar.sql", "03-fiabilidad.sql", "05-invitados.sql", "06-fotos-roly.sql", "07-borrar-cuenta.sql", "08-auditoria.sql", "08-auditoria.sql", "09-facturas.sql", "09-facturas.sql", "10-trabajos.sql", "10-trabajos.sql", "11-trabajos-cobro.sql", "11-trabajos-cobro.sql", "12-pedidos-cobro.sql", "12-pedidos-cobro.sql", "13-facturas-editables.sql", "13-facturas-editables.sql", "15-documentos-sueltos.sql", "15-documentos-sueltos.sql"])
  await db.exec(fs.readFileSync(new URL(f, P), "utf8"));
async function como(user, q) { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`); try { return await db.query(q); } finally { await db.exec("reset role"); } }
const falla = async (user, q, re) => { await assert.rejects(como(user, q), re); };
let ok = 0; const prueba = async (n, f) => { await f(); ok++; console.log("ok - " + n); };

const e = (await como(u, `select crear_empresa('Taller Fau') as e`)).rows[0].e;
const e2 = (await como(v, `select crear_empresa('Otro') as e`)).rows[0].e;
await db.exec(`insert into miembros(empresa_id,user_id,rol) values('${e}','${w}','editor')`);

await prueba("un taller no ve ni cambia los datos de otro", async () => {
  await como(v, `insert into clientes(empresa_id,nombre) values('${e2}','Cliente de otra')`);
  assert.equal((await como(u, `select count(*)::int c from clientes`)).rows[0].c, 0);
  await falla(u, `insert into clientes(empresa_id,nombre) values('${e2}','Intruso')`, /row-level security/);
});
await prueba("guardar_pedido guarda y avisa si otra persona guardó antes", async () => {
  const id = "aaaaaaaa-0000-0000-0000-000000000001";
  const r1 = (await como(u, `select guardar_pedido('{"id":"${id}","empresa_id":"${e}","fecha":"2026-11-11","lineas":[],"pers":[]}'::jsonb) r`)).rows[0].r;
  assert.match(r1.numero, /^P-\d{4}-0001$/); assert.ok(r1.editado);
  const viejo = new Date(new Date(r1.editado).getTime() - 60000).toISOString();
  await falla(w, `select guardar_pedido('{"id":"${id}","empresa_id":"${e}","fecha":"2026-11-11","editado_base":"${viejo}","lineas":[],"pers":[]}'::jsonb)`, /CONFLICTO/);
  const r2 = (await como(w, `select guardar_pedido('{"id":"${id}","empresa_id":"${e}","fecha":"2026-11-11","editado_base":"${viejo}","forzar":true,"lineas":[],"pers":[]}'::jsonb) r`)).rows[0].r;
  assert.equal(r2.numero, r1.numero);
  await falla(v, `select guardar_pedido('{"id":"${id}","empresa_id":"${e}","fecha":"2026-11-11","lineas":[],"pers":[]}'::jsonb)`, /permiso|row-level/);
});
await prueba("cada propietario ve y borra solo sus invitados", async () => {
  await como(u, `insert into invitados(email) values ('primo@x.es')`);
  await como(v, `insert into invitados(email) values ('vecina@x.es')`);
  const vistos = (await como(v, `select email from invitados order by 1`)).rows.map((r) => r.email);
  assert.ok(vistos.includes("vecina@x.es") && !vistos.includes("primo@x.es"));
  await como(v, `delete from invitados where email = 'primo@x.es'`);
  assert.equal((await db.query(`select count(*)::int c from invitados where email='primo@x.es'`)).rows[0].c, 1);
  await falla(w, `insert into invitados(email) values ('x@x.es')`, /row-level security/); // el ayudante no invita
});
await prueba("solo el administrador sube fotos de Roly", async () => {
  assert.equal((await db.query(`select user_id from admins`)).rows[0].user_id, u);
  await como(u, `insert into storage.objects(bucket_id,name) values('roly','CA6554.jpg')`);
  await falla(v, `insert into storage.objects(bucket_id,name) values('roly','CA6554.jpg')`, /row-level security/);
});
await prueba("registro de errores: cada uno apunta los suyos y el administrador los ve todos", async () => {
  await como(w, `insert into errores(empresa_id, mensaje) values ('${e}', 'fallo de prueba')`);
  await falla(w, `insert into errores(empresa_id, mensaje) values ('${e2}', 'en otro taller')`, /row-level security/);
  assert.equal((await como(v, `select count(*)::int c from errores`)).rows[0].c, 0);
  assert.equal((await como(u, `select count(*)::int c from errores`)).rows[0].c, 1);
});
await prueba("ya no existen las tablas antiguas", async () => {
  assert.equal((await db.query(`select count(*)::int c from information_schema.tables where table_name in ('estados','pedido_historial')`)).rows[0].c, 0);
  // «presupuestos» vuelve con el SQL 15, ya sin las columnas de la v1
  assert.equal((await db.query(`select count(*)::int c from information_schema.columns where table_name = 'presupuestos' and column_name in ('version','pedido_id','estado')`)).rows[0].c, 0);
});
await prueba("facturas: número correlativo, una por pedido, nadie de fuera puede emitir ni cambiar", async () => {
  const id = "aaaaaaaa-0000-0000-0000-000000000001";
  const f1 = (await como(u, `select (emitir_factura('${id}', '{"base":100,"iva":21,"total":121}'::jsonb)).*`)).rows[0];
  assert.match(f1.numero, /^F-\d{4}-0001$/); assert.equal(Number(f1.total), 121);
  const otra = (await como(u, `select (emitir_factura('${id}', '{"total":999}'::jsonb)).numero`)).rows[0].numero;
  assert.equal(otra, f1.numero, "el mismo pedido no se factura dos veces");
  const id2 = "aaaaaaaa-0000-0000-0000-000000000002";
  await como(u, `select guardar_pedido('{"id":"${id2}","empresa_id":"${e}","fecha":"2026-11-11","lineas":[],"pers":[]}'::jsonb)`);
  assert.match((await como(u, `select (emitir_factura('${id2}', '{}'::jsonb)).numero`)).rows[0].numero, /-0002$/);
  await falla(v, `select emitir_factura('${id}', '{}'::jsonb)`, /permiso/);
  assert.equal((await como(v, `select count(*)::int c from facturas`)).rows[0].c, 0, "otro taller no las ve");
  // Con el SQL 13: quien edita en el taller puede cambiar sus facturas; los de otro taller, no
  await como(v, `update facturas set total = 1`); await como(v, `delete from facturas`);
  assert.equal((await db.query(`select count(*)::int c from facturas where total = 121`)).rows[0].c, 1, "otro taller no las cambia ni borra");
  await como(u, `update facturas set numero = 'F-2026-0100', total = 120, editado = now() where numero = '${f1.numero}'`);
  assert.equal((await db.query(`select total::int t from facturas where numero = 'F-2026-0100'`)).rows[0].t, 120, "el dueño cambia número y datos");
  await falla(u, `update facturas set numero = 'F-2026-0100' where numero like '%-0002'`, /duplicate|unique/);
  await falla(u, `update facturas set empresa_id = gen_random_uuid()`, /permission denied/);
});
await prueba("facturas y presupuestos sueltos: número siguiente o el elegido, y solo en tu taller", async () => {
  const d = `'{"base":100,"iva":21,"total":121}'::jsonb`;
  const f1 = (await como(u, `select crear_documento('factura', '${e}', ${d}) r`)).rows[0].r;
  assert.match(f1.numero, /^F-\d{4}-\d{4}$/); assert.equal(f1.pedido_id, null); assert.equal(Number(f1.total), 121);
  const f2 = (await como(u, `select crear_documento('factura', '${e}', ${d}) r`)).rows[0].r;
  assert.equal(Number(f2.numero.slice(-4)), Number(f1.numero.slice(-4)) + 1, "correlativas");
  const f3 = (await como(u, `select crear_documento('factura', '${e}', ${d}, null, 'A-7') r`)).rows[0].r;
  assert.equal(f3.numero, "A-7", "número elegido");
  const p1 = (await como(u, `select crear_documento('presupuesto', '${e}', ${d}, '2026-11-24', null, '2026-12-24') r`)).rows[0].r;
  assert.equal(p1.numero, "PR-2026-0001"); assert.equal(p1.validez, "2026-12-24");
  await como(u, `update presupuestos set factura_id = '${f1.id}', editado = now() where id = '${p1.id}'`);
  assert.equal((await db.query(`select factura_id from presupuestos where id = '${p1.id}'`)).rows[0].factura_id, f1.id);
  await falla(v, `select crear_documento('presupuesto', '${e}', ${d})`, /permiso/);
  assert.equal((await como(v, `select count(*)::int c from presupuestos`)).rows[0].c, 0, "otro taller no los ve");
  await como(v, `delete from presupuestos`); assert.equal((await db.query(`select count(*)::int c from presupuestos`)).rows[0].c, 1);
  await falla(u, `insert into presupuestos(empresa_id, numero, datos) values ('${e}', 'X', '{}')`, /permission denied/);
  await como(u, `delete from presupuestos where id = '${p1.id}'`); assert.equal((await db.query(`select count(*)::int c from presupuestos`)).rows[0].c, 0);
});
await prueba("trabajos: número T-0001 seguido por taller y cada uno ve solo los suyos", async () => {
  const t1 = (await como(u, `insert into trabajos(empresa_id, cliente_nombre, items, total, a_cuenta) values ('${e}', 'Laura', '[{"que":"Juego de cuna","cantidad":2}]', 36, 10) returning numero`)).rows[0].numero;
  const t2 = (await como(u, `insert into trabajos(empresa_id, cliente_nombre) values ('${e}', 'Mario') returning numero`)).rows[0].numero;
  assert.equal(t1, "T-0001"); assert.equal(t2, "T-0002");
  assert.equal((await como(v, `insert into trabajos(empresa_id) values ('${e2}') returning numero`)).rows[0].numero, "T-0001", "cada taller su serie");
  assert.equal((await como(v, `select count(*)::int c from trabajos`)).rows[0].c, 1);
  await falla(v, `insert into trabajos(empresa_id) values ('${e}')`, /row-level security/);
  await como(w, `update trabajos set estado = 'listo' where numero = 'T-0001' and empresa_id = '${e}'`);
  assert.equal((await db.query(`select estado from trabajos where numero='T-0001' and empresa_id='${e}'`)).rows[0].estado, "listo", "el ayudante (editor) puede marcarlo");
});
await prueba("borrar cuenta: el ayudante deja el taller intacto; la propietaria lo borra entero", async () => {
  await como(w, `select borrar_mi_cuenta()`);
  assert.equal((await db.query(`select count(*)::int c from pedidos where empresa_id='${e}'`)).rows[0].c, 2);
  await como(u, `select borrar_mi_cuenta()`);
  assert.equal((await db.query(`select count(*)::int c from empresas where id='${e}'`)).rows[0].c, 0);
  assert.equal((await db.query(`select count(*)::int c from clientes where empresa_id='${e2}'`)).rows[0].c, 1);
  await db.exec("set role anon"); await assert.rejects(db.query("select borrar_mi_cuenta()")); await db.exec("reset role");
});
console.log(`\nPruebas de base de datos: ${ok} correctas`);
