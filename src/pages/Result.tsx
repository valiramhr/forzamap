import { useEffect, useState } from "react";
import { PDFDownloadLink as PDFDownloadLinkBase } from "@react-pdf/renderer";
const PDFDownloadLink = PDFDownloadLinkBase as unknown as (props: any) => JSX.Element;
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import ReportView from "../report/ReportView";
import { ReportPDF } from "../report/ReportPDF";
import type { Result as R } from "../lib/instrument";
import { PAPER, INK, MUTED, HAIR } from "../lib/ui";

export default function Result() {
  const { session, signOut } = useAuth();
  const [result, setResult] = useState<R | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none">("loading");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("assessments")
        .select("result, status").eq("candidate_id", session!.user.id)
        .eq("status", "submitted").order("submitted_at", { ascending: false })
        .limit(1).maybeSingle();
      const { data: cand } = await supabase.from("candidates")
        .select("full_name").eq("user_id", session!.user.id).maybeSingle();
      setName(cand?.full_name ?? null);
      if (data?.result) { setResult(data.result as R); setState("ready"); }
      else setState("none");
    })();
  }, [session]);

  if (state === "loading") return <Center>Loading your profile…</Center>;
  if (state === "none") return <Center>No completed assessment found. <a href="/assessment" style={{ color: INK }}>Start it →</a></Center>;

  return (
    <div style={{ minHeight: "100vh", background: PAPER }}>
      <Bar>
        <PDFDownloadLink document={<ReportPDF result={result!} name={name} />} fileName="strengths-profile.pdf"
          className="font-mono" style={btn}>
          {({ loading }: { loading: boolean }) => (loading ? "Preparing PDF…" : "Download PDF")}
        </PDFDownloadLink>
        <button onClick={signOut} className="font-mono" style={{ ...btn, background: "none", color: MUTED, border: `1px solid ${HAIR}` }}>Sign out</button>
      </Bar>
      <ReportView result={result!} name={name} />
    </div>
  );
}

const btn: React.CSSProperties = { padding: "10px 16px", background: INK, color: PAPER, fontSize: 12, letterSpacing: ".05em", textTransform: "uppercase", textDecoration: "none", border: "none", cursor: "pointer" };
function Bar({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: 16, borderBottom: `1px solid ${HAIR}`, position: "sticky", top: 0, background: PAPER, zIndex: 5 }}>{children}</div>;
}
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: PAPER, fontFamily: "monospace", color: MUTED, gap: 8 }}>{children}</div>;
}
