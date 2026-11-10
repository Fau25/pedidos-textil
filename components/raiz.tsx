"use client";
import { Suspense, useEffect, type ReactNode } from "react";
import { ProveedorSesion } from "./sesion";
import { ProveedorAvisos } from "./ui";
import { Marco } from "./marco";

export function Raiz({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator && location.hostname !== "localhost")
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
