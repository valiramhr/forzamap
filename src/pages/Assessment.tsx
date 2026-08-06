import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { PAPER, INK, MUTED, HAIR } from "../lib/ui";
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
  const sizes = [30, 23, 17, 23, 30];

  return (
    <div style={{ minHeight: "100vh", background: PAPER, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ height: 3, background: HAIR }}>
        <div style={{ height: "100%", width: `${pctDone}%`, background: INK, transition: "width .3s ease" }} />
      </div>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
          <button onClick={goBack} disabled={current === 0} className="font-mono"
            style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em", color: MUTED, background: "none", border: "none", cursor: "pointer", opacity: current === 0 ? 0.3 : 1 }}>← Back</button>
          <span className="font-mono" style={{ fontSize: 12, color: MUTED }}>{String(current + 1).padStart(3, "0")} / {total}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 999, overflow: "hidden", background: HAIR }}>
            <div style={{ height: "100%", width: `${timePct}%`, background: timeLeft <= 5 ? "#9C3D54" : INK, transition: "width .25s linear" }} />
          </div>
          <span className="font-mono" style={{ fontSize: 12, width: 32, textAlign: "right", color: timeLeft <= 5 ? "#9C3D54" : MUTED }}>{timeLeft}s</span>
        </div>

        <p className="font-mono" style={{ fontSize: 12, letterSpacing: ".15em", textTransform: "uppercase", color: MUTED, marginBottom: 24, textAlign: "center" }}>Which is more like you?</p>

        <div className="item-flex">
          <Card n="1" text={it.left.s} active={chosen != null && chosen <= 1} />
          <div className="rating-flex">
            <span className="font-mono end-label">most like 1</span>
            {sizes.map((sz, i) => {
              const on = chosen === i;
              return (
                <button key={i} onClick={() => record(i)}
                  aria-label={["most like 1", "more like 1", "neutral", "more like 2", "most like 2"][i]}
                  style={{ width: sz, height: sz, borderRadius: "50%", flexShrink: 0, border: `1.5px solid ${on ? INK : "#CFC9BC"}`, background: on ? INK : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .15s" }}>
                  {on && <span style={{ width: 6, height: 6, borderRadius: "50%", background: PAPER }} />}
                </button>
              );
            })}
            <span className="font-mono end-label">most like 2</span>
          </div>
          <Card n="2" text={it.right.s} active={chosen != null && chosen >= 3} />
        </div>

        <p className="font-mono" style={{ fontSize: 12, marginTop: 32, textAlign: "center", color: MUTED }}>Keys 1–5 to answer · Backspace to go back</p>
      </div>

      <style>{`
        .font-serif{font-family:Georgia,'Times New Roman',serif}
        .font-mono{font-family:ui-monospace,'SF Mono',Menlo,monospace}
        .item-flex{display:flex;flex-direction:column;gap:16px}
        .rating-flex{display:flex;flex-direction:column;align-items:center;justify-content:space-between;
          align-self:center;gap:12px;height:208px}
        .end-label{font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:${MUTED};white-space:nowrap}
        @media (min-width:768px){
          .item-flex{flex-direction:row;align-items:stretch;gap:12px}
          .rating-flex{flex-direction:row;height:auto;width:288px}
        }
        button:focus-visible{outline:2px solid ${INK};outline-offset:2px}
        @media (prefers-reduced-motion:reduce){*{transition:none!important}}
      `}</style>
    </div>
  );
}

function Card({ n, text, active }: { n: string; text: string; active: boolean }) {
  return (
    <div className="item-card" style={{ flex: 1, display: "flex", gap: 12, padding: 20, alignItems: "center", minHeight: "4.5em", border: `1.5px solid ${active ? INK : HAIR}`, background: active ? "#F2EFE8" : PAPER }}>
      <span className="font-mono" style={{ width: 20, height: 20, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", border: `1px solid ${MUTED}`, fontSize: 12, color: MUTED }}>{n}</span>
      <span className="font-serif" style={{ color: INK, fontSize: "1.15rem", lineHeight: 1.3 }}>{text}</span>
    </div>
  );
}
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: PAPER, fontFamily: "monospace", color: MUTED }}>{children}</div>;
}
