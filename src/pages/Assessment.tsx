import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { PAPER, INK, MUTED, HAIR, BODY, FORZA } from "../lib/ui";
import { findAssignment, STRENGTHS_SLUG } from "../lib/assignments";
import {
  buildItems, score, DOMAINS, TIME_LIMIT,
  type Item, type Answers,
} from "../lib/instrument";

const RATING_LABELS = ["most like 1", "more like 1", "neutral", "more like 2", "most like 2"];
const RATING_SIZES = [38, 30, 22, 30, 38];

type Phase = "loading" | "unassigned" | "intro" | "running";

export default function Assessment() {
  const { session } = useAuth();
  const nav = useNavigate();
  const uid = session!.user.id;

  const [phase, setPhase] = useState<Phase>("loading");
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);

  // resume an in-progress attempt, scoped to this candidate's Strengths Profile
  // assignment. Nothing is written on mount: the row is created by begin(), so
  // reading the intro and leaving does not mark the assignment in_progress.
  useEffect(() => {
    (async () => {
      const aid = await findAssignment(uid, STRENGTHS_SLUG);
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

  function record(pos: number) {
    if (lock.current || !items) return;
    lock.current = true;
    const id = items[current].id;
    const next = { ...answers, [id]: pos };
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
    const result = score(items, finalAnswers);
    await supabase.from("assessments")
      .update({ answers: finalAnswers, result, status: "submitted" })
      .eq("id", rowId);
    nav("/result", { replace: true });
  }

  // timer — only once the assessment is actually under way. On the intro the
  // first item is on screen inside the sample, and a countdown there would
  // answer it for someone who is still reading.
  useEffect(() => {
    if (phase !== "running" || !items || submitting) return;
    setTimeLeft(TIME_LIMIT);
    const t0 = Date.now();
    const iv = setInterval(() => {
      const rem = TIME_LIMIT - Math.floor((Date.now() - t0) / 1000);
      setTimeLeft(rem > 0 ? rem : 0);
      if (rem <= 0) { clearInterval(iv); record(2); }
    }, 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, items, phase, submitting]);

  // keyboard
  useEffect(() => {
    if (phase !== "running" || !items) return;
    const onKey = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 5) record(n - 1);
      else if (e.key === "Backspace") { e.preventDefault(); goBack(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, items, phase]);

  const domainEntries = useMemo(() => Object.entries(DOMAINS), []);

  if (phase === "unassigned") return <Shell><Unassigned /></Shell>;
  if (!items) return <Shell><Center>Preparing your assessment…</Center></Shell>;
  if (submitting) return <Shell><Center>Scoring your responses…</Center></Shell>;
  if (phase === "intro") {
    return (
      <Shell>
        <Intro total={total} domains={domainEntries} busy={starting} failed={startError} onBegin={begin} />
      </Shell>
    );
  }

  const it = items[current];
  const chosen = answers[it.id];
  const pctDone = (current / total) * 100;

  return (
    <Shell>
      <div style={{ height: 3, background: HAIR }}>
        <div style={{ height: "100%", width: `${pctDone}%`, background: INK, transition: "width .3s ease" }} />
      </div>
      <div className="wrap" style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="hdr-row" style={{ display: "flex", justifyContent: "space-between" }}>
          <button onClick={goBack} disabled={current === 0} className="font-label"
            style={{ fontSize: 12, minHeight: 44, textTransform: "uppercase", letterSpacing: ".07em", color: MUTED, background: "none", border: "none", cursor: "pointer", opacity: current === 0 ? 0.3 : 1 }}>← Back</button>
          <span className="font-mono" style={{ fontSize: 12, color: MUTED }}>{String(current + 1).padStart(3, "0")} / {total}</span>
        </div>

        <TimerBar secondsLeft={timeLeft} />

        <p className="font-label prompt">Which is more like you?</p>

        <ItemBoard left={it.left.s} right={it.right.s} chosen={chosen} onPick={record} />

        <p className="font-label kbd-hint" style={{ fontSize: 12, marginTop: 32, textAlign: "center", color: MUTED }}>Keys 1–5 to answer · Backspace to go back</p>
      </div>
    </Shell>
  );
}

/* ── the item, as one component ───────────────────────────────────────────
   Used by the live assessment and by the sample on the intro, so what a
   candidate practises on cannot drift away from what they then sit. */
function ItemBoard({ left, right, chosen, onPick }: {
  left: string; right: string; chosen: number | undefined; onPick: (pos: number) => void;
}) {
  return (
    <div className="item-grid">
      <Card n="1" text={left} active={chosen != null && chosen <= 1} />
      <div className="rating">
        <div className="rating-track">
          {RATING_SIZES.map((sz, i) => {
            const on = chosen === i;
            return (
              <button key={i} onClick={() => onPick(i)} aria-label={RATING_LABELS[i]} className="opt">
                <span className="opt-dot" style={{ width: sz, height: sz,
                  border: `1.5px solid ${on ? INK : "#C4BDB1"}`,
                  background: on ? INK : "transparent" }}>
                  {on && <span className="opt-fill" />}
                </span>
                <span className="opt-label font-label">{RATING_LABELS[i]}</span>
              </button>
            );
          })}
        </div>
        <div className="rating-labels font-label">
          <span>most like 1</span><span>neutral</span><span>most like 2</span>
        </div>
      </div>
      <Card n="2" text={right} active={chosen != null && chosen >= 3} />
    </div>
  );
}

/* frozen: the same bar, not counting down — for the sample, where a running
   clock would hurry someone who is still reading the instructions. */
function TimerBar({ secondsLeft, frozen = false }: { secondsLeft: number; frozen?: boolean }) {
  const low = !frozen && secondsLeft <= 5;
  return (
    <div className="timer-row">
      <div className="timer-track">
        <div style={{ height: "100%", width: `${(secondsLeft / TIME_LIMIT) * 100}%`,
          background: low ? FORZA : INK, transition: frozen ? "none" : "width .25s linear" }} />
      </div>
      <span className="font-mono timer-num" style={{ color: low ? FORZA : MUTED }}>{secondsLeft}s</span>
    </div>
  );
}

/* Not from the item bank — a candidate who met one of these again in the real
   assessment might think their practice answer had carried over. */
const SAMPLE = {
  left: "I like to know how an evening will run before it starts",
  right: "I like an evening to unfold however it turns out",
};
const SAMPLE_MEANING = [
  "recorded as strongly the first statement",
  "recorded as leaning towards the first statement",
  "recorded as neutral — neither one more than the other. This is also what is recorded if the 20 seconds run out",
  "recorded as leaning towards the second statement",
  "recorded as strongly the second statement",
];

function Sample() {
  const [pick, setPick] = useState<number | undefined>(undefined);
  return (
    <section className="sample" aria-labelledby="sample-heading">
      <div className="sample-head">
        <h2 id="sample-heading" className="font-display sample-h">Try a sample question</h2>
        <span className="font-label sample-badge">Sample — this answer is not recorded</span>
      </div>
      <p className="sample-note">
        This is the real question layout, with a question that is not part of the
        assessment. Pick any point on the scale to see how it responds.
      </p>

      <TimerBar secondsLeft={TIME_LIMIT} frozen />
      <p className="sample-note">
        In the assessment this bar empties over {TIME_LIMIT} seconds. If it reaches zero
        the neutral midpoint is recorded for you and the next item appears. It is
        frozen here — nothing is timing you on this page.
      </p>

      <p className="font-label prompt sample-prompt">Which is more like you?</p>
      <ItemBoard left={SAMPLE.left} right={SAMPLE.right} chosen={pick} onPick={setPick} />

      <p className="sample-result" role="status">
        {pick == null
          ? "Choose one of the five points above."
          : `In the assessment that would be ${SAMPLE_MEANING[pick]}, and you would move straight on to the next item. Nothing has been saved — this is a sample.`}
      </p>
    </section>
  );
}

function Intro({ total, domains, busy, failed, onBegin }: {
  total: number;
  domains: [string, { label: string; color: string; note: string }][];
  busy: boolean;
  failed: boolean;
  onBegin: () => void;
}) {
  return (
    <div className="wrap intro">
      <p className="font-label intro-eyebrow">Strengths Profile</p>
      <h1 className="font-display intro-h1">Two statements at a time. Pick the one that is more like you.</h1>

      <ul className="intro-list">
        <li><strong>{total} items, about 15 minutes.</strong> One item per screen.</li>
        <li><strong>Each item shows two statements.</strong> Choose which is more like you,
          and how strongly — from most like the first, through neutral, to most like the second.</li>
        <li><strong>You have {TIME_LIMIT} seconds per item.</strong> If the time runs out, the
          neutral midpoint is recorded for you and the assessment moves on.</li>
        <li><strong>There are no right answers.</strong> Your first instinct is the best one.</li>
        <li><strong>Your progress is saved.</strong> If you are interrupted, come back to this
          page and you will pick up where you left off.</li>
      </ul>

      <Sample />

      <h2 className="font-label intro-sub">What it measures</h2>
      <div className="intro-domains">
        {domains.map(([key, d]) => (
          <div key={key} className="intro-domain" style={{ borderTop: `3px solid ${d.color}` }}>
            <div className="font-label intro-domain-label" style={{ color: d.color }}>{d.label}</div>
            <div className="intro-domain-note">{d.note}</div>
          </div>
        ))}
      </div>

      <button onClick={onBegin} disabled={busy} className="font-label intro-begin">
        {busy ? "Starting…" : failed ? "Try again" : "Begin"}
      </button>
      {failed && (
        <p className="intro-fail" role="alert">
          Could not start the assessment. Check your connection and try again —
          nothing has been recorded, so you will start from the first item.
        </p>
      )}
    </div>
  );
}

function Card({ n, text, active }: { n: string; text: string; active: boolean }) {
  return (
    <div className="item-card" style={{ flex: 1, minWidth: 0, display: "flex", gap: 12, alignItems: "center", border: `1.5px solid ${active ? INK : HAIR}`, background: active ? "#E4E0D7" : PAPER }}>
      <span className="font-mono" style={{ width: 20, height: 20, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", border: `1px solid ${MUTED}`, fontSize: 12, color: MUTED }}>{n}</span>
      <span className="font-serif stmt" style={{ color: INK, lineHeight: 1.3 }}>{text}</span>
    </div>
  );
}
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: MUTED }}>{children}</div>;
}
function Unassigned() {
  return (
    <Center>
      <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
        <h1 className="font-display" style={{ fontSize: "1.5rem", color: INK, margin: "0 0 10px" }}>
          You have not been assigned this assessment.
        </h1>
        <p style={{ color: MUTED, lineHeight: 1.6, margin: 0 }}>
          If you were expecting to sit the Strengths Profile, ask whoever invited you to assign it to your account.
        </p>
      </div>
    </Center>
  );
}

/* The intro and the assessment share one stylesheet — the sample is built from
   the same components as the live item and has to be styled by the same rules. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: PAPER, fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif" }}>
      {children}
      <style>{`
        .font-serif{font-family:Archivo,ui-sans-serif,system-ui,sans-serif;font-weight:800;letter-spacing:-0.035em}
        .font-display{font-family:Archivo,ui-sans-serif,system-ui,sans-serif;font-weight:800;letter-spacing:-0.035em}
        .font-label{font-family:Archivo,ui-sans-serif,system-ui,sans-serif;font-weight:500;letter-spacing:.07em}
        .font-mono{font-family:'JetBrains Mono',ui-monospace,monospace}
        .wrap{padding:24px 16px}
        .hdr-row{margin-bottom:16px}
        .timer-row{display:flex;align-items:center;gap:12px;margin-bottom:20px}
        .timer-track{flex:1;height:4px;border-radius:999px;overflow:hidden;background:${HAIR}}
        .timer-num{font-size:12px;width:32px;text-align:right}
        .prompt{margin-bottom:16px;font-size:12px;letter-spacing:.15em;text-transform:uppercase;
          color:${MUTED};text-align:center}
        .item-grid{display:flex;flex-direction:column;gap:14px}
        .rating{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%}
        .rating-track{display:flex;flex-direction:column;align-items:stretch;gap:6px;width:100%}
        .opt{display:flex;align-items:center;gap:12px;min-height:48px;width:100%;
          padding:0 12px;background:none;border:none;cursor:pointer;text-align:left}
        .opt-dot{display:flex;align-items:center;justify-content:center;
          border-radius:50%;flex-shrink:0;transition:all .15s}
        .opt-fill{width:6px;height:6px;border-radius:50%;background:${PAPER}}
        .opt-label{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:${MUTED}}
        .rating-labels{display:none;font-size:10px;letter-spacing:.07em;
          text-transform:uppercase;color:${MUTED}}
        .kbd-hint{display:none}
        .item-card{min-height:3.5em;padding:16px}
        .stmt{font-size:1.05rem;font-weight:500;letter-spacing:0}

        /* ── intro ── the measure is set by the sample, which carries the real
           item side by side; the prose blocks are held to a reading width. */
        .intro{max-width:860px;margin:0 auto;padding-top:40px}
        .intro-eyebrow{font-size:12px;letter-spacing:.15em;text-transform:uppercase;
          color:${MUTED};margin:0 0 10px}
        .intro-h1{font-size:1.8rem;color:${INK};margin:0 0 20px;line-height:1.15;max-width:18em}
        .intro-list{list-style:none;padding:0;margin:0 0 32px;color:${BODY};line-height:1.6;max-width:36em}
        .intro-list li{padding:10px 0;border-bottom:1px solid ${HAIR}}
        .intro-list strong{color:${INK};font-weight:600}
        .intro-sub{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:${MUTED};
          margin:32px 0 12px}
        .intro-domains{display:grid;grid-template-columns:1fr;gap:10px}
        .intro-domain{background:#fff;border:1px solid ${HAIR};padding:14px 16px}
        .intro-domain-label{font-size:11px;letter-spacing:.07em;text-transform:uppercase;
          margin-bottom:4px}
        .intro-domain-note{color:${BODY};font-size:14px;line-height:1.5}
        .intro-begin{width:100%;margin-top:32px;padding:14px;background:${INK};color:${PAPER};
          font-size:13px;letter-spacing:.07em;text-transform:uppercase;border:none;cursor:pointer}
        .intro-begin:disabled{opacity:.6;cursor:default}
        .intro-fail{color:${FORZA};font-size:13px;line-height:1.6;margin:14px 0 0;max-width:36em}

        /* ── sample ── deliberately unlike the assessment itself: dashed rule,
           tinted panel, and a badge that stays put while it is answered. */
        .sample{border:2px dashed ${FORZA};background:rgba(201,100,66,.06);
          padding:18px 16px;margin:0 0 8px}
        .sample-head{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:10px}
        .sample-h{font-size:1.15rem;color:${INK};margin:0}
        .sample-badge{font-size:10px;letter-spacing:.07em;text-transform:uppercase;
          background:${FORZA};color:${PAPER};padding:4px 8px}
        .sample-note{color:${BODY};font-size:13px;line-height:1.55;margin:0 0 14px}
        .sample-prompt{margin-top:4px}
        .sample-result{color:${INK};font-size:13px;line-height:1.55;margin:16px 0 0;
          padding-top:12px;border-top:1px dashed ${FORZA}}

        @media (min-width:768px){
          .wrap{padding:32px 24px}
          .hdr-row{margin-bottom:24px}
          .timer-row{margin-bottom:32px}
          .prompt{margin-bottom:24px}
          .item-grid{flex-direction:row;align-items:center;gap:24px}
          .rating{flex:0 0 280px;width:auto}
          .rating-track{flex-direction:row;justify-content:space-between;align-items:center;gap:0}
          .opt{flex-direction:column;min-height:0;width:auto;padding:0}
          .opt-label{display:none}
          .rating-labels{display:flex;justify-content:space-between;width:100%}
          .kbd-hint{display:block}
          .item-card{min-height:6em;padding:20px}
          .stmt{font-size:1.15rem}
          .intro{padding-top:64px}
          .intro-h1{font-size:2rem}
          .intro-domains{grid-template-columns:1fr 1fr}
          .intro-begin{width:auto;padding:14px 32px}
          .sample{padding:24px}
          /* a little narrower than the live rating column, to leave the two
             statement cards a width close to the one they have in the item */
          .sample .rating{flex:0 0 240px}
          .sample .sample-note{max-width:52em}
        }
        button:focus-visible{outline:2px solid ${INK};outline-offset:2px}
        @media (prefers-reduced-motion:reduce){*{transition:none!important}}
      `}</style>
    </div>
  );
}
