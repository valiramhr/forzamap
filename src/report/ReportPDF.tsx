import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Result } from "../lib/instrument";
import { DOMAINS } from "../lib/instrument";

const INK = "#1A1D24", MUTED = "#6B7280", HAIR = "#E7E3DA", PAPER = "#FBFAF7";
const s = StyleSheet.create({
  page: { padding: 48, backgroundColor: PAPER, fontSize: 11, color: INK, fontFamily: "Helvetica" },
  eyebrow: { fontSize: 9, letterSpacing: 2, color: MUTED, textTransform: "uppercase", marginBottom: 8 },
  h1: { fontSize: 22, fontFamily: "Times-Roman", marginBottom: 8 },
  intro: { color: "#3A3F49", lineHeight: 1.5, marginBottom: 20 },
  strip: { flexDirection: "row", height: 12, marginBottom: 6 },
  legendRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 24 },
  legend: { fontSize: 9, color: MUTED, marginRight: 14, flexDirection: "row", alignItems: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  h3: { fontSize: 9, letterSpacing: 2, color: MUTED, textTransform: "uppercase", marginBottom: 10, marginTop: 8 },
  sig: { flexDirection: "row", marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: HAIR },
  sigNum: { fontFamily: "Times-Roman", fontSize: 18, width: 24 },
  sigName: { fontFamily: "Times-Roman", fontSize: 13, marginBottom: 3 },
  sigDesc: { fontSize: 10, color: "#3A3F49", lineHeight: 1.4 },
  rankRow: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  rankName: { width: 90, fontSize: 10 },
  bar: { flex: 1, height: 6, backgroundColor: HAIR, marginHorizontal: 8 },
  cons: { flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: HAIR, padding: 12, marginTop: 16 },
  foot: { position: "absolute", bottom: 28, left: 48, right: 48, fontSize: 8, color: MUTED },
});

export function ReportPDF({ result, name }: { result: Result; name?: string | null }) {
  const { themeScores, domainShare, top, consistency } = result;
  const lead = domainShare[0];
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>{name ? `${name} — ` : ""}Strengths Profile</Text>
        <Text style={s.h1}>You lead with {top[0].name}.</Text>
        <Text style={s.intro}>Energy leans most toward {lead.label} — {lead.note.toLowerCase()}.</Text>

        <View style={s.strip}>
          {domainShare.map((d) => <View key={d.key} style={{ width: `${d.share}%`, backgroundColor: d.color }} />)}
        </View>
        <View style={s.legendRow}>
          {domainShare.map((d) => (
            <View key={d.key} style={s.legend}>
              <View style={[s.dot, { backgroundColor: d.color }]} />
              <Text>{d.label} {Math.round(d.share)}%</Text>
            </View>
          ))}
        </View>

        <Text style={s.h3}>Signature strengths</Text>
        {top.map((t, i) => (
          <View key={t.key} style={s.sig}>
            <Text style={[s.sigNum, { color: DOMAINS[t.domain].color }]}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.sigName}>{t.name}  ·  {DOMAINS[t.domain].label}</Text>
              <Text style={s.sigDesc}>{t.desc}</Text>
            </View>
          </View>
        ))}

        <Text style={s.h3}>Full ranking</Text>
        {themeScores.map((t, i) => (
          <View key={t.key} style={s.rankRow}>
            <Text style={{ width: 16, fontSize: 9, color: MUTED }}>{i + 1}</Text>
            <Text style={s.rankName}>{t.name}</Text>
            <View style={s.bar}>
              <View style={{ width: `${Math.max(t.norm, 2)}%`, height: "100%", backgroundColor: DOMAINS[t.domain].color, opacity: i < 5 ? 1 : 0.45 }} />
            </View>
            <Text style={{ width: 22, fontSize: 9, color: MUTED, textAlign: "right" }}>{Math.round(t.norm)}</Text>
          </View>
        ))}

        <View style={s.cons}>
          <Text style={{ color: MUTED }}>RESPONSE CONSISTENCY</Text>
          <Text style={{ fontFamily: "Times-Roman", color: consistency === "Low" ? "#9C3D54" : INK }}>{consistency}</Text>
        </View>

        <Text style={s.foot}>
          Ipsative (intra-individual) profile for development use. Scores are relative within this
          person and are not comparable across people. Not affiliated with Gallup CliftonStrengths.
        </Text>
      </Page>
    </Document>
  );
}
