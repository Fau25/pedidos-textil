"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { sb } from "@/lib/supabase";
import type { Empresa, TarifaFila, Tecnica, Proveedor } from "@/lib/tipos";
import { MODELOS_ROLY } from "@/lib/roly";

type Datos = {
  sesion: Session | null;
  empresa: Empresa | null;
  rol: string;
  tecnicas: Tecnica[];
  tarifas: TarifaFila[];
  proveedores: Proveedor[];
  /** Cambia cada vez que llegan cambios (tiempo real) o se vuelve a la app: las pantallas recargan con él */
  version: number;
  recargar: () => Promise<void>;
  tocar: () => void;
};

const Ctx = createContext<Datos | null>(null);
export const useSesion = () => useContext(Ctx)!;

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [listo, setListo] = useState(false);
  const [recuperacion, setRecuperacion] = useState(false);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [rol, setRol] = useState("lector");
  const [tecnicas, setTecnicas] = useState<Tecnica[]>([]);
  const [tarifas, setTarifas] = useState<TarifaFila[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargado, setCargado] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const uid = sesion?.user.id;

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => { setSesion(data.session); setListo(true); });
    const { data } = sb.auth.onAuthStateChange((ev, s) => {
      if (ev === "PASSWORD_RECOVERY") setRecuperacion(true);
      setSesion(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const recargar = useCallback(async () => {
    if (!uid) return;
    setFallo(null);
    try {
    const { data: m, error: em } = await sb.from("miembros").select("empresa_id, rol").eq("user_id", uid).limit(1).maybeSingle();
    if (em) throw em;
    if (!m) { setEmpresa(null); setCargado(true); return; }
    const e = m.empresa_id;
    const [emp, tec, tar, prov] = await Promise.all([
      sb.from("empresas").select("*").eq("id", e).single(),
      sb.from("tecnicas").select("*").eq("empresa_id", e).order("orden"),
      sb.from("tarifas").select("*").eq("empresa_id", e).order("desde"),
      sb.from("proveedores").select("*").eq("empresa_id", e).order("nombre"),
    ]);
    setRol(m.rol);
    setEmpresa(emp.data as Empresa);
    setTecnicas((tec.data ?? []) as Tecnica[]);
    setTarifas(((tar.data ?? []) as TarifaFila[]).map((t) => ({ ...t, coste: Number(t.coste), precio: Number(t.precio) })));
    if (emp.error) throw emp.error;
    setProveedores((prov.data ?? []) as Proveedor[]);
    setCargado(true);
    } catch (e) {
      // Un error de conexión NO es «no tienes empresa»: se avisa y se reintenta
      setFallo(textoError(e)); setCargado(true);
    }
  }, [uid]);

  useEffect(() => { if (uid) { setCargado(false); recargar(); } else { setEmpresa(null); setCargado(true); } }, [uid, recargar]);
  useEffect(() => {
    if (!fallo) return;
    const r = () => recargar();
    window.addEventListener("online", r);
    const t = setInterval(r, 15000);
    return () => { window.removeEventListener("online", r); clearInterval(t); };
  }, [fallo, recargar]);

  // Tiempo real + actualizar al volver a la app (sin tener que pulsar refrescar)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tocar = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setVersion((v) => v + 1), 250);
  }, []);
  useEffect(() => {
    if (!empresa) return;
    const canal = sb.channel("cambios-" + empresa.id);
    for (const t of ["pedidos", "pedido_lineas", "clientes", "presupuestos"])
      canal.on("postgres_changes", { event: "*", schema: "public", table: t, filter: `empresa_id=eq.${empresa.id}` }, tocar);
    canal.subscribe();
    const vis = () => { if (document.visibilityState === "visible") { tocar(); sb.auth.startAutoRefresh(); } else sb.auth.stopAutoRefresh(); };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("online", tocar);
    return () => { sb.removeChannel(canal); document.removeEventListener("visibilitychange", vis); window.removeEventListener("online", tocar); };
  }, [empresa, tocar]);


  if (!listo) return <PantallaCarga />;
  if (recuperacion && sesion) return <NuevaContrasena hecho={() => setRecuperacion(false)} />;
  if (!sesion) return <Entrar />;
  if (!cargado) return <PantallaCarga />;
  if (fallo && !empresa) return <SinConexion texto={fallo} reintentar={() => { setCargado(false); recargar(); }} />;
  if (!empresa) return <AltaEmpresa hecho={recargar} />;

  return (
    <Ctx.Provider value={{ sesion, empresa, rol, tecnicas, tarifas, proveedores, version, recargar, tocar }}>
      {children}
    </Ctx.Provider>
  );
}

import { Boton, Campo } from "./ui";
import { textoError, SITIO } from "@/lib/supabase";
import { Logo } from "./logo";
import { cargarEjemplo } from "@/lib/ejemplo";

function PantallaCarga() {
  // Si tarda (servidor despertando o conexión lenta), decirlo en vez de dejar la pantalla en blanco
  const [lento, setLento] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLento(true), 2500); return () => clearTimeout(t); }, []);
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-4"><Logo grande />{lento && <p className="animar text-[13px] text-texto2" role="status">Conectando…</p>}</div>
    </div>
  );
}

function SinConexion({ texto, reintentar }: { texto: string; reintentar: () => void }) {
  return (
    <Marco titulo="Sin conexión" sub="Tus datos están a salvo. No se ha podido contactar con el servidor.">
      <p className="mb-4 text-[13px] text-texto2">{texto} Si hace más de una semana que nadie abre la app, el servidor puede tardar un minuto en despertar.</p>
      <Boton variante="primario" className="w-full" onClick={reintentar}>Reintentar</Boton>
      <button className="mt-4 w-full text-center text-[13px] text-texto2 hover:underline" onClick={() => sb.auth.signOut()}>Salir</button>
    </Marco>
  );
}

function Marco({ titulo, sub, children }: { titulo: string; sub?: string; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo grande />
          <h1 className="mt-5 text-[24px] font-semibold tracking-[-0.02em]">{titulo}</h1>
          {sub && <p className="mt-1.5 text-texto2">{sub}</p>}
        </div>
        <div className="tarjeta p-6">{children}</div>
      </div>
    </main>
  );
}

function Entrar() {
  const [modo, setModo] = useState<"entrar" | "alta" | "olvido">("entrar");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setCargando(true); setMsg(null);
    try {
      if (modo === "entrar") {
        const { error } = await sb.auth.signInWithPassword({ email, password: clave });
        if (error) throw error;
      } else if (modo === "alta") {
        const { data, error } = await sb.auth.signUp({ email, password: clave, options: { emailRedirectTo: SITIO } });
        if (error) throw error;
        if (!data.session) setMsg({ ok: true, t: "Te hemos enviado un email. Pulsa el enlace para confirmar la cuenta y vuelve aquí para entrar." });
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: SITIO });
        if (error) throw error;
        setMsg({ ok: true, t: "Si el email existe, te llegará un enlace para elegir una contraseña nueva." });
      }
    } catch (err) { setMsg({ t: textoError(err) }); } finally { setCargando(false); }
  }

  const titulos = { entrar: "Entrar", alta: "Crear cuenta", olvido: "Recuperar contraseña" };
  return (
    <Marco titulo={titulos[modo]} sub={modo === "entrar" ? "Gestiona tus pedidos textiles" : undefined}>
      <form onSubmit={enviar} className="space-y-4">
        <Campo etiqueta="Email"><input className="campo" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
        {modo !== "olvido" && (
          <Campo etiqueta="Contraseña" ayuda={modo === "alta" ? "Mínimo 8 caracteres." : undefined}>
            <input className="campo" type="password" autoComplete={modo === "alta" ? "new-password" : "current-password"} required minLength={modo === "alta" ? 8 : 6} value={clave} onChange={(e) => setClave(e.target.value)} />
          </Campo>
        )}
        {msg && <p role="status" className={msg.ok ? "rounded-lg bg-emerald-50 p-3 text-[13px] text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "rounded-lg bg-red-50 p-3 text-[13px] text-red-700 dark:bg-red-950/50 dark:text-red-300"}>{msg.t}</p>}
        <Boton variante="primario" className="w-full" cargando={cargando} type="submit">
          {modo === "entrar" ? "Entrar" : modo === "alta" ? "Crear cuenta" : "Enviar enlace"}
        </Boton>
      </form>
      <div className="mt-5 flex flex-col items-center gap-2 text-[13px]">
        {modo === "entrar" && <>
          <button className="text-acento hover:underline" onClick={() => { setModo("alta"); setMsg(null); }}>¿Primera vez? Crear cuenta</button>
          <button className="text-texto2 hover:underline" onClick={() => { setModo("olvido"); setMsg(null); }}>He olvidado la contraseña</button>
        </>}
        {modo !== "entrar" && <button className="text-acento hover:underline" onClick={() => { setModo("entrar"); setMsg(null); }}>Volver a entrar</button>}
      </div>
    </Marco>
  );
}

function NuevaContrasena({ hecho }: { hecho: () => void }) {
  const [clave, setClave] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  return (
    <Marco titulo="Nueva contraseña">
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault(); setCargando(true); setError("");
        const { error } = await sb.auth.updateUser({ password: clave });
        setCargando(false);
        if (error) setError(textoError(error)); else hecho();
      }}>
        <Campo etiqueta="Contraseña nueva" error={error}><input className="campo" type="password" autoComplete="new-password" minLength={8} required value={clave} onChange={(e) => setClave(e.target.value)} /></Campo>
        <Boton variante="primario" className="w-full" cargando={cargando} type="submit">Guardar</Boton>
      </form>
    </Marco>
  );
}

function AltaEmpresa({ hecho }: { hecho: () => Promise<void> }) {
  const [nombre, setNombre] = useState("");
  const [ejemplo, setEjemplo] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  return (
    <Marco titulo="Tu taller" sub="Un último paso: ponle nombre a tu negocio. Saldrá en los presupuestos.">
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault(); setCargando(true); setError("");
        try {
          const { data, error } = await sb.rpc("crear_empresa", { nombre });
          if (error) throw error;
          await sb.from("catalogo").insert(MODELOS_ROLY.map((m) => ({ empresa_id: data, marca: "Roly", tipo: m.tipo, modelo: m.modelo, referencia: m.referencia, colores: m.colores, tallas: m.tallas, notas: m.notas ?? null, favorito: true, precio_compra: 0 })));
          if (ejemplo) await cargarEjemplo(data as string);
          await hecho();
        } catch (err) { setError(textoError(err)); setCargando(false); }
      }}>
        <Campo etiqueta="Nombre del taller o empresa" error={error}><input className="campo" required autoFocus placeholder="Bordados Fau" value={nombre} onChange={(e) => setNombre(e.target.value)} /></Campo>
        <label className="flex items-start gap-3 rounded-xl bg-suave p-3 text-[13px]">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--acento)]" checked={ejemplo} onChange={(e) => setEjemplo(e.target.checked)} />
          <span><b className="font-semibold">Añadir datos de ejemplo</b><br /><span className="text-texto2">Clientes, prendas y pedidos de muestra para probar la app. Los puedes borrar después en Ajustes.</span></span>
        </label>
        <Boton variante="primario" className="w-full" cargando={cargando} type="submit">Empezar</Boton>
      </form>
      <button className="mt-4 w-full text-center text-[13px] text-texto2 hover:underline" onClick={() => sb.auth.signOut()}>Salir</button>
    </Marco>
  );
}
