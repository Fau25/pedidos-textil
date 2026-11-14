"use client";
import { Suspense, useEffect, type ReactNode } from "react";
import { ProveedorSesion } from "./sesion";
import { ProveedorAvisos } from "./ui";
import { Marco } from "./marco";
import { escucharErrores } from "@/lib/errores";
import { calentarPDF } from "@/lib/entregar-pdf";

export function Raiz({ children }: { children: ReactNode }) {
  useEffect(() => escucharErrores(), []);
  useEffect(() => { if (!location.pathname.includes("/entrar")) calentarPDF(); }, []);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || location.hostname === "localhost") return;
    // Versión nueva publicada: el nuevo service worker toma el control y la app se recarga sola
    // (salvo en el editor de pedidos, para no perder lo que se está escribiendo: se aplica al salir de él)
    const habia = !!navigator.serviceWorker.controller;
    let hecho = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!habia || hecho) return; hecho = true;
      if (!/\/(pedidos|trabajos)\/nuevo/.test(location.pathname)) location.reload();
      else window.addEventListener("popstate", () => location.reload(), { once: true });
    });
    navigator.serviceWorker.register("/pedidos-textil/sw.js", { updateViaCache: "none" }).then((r) => r.update()).catch(() => {});
  }, []);
  return (
    <ProveedorAvisos>
      <ProveedorSesion>
        <Marco><Suspense>{children}</Suspense></Marco>
      </ProveedorSesion>
    </ProveedorAvisos>
  );
}
