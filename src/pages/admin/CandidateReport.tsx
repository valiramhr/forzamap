import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { PDFDownloadLink as PDFDownloadLinkBase } from "@react-pdf/renderer";
const PDFDownloadLink = PDFDownloadLinkBase as unknown as (props: any) => JSX.Element;
import { supabase } from "../../lib/supabase";
import ReportView from "../../report/ReportView";
import { ReportPDF } from "../../report/ReportPDF";
import ParadoxReport from "../../report/ParadoxReport";
import { ParadoxReportPDF } from "../../report/ParadoxReportPDF";
import { PARADOX_SLUG } from "../../lib/assignments";
import type { Result as StrengthsResult } from "../../lib/instrument";
import type { Result as ParadoxResult } from "../../lib/paradox";
import { PAPER, INK, MUTED, HAIR } from "../../lib/ui";

/* PostgREST returns a many-to-one embed as an object; tolerate an array too. */
const one = (x: any) => (Array.isArray(x) ? x[0] : x) ?? {};

export default function CandidateReport() {
  const { id } = useParams();          // assignment id
  const [result, setResult] = useState<unknown>(null);
  const [name, setName] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none">("loading");

  useEffect(() => {
    (async () => {
      const { data: assignment } = await supabase.from("assignments")
        .select("id,candidate:candidates(full_name,email),instrument:instruments(slug,name)")
        .eq("id", id).maybeSingle();
      const cand = one(assignment?.candidate), inst = one(assignment?.instrument);
      setName(cand.full_name ?? cand.email ?? null);
      setSlug(inst.slug ?? null);

      const { data } = await supabase.from("assessments")
        .select("result").eq("assignment_id", id).eq("status", "submitted")
        .order("submitted_at", { ascending: false }).limit(1).maybeSingle();
      if (data?.result) { setResult(data.result); setState("ready"); }
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
          <PDFDownloadLink
            document={isParadox
              ? <ParadoxReportPDF result={result as ParadoxResult} name={name} />
              : <ReportPDF result={result as StrengthsResult} name={name} />}
            fileName={fileName}
            className="font-label" style={{ marginLeft: "auto", padding: "10px 16px", background: INK, color: PAPER, fontSize: 12, letterSpacing: ".07em", textTransform: "uppercase", textDecoration: "none" }}>
            {({ loading }: { loading: boolean }) => (loading ? "Preparing PDF…" : "Download PDF")}
          </PDFDownloadLink>
        )}
      </div>
      {state === "loading" && <Center>Loading…</Center>}
      {state === "none" && <Center>This candidate hasn't completed the assessment yet.</Center>}
      {ready && (isParadox
        ? <ParadoxReport result={result as ParadoxResult} name={name} />
        : <ReportView result={result as StrengthsResult} name={name} />)}
    </div>
  );
}
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 64, textAlign: "center", fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif", color: MUTED }}>{children}</div>;
}
