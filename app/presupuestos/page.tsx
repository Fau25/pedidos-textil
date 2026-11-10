"use client";
import Link from "next/link";
import { useState } from "react";
import { FileText, Download } from "lucide-react";
import { useSesion } from "@/components/sesion";
import { Cabecera } from "@/components/marco";
import { Boton, Cargando, Pastilla, Vacio, cx, fecha, useAvisos } from "@/components/ui";
import { sb, textoError } from "@/lib/supabase";
import { useCarga } from "@/lib/usar";
import { aCent, euros } from "@/lib/calculo";
import { compartirOPDF } from "@/lib/presupuestos";
import { ESTADOS_PRESU, type Presupuesto } from "@/lib/tipos";

export default function Presupuestos() {
  const { empresa } = useSesion();
  const { aviso } = useAvisos();
  const [filtro, setFiltro] = useState<"" | Presupuesto["estado"]>("");
  const [ocupado, setOcupado] = useState("");
  const { datos } = useCarga(async () => {
    const { data, error } = await sb.from("presupuestos").select("*").eq("empresa_id", empresa!.id).order("creado", { ascending: false }).limit(500);
    if (error) throw error;
    return data as Presupuesto[];
  });
  const lista = (datos ?? []).filter((p) => !filtro || p.estado === filtro);
  const suma = (e: string) => (datos ?? []).filter((p) => p.estado === e).reduce((a, p) => a + aCent(p.total), 0);

  return (
    <>
      <Cabecera titulo="Presupuestos" sub="Se generan desde cada pedido. Aquí los tienes todos juntos." />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["borrador", "enviado", "aceptado", "rechazado"] as const).map((e) => (
          <button key={e} onClick={() => setFiltro(filtro === e ? "" : e)} className={cx("tarjeta p-4 text-left", filtro === e && "ring-2 ring-acento")}>
            <p className="text-[12px] font-medium text-texto2">{ESTADOS_PRESU[e]}</p>
            <p className="num mt-1 text-[18px] font-semibold">{euros(suma(e))}</p>
            <p className="text-[12px] text-texto2">{(datos ?? []).filter((p) => p.estado === e).length} presupuestos</p>
          </button>
        ))}
      </div>
      {!datos ? <Cargando /> : !lista.length ? (
        <div className="tarjeta"><Vacio icono={<FileText className="size-5" />} titulo={filtro ? "Ninguno con este estado" : "Aún no hay presupuestos"} texto="Abre un pedido y pulsa «Generar presupuesto»." /></div>
      ) : (
        <div className="tarjeta divide-y divide-borde">
          {lista.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <Link href={`/pedidos/ver/?id=${p.pedido_id}&tab=presupuesto`} className="min-w-[180px] flex-1">
                <p className="num font-semibold">{p.numero} <span className="font-normal text-texto2">· {p.datos.pedido?.numero}</span></p>
                <p className="truncate text-[13px] text-texto2">{p.datos.cliente?.nombre ?? "—"} · {fecha(p.fecha)}</p>
              </Link>
              <Pastilla color={{ borrador: "gris", enviado: "azul", aceptado: "verde", rechazado: "rojo" }[p.estado]}>{ESTADOS_PRESU[p.estado]}</Pastilla>
              <span className="num w-28 text-right font-medium">{euros(aCent(p.total))}</span>
              <Boton tam="s" variante="fantasma" aria-label={`Descargar PDF ${p.numero}`} cargando={ocupado === p.id} onClick={async () => {
                setOcupado(p.id);
                try { await compartirOPDF(p); } catch (e) { aviso(textoError(e), "error"); } finally { setOcupado(""); }
              }}><Download className="size-4" /></Boton>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
