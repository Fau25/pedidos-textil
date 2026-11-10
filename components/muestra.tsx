const COLORES_TELA: Record<string, string> = {
  blanco: "#ffffff", negro: "#1d1d1f", marino: "#1f2a44", "azul marino": "#1f2a44", "azul royal": "#2449a8", royal: "#2449a8", rojo: "#c8232c", "gris vigoré": "#b9bcc0", "gris jaspeado": "#a9adb2",
  gris: "#9ea3aa", "gris plomo": "#55595f", "verde botella": "#1f4d36", "verde kelly": "#1f9a4a", naranja: "#f07b1a", amarillo: "#f5c518", granate: "#6e1f2a", celeste: "#8fc1e8",
  turquesa: "#1fa5b5", chocolate: "#4a2c22", "rosa claro": "#f4c2cf", rosa: "#f0a3bb", fucsia: "#d62f84", morado: "#5b2a86", "blanco perla": "#f2efe8", "azul eléctrico": "#2f6fe0",
  ébano: "#2b2622", "verde militar": "#4b5233", aguamarina: "#55c2b5", lima: "#b6d43a", "verde fluor": "#7cf24a", "amarillo fluor": "#e8f53a", "naranja fluor": "#ff7a2a", beige: "#d9c6a5", arena: "#d8c8a8",
};
/** Color de la tela por su nombre (o null si no se conoce) */
export const colorTela = (nombre?: string | null) => (nombre ? COLORES_TELA[nombre.trim().toLowerCase()] ?? null : null);

export function Muestra({ color }: { color: string }) {
  const c = colorTela(color);
  return <span className="inline-block size-3 shrink-0 rounded-full border border-black/10" style={{ background: c ?? "conic-gradient(#ddd 0 25%, #fff 0 50%, #ddd 0 75%, #fff 0)" }} />;
}

/** Dibujo de la prenda teñido con su color: camiseta, sudadera/chaqueta o gorra */
export function Prenda({ tipo, color, className }: { tipo?: string | null; color?: string | null; className?: string }) {
  const t = (tipo ?? "").toLowerCase();
  const relleno = colorTela(color) ?? "#cfd3da";
  const claro = ["#ffffff", "#f2efe8", "#f5c518", "#e8f53a", "#f4c2cf", "#d9c6a5", "#d8c8a8", "#b6d43a", "#7cf24a"].includes(relleno);
  const trazo = claro ? "rgba(0,0,0,.18)" : "rgba(0,0,0,.28)";
  const brillo = "rgba(255,255,255,.18)";
  if (/gorra/.test(t)) return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <path d="M24 70c0-22 16-38 36-38s36 16 36 38z" fill={relleno} stroke={trazo} strokeWidth="1.5" />
      <path d="M18 70h84c4 0 4 9-1 10-20 4-62 4-82 0-5-1-5-10-1-10z" fill={relleno} stroke={trazo} strokeWidth="1.5" />
      <circle cx="60" cy="32" r="3.5" fill={trazo} /><path d="M60 34v36" stroke={trazo} strokeWidth="1.2" />
    </svg>
  );
  const largo = /sudadera|chaqueta|softshell|acolchad|forro|polar|cazadora/.test(t);
  const capucha = /capucha|urban|sudadera con/.test(t);
  const cuelloPolo = /polo/.test(t);
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      {largo ? (
        <path d="M44 22l-24 10-12 50 12 4 10-34v54h60V52l10 34 12-4-12-50-24-10c-2 7-8 12-16 12s-14-5-16-12z" fill={relleno} stroke={trazo} strokeWidth="1.5" strokeLinejoin="round" />
      ) : (
        <path d="M44 20L18 32l-8 22 16 6 6-12v58h56V48l6 12 16-6-8-22-26-12c-2 8-8 13-16 13s-14-5-16-13z" fill={relleno} stroke={trazo} strokeWidth="1.5" strokeLinejoin="round" />
      )}
      {capucha && <path d="M42 22c0-12 8-16 18-16s18 4 18 16c-4 8-10 12-18 12s-14-4-18-12z" fill={relleno} stroke={trazo} strokeWidth="1.5" />}
      {cuelloPolo && <path d="M52 22l8 14 8-14M60 36v12" stroke={trazo} strokeWidth="1.5" fill="none" />}
      {largo && !capucha && /chaqueta|softshell|acolchad|cazadora/.test(t) && <path d="M60 34v74" stroke={trazo} strokeWidth="1.5" />}
      {capucha && <path d="M46 84h28v12H46z" fill="none" stroke={trazo} strokeWidth="1.3" rx="3" />}
      <path d="M36 50c6 20 4 40 0 56" stroke={brillo} strokeWidth="6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
