import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import type { Empresa } from "./tipos";
import { CORTO, pendienteCent, type Trabajo } from "./trabajos";

/** Ticket de recogida de un trabajo («Recibí»): tamaño A6, cabecera oscura y lo pendiente bien visible */
const OSC = "#17181C", AZUL = "#1D52EB", GRIS = "#6B7079", SUAVE = "#F4F5F7";
const e = (c: number) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(c / 100) + " €";
const f = (d?: string | null, larga = false) => (d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("es-ES", larga ? { weekday: "long", day: "numeric", month: "long" } : { day: "numeric", month: "short", year: "numeric" }) : "");

const s = StyleSheet.create({
  pag: { fontFamily: "Helvetica", fontSize: 9, color: OSC, backgroundColor: "#FFFFFF" },
  cab: { backgroundColor: OSC, color: "#FFFFFF", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18 },
  fila: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  peq: { fontSize: 7, letterSpacing: 0.8, textTransform: "uppercase" },
  num: { fontSize: 26, fontFamily: "Helvetica-Bold", letterSpacing: -0.5 },
  pastilla: { backgroundColor: AZUL, color: "#FFFFFF", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, fontSize: 8, fontFamily: "Helvetica-Bold" },
  cuerpo: { paddingHorizontal: 18, paddingTop: 14 },
  item: { flexDirection: "row", backgroundColor: SUAVE, borderRadius: 8, padding: 8, marginBottom: 5 },
  cant: { width: 20, height: 20, borderRadius: 5, backgroundColor: OSC, color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 9, textAlign: "center", paddingTop: 5, marginRight: 8 },
  tec: { color: AZUL, fontFamily: "Helvetica-Bold", fontSize: 7.5, marginTop: 2 },
  corte: { borderTopWidth: 1, borderTopColor: "#D9DBE1", borderStyle: "dashed", marginHorizontal: 14, marginVertical: 10 },
  pend: { backgroundColor: OSC, color: "#FFFFFF", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginTop: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});

function Ticket({ t, emp }: { t: Trabajo; emp: Empresa }) {
  const items = t.items.filter((i) => i.que || i.detalle);
  const contacto = [emp.telefono, emp.direccion].filter(Boolean).join(" · ");
  return (
    <Document title={`Ticket ${t.numero ?? ""}`} author={emp.nombre}>
      <Page size="A6" style={s.pag}>
        <View style={s.cab}>
          <View style={s.fila}><Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10 }}>{emp.nombre}</Text><Text style={{ fontSize: 8, color: "#B7BAC2" }}>{f(t.creado)}</Text></View>
          {contacto ? <Text style={{ fontSize: 7, color: "#B7BAC2", marginTop: 2 }}>{contacto}</Text> : null}
          <Text style={[s.peq, { color: "#B7BAC2", marginTop: 12 }]}>Ticket de recogida</Text>
          <View style={s.fila}><Text style={s.num}>{t.numero ?? ""}</Text>{t.entrega ? <Text style={s.pastilla}>Para el {f(t.entrega, true)}</Text> : null}</View>
        </View>
        <View style={s.cuerpo}>
          <Text style={[s.peq, { color: GRIS }]}>Cliente</Text>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10.5, marginBottom: 10 }}>{[t.cliente_nombre, t.cliente_telefono].filter(Boolean).join(" · ") || "—"}</Text>
          {items.map((i) => (
            <View key={i.id} style={s.item} wrap={false}>
              <Text style={s.cant}>{i.cantidad}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9.5 }}>{i.que || "Prenda"}</Text>
                {i.tecnica || i.ubicaciones?.length ? <Text style={s.tec}>{[i.tecnica?.toUpperCase(), ...(i.ubicaciones ?? []).map((u) => CORTO[u] ?? u)].filter(Boolean).join("  ·  ")}</Text> : null}
                {i.detalle ? <Text style={{ color: GRIS, marginTop: 2, lineHeight: 1.35 }}>{i.detalle}</Text> : null}
              </View>
            </View>
          ))}
          {t.notas ? <Text style={{ color: GRIS, marginTop: 4 }}>{t.notas}</Text> : null}
        </View>
        <View style={s.corte} />
        <View style={{ paddingHorizontal: 18 }}>
          <View style={s.fila}><Text style={{ color: GRIS }}>Total</Text><Text style={{ color: GRIS }}>{e(Math.round(Number(t.total) * 100))}</Text></View>
          {Number(t.a_cuenta) > 0 ? <View style={[s.fila, { marginTop: 3 }]}><Text style={{ color: GRIS }}>Dejó a cuenta</Text><Text style={{ color: GRIS }}>−{e(Math.round(Number(t.a_cuenta) * 100))}</Text></View> : null}
          <View style={s.pend}><Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold" }}>Pendiente al recoger</Text><Text style={{ fontSize: 15, fontFamily: "Helvetica-Bold" }}>{e(pendienteCent(t))}</Text></View>
          <Text style={{ textAlign: "center", color: GRIS, fontSize: 7.5, marginTop: 10 }}>Enseña este ticket para recoger tus prendas</Text>
        </View>
      </Page>
    </Document>
  );
}

export const pdfTrabajo = (t: Trabajo, emp: Empresa) => pdf(<Ticket t={t} emp={emp} />).toBlob();
