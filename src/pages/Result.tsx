import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { INSTRUMENT_PATH } from "../lib/assignments";
import { PAPER, INK, MUTED, HAIR, BODY } from "../lib/ui";

/* Where a candidate lands after submitting. Candidates do not see their own
   results for any instrument — the report, its PDF and the flagged-response
   detail live behind /admin. This page only confirms the submission arrived,
   names the instrument, and points at whatever is still outstanding. The
   result payload is deliberately never read here. */

interface Submission { instrument: string | null; submittedAt: string | null }
interface Pending { id: string; status: string; name: string; sort: number; path: string }

/* PostgREST returns a many-to-one embed as an object; tolerate an array too. */
const one = (x: any) => (Array.isArray(x) ? x[0] : x) ?? {};

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });
const formatDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : DATE.format(d);
};

export default function Result() {
  const { session, signOut } = useAuth();
  const nav = useNavigate();
  const uid = session!.user.id;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "none">("loading");

  useEffect(() => {
    (async () => {
      // the most recently submitted assessment, whichever instrument it was
      // for — enough to confirm one exists and to name it, and no more
      const { data } = await supabase.from("assessments")
        .select("id, submitted_at, assignment:assignments(instrument:instruments(name))")
        .eq("candidate_id", uid)
        .eq("status", "submitted").order("submitted_at", { ascending: false })
        .limit(1).maybeSingle();

      if (!data) { setState("none"); return; }

      setSubmission({
        instrument: one(one((data as any).assignment).instrument).name ?? null,
        submittedAt: (data as any).submitted_at ?? null,
      });

      // anything else they still owe us, so they can go straight to it
      const { data: rest } = await supabase.from("assignments")
        .select("id,status,instrument:instruments!inner(slug,name,sort_order)")
        .eq("candidate_id", uid)
        .in("status", ["invited", "in_progress"]);

      setPending(((rest ?? []) as any[])
        .map((a) => {
          const i = one(a.instrument);
          return { id: a.id, status: a.status, name: i.name, sort: i.sort_order ?? 0, path: INSTRUMENT_PATH[i.slug] };
        })
        // an instrument with no page in this app can't be sat here, so it is
        // not offered as a choice
        .filter((p) => !!p.path)
        .sort((a, b) => a.sort - b.sort));

      setState("ready");
    })();
  }, [uid]);

  if (state === "loading") return <Shell><Center>Loading…</Center></Shell>;
  // nothing submitted: the landing page works out where they belong
  if (state === "none") return <Navigate to="/" replace />;

  const date = formatDate(submission?.submittedAt ?? null);

  return (
    <Shell>
      <div className="rcwrap">
        {/* Clear space on all four sides is the cap height of the F
            (≈25% of lockup height). */}
        <img src="/brand/forzamap-lockup.svg" alt="ForzaMap" className="rclockup" />
        <h1 className="rch1">Responses received.</h1>

        <div className="rcmeta">
          <span className="rcname">{submission?.instrument ?? "Your assessment"}</span>
          {date && <span className="font-label rcdate">Completed {date}</span>}
        </div>

        <p className="rcbody">
          Your responses have been recorded. Results aren't shown here — they'll
          be discussed with you directly.
        </p>

        {pending.length > 0 ? (
          <>
            <p className="font-label rcsub">Still to do</p>
            <div className="rclist">
              {pending.map((p) => (
                <button key={p.id} onClick={() => nav(p.path)} className="rccard">
                  <span className="rcname">{p.name}</span>
                  <span className="font-label rcstate">
                    {p.status === "in_progress" ? "Resume" : "Start"} →
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <button onClick={signOut} className="font-label rcout">Sign out</button>
        )}
      </div>
    </Shell>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: MUTED }}>{children}</div>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: PAPER, fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif" }}>
      {children}
      <style>{`
        .font-label{font-family:Archivo,ui-sans-serif,system-ui,sans-serif;font-weight:500;letter-spacing:.07em}
        .rcwrap{max-width:560px;margin:0 auto;padding:56px 16px 24px}
        .rclockup{width:160px;height:auto;display:block;margin:0 0 24px}
        .rch1{font-family:Archivo,ui-sans-serif,system-ui,sans-serif;font-weight:800;
          letter-spacing:-0.035em;font-size:1.8rem;color:${INK};margin:0 0 20px}
        .rcmeta{display:flex;flex-direction:column;gap:6px;padding:16px;
          border:1.5px solid ${HAIR};background:${PAPER};margin-bottom:24px}
        .rcname{font-family:Archivo,ui-sans-serif,system-ui,sans-serif;font-weight:800;
          letter-spacing:-0.035em;font-size:1.05rem;color:${INK}}
        .rcdate{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:${MUTED}}
        .rcbody{color:${BODY};line-height:1.6;margin:0 0 32px}
        .rcsub{font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:${MUTED};margin:0 0 10px}
        .rclist{display:grid;gap:10px;margin-bottom:8px}
        .rccard{display:flex;align-items:center;justify-content:space-between;gap:16px;
          width:100%;min-height:64px;padding:16px;text-align:left;cursor:pointer;
          background:${PAPER};border:1.5px solid ${HAIR};transition:border-color .15s}
        .rccard:hover{border-color:${INK}}
        .rcstate{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:${MUTED};white-space:nowrap}
        .rcout{font-size:12px;letter-spacing:.07em;text-transform:uppercase;color:${MUTED};
          background:none;border:none;padding:0;cursor:pointer}
        @media (min-width:768px){
          .rcwrap{padding:80px 24px 24px}
          .rch1{font-size:2rem}
        }
        button:focus-visible{outline:2px solid ${INK};outline-offset:2px}
        @media (prefers-reduced-motion:reduce){*{transition:none!important}}
      `}</style>
    </div>
  );
}
