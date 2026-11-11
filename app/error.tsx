"use client";
import { useEffect } from "react";
import { apuntarError } from "@/lib/errores";

/** Si una pantalla falla, se apunta el error y se ofrece reintentar en vez de dejarla en blanco */
export default function ErrorPantalla({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { apuntarError(error); }, [error]);
  return (
    <div className="tarjeta mx-auto mt-10 max-w-md p-6 text-center">
      <p className="text-[17px] font-semibold">Algo ha fallado en esta pantalla</p>
      <p className="mt-1.5 text-[13px] text-texto2">Ha quedado apuntado para revisarlo. Puedes volver a intentarlo.</p>
      <div className="mt-5 flex justify-center gap-2">
        <button onClick={reset} className="h-11 rounded-full bg-acento px-5 text-[14px] font-medium text-sobre-acento">Reintentar</button>
        {/* oxlint-disable-next-line nextjs/no-html-link-for-pages -- recarga completa a propósito */}
        <a href="/pedidos-textil/" className="inline-flex h-11 items-center rounded-full border border-borde px-5 text-[14px] font-medium">Ir al inicio</a>
      </div>
    </div>
  );
}
