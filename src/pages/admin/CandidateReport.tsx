import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import PdfDownload from "../../report/PdfDownload";
import { supabase } from "../../lib/supabase";
import ReportView from "../../report/ReportView";
import { ReportPDF } from "../../report/ReportPDF";
import ParadoxReport from "../../report/ParadoxReport";
import { ParadoxReportPDF } from "../../report/ParadoxReportPDF";
import { PARADOX_SLUG } from "../../lib/assignments";
import type { Result as StrengthsResult } from "../../lib/instrument";
import { score as scoreParadox } from "../../lib/paradox";
import type { Result as ParadoxResult, Item as ParadoxItem, Answers as ParadoxAnswers } from "../../lib/paradox";
import { PAPER, INK, MUTED, HAIR } from "../../lib/ui";

/* PostgREST returns a many-to-one embed as an object; tolerate an array too. */
const one = (x: any) => (Array.isArray(x) ? x[0] : x) ?? {};

export default function CandidateReport() {
  const { id } = useParams();          // assignment id
  const [result, setResult] = useState<unknown>(null);
  /* Kept alongside the scored result so a flagged paradox panel can show the
     responses behind it. Shapes differ per instrument, so they are only handed
     to the paradox report. */
  const [items, setItems] = useState<unknown>(null);
  const [answers, setAnswers] = useState<unknown>(null);
  const [name, setName] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  /* Set by the submit trigger on the assignment, not carried on the assessment
     row, so it is read here and handed to the report. */
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none">("loading");

  useEffect(() => {
    (async () => {
      const { data: assignment } = await supabase.from("assignments")
        .select("id,completed_at,candidate:candidates(full_name,email),instrument:instruments(slug,name)")
        .eq("id", id).maybeSingle();
      const cand = one(assignment?.candidate), inst = one(assignment?.instrument);
      setName(cand.full_name ?? cand.email ?? null);
      setSlug(inst.slug ?? null);
      setCompletedAt(assignment?.completed_at ?? null);

      const { data } = await supabase.from("assessments")
        .select("result, items, answers").eq("assignment_id", id).eq("status", "submitted")
        .order("submitted_at", { ascending: false }).limit(1).maybeSingle();
      setItems(data?.items ?? null);
      setAnswers(data?.answers ?? null);

      /* Paradox reports are scored from the stored responses on every read
         rather than trusting the stored result JSON. Scoring rules move — the
         quadrant threshold is now a fixed 5.5 where it used to be the person's
         own mean — and a result written under the old rules would otherwise be
         drawn against panels built for the new ones. The responses are the
         durable record; the result JSON is a cache of one scoring pass over
         them, and items and answers are loaded here anyway for the flagged-
         response detail. */
      const px = inst.slug === PARADOX_SLUG;
      const storedItems = data?.items as ParadoxItem[] | null | undefined;
      const rescored = px && Array.isArray(storedItems) && storedItems.length
        ? scoreParadox(storedItems, (data?.answers ?? {}) as ParadoxAnswers)
        : null;

      if (rescored) { setResult(rescored); setState("ready"); }
      else if (data?.result) { setResult(data.result); setState("ready"); }
      else setState("none");
    })();
  }, [id]);

  const isParadox = slug === PARADOX_SLUG;
  const ready = state === "ready" && result != null;
  const fileName = `${(name ?? "candidate").replace(/\W+/g, "-")}-${isParadox ? "paradox" : "strengths"}.pdf`;

  return (
    <div style={{ minHeight: "100vh", background: PAPER }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 16, borderBottom: `1px solid ${HAIR}`, position: "sticky", top: 0, background: PAPER, zIndex: 5 }}>
        <Link to="/admin/candidates" className="font-label" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".07em", color: MUTED, textDecoration: "none" }}>← Candidates</Link>
        {ready && (
          <span style={{ marginLeft: "auto" }}>
            <PdfDownload
              document={isParadox
                ? <ParadoxReportPDF result={result as ParadoxResult} name={name} completedAt={completedAt} />
                : <ReportPDF result={result as StrengthsResult} name={name} completedAt={completedAt} />}
              fileName={fileName}
              className="font-label" style={{ display: "inline-block", padding: "10px 16px", background: INK, color: PAPER, fontSize: 12, letterSpacing: ".07em", textTransform: "uppercase", textDecoration: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }} />
          </span>
        )}
      </div>
      {state === "loading" && <Center>Loading…</Center>}
      {state === "none" && <Center>This candidate hasn't completed the assessment yet.</Center>}
      {ready && (isParadox
        ? <ParadoxReport result={result as ParadoxResult} name={name} completedAt={completedAt}
            items={(items as ParadoxItem[] | null) ?? undefined}
            answers={(answers as ParadoxAnswers | null) ?? undefined} />
        : <ReportView result={result as StrengthsResult} name={name} completedAt={completedAt} />)}
    </div>
  );
}
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 64, textAlign: "center", fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif", color: MUTED }}>{children}</div>;
}
