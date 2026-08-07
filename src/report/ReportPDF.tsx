import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { Result } from "../lib/instrument";
import { DOMAINS } from "../lib/instrument";
import { PAPER, INK, MUTED, HAIR, BODY, FORZA } from "../lib/ui";

/* Archivo static TTFs from Google Fonts' font host — react-pdf can only parse TTF,
   not the woff2 the CSS API serves to modern browsers. If registration fails the
   document falls back to the built-in Helvetica and keeps the brand palette. */
const ARCHIVO_400 = "https://fonts.gstatic.com/s/archivo/v25/k3k6o8UDI-1M0wlSV9XAw6lQkqWY8Q82sJaRE-NWIDdgffTTNDNp8A.ttf";
const ARCHIVO_800 = "https://fonts.gstatic.com/s/archivo/v25/k3k6o8UDI-1M0wlSV9XAw6lQkqWY8Q82sJaRE-NWIDdgffTTtDRp8A.ttf";

let BASE = "Helvetica";
let DISPLAY = "Helvetica-Bold";
let DISPLAY_WEIGHT: 400 | 800 = 400;
try {
  Font.register({
    family: "Archivo",
    fonts: [
      { src: ARCHIVO_400, fontWeight: 400 },
      { src: ARCHIVO_800, fontWeight: 800 },
    ],
  });
  BASE = "Archivo";
  DISPLAY = "Archivo";
  DISPLAY_WEIGHT = 800;
} catch (e) {
  console.warn("Archivo registration failed — PDF falls back to Helvetica.", e);
}

/* Display role: Archivo 800 at -0.035em — react-pdf takes letterSpacing in points,
   so each display style carries its own size × -0.035. */
const display = { fontFamily: DISPLAY, fontWeight: DISPLAY_WEIGHT };

/* Font.register is global and one-shot, so other documents import the resolved
   families from here rather than registering Archivo a second time. */
export const PDF_FONTS = { base: BASE, display: DISPLAY, displayWeight: DISPLAY_WEIGHT };

const s = StyleSheet.create({
  page: { padding: 48, backgroundColor: PAPER, fontSize: 11, color: INK, fontFamily: BASE },
  eyebrow: { fontSize: 9, letterSpacing: 2, color: MUTED, textTransform: "uppercase", marginBottom: 8 },
  h1: { ...display, fontSize: 22, letterSpacing: -0.77, marginBottom: 8 },
  intro: { color: BODY, lineHeight: 1.5, marginBottom: 20 },
  strip: { flexDirection: "row", height: 12, marginBottom: 6 },
  legendRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 24 },
  legend: { fontSize: 9, color: MUTED, marginRight: 14, flexDirection: "row", alignItems: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  h3: { fontSize: 9, letterSpacing: 2, color: MUTED, textTransform: "uppercase", marginBottom: 10, marginTop: 8 },
  sig: { flexDirection: "row", marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: HAIR },
  sigNum: { ...display, fontSize: 18, letterSpacing: -0.63, width: 24 },
  sigName: { ...display, fontSize: 13, letterSpacing: -0.46, marginBottom: 3 },
  sigDesc: { fontSize: 10, color: BODY, lineHeight: 1.4 },
  rankRow: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  rankName: { width: 90, fontSize: 10 },
  bar: { flex: 1, height: 6, backgroundColor: HAIR, marginHorizontal: 8 },
  cons: { flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: HAIR, padding: 12, marginTop: 16 },
  consValue: { ...display, letterSpacing: -0.39 },
  foot: { position: "absolute", bottom: 28, left: 48, right: 48, fontSize: 8, color: MUTED },
});

export function ReportPDF({ result, name }: { result: Result; name?: string | null }) {
  const { themeScores, domainShare, top, consistency } = result;
  const lead = domainShare[0];
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>{name ? `${name} — ` : ""}ForzaMap strengths profile</Text>
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
          <Text style={[s.consValue, { color: consistency === "Low" ? FORZA : INK }]}>{consistency}</Text>
        </View>

        <Text style={s.foot}>
          Ipsative (intra-individual) profile for development use. Scores are relative within this
          person and are not comparable across people. Not affiliated with Gallup CliftonStrengths.
        </Text>
      </Page>
    </Document>
  );
}
