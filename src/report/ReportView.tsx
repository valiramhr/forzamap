import type { Result } from "../lib/instrument";
import { DOMAINS } from "../lib/instrument";
import { PAPER, INK, MUTED, HAIR } from "../lib/ui";

export default function ReportView({ result, name }: { result: Result; name?: string | null }) {
  const { themeScores, domainShare, top, consistency } = result;
  const lead = domainShare[0];
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <p className="font-mono" style={{ fontSize: 12, letterSpacing: ".15em", textTransform: "uppercase", color: MUTED, marginBottom: 8 }}>
        {name ? `${name} · ` : ""}Strengths profile
      </p>
      <h1 className="font-serif" style={{ fontSize: "2rem", color: INK, margin: "0 0 10px" }}>You lead with {top[0].name}.</h1>
      <p style={{ color: "#3A3F49", lineHeight: 1.6, marginBottom: 28 }}>
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

      <h3 className="font-mono" style={{ fontSize: 12, letterSpacing: ".15em", textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>Signature strengths</h3>
      <div style={{ background: HAIR, display: "grid", gap: 1, marginBottom: 40 }}>
        {top.map((t, i) => (
          <div key={t.key} style={{ background: PAPER, display: "flex", gap: 16, padding: 20 }}>
            <span className="font-serif" style={{ color: DOMAINS[t.domain].color, fontSize: "1.5rem", lineHeight: 1 }}>{i + 1}</span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span className="font-serif" style={{ fontSize: "1.1rem", color: INK }}>{t.name}</span>
                <span className="font-mono" style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, color: DOMAINS[t.domain].color, background: DOMAINS[t.domain].color + "18" }}>{DOMAINS[t.domain].label}</span>
              </div>
              <p style={{ fontSize: 14, color: "#3A3F49", lineHeight: 1.5, margin: 0 }}>{t.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <h3 className="font-mono" style={{ fontSize: 12, letterSpacing: ".15em", textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>Full ranking</h3>
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

      <div style={{ display: "flex", justifyContent: "space-between", padding: 16, border: `1px solid ${HAIR}` }}>
        <span className="font-mono" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em", color: MUTED }}>Response consistency</span>
        <span className="font-serif" style={{ color: consistency === "Low" ? "#9C3D54" : INK }}>{consistency}</span>
      </div>
    </div>
  );
}
