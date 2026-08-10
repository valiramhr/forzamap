import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { PAPER, INK, MUTED, HAIR, BODY, FORZA } from "../lib/ui";
import { findAssignment, PARADOX_SLUG } from "../lib/assignments";
import {
  buildItems, score, SCALE_MIN, SCALE_MAX,
  type Item, type Answers,
} from "../lib/paradox";

/* 1..10 — the response scale, rendered as one button per point. */
const SCALE = Array.from({ length: SCALE_MAX - SCALE_MIN + 1 }, (_, i) => SCALE_MIN + i);

const anchorLabel = (v: number) =>
  v === SCALE_MIN ? `${v} — strongly disagree`
    : v === SCALE_MAX ? `${v} — strongly agree`
      : String(v);

type Phase = "loading" | "unassigned" | "intro" | "running";

export default function ParadoxAssessment() {
  const { session } = useAuth();
  const nav = useNavigate();
  const uid = session!.user.id;

  const [phase, setPhase] = useState<Phase>("loading");
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [current, setCurrent] = useState(0);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);

  // resume an in-progress attempt, scoped to this candidate's Paradox Profile
  // assignment. Nothing is written on mount: the row is created by begin(), so
  // reading the intro and leaving does not mark the assignment in_progress.
  useEffect(() => {
    (async () => {
      const aid = await findAssignment(uid, PARADOX_SLUG);
      if (!aid) { setPhase("unassigned"); return; }
      setAssignmentId(aid);

      const { data: existing } = await supabase
        .from("assessments").select("*").eq("assignment_id", aid)
        .order("started_at", { ascending: false }).limit(1).maybeSingle();

      if (existing?.status === "submitted") { nav("/result", { replace: true }); return; }
      if (existing?.status === "in_progress") {
        const saved = existing.items as Item[];
        const done = Object.keys(existing.answers ?? {}).length;
        setRowId(existing.id);
        setItems(saved);
        setAnswers((existing.answers ?? {}) as Answers);
        setCurrent(Math.min(done, saved.length - 1));
        setPhase("running"); // already under way — the intro has been read
        return;
      }
      // no attempt yet: build the items so the intro can quote a length, but
      // leave them unsaved until the candidate commits
      setItems(buildItems());
      setPhase("intro");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Creates the attempt. This insert is what trips the start trigger, so it is
     deliberately the first thing that happens after "Begin". */
  async function begin() {
    if (!items || !assignmentId || starting) return;
    setStarting(true); setStartError(false);
    const { data, error } = await supabase.from("assessments")
      .insert({ candidate_id: uid, assignment_id: assignmentId, items, answers: {}, status: "in_progress" })
      .select("id").single();
    setStarting(false);
    if (error || !data) { console.error(error); setStartError(true); return; }
    setRowId(data.id); setPhase("running");
  }

  const total = items?.length ?? 0;

  function persist(next: Answers) {
    if (rowId) supabase.from("assessments").update({ answers: next }).eq("id", rowId).then();
  }

  function record(value: number) {
    if (lock.current || !items) return;
    lock.current = true;
    const id = items[current].id;
    const next = { ...answers, [id]: value };
    setAnswers(next);
    if (current % 8 === 0) persist(next); // periodic save
    window.setTimeout(() => {
      lock.current = false;
      if (current + 1 >= total) submit(next);
      else setCurrent((c) => c + 1);
    }, 150);
  }
  function goBack() { if (!lock.current && current > 0) setCurrent((c) => c - 1); }

  async function submit(finalAnswers: Answers) {
    if (!items || !rowId) return;
    setSubmitting(true);
    /* Fixed thresholds, so every stored result carries the same 5.5 crosshair
       and one candidate's panels can be read against another's. */
    const result = score(items, finalAnswers, { threshold: "fixed" });
    await supabase.from("assessments")
      .update({ answers: finalAnswers, result, status: "submitted" })
      .eq("id", rowId);
    nav("/result", { replace: true });
  }

  // keyboard — 1–9 pick their own value, 0 picks 10
  useEffect(() => {
    if (phase !== "running" || !items || submitting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Backspace") { e.preventDefault(); goBack(); return; }
      if (e.key === "0") { record(SCALE_MAX); return; }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) record(n);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, items, phase, submitting]);

  if (phase === "unassigned") return <Shell><Unassigned /></Shell>;
  if (phase === "loading" || !items) return <Shell><Center>Preparing your assessment…</Center></Shell>;
  if (submitting) return <Shell><Center>Scoring your responses…</Center></Shell>;
  if (phase === "intro") return <Shell><Intro total={total} busy={starting} failed={startError} onBegin={begin} /></Shell>;

  const it = items[current];
  const chosen = answers[it.id];
  const pctDone = (current / total) * 100;

  return (
    <Shell>
      <div style={{ height: 3, background: HAIR }}>
        <div style={{ height: "100%", width: `${pctDone}%`, background: INK, transition: "width .3s ease" }} />
      </div>

      <div className="pxwrap">
        <div className="pxhdr">
          <button onClick={goBack} disabled={current === 0} className="font-label pxback">← Back</button>
          <span className="font-mono pxcount">{String(current + 1).padStart(3, "0")} / {total}</span>
        </div>

        {/* Reading text, so Archivo 400 — not the 800 display weight. The trait
            being measured and the reverse flag are never surfaced. */}
        <p className="pxstmt">{it.statement}</p>

        <div className="pxscale">
          {SCALE.map((v) => {
            const on = chosen === v;
            return (
              <button key={v} onClick={() => record(v)} className="font-mono pxopt"
                aria-label={anchorLabel(v)} aria-pressed={on}
                style={{ background: on ? INK : "transparent", color: on ? PAPER : INK,
                  border: `1.5px solid ${on ? INK : HAIR}` }}>
                {v}
              </button>
            );
          })}
        </div>

        <div className="pxanchors font-label">
          <span>{SCALE_MIN} — strongly disagree</span>
          <span>{SCALE_MAX} — strongly agree</span>
        </div>

        <p className="font-label pxkbd">Keys 1–9, 0 for 10 · Backspace to go back</p>
      </div>
    </Shell>
  );
}

function Intro({ total, busy, failed, onBegin }: { total: number; busy: boolean; failed: boolean; onBegin: () => void }) {
  return (
    <div className="pxwrap pxintro">
      <p className="font-label" style={{ fontSize: 12, letterSpacing: ".15em", textTransform: "uppercase", color: MUTED, margin: "0 0 10px" }}>
        Paradox Profile
      </p>
      <h1 className="pxh1">Twelve tensions, one statement at a time.</h1>
      <ul className="pxlist">
        <li>{total} statements, one per screen.</li>
        <li>Rate how much you agree with each, from 1 to 10.</li>
        <li>It takes about 10–14 minutes. There is no timer.</li>
        <li>There are no right answers — your first instinct is the best one.</li>
      </ul>
      <button onClick={onBegin} disabled={busy} className="font-label pxbegin">
        {busy ? "Starting…" : "Begin"}
      </button>
      {failed && (
        <p className="pxfail">Could not start the assessment. Check your connection and try again.</p>
      )}
    </div>
  );
}

function Unassigned() {
  return (
    <Center>
      <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
        <h1 className="pxh1" style={{ fontSize: "1.5rem", marginBottom: 10 }}>
          You have not been assigned this assessment.
        </h1>
        <p style={{ color: MUTED, lineHeight: 1.6, margin: 0 }}>
          If you were expecting to sit the Paradox Profile, ask whoever invited you to assign it to your account.
        </p>
      </div>
    </Center>
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
        .font-mono{font-family:'JetBrains Mono',ui-monospace,monospace}
        .pxwrap{max-width:760px;margin:0 auto;padding:24px 16px}
        .pxhdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px}
        .pxback{font-size:12px;min-height:44px;text-transform:uppercase;letter-spacing:.07em;
          color:${MUTED};background:none;border:none;cursor:pointer}
        .pxback:disabled{opacity:.3;cursor:default}
        .pxcount{font-size:12px;color:${MUTED}}

        /* Statement: reading text at Archivo 400, centred. The fixed min-height
           stops the scale jumping as statements change length. */
        .pxstmt{font-family:Archivo,ui-sans-serif,system-ui,sans-serif;font-weight:400;
          font-size:1.05rem;line-height:1.5;color:${INK};text-align:center;
          max-width:34em;margin:0 auto 28px;min-height:4.5em;
          display:flex;align-items:center;justify-content:center}

        /* Mobile: five across, so ten points land as two rows. */
        .pxscale{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
        .pxopt{min-height:44px;font-size:15px;padding:0;cursor:pointer;
          transition:background .12s,border-color .12s,color .12s}
        .pxanchors{display:flex;justify-content:space-between;gap:12px;margin-top:12px;
          font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:${MUTED}}
        .pxkbd{display:none}

        .pxintro{max-width:560px;padding-top:56px}
        .pxh1{font-family:Archivo,ui-sans-serif,system-ui,sans-serif;font-weight:800;
          letter-spacing:-0.035em;font-size:1.8rem;color:${INK};margin:0 0 20px}
        .pxlist{list-style:none;padding:0;margin:0 0 32px;color:${BODY};line-height:1.6}
        .pxlist li{padding:10px 0;border-bottom:1px solid ${HAIR}}
        .pxbegin{width:100%;padding:14px;background:${INK};color:${PAPER};font-size:13px;
          letter-spacing:.07em;text-transform:uppercase;border:none;cursor:pointer}
        .pxbegin:disabled{opacity:.6;cursor:default}
        .pxfail{color:${FORZA};font-size:13px;line-height:1.6;margin:14px 0 0}

        @media (min-width:768px){
          .pxwrap{padding:32px 24px}
          .pxhdr{margin-bottom:40px}
          .pxstmt{font-size:1.15rem;margin-bottom:40px;min-height:3.5em}
          .pxscale{grid-template-columns:repeat(10,1fr);gap:10px}
          .pxopt{min-height:52px;font-size:16px}
          .pxanchors{font-size:11px}
          .pxkbd{display:block;text-align:center;margin-top:32px;font-size:12px;color:${MUTED}}
          .pxintro{padding-top:80px}
          .pxh1{font-size:2rem}
          .pxbegin{width:auto;padding:14px 32px}
        }
        button:focus-visible{outline:2px solid ${INK};outline-offset:2px}
        @media (prefers-reduced-motion:reduce){*{transition:none!important}}
      `}</style>
    </div>
  );
}
