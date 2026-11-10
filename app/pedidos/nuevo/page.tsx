"use client";
import { EditorPedido } from "@/components/editor-pedido";
import { useParam } from "@/lib/usar";

export default function Nuevo() {
  const id = useParam("id"), dup = useParam("duplicar");
  return <EditorPedido key={(id ?? "") + (dup ?? "")} pedidoId={id} duplicarDe={dup} />;
}
