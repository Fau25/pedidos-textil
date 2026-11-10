"use client";
import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Boton, Campo, Hoja, useAvisos } from "./ui";
import { useSesion } from "./sesion";
import { sb, textoError } from "@/lib/supabase";
import { ordenTalla } from "@/lib/pedidos";

type Campos = "referencia" | "modelo" | "tipo" | "color" | "talla" | "precio";
const NOMBRES: Record<Campos, string> = { referencia: "Referencia", modelo: "Modelo / nombre", tipo: "Tipo de prenda / descripción", color: "Color", talla: "Talla", precio: "Precio de compra" };
const PISTAS: Record<Campos, RegExp> = {
  referencia: /^(ref|referencia|c[oó]digo|code|art[ií]culo|model ?code)/i, modelo: /^(modelo|nombre|name|model)$/i, tipo: /(tipo|descrip|familia|categor|product)/i,
  color: /^(color|colour|col)/i, talla: /^(talla|size|tall)/i, precio: /(precio|price|tarifa|pvp|neto|coste|€)/i,
};

/** Importa una tarifa en Excel o CSV: agrupa por modelo y junta colores, tallas y el precio más bajo */
export function ImportarTarifa({ marca = "Roly", hecho }: { marca?: string; hecho: () => void }) {
  const { empresa } = useSesion();
  const { aviso } = useAvisos();
  const [filas, setFilas] = useState<Record<string, unknown>[] | null>(null);
  const [cols, setCols] = useState<string[]>([]);
  const [mapa, setMapa] = useState<Partial<Record<Campos, string>>>({});
  const [marcaTxt, setMarcaTxt] = useState(marca);
  const [cargando, setCargando] = useState(false);

  async function leer(f: File) {
    setCargando(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer());
      // Hoja con más filas
      const hoja = wb.SheetNames.map((n) => wb.Sheets[n]).sort((a, b) => (XLSX.utils.sheet_to_json(b).length - XLSX.utils.sheet_to_json(a).length))[0];
      const datos = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: "" });
      if (!datos.length) throw new Error("El archivo no tiene filas.");
      const c = Object.keys(datos[0]);
      const m: Partial<Record<Campos, string>> = {};
      for (const k of Object.keys(PISTAS) as Campos[]) m[k] = c.find((x) => PISTAS[k].test(x.trim()) && !Object.values(m).includes(x));
      setCols(c); setMapa(m); setFilas(datos);
    } catch (e) { aviso(textoError(e), "error"); } finally { setCargando(false); }
  }

  async function importar() {
    if (!filas) return;
    if (!mapa.modelo && !mapa.referencia) return aviso("Indica al menos la columna de modelo o de referencia", "error");
    setCargando(true);
    const g = new Map<string, { referencia: string | null; modelo: string; tipo: string; colores: Set<string>; tallas: Set<string>; precio: number | null }>();
    const v = (r: Record<string, unknown>, k?: string) => (k ? String(r[k] ?? "").trim() : "");
    for (const r of filas) {
      const ref = v(r, mapa.referencia); const mod = v(r, mapa.modelo) || ref;
      if (!mod) continue;
      const k = (ref || mod).toUpperCase();
      const x = g.get(k) ?? { referencia: ref || null, modelo: mod, tipo: v(r, mapa.tipo) || "Prenda", colores: new Set(), tallas: new Set(), precio: null };
      const col = v(r, mapa.color); if (col) x.colores.add(col);
      const ta = v(r, mapa.talla); if (ta) x.tallas.add(ta);
      const pr = Number(v(r, mapa.precio).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
      if (Number.isFinite(pr) && pr > 0) x.precio = x.precio === null ? pr : Math.min(x.precio, pr);
      g.set(k, x);
    }
    try {
      const { data: existentes } = await sb.from("catalogo").select("id, referencia, modelo, favorito").eq("empresa_id", empresa!.id).eq("marca", marcaTxt);
      const porClave = new Map((existentes ?? []).map((e) => [(e.referencia || e.modelo || "").toUpperCase(), e]));
      const nuevos: Record<string, unknown>[] = []; let actualizados = 0;
      for (const [k, x] of g) {
        const fila = { referencia: x.referencia, modelo: x.modelo, colores: [...x.colores], tallas: [...x.tallas].sort((a, b) => ordenTalla(a) - ordenTalla(b)), ...(x.precio !== null ? { precio_compra: x.precio } : {}) };
        const e = porClave.get(k) ?? [...porClave.values()].find((z) => z.modelo?.toUpperCase() === x.modelo.toUpperCase());
        if (e) { await sb.from("catalogo").update(fila).eq("id", e.id); actualizados++; }
        else nuevos.push({ ...fila, empresa_id: empresa!.id, marca: marcaTxt, tipo: x.tipo, favorito: false });
      }
      for (let i = 0; i < nuevos.length; i += 500) { const { error } = await sb.from("catalogo").insert(nuevos.slice(i, i + 500)); if (error) throw error; }
      aviso(`Tarifa importada: ${nuevos.length} modelos nuevos y ${actualizados} actualizados`);
      setFilas(null); hecho();
    } catch (e) { aviso(textoError(e), "error"); } finally { setCargando(false); }
  }

  return (
    <>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-borde bg-superficie px-4 h-10 text-[14px] font-medium hover:bg-suave">
        {cargando && !filas ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}Importar tarifa
        <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) leer(f); e.target.value = ""; }} />
      </label>
      <Hoja abierta={!!filas} cerrar={() => setFilas(null)} titulo="Importar tarifa"
        pie={<><Boton onClick={() => setFilas(null)}>Cancelar</Boton><Boton variante="primario" cargando={cargando} onClick={importar}>Importar {filas?.length ?? 0} filas</Boton></>}>
        <p className="mb-4 text-[13px] text-texto2">Indica qué columna del archivo es cada dato. Los modelos se agrupan solos y se guardan como no habituales: márcalos con la estrella para tenerlos a mano. Si un modelo ya existe, se actualizan sus colores, tallas y precio.</p>
        <div className="space-y-3">
          <Campo etiqueta="Marca"><input className="campo" value={marcaTxt} onChange={(e) => setMarcaTxt(e.target.value)} /></Campo>
          {(Object.keys(NOMBRES) as Campos[]).map((k) => (
            <Campo key={k} etiqueta={NOMBRES[k]}>
              <select className="campo" value={mapa[k] ?? ""} onChange={(e) => setMapa((m) => ({ ...m, [k]: e.target.value || undefined }))}>
                <option value="">— No está en el archivo —</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Campo>
          ))}
        </div>
        {filas && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-borde text-[12px]">
            <table className="w-full"><thead className="bg-suave text-left"><tr>{cols.slice(0, 6).map((c) => <th key={c} className="px-2 py-1 font-medium">{c}</th>)}</tr></thead>
              <tbody>{filas.slice(0, 3).map((r, i) => <tr key={i} className="border-t border-borde">{cols.slice(0, 6).map((c) => <td key={c} className="px-2 py-1">{String(r[c])}</td>)}</tr>)}</tbody></table>
          </div>
        )}
      </Hoja>
    </>
  );
}
