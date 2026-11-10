"use client";
import { useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { Boton, Tarjeta, useAvisos } from "./ui";
import { useSesion } from "./sesion";
import { sb, textoError } from "@/lib/supabase";
import { useCarga } from "@/lib/usar";

/** Lista de emails que pueden crear cuenta (el resto se rechaza en la base de datos) */
export function Invitados() {
  const { rol, sesion } = useSesion();
  const { aviso, confirmar } = useAvisos();
  const [email, setEmail] = useState("");
  const { datos, recargar } = useCarga(async () => {
    const { data, error } = await sb.from("invitados").select("email, creado").order("creado");
    if (error) throw error;
    return data as { email: string; creado: string }[];
  });
  if (rol !== "propietario") return null;
  const mio = sesion?.user.email?.toLowerCase();
  return (
    <Tarjeta titulo="Invitar a la familia">
      <p className="mb-4 text-[13px] text-texto2">Solo estos emails pueden crearse una cuenta. Cada persona tiene su propio taller y sus datos separados. Después de invitarla, dile que abra la app y pulse «Crear cuenta» con ese email.</p>
      <form className="mb-3 flex gap-2" onSubmit={async (e) => {
        e.preventDefault();
        const v = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return aviso("Escribe un email válido", "error");
        const { error } = await sb.from("invitados").insert({ email: v });
        if (error) return aviso(/duplicate|unique/i.test(error.message) ? "Ese email ya está invitado" : textoError(error), "error");
        setEmail(""); recargar(); aviso(`${v} ya puede crear su cuenta`);
      }}>
        <input className="campo" type="email" placeholder="email@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email a invitar" />
        <Boton type="submit"><UserPlus className="size-4" />Invitar</Boton>
      </form>
      <ul className="divide-y divide-borde text-[13px]">
        {(datos ?? []).map((x) => (
          <li key={x.email} className="flex items-center gap-2 py-2">
            <span className="flex-1 truncate">{x.email}{x.email === mio && <span className="text-texto2"> · tú</span>}</span>
            {x.email !== mio && (
              <button aria-label={`Quitar ${x.email}`} className="grid size-8 place-items-center rounded-lg text-texto2 hover:bg-suave hover:text-red-600" onClick={async () => {
                if (!(await confirmar({ titulo: `¿Quitar a ${x.email}?`, texto: "Ya no podrá crear cuenta. Si ya la tiene, la conserva.", ok: "Quitar", peligro: true }))) return;
                const { error } = await sb.from("invitados").delete().eq("email", x.email);
                if (error) aviso(textoError(error), "error"); else recargar();
              }}><Trash2 className="size-4" /></button>
            )}
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}
