"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { useSesion } from "@/components/sesion";
import { Cabecera } from "@/components/marco";
import { Boton, Campo, Tarjeta, cx, useAvisos, PUNTOS } from "@/components/ui";
import { sb, subirArchivo, textoError, urlArchivo } from "@/lib/supabase";
import { borrarEjemplo, cargarEjemplo } from "@/lib/ejemplo";
import type { Estado } from "@/lib/tipos";

const esquema = z.object({
  nombre: z.string().trim().min(1, "Obligatorio"),
  nif: z.string().optional(), direccion: z.string().optional(), email: z.string().optional(), telefono: z.string().optional(), web: z.string().optional(),
  iva: z.coerce.number<string | number>().min(0).max(100), margen: z.coerce.number<string | number>().min(0).max(1000),
  validez_dias: z.coerce.number<string | number>().int().min(1).max(365), condiciones: z.string().optional(),
});
type F = z.input<typeof esquema>;
type FS = z.output<typeof esquema>;

const VERSION = "1.0.0";

export default function Ajustes() {
  const { empresa, recargar, tocar, sesion } = useSesion();
  const { aviso, confirmar } = useAvisos();
  const [logo, setLogo] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [ejemplo, setEjemplo] = useState("");
  const [clave, setClave] = useState("");
  useEffect(() => { urlArchivo(empresa!.logo_path).then(setLogo); }, [empresa]);

  const e = empresa!;
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm<F, unknown, FS>({
    resolver: zodResolver(esquema),
    values: { nombre: e.nombre, nif: e.nif ?? "", direccion: e.direccion ?? "", email: e.email ?? "", telefono: e.telefono ?? "", web: e.web ?? "", iva: Number(e.iva), margen: Number(e.margen), validez_dias: e.validez_dias, condiciones: e.condiciones ?? "" },
  });

  return (
    <>
      <Cabecera titulo="Ajustes" />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Tu empresa" className="lg:row-span-2">
          <form className="space-y-4" onSubmit={handleSubmit(async (f) => {
            const fila = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === "" ? null : v]));
            const { error } = await sb.from("empresas").update(fila).eq("id", e.id);
            if (error) return aviso(textoError(error), "error");
            await recargar(); aviso("Datos guardados");
          })}>
            <div className="flex items-center gap-4">
              <label className="relative grid h-16 w-32 cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed border-borde bg-suave text-texto2 hover:border-acento">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {subiendo ? <Loader2 className="size-5 animate-spin" /> : logo ? <img src={logo} alt="Logotipo" className="size-full object-contain p-2" /> : <span className="flex items-center gap-1.5 text-[12px]"><ImagePlus className="size-4" />Logotipo</span>}
                <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="sr-only" onChange={async (ev) => {
                  const f = ev.target.files?.[0]; if (!f) return; setSubiendo(true);
                  try { const path = await subirArchivo(e.id, "logo", f); const { error } = await sb.from("empresas").update({ logo_path: path }).eq("id", e.id); if (error) throw error; await recargar(); aviso("Logotipo actualizado"); }
                  catch (err) { aviso(textoError(err), "error"); } finally { setSubiendo(false); }
                }} />
              </label>
              <p className="text-[12px] text-texto2">Sale en los presupuestos en PDF. Mejor en PNG con fondo transparente.</p>
            </div>
            <Campo etiqueta="Nombre comercial" error={errors.nombre?.message}><input className="campo" {...register("nombre")} /></Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="NIF / CIF"><input className="campo uppercase" {...register("nif")} /></Campo>
              <Campo etiqueta="Teléfono"><input className="campo" {...register("telefono")} /></Campo>
              <Campo etiqueta="Email"><input className="campo" type="email" {...register("email")} /></Campo>
              <Campo etiqueta="Web"><input className="campo" {...register("web")} /></Campo>
            </div>
            <Campo etiqueta="Dirección fiscal"><input className="campo" {...register("direccion")} /></Campo>
            <div className="grid grid-cols-3 gap-4">
              <Campo etiqueta="IVA por defecto %" error={errors.iva?.message}><input className="campo num" inputMode="decimal" {...register("iva")} /></Campo>
              <Campo etiqueta="Margen por defecto %" error={errors.margen?.message}><input className="campo num" inputMode="decimal" {...register("margen")} /></Campo>
              <Campo etiqueta="Validez (días)" error={errors.validez_dias?.message}><input className="campo num" inputMode="numeric" {...register("validez_dias")} /></Campo>
            </div>
            <Campo etiqueta="Condiciones comerciales" ayuda="Aparecen al pie de los presupuestos."><textarea className="campo" rows={4} {...register("condiciones")} /></Campo>
            <div className="flex justify-end"><Boton variante="primario" type="submit" disabled={!isDirty} cargando={isSubmitting}>Guardar cambios</Boton></div>
          </form>
        </Tarjeta>

        <Estados />

        <Tarjeta titulo="Datos de ejemplo">
          <p className="mb-4 text-[13px] text-texto2">Clientes, prendas y pedidos de muestra para probar. Solo se borran los de ejemplo, nunca los tuyos.</p>
          <div className="flex flex-wrap gap-2">
            <Boton cargando={ejemplo === "cargar"} onClick={async () => { setEjemplo("cargar"); try { await cargarEjemplo(e.id); await recargar(); tocar(); aviso("Datos de ejemplo añadidos"); } catch (err) { aviso(textoError(err), "error"); } setEjemplo(""); }}>Añadir ejemplos</Boton>
            <Boton variante="peligro" cargando={ejemplo === "borrar"} onClick={async () => {
              if (!(await confirmar({ titulo: "¿Borrar los datos de ejemplo?", texto: "Se borran solo los clientes, pedidos y prendas marcados como ejemplo.", ok: "Borrar", peligro: true }))) return;
              setEjemplo("borrar"); try { await borrarEjemplo(e.id); await recargar(); tocar(); aviso("Datos de ejemplo borrados"); } catch (err) { aviso(textoError(err), "error"); } setEjemplo("");
            }}>Borrar ejemplos</Boton>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Tu cuenta">
          <p className="mb-3 text-[13px] text-texto2">{sesion?.user.email}</p>
          <form className="flex gap-2" onSubmit={async (ev) => {
            ev.preventDefault();
            const { error } = await sb.auth.updateUser({ password: clave });
            if (error) return aviso(textoError(error), "error");
            setClave(""); aviso("Contraseña cambiada");
          }}>
            <input className="campo" type="password" autoComplete="new-password" minLength={6} required placeholder="Contraseña nueva" value={clave} onChange={(ev) => setClave(ev.target.value)} />
            <Boton type="submit">Cambiar</Boton>
          </form>
          <p className="mt-4 text-[12px] text-texto2">Cada persona de la familia crea su propia cuenta desde la pantalla de acceso y tiene sus datos separados. Versión {VERSION}.</p>
        </Tarjeta>
      </div>
    </>
  );
}

function Estados() {
  const { estados, recargar, empresa } = useSesion();
  const { aviso, confirmar } = useAvisos();
  const [lista, setLista] = useState<Estado[]>(estados);
  useEffect(() => setLista(estados), [estados]);
  const colores = Object.keys(PUNTOS);

  async function guardar(e: Estado, c: Partial<Estado>) {
    const { error } = await sb.from("estados").update(c).eq("id", e.id);
    if (error) aviso(textoError(error), "error"); else recargar();
  }
  async function mover(i: number, d: -1 | 1) {
    const a = lista[i], b = lista[i + d]; if (!a || !b) return;
    await Promise.all([sb.from("estados").update({ orden: b.orden }).eq("id", a.id), sb.from("estados").update({ orden: a.orden }).eq("id", b.id)]);
    recargar();
  }
  return (
    <Tarjeta titulo="Estados de los pedidos">
      <ul className="space-y-1.5">
        {lista.map((e, i) => (
          <li key={e.id} className="flex items-center gap-2">
            <div className="relative">
              <select aria-label="Color" className={cx("size-8 cursor-pointer appearance-none rounded-full border-4 border-superficie text-transparent", PUNTOS[e.color])} value={e.color} onChange={(ev) => guardar(e, { color: ev.target.value })}>
                {colores.map((c) => <option key={c} value={c} className="text-black">{c}</option>)}
              </select>
            </div>
            <input className="campo h-9" defaultValue={e.nombre} aria-label="Nombre del estado" onBlur={(ev) => ev.target.value.trim() && ev.target.value !== e.nombre && guardar(e, { nombre: ev.target.value.trim() })} />
            <button aria-label="Subir" className="grid size-8 place-items-center rounded-lg text-texto2 hover:bg-suave disabled:opacity-30" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp className="size-4" /></button>
            <button aria-label="Bajar" className="grid size-8 place-items-center rounded-lg text-texto2 hover:bg-suave disabled:opacity-30" disabled={i === lista.length - 1} onClick={() => mover(i, 1)}><ArrowDown className="size-4" /></button>
            <button aria-label="Eliminar estado" title={e.clave ? "Estado del sistema: se puede renombrar pero no borrar" : "Eliminar"} disabled={!!e.clave} className="grid size-8 place-items-center rounded-lg text-texto2 hover:bg-suave hover:text-red-600 disabled:opacity-20"
              onClick={async () => {
                if (!(await confirmar({ titulo: `¿Eliminar «${e.nombre}»?`, ok: "Eliminar", peligro: true }))) return;
                const { error } = await sb.from("estados").delete().eq("id", e.id);
                if (error) aviso("No se puede eliminar: hay pedidos en este estado.", "error"); else recargar();
              }}><Trash2 className="size-4" /></button>
          </li>
        ))}
      </ul>
      <Boton tam="s" className="mt-3" onClick={async () => {
        const orden = Math.max(0, ...lista.map((x) => x.orden)) + 1;
        const { error } = await sb.from("estados").insert({ empresa_id: empresa!.id, nombre: "Nuevo estado", orden, color: "gris" });
        if (error) aviso(textoError(error), "error"); else recargar();
      }}><Plus className="size-3.5" />Añadir estado</Boton>
    </Tarjeta>
  );
}
