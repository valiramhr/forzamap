import { useState } from "react";
import { PAPER, INK, MUTED, HAIR, BODY, FORZA } from "../lib/ui";
import {
  PARADOXES, SCALE_MIN, SCALE_MAX, itemScore,
  type ParadoxResult, type Quadrant, type TraitScore, type Item, type Answers,
} from "../lib/paradox";

/* One paradox as a square quadrant plot.
   y = the dynamic pole, x = the gentle pole, both running 1–10.
   The crosshair sits at the result's own thresholds, which move with the
   scoring mode — under personCentred they are the candidate's overall mean,
   not the scale midpoint. */

const DISPLAY = "Archivo, ui-sans-serif, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
/* FORZA at ~10% — enough to read as "you are here" without fighting the label. */
const TINT = FORZA + "1A";
const GUTTER = 22; // room for the y-axis tick numbers
/* A converted item this far from its trait's mean is answered against the rest
   of the trait, so it gets called out in the response detail. */
const DRIFT = 2;

const CORNERS: Record<Quadrant, { align: "flex-start" | "flex-end"; justify: "flex-start" | "flex-end"; text: "left" | "right" }> = {
  oneSidedDynamic: { align: "flex-start", justify: "flex-start", text: "left" },
  balanced: { align: "flex-start", justify: "flex-end", text: "right" },
  deficient: { align: "flex-end", justify: "flex-start", text: "left" },
  oneSidedGentle: { align: "flex-end", justify: "flex-end", text: "right" },
};

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }

/* Standard error of the trait score. The score is a mean of five items, so what
   the band should express is the uncertainty in that mean — sd/√n — not the SD,
   which describes the spread of the items themselves. At n = 5 the SD runs
   1.5–2.5, wide enough that its edges read as a second pair of axes. */
function stderr(t: TraitScore) { return t.answered > 0 ? t.sd / Math.sqrt(t.answered) : 0; }

export default function ParadoxPanel({ result, size = 240, items, answers }: {
  result: ParadoxResult; size?: number; items?: Item[]; answers?: Answers;
}) {
  const { dynamic, gentle, quadrant, flagged } = result;
  const labels = PARADOXES[result.key].labels;
  const [open, setOpen] = useState(false);
  /* The raw responses are optional — without them there is nothing to inspect,
     so the caption stays a caption. */
  const canInspect = Boolean(items && answers);

  const span = SCALE_MAX - SCALE_MIN;
  const px = (v: number) => ((clamp(v, SCALE_MIN, SCALE_MAX) - SCALE_MIN) / span) * size;
  const py = (v: number) => size - px(v);

  const cx = px(result.thresholdX);
  const cy = py(result.thresholdY);

  // Uncertainty band: ±1 standard error on each trait, cut off at the plot edge.
  const gse = stderr(gentle), dse = stderr(dynamic);
  const x0 = px(gentle.score - gse), x1 = px(gentle.score + gse);
  const y0 = py(dynamic.score - dse), y1 = py(dynamic.score + dse);

  const ptX = px(gentle.score), ptY = py(dynamic.score);

  const quads: { key: Quadrant; left: number; top: number; w: number; h: number }[] = [
    { key: "oneSidedDynamic", left: 0, top: 0, w: cx, h: cy },
    { key: "balanced", left: cx, top: 0, w: size - cx, h: cy },
    { key: "deficient", left: 0, top: cy, w: cx, h: size - cy },
    { key: "oneSidedGentle", left: cx, top: cy, w: size - cx, h: size - cy },
  ];

  return (
    <div style={{ width: size + GUTTER, fontFamily: DISPLAY }}>
      {/* Two lines' worth of height whether or not the name wraps, so plots stay
          on a common baseline across a grid row. */}
      <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, letterSpacing: "-0.035em", fontSize: "1.05rem", lineHeight: 1.2, minHeight: "2.4em", color: INK, margin: "0 0 8px" }}>
        {result.name}
      </h3>

      {/* y-axis label: above and to the left of the plot, upright rather than rotated */}
      <div style={{ marginLeft: GUTTER, marginBottom: 6, fontWeight: 500, letterSpacing: ".07em", textTransform: "uppercase", fontSize: 10, color: MUTED }}>
        ↑ {dynamic.name}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ width: GUTTER - 6, height: size, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", fontFamily: MONO, fontSize: 9, color: MUTED }}>
          <span>{SCALE_MAX}</span><span>{SCALE_MIN}</span>
        </div>

        <div style={{ position: "relative", width: size, height: size, background: PAPER }}>
          {quads.map((q) => {
            const on = q.key === quadrant;
            const c = CORNERS[q.key];
            return (
              <div key={q.key}
                style={{
                  position: "absolute", left: q.left, top: q.top, width: q.w, height: q.h,
                  background: on ? TINT : "transparent",
                  display: "flex", alignItems: c.align, justifyContent: c.justify, padding: 6, boxSizing: "border-box",
                }}>
                <span style={{
                  fontWeight: on ? 500 : 400, letterSpacing: ".07em", textTransform: "uppercase",
                  fontSize: 9, lineHeight: 1.25, textAlign: c.text, color: on ? INK : MUTED,
                }}>{labels[q.key]}</span>
              </div>
            );
          })}

          <svg width={size} height={size} style={{ position: "absolute", left: 0, top: 0, display: "block", pointerEvents: "none" }} aria-hidden="true">
            <rect x={0.5} y={0.5} width={size - 1} height={size - 1} fill="none" stroke={HAIR} strokeWidth={1} />
            {/* crosshair at the result's own thresholds */}
            <line x1={cx} y1={0} x2={cx} y2={size} stroke={HAIR} strokeWidth={1} />
            <line x1={0} y1={cy} x2={size} y2={cy} stroke={HAIR} strokeWidth={1} />
            {/* Uncertainty halo from the two traits' standard errors. Filled and
                unstroked on purpose: an outlined box reads as a bounded shape,
                which is the wrong claim for an interval. */}
            <rect x={x0} y={y1} width={Math.max(x1 - x0, 0)} height={Math.max(y0 - y1, 0)}
              fill={HAIR} fillOpacity={0.25} stroke="none" />
            <circle cx={ptX} cy={ptY} r={4.5} fill={flagged ? "none" : INK} stroke={INK} strokeWidth={1.5} />
          </svg>
        </div>
      </div>

      <div style={{ marginLeft: GUTTER, width: size, display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 9, color: MUTED, marginTop: 4 }}>
        <span>{SCALE_MIN}</span><span>{SCALE_MAX}</span>
      </div>
      <div style={{ marginLeft: GUTTER, width: size, textAlign: "center", marginTop: 4, fontWeight: 500, letterSpacing: ".07em", textTransform: "uppercase", fontSize: 10, color: MUTED }}>
        {gentle.name} →
      </div>

      <div style={{ marginLeft: GUTTER, width: size, marginTop: 10, fontFamily: MONO, fontSize: 10, color: INK }}>
        {dynamic.name} {dynamic.score.toFixed(1)} · {gentle.name} {gentle.score.toFixed(1)}
      </div>

      {flagged && !canInspect && (
        <p style={{ margin: "6px 0 0", marginLeft: GUTTER, width: size, fontSize: 11, lineHeight: 1.4, color: FORZA }}>
          Responses on this pair were inconsistent — interpret with care.
        </p>
      )}

      {flagged && canInspect && (
        <>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
            style={{
              display: "block", margin: "6px 0 0", marginLeft: GUTTER, width: size,
              padding: 0, background: "none", border: "none", cursor: "pointer",
              font: "inherit", fontSize: 11, lineHeight: 1.4, textAlign: "left", color: FORZA,
            }}>
            Responses on this pair were inconsistent —{" "}
            <span style={{ textDecoration: "underline" }}>
              {open ? "Hide responses" : "View responses"}
            </span>
          </button>

          {open && (
            <div style={{ marginLeft: GUTTER, width: size, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${HAIR}` }}>
              <TraitDetail trait={dynamic} items={items!} answers={answers!} />
              <TraitDetail trait={gentle} items={items!} answers={answers!} />
              <p style={{ margin: "10px 0 0", fontSize: 9.5, lineHeight: 1.4, color: MUTED }}>
                Reverse-keyed items score {SCALE_MIN + SCALE_MAX} − response. Highlighted
                rows sit more than {DRIFT} points from their trait's mean — they pull
                against the other items in that trait.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* One trait's five items, as answered. The pair's two traits each get one of
   these under a flagged panel. */
function TraitDetail({ trait, items, answers }: { trait: TraitScore; items: Item[]; answers: Answers }) {
  /* Positives first, then the reverse items, so the two means quoted above the
     table line up with two visible blocks. Item order is otherwise the
     randomised order the candidate saw them in. */
  const rows = items
    .filter((it) => it.trait === trait.key)
    .sort((a, b) => Number(a.reverse) - Number(b.reverse) || a.id - b.id)
    .map((it) => {
      const raw = answers[it.id];
      const converted = raw == null ? null : itemScore(raw, it.reverse);
      const drift = converted == null ? 0 : converted - trait.score;
      return { it, raw, converted, out: Math.abs(drift) > DRIFT, up: drift > 0 };
    });

  const tone = trait.flagged ? FORZA : MUTED;

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontWeight: 800, letterSpacing: "-0.02em", fontSize: 12, color: INK }}>{trait.name}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: INK }}>{trait.score.toFixed(1)}</span>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 9.5, color: tone, marginTop: 2 }}>
        P {trait.positiveMean.toFixed(1)} · R {trait.reverseMean.toFixed(1)} · gap {trait.gap.toFixed(1)}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6, tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left" }}>Statement</th>
            <th style={{ ...th, width: 22 }}>Key</th>
            <th style={{ ...th, width: 26 }}>Raw</th>
            <th style={{ ...th, width: 34 }}>Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ it, raw, converted, out, up }) => (
            <tr key={it.id} style={out ? { background: FORZA + "14" } : undefined}>
              <td style={{ ...td, textAlign: "left", color: out ? INK : BODY }}>{it.statement}</td>
              <td style={{ ...td, fontFamily: MONO, color: MUTED }}>{it.reverse ? "R" : "P"}</td>
              <td style={{ ...td, fontFamily: MONO, color: MUTED }}>{raw ?? "—"}</td>
              <td style={{ ...td, fontFamily: MONO, fontWeight: out ? 700 : 400, color: out ? FORZA : INK }}>
                {converted == null ? "—" : `${converted}${out ? (up ? " ↑" : " ↓") : ""}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = {
  fontWeight: 500, letterSpacing: ".07em", textTransform: "uppercase", fontSize: 8.5,
  color: MUTED, textAlign: "right", padding: "0 3px 3px", borderBottom: `1px solid ${HAIR}`,
};
const td: React.CSSProperties = {
  fontSize: 10, lineHeight: 1.35, padding: "4px 3px", textAlign: "right",
  verticalAlign: "top", borderBottom: `1px solid ${HAIR}`,
};
