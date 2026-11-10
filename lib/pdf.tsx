import { Document, Page, Text, View, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import { urlArchivo } from "./supabase";
import type { Presupuesto } from "./tipos";

const AZUL = "#2B59C3", TEXTO = "#1E2024", GRIS = "#5B616E", LINEA = "#E6E7EA";
const e = (n: number) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " €";
const f = (d?: string | null) => (d ? new Date(d + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : "");

const s = StyleSheet.create({
  pag: { padding: 44, paddingBottom: 64, fontFamily: "Helvetica", fontSize: 9.5, color: TEXTO, lineHeight: 1.4 },
  fila: { flexDirection: "row" },
  logo: { width: 110, height: 44, objectFit: "contain", objectPositionX: 0 },
  titulo: { fontSize: 22, fontFamily: "Helvetica-Bold", letterSpacing: -0.5 },
  gris: { color: GRIS },
  peq: { fontSize: 8, color: GRIS, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
  caja: { flex: 1, padding: 12, backgroundColor: "#F7F7F8", borderRadius: 8 },
  th: { fontSize: 8, color: GRIS, textTransform: "uppercase", letterSpacing: 0.5, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: LINEA },
  td: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: LINEA },
  num: { textAlign: "right" },
  b: { fontFamily: "Helvetica-Bold" },
  pie: { position: "absolute", bottom: 28, left: 44, right: 44, fontSize: 7.5, color: GRIS, flexDirection: "row", justifyContent: "space-between" },
});

const C = { d: { flex: 1 }, u: { width: 50 }, p: { width: 70 }, i: { width: 80 } };

function Doc({ p, logo }: { p: Presupuesto; logo: string | null }) {
  const d = p.datos;
  const filas = [...d.lineas, ...d.personalizaciones];
  return (
    <Document title={`Presupuesto ${p.numero}`} author={d.empresa.nombre ?? ""} language="es">
      <Page size="A4" style={s.pag}>
        <View style={[s.fila, { justifyContent: "space-between", marginBottom: 28 }]}>
          <View>
            {logo ? <Image src={logo} style={s.logo} /> : <Text style={[s.b, { fontSize: 14 }]}>{d.empresa.nombre}</Text>}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.titulo}>Presupuesto</Text>
            <Text style={[s.gris, { marginTop: 2 }]}>{p.numero}</Text>
          </View>
        </View>

        <View style={[s.fila, { gap: 12, marginBottom: 22 }]}>
          <View style={s.caja}>
            <Text style={s.peq}>De</Text>
            <Text style={s.b}>{d.empresa.nombre}</Text>
            {d.empresa.nif && <Text>NIF {d.empresa.nif}</Text>}
            {d.empresa.direccion && <Text>{d.empresa.direccion}</Text>}
            {[d.empresa.telefono, d.empresa.email].filter(Boolean).length > 0 && <Text>{[d.empresa.telefono, d.empresa.email].filter(Boolean).join(" · ")}</Text>}
          </View>
          <View style={s.caja}>
            <Text style={s.peq}>Para</Text>
            <Text style={s.b}>{d.cliente?.nombre ?? "—"}</Text>
            {d.cliente?.contacto && <Text>Att. {d.cliente.contacto}</Text>}
            {d.cliente?.nif && <Text>NIF/CIF {d.cliente.nif}</Text>}
            {(d.cliente?.facturacion || d.cliente?.direccion) && <Text>{d.cliente?.facturacion || d.cliente?.direccion}</Text>}
            {d.cliente?.email && <Text>{d.cliente.email}</Text>}
          </View>
          <View style={[s.caja, { flex: 0.8 }]}>
            <Text style={s.peq}>Fecha</Text><Text>{f(p.fecha)}</Text>
            <Text style={[s.peq, { marginTop: 6 }]}>Válido hasta</Text><Text>{f(p.validez)}</Text>
          </View>
        </View>
        {d.pedido.referencia && <Text style={{ marginBottom: 10 }}><Text style={s.gris}>Referencia: </Text>{d.pedido.referencia}</Text>}

        <View style={s.fila}>
          <Text style={[s.th, C.d]}>Concepto</Text><Text style={[s.th, C.u, s.num]}>Uds</Text><Text style={[s.th, C.p, s.num]}>Precio</Text><Text style={[s.th, C.i, s.num]}>Importe</Text>
        </View>
        {filas.map((x, i) => (
          <View key={i} style={s.fila} wrap={false}>
            <View style={[s.td, C.d, { paddingRight: 8 }]}><Text style={s.b}>{x.descripcion}</Text>{x.detalle ? <Text style={[s.gris, { fontSize: 8.5 }]}>{x.detalle}</Text> : null}</View>
            <Text style={[s.td, C.u, s.num]}>{x.unidades}</Text>
            <Text style={[s.td, C.p, s.num]}>{e(x.precio)}</Text>
            <Text style={[s.td, C.i, s.num]}>{e(x.importe)}</Text>
          </View>
        ))}
        {d.gastos > 0 && (
          <View style={s.fila}><Text style={[s.td, C.d]}>Otros gastos</Text><Text style={[s.td, C.u]} /><Text style={[s.td, C.p]} /><Text style={[s.td, C.i, s.num]}>{e(d.gastos)}</Text></View>
        )}

        <View style={{ alignSelf: "flex-end", width: 230, marginTop: 14 }} wrap={false}>
          {d.descuento > 0 && <>
            <View style={[s.fila, { justifyContent: "space-between", paddingVertical: 2 }]}><Text style={s.gris}>Suma</Text><Text>{e(d.bruto)}</Text></View>
            <View style={[s.fila, { justifyContent: "space-between", paddingVertical: 2 }]}><Text style={s.gris}>Descuento {d.descuento_pct} %</Text><Text>-{e(d.descuento)}</Text></View>
          </>}
          <View style={[s.fila, { justifyContent: "space-between", paddingVertical: 2 }]}><Text style={s.gris}>Base imponible</Text><Text>{e(d.base)}</Text></View>
          <View style={[s.fila, { justifyContent: "space-between", paddingVertical: 2 }]}><Text style={s.gris}>IVA {d.iva_pct} %</Text><Text>{e(d.iva)}</Text></View>
          <View style={[s.fila, { justifyContent: "space-between", marginTop: 6, paddingTop: 8, borderTopWidth: 1.5, borderTopColor: AZUL }]}>
            <Text style={[s.b, { fontSize: 12 }]}>Total</Text><Text style={[s.b, { fontSize: 14, color: AZUL }]}>{e(d.total)}</Text>
          </View>
        </View>

        {d.condiciones && (
          <View style={{ marginTop: 30 }} wrap={false}>
            <Text style={s.peq}>Condiciones</Text>
            <Text style={[s.gris, { fontSize: 8.5 }]}>{d.condiciones}</Text>
          </View>
        )}
        <View style={s.pie} fixed>
          <Text>{[d.empresa.nombre, d.empresa.web].filter(Boolean).join(" · ")}</Text>
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

export async function generarPDF(p: Presupuesto): Promise<Blob> {
  const u = await urlArchivo(p.datos.empresa.logo_path);
  const logo = u ? await aDataUrl(u) : null;
  return pdf(<Doc p={p} logo={logo} />).toBlob();
}
