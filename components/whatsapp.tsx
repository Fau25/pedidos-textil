/** WhatsApp: número para wa.me (añade 34 a los móviles españoles de 9 cifras) e icono en trazo */
export const telWa = (t: string) => { const d = t.replace(/\D/g, ""); return d.length === 9 ? "34" + d : d; };
export const enlaceWa = (tel: string, texto?: string) => `https://wa.me/${telWa(tel)}${texto ? "?text=" + encodeURIComponent(texto) : ""}`;

export function IconoWhatsApp({ className = "size-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4z" />
      <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z" strokeWidth="1.5" />
    </svg>
  );
}
