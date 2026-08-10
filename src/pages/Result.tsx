import { useEffect, useState } from "react";
import { PDFDownloadLink as PDFDownloadLinkBase } from "@react-pdf/renderer";
const PDFDownloadLink = PDFDownloadLinkBase as unknown as (props: any) => JSX.Element;
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import ReportView from "../report/ReportView";
import { ReportPDF } from "../report/ReportPDF";
import ParadoxReport from "../report/ParadoxReport";
import { ParadoxReportPDF } from "../report/ParadoxReportPDF";
import { PARADOX_SLUG } from "../lib/assignments";
import type { Result as StrengthsResult } from "../lib/instrument";
import type { Result as ParadoxResult } from "../lib/paradox";
import { PAPER, INK, MUTED, HAIR } from "../lib/ui";

/* PostgREST returns a many-to-one embed as an object; tolerate an array too. */
const one = (x: any) => (Array.isArray(x) ? x[0] : x) ?? {};

export default function Result() {
  const { session, signOut } = useAuth();
  const [result, setResult] = useState<unknown>(null);
  const [name, setName] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none">("loading");

  useEffect(() => {
    (async () => {
      // the most recently submitted assessment, whichever instrument it was for
      const { data } = await supabase.from("assessments")
        .select("result, status, assignment:assignments(instrument:instruments(slug))")
        .eq("candidate_id", session!.user.id)
        .eq("status", "submitted").order("submitted_at", { ascending: false })
        .limit(1).maybeSingle();
      const { data: cand } = await supabase.from("candidates")
        .select("full_name").eq("user_id", session!.user.id).maybeSingle();
      setName(cand?.full_name ?? null);
      setSlug(one(one((data as any)?.assignment).instrument).slug ?? null);
      if (data?.result) { setResult(data.result); setState("ready"); }
      else setState("none");
    })();
  }, [session]);

  const isParadox = slug === PARADOX_SLUG;

  if (state === "loading") return <Center>Loading your profile…</Center>;
  if (state === "none") return <Center>No completed assessment found. <a href="/" style={{ color: INK }}>Start it →</a></Center>;

  return (
    <div style={{ minHeight: "100vh", background: PAPER }}>
      <Bar>
        <PDFDownloadLink
          document={isParadox
            ? <ParadoxReportPDF result={result as ParadoxResult} name={name} />
            : <ReportPDF result={result as StrengthsResult} name={name} />}
          fileName={isParadox ? "paradox-profile.pdf" : "strengths-profile.pdf"}
          className="font-label" style={btn}>
          {({ loading }: { loading: boolean }) => (loading ? "Preparing PDF…" : "Download PDF")}
        </PDFDownloadLink>
        <button onClick={signOut} className="font-label" style={{ ...btn, background: "none", color: MUTED, border: `1px solid ${HAIR}` }}>Sign out</button>
      </Bar>
      {isParadox
        ? <ParadoxReport result={result as ParadoxResult} name={name} />
        : <ReportView result={result as StrengthsResult} name={name} />}
    </div>
  );
}

const btn: React.CSSProperties = { padding: "10px 16px", background: INK, color: PAPER, fontSize: 12, letterSpacing: ".07em", textTransform: "uppercase", textDecoration: "none", border: "none", cursor: "pointer" };
function Bar({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: 16, borderBottom: `1px solid ${HAIR}`, position: "sticky", top: 0, background: PAPER, zIndex: 5 }}>{children}</div>;
}
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: PAPER, fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif", color: MUTED, gap: 8 }}>{children}</div>;
}
