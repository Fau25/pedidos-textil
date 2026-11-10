"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Boton, Campo, Hoja, useAvisos } from "./ui";
import { useSesion } from "./sesion";
import { sb, textoError } from "@/lib/supabase";
import type { Cliente } from "@/lib/tipos";

const esquema = z.object({
  nombre: z.string().trim().min(1, "Pon un nombre"),
  contacto: z.string().optional(),
  telefono: z.string().optional(),
  email: z.union([z.literal(""), z.email("Email no válido")]).optional(),
  nif: z.string().optional().refine((v) => !v || /^[A-Za-z0-9-]{8,12}$/.test(v.replace(/\s/g, "")), "NIF/CIF no válido"),
  direccion: z.string().optional(),
  facturacion: z.string().optional(),
  notas: z.string().optional(),
});
type F = z.infer<typeof esquema>;

export function FormCliente({ abierto, cerrar, cliente, guardado }: { abierto: boolean; cerrar: () => void; cliente?: Cliente | null; guardado?: (c: Cliente) => void }) {
  const { empresa } = useSesion();
  const { aviso } = useAvisos();
  const vacio = (v?: string | null) => v ?? "";
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<F>({
    resolver: zodResolver(esquema),
    values: { nombre: vacio(cliente?.nombre), contacto: vacio(cliente?.contacto), telefono: vacio(cliente?.telefono), email: vacio(cliente?.email), nif: vacio(cliente?.nif), direccion: vacio(cliente?.direccion), facturacion: vacio(cliente?.facturacion), notas: vacio(cliente?.notas) },
  });
  const enviar = async (f: F) => {
    const fila = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v]));
    const r = cliente
      ? await sb.from("clientes").update(fila).eq("id", cliente.id).select("*").single()
      : await sb.from("clientes").insert({ ...fila, empresa_id: empresa!.id }).select("*").single();
    if (r.error) return aviso(textoError(r.error), "error");
    aviso(cliente ? "Cliente actualizado" : "Cliente creado");
    guardado?.(r.data as Cliente); cerrar();
  };
  return (
    <Hoja abierta={abierto} cerrar={cerrar} titulo={cliente ? "Editar cliente" : "Nuevo cliente"}
      pie={<><Boton onClick={cerrar}>Cancelar</Boton><Boton variante="primario" type="submit" form="f-cliente" cargando={isSubmitting}>Guardar</Boton></>}>
      <form id="f-cliente" onSubmit={handleSubmit(enviar)} className="space-y-4" noValidate>
        <Campo etiqueta="Nombre o empresa" error={errors.nombre?.message}><input className="campo" {...register("nombre")} /></Campo>
        <Campo etiqueta="Persona de contacto"><input className="campo" {...register("contacto")} /></Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Teléfono"><input className="campo" type="tel" {...register("telefono")} /></Campo>
          <Campo etiqueta="Email" error={errors.email?.message}><input className="campo" type="email" {...register("email")} /></Campo>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="NIF / CIF" error={errors.nif?.message}><input className="campo uppercase" {...register("nif")} /></Campo>
          <Campo etiqueta="Dirección"><input className="campo" {...register("direccion")} /></Campo>
        </div>
        <Campo etiqueta="Datos de facturación" ayuda="Razón social y dirección fiscal si son distintas."><textarea className="campo" rows={2} {...register("facturacion")} /></Campo>
        <Campo etiqueta="Observaciones"><textarea className="campo" rows={2} {...register("notas")} /></Campo>
      </form>
    </Hoja>
  );
}
