import type { DomainKey, Result, ThemeKey } from "../lib/instrument";
import { DOMAINS, THEMES } from "../lib/instrument";
import { PAPER, INK, MUTED, HAIR, BODY, FORZA, fmtReportDate } from "../lib/ui";

/* Section label role, repeated for every heading on the page. */
const h3: React.CSSProperties = {
  fontSize: 12, letterSpacing: ".15em", textTransform: "uppercase", color: MUTED, margin: "0 0 16px",
};
/* A heading that carries an explanatory line sits closer to it than to the
   section above. */
const h3Tight: React.CSSProperties = { ...h3, margin: "0 0 6px" };
const note: React.CSSProperties = {
  fontSize: 13, lineHeight: 1.5, color: MUTED, margin: "0 0 18px", maxWidth: "60ch",
};

/* Domains in instrument order, and within each the themes in the order
   instrument.ts declares them rather than in this person's rank order. */
const DOMAIN_KEYS = Object.keys(DOMAINS) as DomainKey[];
const THEMES_BY_DOMAIN = DOMAIN_KEYS.reduce((acc, d) => {
  acc[d] = (Object.keys(THEMES) as ThemeKey[]).filter((k) => THEMES[k].domain === d);
  return acc;
}, {} as Record<DomainKey, ThemeKey[]>);

/* completedAt is optional: it lives on the assignment, and the report also
   renders from previews and fixtures that have none. */
export default function ReportView({ result, name, completedAt }: {
  result: Result; name?: string | null; completedAt?: string | null;
}) {
  const { themeScores, domainShare, top, quality } = result;
  const lead = domainShare[0];
  const bottom = themeScores.slice(-5);
  const firstBottomRank = themeScores.length - 5;
  /* Rank by theme, so the reference can mark the top five where they fall
     among their own domain rather than re-sorting them. */
  const rankOf = new Map<ThemeKey, number>(themeScores.map((t, i) => [t.key, i]));
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px", fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif" }}>
      {/* Lockup at 160px — above the 88px brand minimum. Clear space below equals
          the cap height of the F (≈25% of lockup height). */}
      <img src="/brand/forzamap-lockup.svg" alt="ForzaMap" style={{ width: 160, height: "auto", display: "block", marginBottom: 20 }} />
      {/* The candidate on a line of their own, at reading size in ink: a name
          set in the label treatment reads as one more field of metadata. */}
      {name && (
        <p className="font-label" style={{ fontSize: "1.05rem", letterSpacing: "normal", color: INK, margin: "0 0 4px" }}>{name}</p>
      )}
      <p className="font-label" style={{ fontSize: 12, letterSpacing: ".15em", textTransform: "uppercase", color: MUTED, margin: "0 0 8px" }}>
        Strengths profile{completedAt ? ` · Completed ${fmtReportDate(completedAt)}` : ""}
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

      <h3 className="font-label" style={h3}>Signature strengths</h3>
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

      {/* The bottom five carry a rank and a name and nothing else: no bar, no
          description, no domain colour. Anything more would read as a verdict,
          and the note above them exists precisely to say it is not one. */}
      <h3 className="font-label" style={h3Tight}>Least called upon</h3>
      <p style={note}>
        These rank lowest within this person's own profile. A low rank means the theme is less
        central to how they work, not that they lack the capability.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 28px", marginBottom: 40 }}>
        {bottom.map((t, i) => (
          <span key={t.key} style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
            <span className="font-mono" style={{ fontSize: 12, color: MUTED }}>{firstBottomRank + i + 1}</span>
            <span style={{ fontSize: 14, color: BODY }}>{t.name}</span>
          </span>
        ))}
      </div>

      <h3 className="font-label" style={h3}>Full ranking</h3>
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

      <h3 className="font-label" style={h3Tight}>All twenty themes</h3>
      <p style={note}>
        Every theme the instrument measures, in its own domain. The five this person leads with
        are marked with their rank.
      </p>
      <div className="thref">
        {DOMAIN_KEYS.map((d) => (
          <section key={d}>
            <h4 className="font-label" style={{ fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: DOMAINS[d].color, margin: "0 0 10px" }}>
              {DOMAINS[d].label}
            </h4>
            {THEMES_BY_DOMAIN[d].map((k) => {
              const rank = rankOf.get(k);
              const isTop = rank != null && rank < top.length;
              return (
                <div key={k} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {/* Fixed-width gutter on every row, marked or not, so all five
                      descriptions share one left edge and the marked ones stand
                      out of it. */}
                  <span style={{ flex: "0 0 28px", display: "inline-flex", alignItems: "center", gap: 4, height: 20 }}>
                    {isTop && (
                      <>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: DOMAINS[d].color }} />
                        <span className="font-mono" style={{ fontSize: 11, color: DOMAINS[d].color }}>{rank + 1}</span>
                      </>
                    )}
                  </span>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: BODY }}>
                    <span className="font-display" style={{ color: INK }}>{THEMES[k].name}</span> — {THEMES[k].desc}
                  </p>
                </div>
              );
            })}
          </section>
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

      {/* Two columns once there is room for them, collapsing to one below 768px.
          Flowed columns rather than a two-track grid: a grid aligns its rows to
          the tallest domain in each, which opens a band of white under the
          shorter one. Domains are kept whole inside a column. */}
      <style>{`
        .thref{margin-bottom:36px}
        .thref section{break-inside:avoid;margin-bottom:24px}
        @media (min-width:768px){.thref{column-count:2;column-gap:28px}}
      `}</style>
    </div>
  );
}
