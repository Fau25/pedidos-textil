// Descarga todos los archivos de Supabase Storage (buckets «archivos» y «roly») a la carpeta indicada.
// Uso (lo ejecuta el workflow «Copia de seguridad»): SUPABASE_URL=… SUPABASE_SERVICE_KEY=… node scripts/copia-archivos.mjs destino/
import fs from "node:fs"; import path from "node:path";
const URL_ = process.env.SUPABASE_URL ?? "https://sqartxsdlynecelkufyq.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_KEY; const DEST = process.argv[2] ?? "archivos";
if (!KEY) { console.error("Falta SUPABASE_SERVICE_KEY"); process.exit(1); }
// Claves nuevas (sb_secret_…) van solo en «apikey»; las antiguas (service_role, un JWT «eyJ…») también como Bearer
const h = KEY.startsWith("eyJ") ? { apikey: KEY, Authorization: `Bearer ${KEY}` } : { apikey: KEY };
async function listar(bucket, prefijo = "") {
  const fuera = [];
  for (let offset = 0; ; offset += 1000) {
    const r = await fetch(`${URL_}/storage/v1/object/list/${bucket}`, { method: "POST", headers: { ...h, "content-type": "application/json" }, body: JSON.stringify({ prefix: prefijo, limit: 1000, offset }) });
    if (!r.ok) throw new Error(`${bucket}/${prefijo}: ${r.status} ${await r.text()}`);
    const items = await r.json();
    for (const it of items) {
      const ruta = prefijo ? `${prefijo}/${it.name}` : it.name;
      if (it.id === null) fuera.push(...await listar(bucket, ruta)); else fuera.push(ruta); // id null = carpeta
    }
    if (items.length < 1000) return fuera;
  }
}
let n = 0, bytes = 0;
for (const bucket of ["archivos", "roly"]) {
  for (const ruta of await listar(bucket)) {
    const r = await fetch(`${URL_}/storage/v1/object/${bucket}/${ruta.split("/").map(encodeURIComponent).join("/")}`, { headers: h });
    if (!r.ok) throw new Error(`No se pudo bajar ${bucket}/${ruta}: ${r.status}`);
    const b = Buffer.from(await r.arrayBuffer()); const f = path.join(DEST, bucket, ruta);
    fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b); n++; bytes += b.length;
  }
}
console.log(`${n} archivos, ${(bytes / 1e6).toFixed(1)} MB`);
