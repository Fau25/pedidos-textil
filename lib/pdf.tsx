import { Document, Page, Text, View, Image, StyleSheet, Font, pdf } from "@react-pdf/renderer";
import { urlArchivo } from "./supabase";
import type { Presupuesto } from "./tipos";

const OSC = "#17181C", GRIS = "#6B7079", LINEA = "#E4E6EA", LATERAL = "#F5F6F8";
const e = (n: number) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " €";
const f = (d?: string | null) => (d ? new Date(d + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "");

// Inter (incluida en la app: la política de seguridad no deja cargar fuentes de fuera)
let fuentes = false;
export function registrarFuentes() {
  if (fuentes) return; fuentes = true;
  const u = (x: string) => `${location.origin}/pedidos-textil/fonts/pdf/${x}`;
  Font.register({ family: "Inter", fonts: [
    { src: u("Inter_300Light.ttf"), fontWeight: 300 },
    { src: u("Inter_400Regular.ttf"), fontWeight: 400 },
    { src: u("Inter_600SemiBold.ttf"), fontWeight: 600 },
  ] });
  Font.registerHyphenationCallback((w) => [w]);
}

/* Diseño E (lienzo «Tickets y facturas»): columna gris con los datos a la izquierda y, a la derecha,
   el título grande y fino, las líneas con «uds × precio» y el total grande abajo */
const s = StyleSheet.create({
  pag: { paddingTop: 46, paddingBottom: 56, paddingLeft: 150 + 36, paddingRight: 40, fontFamily: "Inter", fontSize: 9.5, color: OSC, lineHeight: 1.4 },
  lateral: { position: "absolute", top: 0, bottom: 0, left: 0, width: 150, backgroundColor: LATERAL },
  datos: { position: "absolute", top: 46, left: 18, width: 116 },
  peq: { fontSize: 7, fontWeight: 600, color: GRIS, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 },
  gris: { color: GRIS },
  b: { fontWeight: 600 },
  logo: { width: 96, height: 40, objectFit: "contain", objectPositionX: 0, marginBottom: 8 },
  inicial: { width: 26, height: 26, borderRadius: 6, backgroundColor: OSC, color: "#FFFFFF", fontSize: 9, fontWeight: 600, textAlign: "center", paddingTop: 7, marginBottom: 8 },
  bloque: { marginBottom: 16, fontSize: 8.5 },
  titulo: { fontSize: 40, fontWeight: 300, letterSpacing: -1.2, lineHeight: 1 },
  linea: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: LINEA },
  pie: { position: "absolute", bottom: 24, left: 186, right: 40, fontSize: 7.5, color: GRIS, flexDirection: "row", justifyContent: "space-between" },
});

export type TipoDoc = "presupuesto" | "ticket" | "factura";
const TITULO: Record<TipoDoc, string> = { presupuesto: "Presupuesto", ticket: "Ticket", factura: "Factura" };
const iniciales = (n?: string | null) => (n ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]!.toUpperCase()).join("") || "·";

function Doc({ p, logo, tipo }: { p: Presupuesto; logo: string | null; tipo: TipoDoc }) {
  const d = p.datos;
  const filas = [...d.lineas, ...d.personalizaciones];
  const emp = d.empresa, cli = d.cliente;
  return (
    <Document title={`${TITULO[tipo]} ${p.numero}`} author={emp.nombre ?? ""} language="es">
      <Page size="A4" style={s.pag}>
        <View style={s.lateral} fixed />
        <View style={s.datos} fixed>
          <View style={s.bloque}>
            {logo ? <Image src={logo} style={s.logo} /> : <Text style={s.inicial}>{iniciales(emp.nombre)}</Text>}
            <Text style={[s.b, { fontSize: 10 }]}>{emp.nombre}</Text>
            {emp.nif ? <Text style={s.gris}>NIF {emp.nif}</Text> : null}
            {emp.direccion ? <Text style={s.gris}>{emp.direccion}</Text> : null}
            {emp.telefono ? <Text style={s.gris}>{emp.telefono}</Text> : null}
            {emp.email ? <Text style={s.gris}>{emp.email}</Text> : null}
          </View>
          <View style={s.bloque}>
            <Text style={s.peq}>Cliente</Text>
            <Text style={s.b}>{cli?.nombre ?? "—"}</Text>
            {cli?.contacto ? <Text style={s.gris}>Att. {cli.contacto}</Text> : null}
            {cli?.nif ? <Text style={s.gris}>NIF/CIF {cli.nif}</Text> : null}
            {cli?.facturacion || cli?.direccion ? <Text style={s.gris}>{cli?.facturacion || cli?.direccion}</Text> : null}
            {cli?.email ? <Text style={s.gris}>{cli.email}</Text> : null}
          </View>
          {tipo === "factura" && d.pedido?.numero ? <View style={s.bloque}><Text style={s.peq}>Pedido</Text><Text>{d.pedido.numero}</Text></View> : null}
          {d.pedido?.referencia ? <View style={s.bloque}><Text style={s.peq}>Referencia</Text><Text>{d.pedido.referencia}</Text></View> : null}
          {tipo === "presupuesto" && p.validez ? <View style={s.bloque}><Text style={s.peq}>Válido hasta</Text><Text>{f(p.validez)}</Text></View> : null}
          {tipo !== "factura" && d.condiciones ? <View style={s.bloque}><Text style={s.peq}>Condiciones</Text><Text style={[s.gris, { fontSize: 7.5 }]}>{d.condiciones}</Text></View> : null}
        </View>

        <Text style={s.titulo}>{TITULO[tipo]}</Text>
        <View style={{ flexDirection: "row", marginTop: 10, marginBottom: 26 }}>
          <Text style={{ marginRight: 22 }}><Text style={s.gris}>Nº </Text><Text style={s.b}>{p.numero}</Text></Text>
          <Text><Text style={s.gris}>{tipo === "factura" ? "Fecha de expedición " : "Fecha "}</Text>{f(p.fecha)}</Text>
          {tipo === "factura" && !cli?.nif ? <Text style={[s.gris, { marginLeft: 22 }]}>Factura simplificada</Text> : null}
        </View>

        {filas.map((x, i) => (
          <View key={i} style={s.linea} wrap={false}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text>{x.descripcion}</Text>
              {x.detalle ? <Text style={[s.gris, { fontSize: 8 }]}>{x.detalle}</Text> : null}
              <Text style={[s.gris, { fontSize: 8 }]}>{x.unidades} × {e(x.precio)}</Text>
            </View>
            <Text style={{ fontSize: 10.5 }}>{e(x.importe)}</Text>
          </View>
        ))}
        {d.gastos > 0 && <View style={s.linea}><Text>Otros gastos</Text><Text style={{ fontSize: 10.5 }}>{e(d.gastos)}</Text></View>}

        <View style={{ marginTop: 34, paddingTop: 12, borderTopWidth: 1, borderTopColor: OSC, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }} wrap={false}>
          <View style={[s.gris, { fontSize: 8.5 }]}>
            {d.descuento > 0 ? <Text>Suma {e(d.bruto)} · Descuento {d.descuento_pct} % −{e(d.descuento)}</Text> : null}
            <Text>Base imponible {e(d.base)}</Text>
            <Text>IVA {d.iva_pct} % {e(d.iva)}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[s.gris, { fontSize: 8.5 }]}>Total</Text>
            <Text style={{ fontSize: 28, fontWeight: 300, letterSpacing: -0.8 }}>{e(d.total)}</Text>
          </View>
        </View>
        <Text style={[s.gris, { fontSize: 8.5, marginTop: 14 }]}>Gracias por tu confianza.</Text>

        <View style={s.pie} fixed>
          <Text>{[emp.nombre, emp.web].filter(Boolean).join(" · ")}</Text>
          <Text render={({ pageNumber, totalPages }) => `${p.numero} · ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

async function aDataUrl(url: string): Promise<string | null> {
  try {
    const b = await (await fetch(url)).blob();
    if (!/image\/(png|jpe?g)/.test(b.type)) {
      // Convertir a PNG (SVG, WebP…) con un canvas
      const img = await createImageBitmap(b);
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      c.getContext("2d")!.drawImage(img, 0, 0);
      return c.toDataURL("image/png");
    }
    return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(b); });
  } catch { return null; }
}

export async function generarPDF(p: Presupuesto, tipo: TipoDoc = "presupuesto"): Promise<Blob> {
  const u = await urlArchivo(p.datos.empresa.logo_path);
  const logo = u ? await aDataUrl(u) : null;
  registrarFuentes();
  return pdf(<Doc p={p} logo={logo} tipo={tipo} />).toBlob();
}
