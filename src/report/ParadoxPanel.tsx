import { PAPER, INK, MUTED, HAIR, FORZA } from "../lib/ui";
import { PARADOXES, SCALE_MIN, SCALE_MAX, type ParadoxResult, type Quadrant } from "../lib/paradox";

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

const CORNERS: Record<Quadrant, { align: "flex-start" | "flex-end"; justify: "flex-start" | "flex-end"; text: "left" | "right" }> = {
  oneSidedDynamic: { align: "flex-start", justify: "flex-start", text: "left" },
  balanced: { align: "flex-start", justify: "flex-end", text: "right" },
  deficient: { align: "flex-end", justify: "flex-start", text: "left" },
  oneSidedGentle: { align: "flex-end", justify: "flex-end", text: "right" },
};

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }

export default function ParadoxPanel({ result, size = 240 }: { result: ParadoxResult; size?: number }) {
  const { dynamic, gentle, quadrant, flagged } = result;
  const labels = PARADOXES[result.key].labels;

  const span = SCALE_MAX - SCALE_MIN;
  const px = (v: number) => ((clamp(v, SCALE_MIN, SCALE_MAX) - SCALE_MIN) / span) * size;
  const py = (v: number) => size - px(v);

  const cx = px(result.thresholdX);
  const cy = py(result.thresholdY);

  // Uncertainty band: half-width equals each trait's own SD, cut off at the plot edge.
  const x0 = px(gentle.score - gentle.sd), x1 = px(gentle.score + gentle.sd);
  const y0 = py(dynamic.score - dynamic.sd), y1 = py(dynamic.score + dynamic.sd);

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
            {/* uncertainty square from the two traits' SDs */}
            <rect x={x0} y={y1} width={Math.max(x1 - x0, 0)} height={Math.max(y0 - y1, 0)} fill="none" stroke={HAIR} strokeWidth={1} />
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

      {flagged && (
        <p style={{ margin: "6px 0 0", marginLeft: GUTTER, width: size, fontSize: 11, lineHeight: 1.4, color: FORZA }}>
          Responses on this pair were inconsistent — interpret with care.
        </p>
      )}
    </div>
  );
}
