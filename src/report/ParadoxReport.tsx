import ParadoxPanel from "./ParadoxPanel";
import { PARADOX_ORDER, type Result } from "../lib/paradox";
import { INK, MUTED, HAIR, BODY, FORZA } from "../lib/ui";

export default function ParadoxReport({ result, name }: { result: Result; name?: string | null }) {
  const { zoneCounts, consistency, flaggedCount, thresholdMode, overallMean } = result;
  const byKey = new Map(result.paradoxes.map((p) => [p.key, p]));
  /* result.flaggedCount counts flagged *traits*; a pair is flagged when either
     of its two traits is, so the panel count is its own tally. */
  const flaggedPairs = result.paradoxes.filter((p) => p.flagged).length;
  const oneSided = zoneCounts.oneSidedDynamic + zoneCounts.oneSidedGentle;

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 24px", fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif" }}>
      <img src="/brand/forzamap-lockup.svg" alt="ForzaMap" style={{ width: 160, height: "auto", display: "block", marginBottom: 20 }} />

      <p className="font-label" style={{ fontSize: 12, letterSpacing: ".15em", textTransform: "uppercase", color: MUTED, margin: "0 0 8px" }}>
        {name ? `${name} · ` : ""}Paradox Profile
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

      {thresholdMode === "personCentred" && (
        <p style={{ color: BODY, lineHeight: 1.6, fontSize: 14, margin: "0 0 32px", maxWidth: 720 }}>
          Quadrant boundaries sit at this person's own mean across all 24 traits (
          <span className="font-mono">{overallMean.toFixed(1)}</span>), so each position is
          relative to the rest of their own profile rather than to other people.
        </p>
      )}

      <div className="pxgrid">
        {PARADOX_ORDER.map((key) => {
          const p = byKey.get(key);
          return p ? <ParadoxPanel key={key} result={p} /> : null;
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

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
      <span className="font-label" style={{ fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED }}>{label}</span>
      <span className="font-mono" style={{ fontSize: 13, color: tone }}>{value}</span>
    </span>
  );
}
