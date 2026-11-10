"use client";
import { useEffect, useState } from "react";
import { EditorPedido } from "@/components/editor-pedido";

export default function Nuevo() {
  const [params, setParams] = useState<{ id: string | null; dup: string | null } | null>(null);
  useEffect(() => { const s = new URLSearchParams(location.search); setParams({ id: s.get("id"), dup: s.get("duplicar") }); }, []);
  if (!params) return null;
  return <EditorPedido key={(params.id ?? "") + (params.dup ?? "")} pedidoId={params.id} duplicarDe={params.dup} />;
}
