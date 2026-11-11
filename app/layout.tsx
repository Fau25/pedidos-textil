import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Raiz } from "@/components/raiz";

export const metadata: Metadata = {
  title: "Mis pedidos textiles",
  description: "Gestión de pedidos de ropa personalizada: clientes, prendas, bordados y presupuestos.",
  manifest: "/pedidos-textil/manifest.webmanifest",
  icons: { icon: "/pedidos-textil/icono.svg", apple: "/pedidos-textil/icono-180.png" },
  appleWebApp: { capable: true, title: "Pedidos", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1,
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#18191c" }],
};

// Política de seguridad del contenido: la app solo habla con su propio sitio y con Supabase.
// Si alguna vez se colara código ajeno, no podría enviar la sesión a otro servidor ni cargar scripts de fuera.
// (Next mete scripts en línea con los datos de la página, por eso hace falta 'unsafe-inline' en script-src.)
const SB = "https://sqartxsdlynecelkufyq.supabase.co";
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'", // wasm: lo usa el generador de PDF
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SB}`,
  "font-src 'self' data:",
  `connect-src 'self' data: blob: ${SB} wss://sqartxsdlynecelkufyq.supabase.co`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const TEMA = `try{var t=localStorage.getItem('tema');if(t==='oscuro'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Content-Security-Policy" content={CSP} />
        <script dangerouslySetInnerHTML={{ __html: TEMA }} />
        <link rel="preconnect" href="https://sqartxsdlynecelkufyq.supabase.co" crossOrigin="" />
        <link rel="preload" href="/pedidos-textil/fuentes/pjs-400.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/pedidos-textil/fuentes/pjs-500.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/pedidos-textil/fuentes/pjs-600.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/pedidos-textil/fuentes/pjs-700.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>
        <noscript><p style={{ padding: 24, fontFamily: "system-ui" }}>Mis pedidos textiles necesita JavaScript. Actívalo en tu navegador para usar la app.</p></noscript>
        <Raiz>{children}</Raiz>
      </body>
    </html>
  );
}
