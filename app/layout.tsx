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

const TEMA = `try{var t=localStorage.getItem('tema');if(t==='oscuro'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA }} />
        <link rel="preconnect" href="https://sqartxsdlynecelkufyq.supabase.co" crossOrigin="" />
        <link rel="preload" href="/pedidos-textil/fuentes/pjs-400.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/pedidos-textil/fuentes/pjs-600.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body><Raiz>{children}</Raiz></body>
    </html>
  );
}
