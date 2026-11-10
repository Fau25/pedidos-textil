"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, Phone, Mail, MapPin } from "lucide-react";
import { Cabecera } from "@/components/marco";
import { Boton, Cargando, Pastilla, Tarjeta, Vacio, fecha, useAvisos } from "@/components/ui";
import { FormCliente } from "@/components/form-cliente";
import { sb, textoError } from "@/lib/supabase";
import { useCarga, useParam } from "@/lib/usar";
import { aCent, euros } from "@/lib/calculo";
import type { Cliente, Pedido } from "@/lib/tipos";

export default function FichaCliente() {
  const cid = useParam("id");
  const { aviso, confirmar } = useAvisos();
  const router = useRouter();
  const [editar, setEditar] = useState(false);
  const { datos, recargar, error } = useCarga(async () => {
    if (!cid) return null;
    const [c, p] = await Promise.all([
      sb.from("clientes").select("*").eq("id", cid).maybeSingle(),
      sb.from("pedidos").select("id, numero, fecha, entrega, total, entregado, unidades, referencia").eq("cliente_id", cid).order("fecha", { ascending: false }),
    ]);
    return { cliente: c.data as Cliente | null, pedidos: (p.data ?? []) as Pedido[] };
  }, [cid]);

  if (!cid || !datos) return <Cargando error={error} reintentar={recargar} />;
  const { cliente, pedidos } = datos;
  if (!cliente) return <Vacio titulo="Este cliente no existe" accion={<Link href="/clientes/"><Boton>Ver clientes</Boton></Link>} />;
  const total = pedidos.reduce((a, p) => a + aCent(p.total), 0);

  async function borrar() {
    if (pedidos.length) return aviso("No se puede borrar: tiene pedidos. Borra o reasigna sus pedidos primero.", "error");
    if (!(await confirmar({ titulo: `¿Eliminar a ${cliente!.nombre}?`, ok: "Eliminar", peligro: true }))) return;
    const { error } = await sb.from("clientes").delete().eq("id", cliente!.id);
    if (error) return aviso(textoError(error), "error");
    aviso("Cliente eliminado"); router.push("/clientes/");
  }

  return (
    <>
      <Cabecera volver={{ href: "/clientes/", t: "Clientes" }} titulo={cliente.nombre} sub={cliente.contacto}
        acciones={<>
          <Link href={`/pedidos/nuevo/?cliente=${cliente.id}`}><Boton variante="primario"><Plus className="size-4" />Nuevo pedido</Boton></Link>
          <Boton onClick={() => setEditar(true)}><Pencil className="size-4" />Editar</Boton>
          <Boton variante="fantasma" aria-label="Eliminar cliente" className="hover:text-red-600" onClick={borrar}><Trash2 className="size-4" /></Boton>
        </>} />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Tarjeta titulo={`Pedidos · ${pedidos.length}`} accion={<span className="num text-[13px] text-texto2">{euros(total)}</span>} sinPadding>
            {!pedidos.length ? <p className="px-5 pb-5 text-texto2">Aún no tiene pedidos.</p> : (
              <ul className="divide-y divide-borde">
                {pedidos.map((p) => { return (
                  <li key={p.id}><Link href={`/pedidos/ver/?id=${p.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-suave/60">
                    <span className="num w-28 font-semibold">{p.numero}</span>
                    <span className="flex-1 text-[13px] text-texto2">{fecha(p.fecha)} · {p.unidades} uds{p.referencia ? " · " + p.referencia : ""}</span>
                    <span className="num text-[13px] font-medium">{euros(aCent(p.total))}</span>
                    <Pastilla color={p.entregado ? "verde" : "ambar"}>{p.entregado ? "Entregado" : "Pendiente"}</Pastilla>
                  </Link></li>); })}
              </ul>
            )}
          </Tarjeta>

        </div>
        <Tarjeta titulo="Datos">
          <div className="space-y-2.5 text-[13px]">
            {cliente.telefono && <a href={`tel:${cliente.telefono.replace(/\s/g, "")}`} className="flex items-center gap-2 text-acento"><Phone className="size-4" />{cliente.telefono}</a>}
            {cliente.email && <a href={`mailto:${cliente.email}`} className="flex items-center gap-2 break-all text-acento"><Mail className="size-4 shrink-0" />{cliente.email}</a>}
            {cliente.direccion && <p className="flex gap-2"><MapPin className="size-4 shrink-0 text-texto2" />{cliente.direccion}</p>}
            {cliente.nif && <p><span className="text-texto2">NIF/CIF </span>{cliente.nif}</p>}
            {cliente.facturacion && <div><p className="text-texto2">Facturación</p><p className="whitespace-pre-line">{cliente.facturacion}</p></div>}
            {cliente.notas && <div><p className="text-texto2">Observaciones</p><p className="whitespace-pre-line">{cliente.notas}</p></div>}
            {!cliente.telefono && !cliente.email && !cliente.nif && <button className="text-acento" onClick={() => setEditar(true)}>Completar datos</button>}
          </div>
        </Tarjeta>
      </div>
      <FormCliente abierto={editar} cerrar={() => setEditar(false)} cliente={cliente} guardado={recargar} />
    </>
  );
}
