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

/** Descarga por detrás (sin ejecutarlo) el motor de PDF y sus fuentes cuando el dispositivo está libre.
 *  Quedan guardados en el dispositivo y el primer ticket o factura sale rápido. Ejecutarlo aquí congelaba
 *  el móvil medio segundo justo cuando se estaba escribiendo: ahora solo se ejecuta al abrir un ticket o factura. */
export function calentarPDF() {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (c?.saveData) return;
  const base = "/pedidos-textil/";
  const ir = async () => {
    const lista: string[] = await fetch(base + "pdf-chunks.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
    for (const f of [...lista, "fonts/pdf/Inter_300Light.ttf", "fonts/pdf/Inter_400Regular.ttf", "fonts/pdf/Inter_600SemiBold.ttf"]) await fetch(base + f).catch(() => {});
  };
  const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number };
  setTimeout(() => (w.requestIdleCallback ? w.requestIdleCallback(() => { ir(); }, { timeout: 8000 }) : ir()), 4000);
}
