import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { PDFDownloadLink as PDFDownloadLinkBase } from "@react-pdf/renderer";
const PDFDownloadLink = PDFDownloadLinkBase as unknown as (props: any) => JSX.Element;
import { supabase } from "../../lib/supabase";
import ReportView from "../../report/ReportView";
import { ReportPDF } from "../../report/ReportPDF";
import type { Result as R } from "../../lib/instrument";
import { PAPER, INK, MUTED, HAIR } from "../../lib/ui";

export default function CandidateReport() {
  const { id } = useParams();
  const [result, setResult] = useState<R | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none">("loading");

  useEffect(() => {
    (async () => {
      const { data: cand } = await supabase.from("candidates")
        .select("full_name,email").eq("user_id", id).maybeSingle();
      setName(cand?.full_name ?? cand?.email ?? null);
      const { data } = await supabase.from("assessments")
        .select("result").eq("candidate_id", id).eq("status", "submitted")
        .order("submitted_at", { ascending: false }).limit(1).maybeSingle();
      if (data?.result) { setResult(data.result as R); setState("ready"); }
      else setState("none");
    })();
  }, [id]);

  return (
    <div style={{ minHeight: "100vh", background: PAPER }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 16, borderBottom: `1px solid ${HAIR}`, position: "sticky", top: 0, background: PAPER, zIndex: 5 }}>
        <Link to="/admin/candidates" className="font-label" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".07em", color: MUTED, textDecoration: "none" }}>← Candidates</Link>
        {result && (
          <PDFDownloadLink document={<ReportPDF result={result} name={name} />} fileName={`${(name ?? "candidate").replace(/\W+/g, "-")}-strengths.pdf`}
            className="font-label" style={{ marginLeft: "auto", padding: "10px 16px", background: INK, color: PAPER, fontSize: 12, letterSpacing: ".07em", textTransform: "uppercase", textDecoration: "none" }}>
            {({ loading }: { loading: boolean }) => (loading ? "Preparing PDF…" : "Download PDF")}
          </PDFDownloadLink>
        )}
      </div>
      {state === "loading" && <Center>Loading…</Center>}
      {state === "none" && <Center>This candidate hasn't completed the assessment yet.</Center>}
      {state === "ready" && result && <ReportView result={result} name={name} />}
    </div>
  );
}
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 64, textAlign: "center", fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif", color: MUTED }}>{children}</div>;
}
