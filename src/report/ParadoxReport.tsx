import ParadoxPanel from "./ParadoxPanel";
import { PARADOX_ORDER, type Result, type Item, type Answers } from "../lib/paradox";
import { PAPER, INK, MUTED, HAIR, FORZA, fmtReportDate } from "../lib/ui";

/* items and answers are optional: with them, a flagged panel can open the raw
   responses behind its two traits. Without them the panels render exactly as
   they did before. completedAt is optional for the same reason — it lives on
   the assignment, and the preview route has none. */
export default function ParadoxReport({ result, name, items, answers, completedAt }: {
  result: Result; name?: string | null; items?: Item[]; answers?: Answers; completedAt?: string | null;
}) {
  const { zoneCounts, consistency, flaggedCount } = result;
  const byKey = new Map(result.paradoxes.map((p) => [p.key, p]));
  /* result.flaggedCount counts flagged *traits*; a pair is flagged when either
     of its two traits is, so the panel count is its own tally. */
  const flaggedPairs = result.paradoxes.filter((p) => p.flagged).length;
  const oneSided = zoneCounts.oneSidedDynamic + zoneCounts.oneSidedGentle;

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 24px", fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif" }}>
      <img src="/brand/forzamap-lockup.svg" alt="ForzaMap" style={{ width: 160, height: "auto", display: "block", marginBottom: 20 }} />

      {/* The candidate on a line of their own, at reading size in ink: a name
          set in the label treatment reads as one more field of metadata. */}
      {name && (
        <p className="font-label" style={{ fontSize: "1.05rem", letterSpacing: "normal", color: INK, margin: "0 0 4px" }}>{name}</p>
      )}
      <p className="font-label" style={{ fontSize: 12, letterSpacing: ".15em", textTransform: "uppercase", color: MUTED, margin: "0 0 8px" }}>
        Paradox Profile{completedAt ? ` · Completed ${fmtReportDate(completedAt)}` : ""}
      </p>
      <h1 className="font-display" style={{ fontSize: "2rem", color: INK, margin: "0 0 20px" }}>
        Twelve tensions, held or leaning.
      </h1>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 28px", alignItems: "baseline", padding: "16px 0", borderTop: `1px solid ${HAIR}`, borderBottom: `1px solid ${HAIR}`, marginBottom: 20 }}>
        <Stat label="Consistency" value={consistency} tone={consistency === "Low" ? FORZA : INK} />
        <Stat label="Flagged pairs" value={`${flaggedPairs} of 12`} tone={flaggedPairs > 0 ? FORZA : INK} />
        <Stat label="Flagged traits" value={`${flaggedCount} of 24`} tone={flaggedCount > 0 ? FORZA : INK} />
        <Stat label="Zones" value={`${zoneCounts.balanced} balanced · ${oneSided} one-sided · ${zoneCounts.deficient} deficient`} tone={INK} />
      </div>

      <Legend />

      <div className="pxgrid">
        {PARADOX_ORDER.map((key) => {
          const p = byKey.get(key);
          return p ? <ParadoxPanel key={key} result={p} items={items} answers={answers} /> : null;
        })}
      </div>

      <p style={{ color: MUTED, fontSize: 12, lineHeight: 1.5, marginTop: 40, paddingTop: 16, borderTop: `1px solid ${HAIR}` }}>
        Self-report instrument for development discussion. Not normed, not validated for selection decisions.
      </p>

      <style>{`
        .pxgrid{display:grid;grid-template-columns:1fr;gap:36px 24px;justify-items:center}
        @media (min-width:768px){.pxgrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media (min-width:1024px){.pxgrid{grid-template-columns:repeat(3,minmax(0,1fr))}}
      `}</style>
    </div>
  );
}

/* Key to the marks, once above the grid rather than per panel — twelve copies
   of it would drown the twelve plots it explains. Two lines: the two things the
   point itself can say, then the tint and the flagged form. Mark geometry is
   the panel's, at legend scale. */
const TINT = FORZA + "1A";
const W = { stroke: MUTED, strokeWidth: 1.3, strokeLinecap: "round" as const };

function Legend() {
  return (
    <div style={{ margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={legendRow}>
        <Key mark={<DotMark />} lead="Plain dot"
          text="responses on this trait were consistent." />
        <Key mark={<WhiskerMark />} lead="Whiskers"
          text="where the score could plausibly sit, given how much the five items varied. Longer means less certain." />
      </div>
      <div style={legendRow}>
        <Key mark={<QuadMark />} lead="Tinted quadrant" text="where this person falls." />
        <Key mark={<HollowMark />} lead="Hollow dot"
          text="responses on the pair were inconsistent — interpret with care." />
      </div>
    </div>
  );
}

const legendRow: React.CSSProperties = {
  display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 28px",
};

function Key({ mark, lead, text }: { mark: React.ReactNode; lead: string; text: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, lineHeight: 1.4, color: MUTED }}>
      {mark}
      <span><span style={{ fontWeight: 500, color: INK }}>{lead}</span> — {text}</span>
    </span>
  );
}

function DotMark() {
  return (
    <svg width={14} height={14} style={{ display: "block", flexShrink: 0 }} aria-hidden="true">
      <circle cx={7} cy={7} r={3.5} fill={INK} stroke={INK} strokeWidth={1.5} />
    </svg>
  );
}

function HollowMark() {
  return (
    <svg width={14} height={14} style={{ display: "block", flexShrink: 0 }} aria-hidden="true">
      <circle cx={7} cy={7} r={3.5} fill={PAPER} stroke={INK} strokeWidth={1.5} />
    </svg>
  );
}

/* Both axes, as they appear on a panel: whiskers under a haloed point. */
function WhiskerMark() {
  return (
    <svg width={30} height={18} style={{ display: "block", flexShrink: 0 }} aria-hidden="true">
      <g {...W}>
        <line x1={3} y1={9} x2={27} y2={9} />
        <line x1={3} y1={6} x2={3} y2={12} />
        <line x1={27} y1={6} x2={27} y2={12} />
        <line x1={15} y1={2} x2={15} y2={16} />
        <line x1={12} y1={2} x2={18} y2={2} />
        <line x1={12} y1={16} x2={18} y2={16} />
      </g>
      <circle cx={15} cy={9} r={5} fill={PAPER} />
      <circle cx={15} cy={9} r={3.5} fill={INK} stroke={INK} strokeWidth={1.5} />
    </svg>
  );
}

/* A panel in miniature: crosshair, one quadrant tinted. */
function QuadMark() {
  return (
    <svg width={14} height={14} style={{ display: "block", flexShrink: 0 }} aria-hidden="true">
      <rect x={7} y={0.5} width={6.5} height={6.5} fill={TINT} />
      <rect x={0.5} y={0.5} width={13} height={13} fill="none" stroke={HAIR} strokeWidth={1} />
      <line x1={7} y1={0.5} x2={7} y2={13.5} stroke={HAIR} strokeWidth={1} />
      <line x1={0.5} y1={7} x2={13.5} y2={7} stroke={HAIR} strokeWidth={1} />
    </svg>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
      <span className="font-label" style={{ fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED }}>{label}</span>
      <span className="font-mono" style={{ fontSize: 13, color: tone }}>{value}</span>
    </span>
  );
}
