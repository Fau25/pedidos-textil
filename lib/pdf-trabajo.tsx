import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import type { Empresa } from "./tipos";
import { registrarFuentes } from "./pdf";
import { CORTO, pendienteCent, type Trabajo } from "./trabajos";

/** Ticket de recogida de un trabajo («Recibí»), diseño E: franja gris arriba, número grande y fino, lo pendiente grande al final */
const OSC = "#17181C", GRIS = "#6B7079", LATERAL = "#F5F6F8", LINEA = "#E4E6EA";
const e = (c: number) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(c / 100) + " €";
const f = (d?: string | null, larga = false) => (d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("es-ES", larga ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" }) : "");
const iniciales = (n?: string | null) => (n ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]!.toUpperCase()).join("") || "·";

const s = StyleSheet.create({
  pag: { fontFamily: "Inter", fontSize: 8.5, color: OSC, backgroundColor: "#FFFFFF", lineHeight: 1.35 },
  cab: { backgroundColor: LATERAL, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 },
  fila: { flexDirection: "row", justifyContent: "space-between" },
  peq: { fontSize: 6.5, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", color: GRIS },
  ini: { width: 22, height: 22, borderRadius: 5, backgroundColor: OSC, color: "#FFFFFF", fontSize: 7.5, fontWeight: 600, textAlign: "center", paddingTop: 6, marginRight: 8 },
  cuerpo: { paddingHorizontal: 20, paddingTop: 14, flexGrow: 1 },
  item: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: LINEA },
});

function Ticket({ t, emp }: { t: Trabajo; emp: Empresa }) {
  const items = t.items.filter((i) => i.que || i.detalle);
  return (
    <Document title={`Ticket ${t.numero ?? ""}`} author={emp.nombre}>
      <Page size="A6" style={s.pag}>
        <View style={s.cab}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={s.ini}>{iniciales(emp.nombre)}</Text>
            <View><Text style={{ fontWeight: 600, fontSize: 9.5 }}>{emp.nombre}</Text>{emp.telefono ? <Text style={{ color: GRIS }}>{emp.telefono}</Text> : null}</View>
          </View>
          <View style={[s.fila, { marginTop: 12 }]}>
            <View style={{ maxWidth: 150 }}><Text style={s.peq}>Cliente</Text><Text style={{ fontWeight: 600 }}>{t.cliente_nombre || "—"}</Text>{t.cliente_telefono ? <Text style={{ color: GRIS }}>{t.cliente_telefono}</Text> : null}</View>
            {t.entrega ? <View style={{ alignItems: "flex-end" }}><Text style={s.peq}>Recoger el</Text><Text style={{ fontWeight: 600 }}>{f(t.entrega, true)}</Text></View> : null}
          </View>
        </View>
        <View style={s.cuerpo}>
          <Text style={{ fontSize: 28, fontWeight: 300, letterSpacing: -0.8, lineHeight: 1 }}>{t.numero ?? ""}</Text>
          <Text style={{ color: GRIS, marginTop: 3, marginBottom: 10 }}>Ticket de recogida · {f(t.creado)}</Text>
          {items.map((i) => (
            <View key={i.id} style={s.item} wrap={false}>
              <Text style={{ fontWeight: 600 }}>{i.cantidad} × {i.que || "Trabajo"}</Text>
              {i.tecnica || i.ubicaciones?.length ? <Text style={{ color: GRIS, fontSize: 7.5 }}>{[i.tecnica, ...(i.ubicaciones ?? []).map((u) => CORTO[u] ?? u)].filter(Boolean).join(" · ")}</Text> : null}
              {i.detalle ? <Text style={{ color: GRIS, fontSize: 7.5 }}>{i.detalle}</Text> : null}
            </View>
          ))}
          {t.notas ? <Text style={{ color: GRIS, marginTop: 6 }}>{t.notas}</Text> : null}
        </View>
        <View style={{ marginHorizontal: 20, marginBottom: 16, paddingTop: 9, borderTopWidth: 1, borderTopColor: OSC, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          <View style={{ color: GRIS, fontSize: 7.5 }}>
            <Text>Total {e(Math.round(Number(t.total) * 100))}</Text>
            {Number(t.a_cuenta) > 0 ? <Text>A cuenta {e(Math.round(Number(t.a_cuenta) * 100))}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end" }}><Text style={{ color: GRIS, fontSize: 7.5 }}>Pendiente</Text><Text style={{ fontSize: 22, fontWeight: 300, letterSpacing: -0.6 }}>{e(pendienteCent(t))}</Text></View>
        </View>
        <Text style={{ textAlign: "center", color: GRIS, fontSize: 6.5, marginBottom: 12 }}>Presenta este ticket para recoger tus prendas</Text>
      </Page>
    </Document>
  );
}

export const pdfTrabajo = (t: Trabajo, emp: Empresa) => { registrarFuentes(); return pdf(<Ticket t={t} emp={emp} />).toBlob(); };
