import { Document, Page, Text, View, Image, StyleSheet, Svg, Line, Rect, Circle } from "@react-pdf/renderer";
import { PDF_FONTS } from "./ReportPDF";
import {
  PARADOX_ORDER, PARADOXES, SCALE_MIN, SCALE_MAX,
  type Result, type ParadoxResult, type Quadrant,
} from "../lib/paradox";
import { PAPER, INK, MUTED, HAIR, BODY, FORZA } from "../lib/ui";

/* All twelve paradoxes on one A4 portrait page.
   A4 is 210 × 297mm; at 15mm margins the live area is 180 × 267mm and the
   3 × 4 grid of 60mm panels takes 180 × 240mm of it. That leaves 27mm for the
   header and the footer combined, so the header runs 21mm rather than a
   round 25 — at 25 the footer no longer fits and react-pdf breaks to a
   second page. */

const MM = 72 / 25.4;
const PANEL = 60 * MM;
const PLOT = 45 * MM;
const HEADER = 21 * MM;
const CONTENT_W = 180 * MM;
const PLOT_INSET = (PANEL - PLOT) / 2;

const { base: BASE, display: DISPLAY, displayWeight: DISPLAY_WEIGHT } = PDF_FONTS;
const display = { fontFamily: DISPLAY, fontWeight: DISPLAY_WEIGHT };
const label = { fontFamily: BASE, fontWeight: 400 as const, textTransform: "uppercase" as const };
/* The web panel tints with FORZA at 10% alpha; react-pdf's colour parser is
   happier with opaque values, so this is that tint pre-blended over PAPER. */
const TINT = "#ECE0D8";

const s = StyleSheet.create({
  page: { paddingVertical: 15 * MM, paddingHorizontal: 15 * MM, backgroundColor: PAPER, color: INK, fontFamily: BASE },

  header: { height: HEADER, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  lockup: { width: 28 * MM, height: 12.6 * MM, marginBottom: 3 },
  h1: { ...display, fontSize: 14, letterSpacing: -0.49 },
  metaCol: { alignItems: "flex-end" },
  nameTxt: { ...display, fontSize: 10, letterSpacing: -0.35, marginBottom: 3 },
  meta: { fontSize: 7, color: MUTED, marginBottom: 2 },

  grid: { width: CONTENT_W, flexDirection: "row", flexWrap: "wrap" },
  panel: { width: PANEL, height: PANEL },
  panelInner: { marginLeft: PLOT_INSET, width: PLOT },
  title: { ...display, fontSize: 6.5, letterSpacing: -0.23, height: 4.5 * MM },
  axisY: { ...label, fontSize: 4.5, letterSpacing: 0.32, color: MUTED, height: 2.6 * MM },
  axisX: { ...label, fontSize: 4.5, letterSpacing: 0.32, color: MUTED, height: 4 * MM, textAlign: "center", paddingTop: 2 },
  scores: { fontSize: 5, height: 3 * MM, color: BODY },

  plot: { width: PLOT, height: PLOT, position: "relative", backgroundColor: PAPER },
  quad: { position: "absolute", padding: 3 },
  quadTxt: { fontSize: 5, lineHeight: 1.2, maxWidth: "100%" },

  /* In normal flow, not absolutely positioned: an absolute child whose box
     falls below the page's content area is what pushes react-pdf onto a
     second page, even when the flow content itself still fits. */
  foot: { marginTop: 4, fontSize: 6.5, color: MUTED },
});

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }

/* Break a quadrant label into two balanced lines ourselves. Left to its own
   devices react-pdf hyphenates inside words at this size ("PERSUASIVE LIS-
   TENER"); the alternative fix, Font.registerHyphenationCallback, is global
   and would change the existing strengths report too. */
function labelLines(text: string): string[] {
  const words = text.split(" ");
  if (words.length < 2) return [text];
  let at = 1, best = Infinity;
  for (let i = 1; i < words.length; i++) {
    const gap = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (gap < best) { best = gap; at = i; }
  }
  return [words.slice(0, at).join(" "), words.slice(at).join(" ")];
}
/* Scale value (1–10) to a 0–100 viewBox / percentage position along the x axis. */
function pct(v: number) { return ((clamp(v, SCALE_MIN, SCALE_MAX) - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100; }

const CORNERS: Record<Quadrant, { justifyContent: "flex-start" | "flex-end"; alignItems: "flex-start" | "flex-end"; textAlign: "left" | "right" }> = {
  oneSidedDynamic: { justifyContent: "flex-start", alignItems: "flex-start", textAlign: "left" },
  balanced: { justifyContent: "flex-start", alignItems: "flex-end", textAlign: "right" },
  deficient: { justifyContent: "flex-end", alignItems: "flex-start", textAlign: "left" },
  oneSidedGentle: { justifyContent: "flex-end", alignItems: "flex-end", textAlign: "right" },
};

function Panel({ p }: { p: ParadoxResult }) {
  const { dynamic, gentle, quadrant, flagged } = p;
  const labels = PARADOXES[p.key].labels;

  // Crosshair position, as a share of the plot square measured from the top-left.
  const cx = pct(p.thresholdX);
  const cyTop = 100 - pct(p.thresholdY);

  const x0 = pct(gentle.score - gentle.sd), x1 = pct(gentle.score + gentle.sd);
  const yTop = 100 - pct(dynamic.score + dynamic.sd), yBot = 100 - pct(dynamic.score - dynamic.sd);
  const ptX = pct(gentle.score), ptY = 100 - pct(dynamic.score);

  const boxes: { key: Quadrant; left: number; top: number; w: number; h: number }[] = [
    { key: "oneSidedDynamic", left: 0, top: 0, w: cx, h: cyTop },
    { key: "balanced", left: cx, top: 0, w: 100 - cx, h: cyTop },
    { key: "deficient", left: 0, top: cyTop, w: cx, h: 100 - cyTop },
    { key: "oneSidedGentle", left: cx, top: cyTop, w: 100 - cx, h: 100 - cyTop },
  ];

  return (
    <View style={s.panel}>
      <View style={s.panelInner}>
        <Text style={s.title}>{p.name}</Text>
        <Text style={s.axisY}>{dynamic.name}</Text>

        <View style={s.plot}>
          {boxes.map((b) => {
            const on = b.key === quadrant;
            const c = CORNERS[b.key];
            return (
              /* No backgroundColor at all on the unoccupied three — react-pdf
                 renders the string "transparent" as solid black. */
              <View key={b.key} style={[s.quad, {
                left: `${b.left}%`, top: `${b.top}%`, width: `${b.w}%`, height: `${b.h}%`,
                justifyContent: c.justifyContent, alignItems: c.alignItems,
              }, on ? { backgroundColor: TINT } : {}]}>
                {labelLines(labels[b.key]).map((line, i) => (
                  <Text key={i} style={[s.quadTxt, {
                    ...label, letterSpacing: 0.35, textAlign: c.textAlign,
                    color: on ? INK : MUTED,
                  }]}>{line}</Text>
                ))}
              </View>
            );
          })}

          <Svg width={PLOT} height={PLOT} viewBox="0 0 100 100" style={{ position: "absolute", top: 0, left: 0 }}>
            <Rect x={0} y={0} width={100} height={100} fill="none" stroke={HAIR} strokeWidth={0.5} />
            <Line x1={cx} y1={0} x2={cx} y2={100} stroke={HAIR} strokeWidth={0.5} />
            <Line x1={0} y1={cyTop} x2={100} y2={cyTop} stroke={HAIR} strokeWidth={0.5} />
            <Rect x={x0} y={yTop} width={Math.max(x1 - x0, 0)} height={Math.max(yBot - yTop, 0)}
              fill="none" stroke={HAIR} strokeWidth={0.5} />
            <Circle cx={ptX} cy={ptY} r={2.6} fill={flagged ? "none" : INK} stroke={INK} strokeWidth={1} />
          </Svg>
        </View>

        <Text style={s.axisX}>{gentle.name}</Text>
        <Text style={[s.scores, flagged ? { color: FORZA } : {}]}>
          {dynamic.name} {dynamic.score.toFixed(1)} · {gentle.name} {gentle.score.toFixed(1)}
          {flagged ? " · inconsistent" : ""}
        </Text>
      </View>
    </View>
  );
}

export function ParadoxReportPDF({ result, name }: { result: Result; name?: string | null }) {
  const byKey = new Map(result.paradoxes.map((p) => [p.key, p]));
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={s.page}>
        <View style={s.header}>
          <View>
            <Image src="/brand/forzamap-lockup-2x.png" style={s.lockup} />
            <Text style={s.h1}>Paradox Profile</Text>
          </View>
          <View style={s.metaCol}>
            {name ? <Text style={s.nameTxt}>{name}</Text> : null}
            <Text style={s.meta}>{date}</Text>
            <Text style={[s.meta, result.consistency === "Low" ? { color: FORZA } : {}]}>
              Consistency {result.consistency}
              {result.flaggedCount > 0 ? ` · ${result.flaggedCount} flagged` : ""}
            </Text>
          </View>
        </View>

        <View style={s.grid}>
          {PARADOX_ORDER.map((k) => {
            const p = byKey.get(k);
            return p ? <Panel key={k} p={p} /> : null;
          })}
        </View>

        <Text style={s.foot}>
          Self-report instrument for development discussion. Not normed, not validated for selection decisions.
        </Text>
      </Page>
    </Document>
  );
}
