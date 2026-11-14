/** Enviar (menú de compartir del móvil: WhatsApp, correo…) o descargar un PDF ya generado */
export async function entregarPDF(blob: Blob, nombre: string, titulo: string, soloDescargar = false): Promise<"compartido" | "cancelado" | "descargado"> {
  const archivo = new File([blob], nombre, { type: "application/pdf" });
  // En móvil/tablet se abre el menú de compartir; en el ordenador se descarga
  if (!soloDescargar && navigator.canShare?.({ files: [archivo] }) && matchMedia("(pointer: coarse)").matches) {
    try { await navigator.share({ files: [archivo], title: titulo }); return "compartido"; }
    catch (e) { if ((e as Error).name === "AbortError") return "cancelado"; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "descargado";
}

/** Descarga por detrás el motor de PDF y sus fuentes cuando el dispositivo está libre,
 *  para que el primer ticket o factura salga al momento (quedan guardados en el dispositivo) */
export function calentarPDF() {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (c?.saveData) return;
  const ir = () => {
    import("./pdf").catch(() => {});
    for (const f of ["Inter_300Light", "Inter_400Regular", "Inter_600SemiBold"]) fetch(`/pedidos-textil/fonts/pdf/${f}.ttf`).catch(() => {});
  };
  const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number };
  setTimeout(() => (w.requestIdleCallback ? w.requestIdleCallback(ir, { timeout: 8000 }) : ir()), 4000);
}
