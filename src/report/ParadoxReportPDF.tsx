import { Document, Page, Text, View, Image, StyleSheet, Svg, Line, Rect, Circle } from "@react-pdf/renderer";
import { PDF_FONTS } from "./ReportPDF";
import {
  PARADOX_ORDER, PARADOXES, SCALE_MIN, SCALE_MAX,
  type Result, type ParadoxResult, type Quadrant, type TraitScore,
} from "../lib/paradox";
import { PAPER, INK, MUTED, HAIR, BODY, FORZA, fmtCompleted } from "../lib/ui";

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

  /* Column, so the legend can sit at the foot of the header block, directly
     above the grid it explains. space-between pins it there. */
  header: { height: HEADER, flexDirection: "column", justifyContent: "space-between" },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  /* 24mm rather than 28: the legend row has to come out of the same 21mm
     header, and the header is what the one-page fit has least slack in. 24 is
     the floor — BRAND.md sets the print minimum for the lockup with its
     tagline at 24mm, and below that the tagline has to be dropped. */
  lockup: { width: 24 * MM, height: 10.8 * MM, marginBottom: 3 },
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

  legend: { flexDirection: "row", alignItems: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", marginRight: 10 },
  legendMark: { marginRight: 3 },
  legendTxt: { fontSize: 5, color: MUTED },

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

/* Standard error of the trait score — see the note on the web panel. The score
   is a mean of five items, so the whisker belongs at sd/√n, not at the item SD. */
function stderr(t: TraitScore) { return t.answered > 0 ? t.sd / Math.sqrt(t.answered) : 0; }

/* Whisker geometry, in viewBox units. The plot is 100 units across where the
   web panel is 240px, so a web pixel is 100/240 units: the web's 6px cap is
   2.5 units across, 1.25 either side. SE_FLOOR is in scale units and so is
   shared with the web panel unchanged. */
const SE_FLOOR = 0.65;
const CAP = 1.25;
const WHISKER_W = 0.6;
const whisker = { stroke: MUTED, strokeWidth: WHISKER_W, strokeLinecap: "round" as const };

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

  const ptX = pct(gentle.score), ptY = 100 - pct(dynamic.score);

  /* Whiskers: ±1 standard error on each trait, cut off at the plot edge (pct
     clamps to the scale). An axis under SE_FLOOR is left bare. */
  const gse = stderr(gentle), dse = stderr(dynamic);
  const showX = gse >= SE_FLOOR, showY = dse >= SE_FLOOR;
  const x0 = pct(gentle.score - gse), x1 = pct(gentle.score + gse);
  const yTop = 100 - pct(dynamic.score + dse), yBot = 100 - pct(dynamic.score - dse);
  /* Caps run across the whisker, so they need their own clamp to the square. */
  const capAt = (v: number) => clamp(v, 0, 100);

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
            {/* Uncertainty as whiskers, one axis at a time, under the point. */}
            {showX ? (
              <>
                <Line x1={x0} y1={ptY} x2={x1} y2={ptY} {...whisker} />
                <Line x1={x0} y1={capAt(ptY - CAP)} x2={x0} y2={capAt(ptY + CAP)} {...whisker} />
                <Line x1={x1} y1={capAt(ptY - CAP)} x2={x1} y2={capAt(ptY + CAP)} {...whisker} />
              </>
            ) : null}
            {showY ? (
              <>
                <Line x1={ptX} y1={yTop} x2={ptX} y2={yBot} {...whisker} />
                <Line x1={capAt(ptX - CAP)} y1={yTop} x2={capAt(ptX + CAP)} y2={yTop} {...whisker} />
                <Line x1={capAt(ptX - CAP)} y1={yBot} x2={capAt(ptX + CAP)} y2={yBot} {...whisker} />
              </>
            ) : null}
            {/* PAPER halo: keeps the whiskers off the dot's edge, and keeps a
                hollow dot reading as hollow where a whisker runs beneath it. */}
            <Circle cx={ptX} cy={ptY} r={3.5} fill={PAPER} />
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

/* Key to the marks, in the header block. Same geometry as a panel's, drawn at
   legend scale in points rather than in the plot's 0–100 viewBox. */
function Legend() {
  return (
    <View style={s.legend}>
      <LegendItem text="Plain dot — responses consistent">
        <Svg width={7} height={7} style={s.legendMark}>
          <Circle cx={3.5} cy={3.5} r={2} fill={INK} stroke={INK} strokeWidth={0.8} />
        </Svg>
      </LegendItem>

      <LegendItem text="Whiskers — plausible range; longer, less certain">
        <Svg width={16} height={9} style={s.legendMark}>
          <Line x1={1.5} y1={4.5} x2={14.5} y2={4.5} {...legendWhisker} />
          <Line x1={1.5} y1={3} x2={1.5} y2={6} {...legendWhisker} />
          <Line x1={14.5} y1={3} x2={14.5} y2={6} {...legendWhisker} />
          <Line x1={8} y1={1} x2={8} y2={8} {...legendWhisker} />
          <Line x1={6.5} y1={1} x2={9.5} y2={1} {...legendWhisker} />
          <Line x1={6.5} y1={8} x2={9.5} y2={8} {...legendWhisker} />
          <Circle cx={8} cy={4.5} r={2.8} fill={PAPER} />
          <Circle cx={8} cy={4.5} r={2} fill={INK} stroke={INK} strokeWidth={0.8} />
        </Svg>
      </LegendItem>

      <LegendItem text="Tint — this person's quadrant">
        <Svg width={7} height={7} style={s.legendMark}>
          <Rect x={3.5} y={0.25} width={3.25} height={3.25} fill={TINT} />
          <Rect x={0.25} y={0.25} width={6.5} height={6.5} fill="none" stroke={HAIR} strokeWidth={0.5} />
          <Line x1={3.5} y1={0.25} x2={3.5} y2={6.75} stroke={HAIR} strokeWidth={0.5} />
          <Line x1={0.25} y1={3.5} x2={6.75} y2={3.5} stroke={HAIR} strokeWidth={0.5} />
        </Svg>
      </LegendItem>

      <LegendItem text="Hollow — inconsistent pair, read with care">
        <Svg width={7} height={7} style={s.legendMark}>
          <Circle cx={3.5} cy={3.5} r={2} fill={PAPER} stroke={INK} strokeWidth={0.8} />
        </Svg>
      </LegendItem>
    </View>
  );
}

const legendWhisker = { stroke: MUTED, strokeWidth: 0.5, strokeLinecap: "round" as const };

function LegendItem({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <View style={s.legendItem}>
      {children}
      <Text style={s.legendTxt}>{text}</Text>
    </View>
  );
}

export function ParadoxReportPDF({ result, name, completedAt }: {
  result: Result; name?: string | null; completedAt?: string | null;
}) {
  const byKey = new Map(result.paradoxes.map((p) => [p.key, p]));
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  /* Pairs, not result.flaggedCount — that one counts traits. */
  const flaggedPairs = result.paradoxes.filter((p) => p.flagged).length;

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={s.page}>
        <View style={s.header}>
          <View style={s.headerTop}>
            <View>
              <Image src="/brand/forzamap-lockup-2x.png" style={s.lockup} />
              <Text style={s.h1}>Paradox Profile</Text>
            </View>
            <View style={s.metaCol}>
              {name ? <Text style={s.nameTxt}>{name}</Text> : null}
              {/* Labelled, because the line under it is the date the PDF was
                  made — the two are only the same on the day of the sitting.
                  Free vertically: this column runs shorter than the lockup and
                  title beside it, so a fourth line does not touch the 21mm the
                  header gets, and the legend stays pinned above the grid. */}
              {completedAt ? <Text style={s.meta}>Completed {fmtCompleted(completedAt)}</Text> : null}
              <Text style={s.meta}>{date}</Text>
              <Text style={[s.meta, result.consistency === "Low" ? { color: FORZA } : {}]}>
                Consistency {result.consistency}
                {flaggedPairs > 0 ? ` · ${flaggedPairs} flagged ${flaggedPairs === 1 ? "pair" : "pairs"}` : ""}
              </Text>
            </View>
          </View>
          <Legend />
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
