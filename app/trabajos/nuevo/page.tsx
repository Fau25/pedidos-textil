"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, Paperclip, Phone, Plus, Trash2, User, X } from "lucide-react";
import { useSesion } from "@/components/sesion";
import { Cabecera } from "@/components/marco";
import { Cargando, CampoImporte, cx, useAvisos } from "@/components/ui";
import { iconoTecnica } from "@/components/bloque-personalizacion";
import { TicketTrabajo } from "@/components/ticket-trabajo";
import { sb, subirArchivo, textoError } from "@/lib/supabase";
import { useParam } from "@/lib/usar";
import { euros } from "@/lib/calculo";
import { AVISO_SIN_TRABAJOS, guardarTrabajo, nuevoItem, nuevoTrabajo, pendienteCent, sinTablaTrabajos, type ItemTrabajo, type Trabajo } from "@/lib/trabajos";

type ClienteMin = { id: string; nombre: string; telefono: string | null };

/** «Recibí»: ficha rápida para apuntar un trabajo en el que el cliente deja sus prendas */
export default function NuevoTrabajo() {
  const { empresa, tecnicas, rol } = useSesion();
  const puedeEditar = rol !== "lector";
  const { aviso, confirmar } = useAvisos();
  const router = useRouter();
  const id = useParam("id");
  const tecnicaInicial = tecnicas[0]?.nombre ?? "Bordado";
  const [t, setT] = useState<Trabajo | null>(null);
  const [clientes, setClientes] = useState<ClienteMin[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [ticket, setTicket] = useState<Trabajo | null>(null);
  const [errorNombre, setErrorNombre] = useState(false);
  const cambiado = useRef(false);

  useEffect(() => {
    if (!empresa) return;
    sb.from("clientes").select("id, nombre, telefono").eq("empresa_id", empresa.id).order("nombre").limit(3000).then(({ data }) => setClientes((data ?? []) as ClienteMin[]));
    if (!id) { setT(nuevoTrabajo(empresa.id, tecnicaInicial)); return; }
    sb.from("trabajos").select("*").eq("id", id).maybeSingle().then(({ data, error }) => {
      if (error) { aviso(sinTablaTrabajos(error) ? AVISO_SIN_TRABAJOS : textoError(error), "error"); return router.replace("/trabajos/"); }
      if (!data) { aviso("No se encuentra el trabajo", "error"); return router.replace("/trabajos/"); }
      const x = data as Trabajo;
      setT({ ...x, items: x.items?.length ? x.items : [nuevoItem(tecnicaInicial)], total: Number(x.total), a_cuenta: Number(x.a_cuenta) });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, id]);

  if (!t) return <Cargando />;
  const set = (c: Partial<Trabajo>) => { cambiado.current = true; setT((x) => (x ? { ...x, ...c } : x)); };
  const setItem = (iid: string, c: Partial<ItemTrabajo>) => set({ items: t.items.map((i) => (i.id === iid ? { ...i, ...c } : i)) });

  function elegirCliente(nombre: string) {
    const c = clientes.find((x) => x.nombre.toLowerCase() === nombre.trim().toLowerCase());
    set({ cliente_nombre: nombre, cliente_id: c?.id ?? null, ...(c?.telefono && !t!.cliente_telefono ? { cliente_telefono: c.telefono } : {}) });
    if (nombre.trim()) setErrorNombre(false);
  }

  async function guardar() {
    if (!t!.cliente_nombre?.trim()) { setErrorNombre(true); return aviso("Escribe el nombre del cliente", "error"); }
    if (!t!.items.some((i) => i.que.trim())) return aviso("Escribe qué deja el cliente", "error");
    setGuardando(true);
    try {
      const g = await guardarTrabajo(t!);
      cambiado.current = false;
      setT({ ...g, items: g.items, total: Number(g.total), a_cuenta: Number(g.a_cuenta) });
      setTicket(g);
      aviso(id ? "Trabajo guardado" : `Trabajo ${g.numero} apuntado`);
    } catch (e) { aviso(textoError(e), "error"); } finally { setGuardando(false); }
  }

  async function salir() {
    if (cambiado.current && !(await confirmar({ titulo: "¿Salir sin guardar?", texto: "Lo que has escrito no se guardará.", ok: "Salir sin guardar", peligro: true }))) return;
    router.push("/trabajos/");
  }

  async function borrar() {
    if (!(await confirmar({ titulo: `¿Borrar el trabajo ${t!.numero}?`, texto: "No se puede deshacer.", ok: "Borrar", peligro: true }))) return;
    const { error } = await sb.from("trabajos").delete().eq("id", t!.id);
    if (error) return aviso(textoError(error), "error");
    aviso("Trabajo borrado"); router.push("/trabajos/");
  }

  const pend = pendienteCent(t);
  const etiqueta = "mb-1 block text-[11.5px] font-semibold text-texto2";

  return (
    <div className="mx-auto max-w-2xl pb-28 lg:pb-10">
      <Cabecera titulo={id ? `Trabajo ${t.numero ?? ""}` : "Recibí · nuevo trabajo"} sub="El cliente deja sus prendas para personalizar" volver={{ href: "/trabajos/", t: "Trabajos" }} />

      <div className="grid gap-3">
        <section className="tarjeta p-4" aria-labelledby="t-cliente">
          <h2 id="t-cliente" className="mb-2 text-[12px] font-bold uppercase tracking-[.06em] text-texto2">Cliente</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="relative">
              <span className="sr-only">Nombre del cliente</span>
              <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto2" aria-hidden="true" />
              <input className={cx("campo pl-9", errorNombre && "!border-red-500")} list="trabajo-clientes" placeholder="Nombre" autoComplete="off"
                value={t.cliente_nombre ?? ""} onChange={(e) => elegirCliente(e.target.value)} />
              <datalist id="trabajo-clientes">{clientes.map((c) => <option key={c.id} value={c.nombre} />)}</datalist>
            </label>
            <label className="relative">
              <span className="sr-only">Teléfono</span>
              <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto2" aria-hidden="true" />
              <input className="campo pl-9" type="tel" inputMode="tel" placeholder="Teléfono" value={t.cliente_telefono ?? ""} onChange={(e) => set({ cliente_telefono: e.target.value })} />
            </label>
          </div>
          <p className="mt-1.5 text-[12px] text-texto2">{t.cliente_id ? "Cliente de tu lista" : "Escribe el nombre: si ya es cliente tuyo, aparece en la lista."}</p>
        </section>

        {t.items.map((i, n) => {
          return (
            <section key={i.id} className="tarjeta p-4" aria-label={`Prenda ${n + 1}`}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[12px] font-bold uppercase tracking-[.06em] text-texto2">Prenda {n + 1}</h2>
                {t.items.length > 1 && <button className="flex items-center gap-1 text-[12px] font-semibold text-texto2 hover:text-red-600" onClick={() => set({ items: t.items.filter((x) => x.id !== i.id) })}><X className="size-3.5" />Quitar</button>}
              </div>
              <div className="grid grid-cols-[1fr_80px] gap-2">
                <label><span className={etiqueta}>Qué deja</span><input className="campo" placeholder="Juego de cuna, toalla, mochila…" value={i.que} onChange={(e) => setItem(i.id, { que: e.target.value })} /></label>
                <label><span className={etiqueta}>Cant.</span><input className="campo num text-center font-bold" type="number" inputMode="numeric" min={1} value={i.cantidad || ""} onChange={(e) => setItem(i.id, { cantidad: Math.max(0, Number(e.target.value) || 0) })} /></label>
              </div>
              <div className="mt-3 border-t border-borde pt-3">
                <span className={etiqueta}>Personalización</span>
                <div className="mb-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Técnica de la prenda ${n + 1}`}>
                  {(tecnicas.length ? tecnicas.map((x) => x.nombre) : ["Bordado", "Vinilo", "DTF"]).map((nombre) => {
                    const I = iconoTecnica(nombre); const on = i.tecnica === nombre;
                    return (
                      <button key={nombre} role="radio" aria-checked={on} onClick={() => setItem(i.id, { tecnica: on ? "" : nombre })}
                        className={cx("flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-bold", on ? "bg-acento text-sobre-acento" : "border border-borde bg-superficie")}>
                        <I className="size-[15px]" />{nombre}
                      </button>
                    );
                  })}
                </div>
                <label><span className="sr-only">Qué y dónde</span>
                  <textarea className="campo min-h-[64px] py-2.5 leading-snug" rows={2} placeholder="Qué y dónde: nombre «Lucía» en la esquina, letra script, hilo rosa…" value={i.detalle} onChange={(e) => setItem(i.id, { detalle: e.target.value })} />
                </label>
                <Diseno i={i} n={n} cambiar={(p) => setItem(i.id, { diseno_path: p })} />
              </div>
            </section>
          );
        })}

        <button onClick={() => set({ items: [...t.items, nuevoItem(tecnicaInicial)] })}
          className="flex h-11 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-dashed border-borde text-[13.5px] font-semibold hover:bg-superficie">
          <Plus className="size-4" />Añadir otra prenda
        </button>

        <section className="resumen-oscuro tarjeta grid grid-cols-2 gap-3 p-4" aria-label="Entrega y precio">
          <label><span className="mb-1 block text-[11.5px] text-white/65">Para el</span>
            <span className="relative block"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/70" aria-hidden="true" />
              <input type="date" className="campo pl-9 [color-scheme:dark]" value={t.entrega ?? ""} onChange={(e) => set({ entrega: e.target.value || null })} /></span>
          </label>
          <label><span className="mb-1 block text-[11.5px] text-white/65">Precio total</span>
            <CampoImporte valor={t.total || null} cambiar={(v) => set({ total: v ?? 0 })} aria-label="Precio total" /></label>
          <label><span className="mb-1 block text-[11.5px] text-white/65">Deja a cuenta</span>
            <CampoImporte valor={t.a_cuenta || null} cambiar={(v) => set({ a_cuenta: v ?? 0 })} aria-label="Deja a cuenta" /></label>
          <div className="flex flex-col items-end justify-end"><span className="text-[11.5px] text-white/65">Pendiente</span><b className="num text-[26px] leading-tight">{euros(pend)}</b></div>
          <label className="col-span-2"><span className="mb-1 block text-[11.5px] text-white/65">Notas (opcional)</span>
            <input className="campo" placeholder="Algo más que deba saber el taller" value={t.notas ?? ""} onChange={(e) => set({ notas: e.target.value })} /></label>
        </section>

        {puedeEditar && (
          <div className="fixed inset-x-4 bottom-[92px] z-20 grid grid-cols-[auto_1fr] gap-2 lg:static lg:inset-auto lg:mt-1">
            <button onClick={salir} className="cristal h-[52px] rounded-full px-5 text-[14.5px] font-semibold">Cancelar</button>
            <button onClick={guardar} disabled={guardando} className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-azul text-[15.5px] font-bold text-white shadow-[0_12px_24px_-10px_rgba(29,82,235,.6)] disabled:opacity-60">
              {guardando && <Loader2 className="size-5 animate-spin" />}{id ? "Guardar y ver ticket" : "Guardar y generar ticket"}
            </button>
          </div>
        )}
        {id && puedeEditar && <button onClick={borrar} className="mx-auto mt-2 flex items-center gap-1.5 text-[13px] font-medium text-texto2 hover:text-red-600"><Trash2 className="size-4" />Borrar trabajo</button>}
      </div>

      <TicketTrabajo t={ticket} abierto={!!ticket} cerrar={() => { setTicket(null); router.push("/trabajos/"); }} />
    </div>
  );
}

/** Foto del diseño de una prenda (opcional) */
function Diseno({ i, n, cambiar }: { i: ItemTrabajo; n: number; cambiar: (p: string | null) => void }) {
  const { empresa } = useSesion();
  const { aviso } = useAvisos();
  const [subiendo, setSubiendo] = useState(false);
  const nombre = i.diseno_path?.split("/").pop();
  return (
    <div className="mt-2 flex items-center gap-2">
      <label className={cx("flex h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-dashed border-borde px-3 text-[12.5px] text-texto2 hover:bg-superficie", subiendo && "pointer-events-none opacity-60")}>
        {subiendo ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4 shrink-0" />}
        <span className="truncate">{nombre ? `Diseño: ${nombre}` : "Añadir foto del diseño (opcional)"}</span>
        <input type="file" accept="image/*,application/pdf" className="sr-only" aria-label={`Foto del diseño de la prenda ${n + 1}`} onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
          setSubiendo(true);
          try { cambiar(await subirArchivo(empresa!.id, "trabajos", f)); } catch (err) { aviso(textoError(err), "error"); } finally { setSubiendo(false); }
        }} />
      </label>
      {i.diseno_path && <button aria-label="Quitar el diseño" className="grid size-10 place-items-center rounded-full text-texto2 hover:text-red-600" onClick={() => cambiar(null)}><X className="size-4" /></button>}
    </div>
  );
}
