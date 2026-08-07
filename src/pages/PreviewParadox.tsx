import { useMemo, useState } from "react";
import { PDFDownloadLink as PDFDownloadLinkBase } from "@react-pdf/renderer";
const PDFDownloadLink = PDFDownloadLinkBase as unknown as (props: any) => JSX.Element;
import ParadoxReport from "../report/ParadoxReport";
import { ParadoxReportPDF } from "../report/ParadoxReportPDF";
import {
  buildItems, score, SCALE_MIN, SCALE_MAX,
  type Answers, type Item, type ThresholdMode,
} from "../lib/paradox";
import { PAPER, INK, MUTED, HAIR } from "../lib/ui";

/* Dev-only preview. Unguarded, not wired to the database — it fabricates a
   response set so the report layout can be checked without sitting the
   instrument. */

const NAME = "Sample Candidate";

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }
function likert(v: number) { return clamp(Math.round(v), SCALE_MIN, SCALE_MAX); }

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Give every trait its own target level across the full 1–10 range, then
   shuffle so neighbouring paradoxes do not come out in a tidy gradient.
   The spread is deliberately weighted high (the ^0.6 curve) rather than even:
   an even spread puts the person's own mean at 5.5, which makes the
   person-centred crosshair land on top of the fixed one and hides the
   difference between the two threshold modes.

   Two traits are answered incoherently on purpose: their reverse items get the
   same raw answer as their positive items, which after recoding pulls the
   within-trait spread wide enough to trip the flag and exercise the
   flagged-panel rendering. */
function mockAnswers(items: Item[]): Answers {
  const traits = Array.from(new Set(items.map((it) => it.trait)));
  const levels = shuffle(traits.map((_, i) =>
    SCALE_MIN + Math.pow(i / (traits.length - 1), 0.6) * (SCALE_MAX - SCALE_MIN)));

  const target: Record<string, number> = {};
  traits.forEach((t, i) => (target[t] = levels[i]));

  // Break the three most extreme targets — inconsistency is invisible on a
  // trait already sitting at the midpoint. Three rather than two because two
  // of them can turn out to be the same paradox's own pair, which would leave
  // only one flagged panel to look at; three guarantees at least two.
  const incoherent = new Set(
    [...traits].sort((a, b) => Math.abs(target[b] - 5.5) - Math.abs(target[a] - 5.5)).slice(0, 3),
  );

  const answers: Answers = {};
  items.forEach((it) => {
    const jitter = (Math.random() - 0.5) * 1.2;
    const x = target[it.trait] + jitter;
    // Normally a reverse item is answered 11 − X to express the same level;
    // the incoherent traits answer it in the same direction as the positives.
    answers[it.id] = likert(it.reverse && !incoherent.has(it.trait) ? SCALE_MIN + SCALE_MAX - x : x);
  });
  return answers;
}

export default function PreviewParadox() {
  const [threshold, setThreshold] = useState<ThresholdMode>("fixed");
  const [seed, setSeed] = useState(0);

  const items = useMemo(() => buildItems(), [seed]);
  const answers = useMemo(() => mockAnswers(items), [items]);
  const result = useMemo(() => score(items, answers, { threshold }), [items, answers, threshold]);

  return (
    <div style={{ minHeight: "100vh", background: PAPER }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: 16, borderBottom: `1px solid ${HAIR}`, position: "sticky", top: 0, background: PAPER, zIndex: 5 }}>
        <span className="font-label" style={{ fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: MUTED, marginRight: "auto" }}>
          Preview · mock data
        </span>

        <div style={{ display: "flex", border: `1px solid ${HAIR}` }}>
          {(["fixed", "personCentred"] as ThresholdMode[]).map((m) => (
            <button key={m} onClick={() => setThreshold(m)} className="font-label"
              style={{ ...btn, background: threshold === m ? INK : "transparent", color: threshold === m ? PAPER : MUTED, border: "none" }}>
              {m === "fixed" ? "Fixed 5.5" : "Person-centred"}
            </button>
          ))}
        </div>

        <button onClick={() => setSeed((n) => n + 1)} className="font-label"
          style={{ ...btn, background: "none", color: MUTED, border: `1px solid ${HAIR}` }}>
          Regenerate
        </button>

        <PDFDownloadLink key={`${seed}-${threshold}`}
          document={<ParadoxReportPDF result={result} name={NAME} />}
          fileName="paradox-profile.pdf" className="font-label" style={{ ...btn, background: INK, color: PAPER, textDecoration: "none" }}>
          {({ loading, error }: { loading: boolean; error: Error | null }) => {
            if (error) { console.error("Paradox PDF failed", error); return "PDF failed — see console"; }
            return loading ? "Preparing PDF…" : "Download PDF";
          }}
        </PDFDownloadLink>
      </div>

      <ParadoxReport result={result} name={NAME} />
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "10px 14px", fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase",
  cursor: "pointer", fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif", fontWeight: 500,
};
