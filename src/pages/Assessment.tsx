import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { PAPER, INK, MUTED, HAIR, FORZA } from "../lib/ui";
import {
  buildItems, score, DOMAINS, TIME_LIMIT,
  type Item, type Answers,
} from "../lib/instrument";

export default function Assessment() {
  const { session } = useAuth();
  const nav = useNavigate();
  const uid = session!.user.id;

  const [rowId, setRowId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);

  // load an in-progress attempt or create a new one
  useEffect(() => {
    (async () => {
      const { data: existing } = await supabase
        .from("assessments").select("*").eq("candidate_id", uid)
        .order("started_at", { ascending: false }).limit(1).maybeSingle();

      if (existing?.status === "submitted") { nav("/result", { replace: true }); return; }
      if (existing?.status === "in_progress") {
        setRowId(existing.id);
        setItems(existing.items as Item[]);
        setAnswers((existing.answers ?? {}) as Answers);
        setCurrent(Object.keys(existing.answers ?? {}).length);
        return;
      }
      const fresh = buildItems();
      const { data, error } = await supabase.from("assessments")
        .insert({ candidate_id: uid, items: fresh, answers: {}, status: "in_progress" })
        .select("id").single();
      if (error) { console.error(error); return; }
      setRowId(data.id); setItems(fresh);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // timer
  useEffect(() => {
    if (!items || submitting) return;
    setTimeLeft(TIME_LIMIT);
    const t0 = Date.now();
    const iv = setInterval(() => {
      const rem = TIME_LIMIT - Math.floor((Date.now() - t0) / 1000);
      setTimeLeft(rem > 0 ? rem : 0);
      if (rem <= 0) { clearInterval(iv); record(2); }
    }, 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, items, submitting]);

  // keyboard
  useEffect(() => {
    if (!items) return;
    const onKey = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 5) record(n - 1);
      else if (e.key === "Backspace") { e.preventDefault(); goBack(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, items]);

  const domainEntries = useMemo(() => Object.entries(DOMAINS), []);

  if (!items) return <Center>Preparing your assessment…</Center>;
  if (submitting) return <Center>Scoring your responses…</Center>;

  const it = items[current];
  const chosen = answers[it.id];
  const pctDone = (current / total) * 100;
  const timePct = (timeLeft / TIME_LIMIT) * 100;
  const sizes = [38, 30, 22, 30, 38];

  return (
    <div style={{ minHeight: "100vh", background: PAPER, fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ height: 3, background: HAIR }}>
        <div style={{ height: "100%", width: `${pctDone}%`, background: INK, transition: "width .3s ease" }} />
      </div>
      <div className="wrap" style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="hdr-row" style={{ display: "flex", justifyContent: "space-between" }}>
          <button onClick={goBack} disabled={current === 0} className="font-label"
            style={{ fontSize: 12, minHeight: 44, textTransform: "uppercase", letterSpacing: ".07em", color: MUTED, background: "none", border: "none", cursor: "pointer", opacity: current === 0 ? 0.3 : 1 }}>← Back</button>
          <span className="font-mono" style={{ fontSize: 12, color: MUTED }}>{String(current + 1).padStart(3, "0")} / {total}</span>
        </div>

        <div className="timer-row" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 999, overflow: "hidden", background: HAIR }}>
            <div style={{ height: "100%", width: `${timePct}%`, background: timeLeft <= 5 ? FORZA : INK, transition: "width .25s linear" }} />
          </div>
          <span className="font-mono" style={{ fontSize: 12, width: 32, textAlign: "right", color: timeLeft <= 5 ? FORZA : MUTED }}>{timeLeft}s</span>
        </div>

        <p className="font-label prompt" style={{ fontSize: 12, letterSpacing: ".15em", textTransform: "uppercase", color: MUTED, textAlign: "center" }}>Which is more like you?</p>

        <div className="item-grid">
          <Card n="1" text={it.left.s} active={chosen != null && chosen <= 1} />
          <div className="rating">
            <div className="rating-track">
              {sizes.map((sz, i) => {
                const on = chosen === i;
                const labels = ["most like 1", "more like 1", "neutral", "more like 2", "most like 2"];
                return (
                  <button key={i} onClick={() => record(i)} aria-label={labels[i]}
                    className="opt">
                    <span className="opt-dot" style={{ width: sz, height: sz,
                      border: `1.5px solid ${on ? INK : "#C4BDB1"}`,
                      background: on ? INK : "transparent" }}>
                      {on && <span className="opt-fill" />}
                    </span>
                    <span className="opt-label font-label">{labels[i]}</span>
                  </button>
                );
              })}
            </div>
            <div className="rating-labels font-label">
              <span>most like 1</span><span>neutral</span><span>most like 2</span>
            </div>
          </div>
          <Card n="2" text={it.right.s} active={chosen != null && chosen >= 3} />
        </div>

        <p className="font-label kbd-hint" style={{ fontSize: 12, marginTop: 32, textAlign: "center", color: MUTED }}>Keys 1–5 to answer · Backspace to go back</p>
      </div>

      <style>{`
        .font-serif{font-family:Archivo,ui-sans-serif,system-ui,sans-serif;font-weight:800;letter-spacing:-0.035em}
        .font-display{font-family:Archivo,ui-sans-serif,system-ui,sans-serif;font-weight:800;letter-spacing:-0.035em}
        .font-label{font-family:Archivo,ui-sans-serif,system-ui,sans-serif;font-weight:500;letter-spacing:.07em}
        .font-mono{font-family:'JetBrains Mono',ui-monospace,monospace}
        .wrap{padding:24px 16px}
        .hdr-row{margin-bottom:16px}
        .timer-row{margin-bottom:20px}
        .prompt{margin-bottom:16px}
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
        }
        button:focus-visible{outline:2px solid ${INK};outline-offset:2px}
        @media (prefers-reduced-motion:reduce){*{transition:none!important}}
      `}</style>
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
  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: PAPER, fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif", color: MUTED }}>{children}</div>;
}
