import type { Result } from "../lib/instrument";
import { DOMAINS } from "../lib/instrument";
import { PAPER, INK, MUTED, HAIR, BODY, FORZA } from "../lib/ui";

export default function ReportView({ result, name }: { result: Result; name?: string | null }) {
  const { themeScores, domainShare, top, quality } = result;
  const lead = domainShare[0];
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px", fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif" }}>
      {/* Lockup at 160px — above the 88px brand minimum. Clear space below equals
          the cap height of the F (≈25% of lockup height). */}
      <img src="/brand/forzamap-lockup.svg" alt="ForzaMap" style={{ width: 160, height: "auto", display: "block", marginBottom: 20 }} />
      <p className="font-label" style={{ fontSize: 12, letterSpacing: ".15em", textTransform: "uppercase", color: MUTED, marginBottom: 8 }}>
        {name ? `${name} · ` : ""}Strengths profile
      </p>
      <h1 className="font-display" style={{ fontSize: "2rem", color: INK, margin: "0 0 10px" }}>You lead with {top[0].name}.</h1>
      <p style={{ color: BODY, lineHeight: 1.6, marginBottom: 28 }}>
        Energy leans most toward <strong style={{ color: lead.color }}>{lead.label}</strong> — {lead.note.toLowerCase()}.
      </p>

      <div style={{ display: "flex", height: 12, borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
        {domainShare.map((d) => <div key={d.key} style={{ width: `${d.share}%`, background: d.color }} />)}
      </div>
      <div className="font-mono" style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: 12, color: MUTED, marginBottom: 36 }}>
        {domainShare.map((d) => (
          <span key={d.key} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color }} />{d.label} {Math.round(d.share)}%
          </span>
        ))}
      </div>

      <h3 className="font-label" style={{ fontSize: 12, letterSpacing: ".15em", textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>Signature strengths</h3>
      <div style={{ background: HAIR, display: "grid", gap: 1, marginBottom: 40 }}>
        {top.map((t, i) => (
          <div key={t.key} style={{ background: PAPER, display: "flex", gap: 16, padding: 20 }}>
            <span className="font-display" style={{ color: DOMAINS[t.domain].color, fontSize: "1.5rem", lineHeight: 1 }}>{i + 1}</span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span className="font-display" style={{ fontSize: "1.1rem", color: INK }}>{t.name}</span>
                <span className="font-label" style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, color: DOMAINS[t.domain].color, background: DOMAINS[t.domain].color + "18" }}>{DOMAINS[t.domain].label}</span>
              </div>
              <p style={{ fontSize: 14, color: BODY, lineHeight: 1.5, margin: 0 }}>{t.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <h3 className="font-label" style={{ fontSize: 12, letterSpacing: ".15em", textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>Full ranking</h3>
      <div style={{ display: "grid", gap: 12, marginBottom: 36 }}>
        {themeScores.map((t, i) => (
          <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="font-mono" style={{ fontSize: 12, width: 20, textAlign: "right", color: MUTED }}>{i + 1}</span>
            <span style={{ fontSize: 14, width: 112, color: i < 5 ? INK : MUTED }}>{t.name}</span>
            <div style={{ flex: 1, height: 8, background: HAIR, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(t.norm, 2)}%`, height: "100%", background: DOMAINS[t.domain].color, opacity: i < 5 ? 1 : 0.45 }} />
            </div>
            <span className="font-mono" style={{ fontSize: 12, width: 32, textAlign: "right", color: MUTED }}>{Math.round(t.norm)}</span>
          </div>
        ))}
      </div>

      {/* A High rating stands alone; anything lower carries the signals that
          pulled it down, so the reader knows what to check in the responses. */}
      <div style={{ padding: 16, border: `1px solid ${HAIR}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
          <span className="font-label" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".07em", color: MUTED }}>Response quality</span>
          <span className="font-display" style={{ color: quality.rating === "Low" ? FORZA : INK }}>{quality.rating}</span>
        </div>
        {quality.rating !== "High" && quality.reasons.length > 0 && (
          <ul style={{ margin: "12px 0 0", paddingLeft: 18 }}>
            {quality.reasons.map((r, i) => (
              <li key={i} style={{ fontSize: 13, color: BODY, lineHeight: 1.5, marginTop: i ? 6 : 0 }}>{r}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
