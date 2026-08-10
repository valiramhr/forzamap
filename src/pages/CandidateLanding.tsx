import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { INSTRUMENT_PATH } from "../lib/assignments";
import { PAPER, INK, MUTED, HAIR, BODY } from "../lib/ui";

/* Where a signed-in candidate lands: straight into their assessment when there
   is only one waiting, a chooser when there are several. */
interface Pending { id: string; status: string; name: string; sort: number; path: string }

/* PostgREST returns a many-to-one embed as an object; tolerate an array too. */
const one = (x: any) => (Array.isArray(x) ? x[0] : x) ?? {};

export default function CandidateLanding() {
  const { session, signOut } = useAuth();
  const nav = useNavigate();
  const uid = session!.user.id;
  const [pending, setPending] = useState<Pending[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("assignments")
        .select("id,status,instrument:instruments!inner(slug,name,sort_order)")
        .eq("candidate_id", uid)
        .in("status", ["invited", "in_progress"]);

      setPending(((data ?? []) as any[])
        .map((a) => {
          const i = one(a.instrument);
          return { id: a.id, status: a.status, name: i.name, sort: i.sort_order ?? 0, path: INSTRUMENT_PATH[i.slug] };
        })
        // an instrument with no page in this app can't be sat here, so it is
        // not offered as a choice
        .filter((p) => !!p.path)
        .sort((a, b) => a.sort - b.sort));
    })();
  }, [uid]);

  if (pending === null) return <Shell><Center>Loading…</Center></Shell>;
  if (pending.length === 1) return <Navigate to={pending[0].path} replace />;

  return (
    <Shell>
      <div className="lndwrap">
        <p className="font-label lndeyebrow">ForzaMap</p>
        {pending.length === 0 ? (
          <>
            <h1 className="lndh1">Nothing assigned.</h1>
            <p className="lndbody">
              You don't have any assessments waiting. If you were expecting one,
              ask whoever invited you to assign it to your account.
            </p>
          </>
        ) : (
          <>
            <h1 className="lndh1">{pending.length} assessments waiting.</h1>
            <p className="lndbody">Pick one to start. You can come back for the rest.</p>
            <div className="lndlist">
              {pending.map((p) => (
                <button key={p.id} onClick={() => nav(p.path)} className="lndcard">
                  <span className="lndname">{p.name}</span>
                  <span className="font-label lndstate">
                    {p.status === "in_progress" ? "Resume" : "Start"} →
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        <button onClick={signOut} className="font-label lndout">Sign out</button>
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
        .lndwrap{max-width:560px;margin:0 auto;padding:56px 16px 24px}
        .lndeyebrow{font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:${MUTED};margin:0 0 10px}
        .lndh1{font-family:Archivo,ui-sans-serif,system-ui,sans-serif;font-weight:800;
          letter-spacing:-0.035em;font-size:1.8rem;color:${INK};margin:0 0 12px}
        .lndbody{color:${BODY};line-height:1.6;margin:0 0 28px}
        .lndlist{display:grid;gap:10px;margin-bottom:32px}
        .lndcard{display:flex;align-items:center;justify-content:space-between;gap:16px;
          width:100%;min-height:64px;padding:16px;text-align:left;cursor:pointer;
          background:${PAPER};border:1.5px solid ${HAIR};transition:border-color .15s}
        .lndcard:hover{border-color:${INK}}
        .lndname{font-family:Archivo,ui-sans-serif,system-ui,sans-serif;font-weight:800;
          letter-spacing:-0.035em;font-size:1.05rem;color:${INK}}
        .lndstate{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:${MUTED};white-space:nowrap}
        .lndout{font-size:12px;letter-spacing:.07em;text-transform:uppercase;color:${MUTED};
          background:none;border:none;padding:0;cursor:pointer}
        @media (min-width:768px){
          .lndwrap{padding:80px 24px 24px}
          .lndh1{font-size:2rem}
        }
        button:focus-visible{outline:2px solid ${INK};outline-offset:2px}
        @media (prefers-reduced-motion:reduce){*{transition:none!important}}
      `}</style>
    </div>
  );
}
