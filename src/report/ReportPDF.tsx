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
  intro: { color: BODY, lineHeight: 1.5, marginBottom: 14 },
  strip: { flexDirection: "row", height: 12, marginBottom: 6 },
  legendRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 18 },
  legend: { fontSize: 9, color: MUTED, marginRight: 14, flexDirection: "row", alignItems: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  h3: { fontSize: 9, letterSpacing: 2, color: MUTED, textTransform: "uppercase", marginBottom: 8, marginTop: 6 },
  sig: { flexDirection: "row", marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: HAIR },
  sigNum: { ...display, fontSize: 18, letterSpacing: -0.63, width: 24 },
  sigName: { ...display, fontSize: 13, letterSpacing: -0.46, marginBottom: 3 },
  sigDesc: { fontSize: 10, color: BODY, lineHeight: 1.4 },
  /* Twenty themes in one column overflow A4 — they run as two columns of ten,
     which keeps the ranking on the page at the same type sizes as the rest. */
  rankCols: { flexDirection: "row" },
  rankCol: { flex: 1 },
  rankColGutter: { marginRight: 24 },
  rankRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  rankNum: { width: 14, fontSize: 9, color: MUTED },
  rankName: { width: 80, fontSize: 10 },
  rankVal: { width: 18, fontSize: 9, color: MUTED, textAlign: "right" },
  bar: { flex: 1, height: 6, backgroundColor: HAIR, marginHorizontal: 8 },
  cons: { borderWidth: 1, borderColor: HAIR, padding: 12, marginTop: 10 },
  consHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  consValue: { ...display, letterSpacing: -0.39 },
  consReason: { fontSize: 9, color: BODY, lineHeight: 1.4, marginTop: 4 },
  foot: { position: "absolute", bottom: 28, left: 48, right: 48, fontSize: 8, color: MUTED },
});

export function ReportPDF({ result, name }: { result: Result; name?: string | null }) {
  const { themeScores, domainShare, top, quality } = result;
  const lead = domainShare[0];
  const half = Math.ceil(themeScores.length / 2);
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
        <View style={s.rankCols}>
          {[0, 1].map((c) => (
            <View key={c} style={c === 0 ? [s.rankCol, s.rankColGutter] : s.rankCol}>
              {themeScores.slice(c * half, (c + 1) * half).map((t, j) => {
                const i = c * half + j;   // rank across both columns, not within one
                return (
                  <View key={t.key} style={s.rankRow}>
                    <Text style={s.rankNum}>{i + 1}</Text>
                    <Text style={s.rankName}>{t.name}</Text>
                    <View style={s.bar}>
                      <View style={{ width: `${Math.max(t.norm, 2)}%`, height: "100%", backgroundColor: DOMAINS[t.domain].color, opacity: i < 5 ? 1 : 0.45 }} />
                    </View>
                    <Text style={s.rankVal}>{Math.round(t.norm)}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* A High rating stands alone; anything lower carries the signals that
            pulled it down, so the reader knows what to check in the responses. */}
        <View style={s.cons}>
          <View style={s.consHead}>
            <Text style={{ color: MUTED }}>RESPONSE QUALITY</Text>
            <Text style={[s.consValue, { color: quality.rating === "Low" ? FORZA : INK }]}>{quality.rating}</Text>
          </View>
          {quality.rating !== "High" && quality.reasons.map((r, i) => (
            <Text key={i} style={s.consReason}>— {r}</Text>
          ))}
        </View>

        {/* Page furniture, not flow content — `fixed` keeps it out of the height
            accounting, which otherwise pushes it onto a page of its own when the
            report runs long. */}
        <Text style={s.foot} fixed>
          Ipsative (intra-individual) profile for development use. Scores are relative within this
          person and are not comparable across people. Not affiliated with Gallup CliftonStrengths.
        </Text>
      </Page>
    </Document>
  );
}
