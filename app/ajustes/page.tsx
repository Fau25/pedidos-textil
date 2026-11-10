"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImagePlus, Loader2 } from "lucide-react";
import { useSesion } from "@/components/sesion";
import { Cabecera } from "@/components/marco";
import { Boton, Campo, Tarjeta, cx, useAvisos } from "@/components/ui";
import { sb, subirArchivo, subirFotosRoly, textoError, urlArchivo } from "@/lib/supabase";
import { borrarEjemplo, cargarEjemplo } from "@/lib/ejemplo";
import { descargarCopia } from "@/lib/copia";
import { Invitados } from "@/components/invitados";

const esquema = z.object({
  nombre: z.string().trim().min(1, "Obligatorio"),
  nif: z.string().optional(), direccion: z.string().optional(), email: z.string().optional(), telefono: z.string().optional(), web: z.string().optional(),
  iva: z.coerce.number<string | number>().min(0).max(100), margen: z.coerce.number<string | number>().min(0).max(1000),
  validez_dias: z.coerce.number<string | number>().int().min(1).max(365), condiciones: z.string().optional(),
});
type F = z.input<typeof esquema>;
type FS = z.output<typeof esquema>;

const VERSION = "2.5.3";

export default function Ajustes() {
  const { empresa, recargar, tocar, sesion } = useSesion();
  const { aviso, confirmar } = useAvisos();
  const [logo, setLogo] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [ejemplo, setEjemplo] = useState("");
  const [clave, setClave] = useState("");
  const [copiando, setCopiando] = useState(false);
  const [ultima, setUltima] = useState<string | null>(null);
  useEffect(() => { try { const u = localStorage.getItem(`ultima-copia-${empresa!.id}`); if (u) setUltima(new Date(u + "T12:00:00").toLocaleDateString("es-ES")); } catch {} }, [empresa]);
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
              <Campo etiqueta="Margen sobre tarifa %" error={errors.margen?.message}><input className="campo num" inputMode="decimal" {...register("margen")} /></Campo>
              <Campo etiqueta="Validez (días)" error={errors.validez_dias?.message}><input className="campo num" inputMode="numeric" {...register("validez_dias")} /></Campo>
            </div>
            <Campo etiqueta="Condiciones comerciales" ayuda="Aparecen al pie de los presupuestos."><textarea className="campo" rows={4} {...register("condiciones")} /></Campo>
            <div className="flex justify-end"><Boton variante="primario" type="submit" disabled={!isDirty} cargando={isSubmitting}>Guardar cambios</Boton></div>
          </form>
        </Tarjeta>

        <Invitados />

        <FotosRoly />

        <Tarjeta titulo="Copia de seguridad">
          <p className="mb-4 text-[13px] text-texto2">Descarga todos tus pedidos, prendas, clientes y catálogo en un Excel. Hazlo de vez en cuando y guárdalo en tu ordenador.{ultima ? ` Última copia en este dispositivo: ${ultima}.` : ""}</p>
          <Boton variante="primario" cargando={copiando} onClick={async () => {
            setCopiando(true);
            try { await descargarCopia(e.id, e.nombre); setUltima(new Date().toLocaleDateString("es-ES")); aviso("Copia descargada"); }
            catch (err) { aviso(textoError(err), "error"); } finally { setCopiando(false); }
          }}>Descargar copia en Excel</Boton>
        </Tarjeta>

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
            <input className="campo" type="password" autoComplete="new-password" minLength={8} required placeholder="Contraseña nueva (mín. 8)" value={clave} onChange={(ev) => setClave(ev.target.value)} />
            <Boton type="submit">Cambiar</Boton>
          </form>
          <p className="mt-4 text-[12px] text-texto2">Cada persona invitada crea su propia cuenta desde la pantalla de acceso y tiene sus datos separados. Versión {VERSION}.</p>
        </Tarjeta>
      </div>
    </>
  );
}


/** Subida en bloque de las fotos de Roly a la carpeta privada compartida por la familia */
function FotosRoly() {
  const { aviso } = useAvisos();
  const [subiendo, setSubiendo] = useState<{ hechas: number; total: number } | null>(null);
  return (
    <Tarjeta titulo="Fotos de Roly">
      <p className="mb-4 text-[13px] text-texto2">Elige todas las fotos a la vez (puedes seleccionar varias carpetas, una tras otra). Cada foto se coloca sola en su prenda por la referencia del nombre, por ejemplo «Camiseta CA6554.jpg». Son privadas: solo las ve tu familia dentro de la app.</p>
      <label className={cx("inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-acento px-5 text-[14px] font-medium text-sobre-acento", subiendo && "pointer-events-none opacity-60")}>
        {subiendo ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        {subiendo ? `Subiendo ${subiendo.hechas} de ${subiendo.total}…` : "Subir fotos"}
        <input type="file" accept="image/*" multiple className="sr-only" aria-label="Subir fotos de Roly" onChange={async (ev) => {
          const files = Array.from(ev.target.files ?? []); ev.target.value = ""; if (!files.length) return;
          setSubiendo({ hechas: 0, total: files.length });
          try {
            const r = await subirFotosRoly(files, (hechas) => setSubiendo({ hechas, total: files.length }));
            aviso(`${r.ok} fotos subidas` + (r.sinRef.length ? ` · ${r.sinRef.length} sin referencia en el nombre` : ""));
          } catch (err) { aviso(textoError(err), "error"); } finally { setSubiendo(null); }
        }} />
      </label>
    </Tarjeta>
  );
}
