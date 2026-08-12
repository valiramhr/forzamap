import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { failureMessage } from "../../lib/edge";
import AdminNav from "./AdminNav";
import { PAPER, INK, MUTED, HAIR, FORZA } from "../../lib/ui";

/* One row per assignment — a candidate sitting two instruments appears twice. */
interface Row {
  id: string;              // assignment id
  candidate_id: string;
  email: string;
  full_name: string | null;
  instrument_slug: string;
  instrument_name: string;
  status: string;
  invited_at: string;
  completed_at: string | null;   // set by the submit trigger; null until then
}
interface Instrument { slug: string; name: string }
/* Row actions report back here rather than inline, so the message survives the
   menu closing and the table re-rendering under it. */
interface Toast { ok: boolean; text: string }

const STATUS: Record<string, { label: string; color: string }> = {
  invited: { label: "Invited", color: "#7A736B" },
  in_progress: { label: "In progress", color: "#B8862F" },
  completed: { label: "Completed", color: "#4F7D6C" },
};
/* Logical progression through the funnel, not alphabetical — drives the Status sort. */
const STATUS_ORDER = ["invited", "in_progress", "completed"];

type SortCol = "candidate" | "status" | "sent" | "completed";
type SortDir = "asc" | "desc";

/* Mobile has no column headers to click, so the same sorts are offered as a select. */
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "sent:desc", label: "Sent — newest first" },
  { value: "sent:asc", label: "Sent — oldest first" },
  { value: "completed:desc", label: "Completed — newest first" },
  { value: "completed:asc", label: "Completed — oldest first" },
  { value: "candidate:asc", label: "Candidate — A to Z" },
  { value: "candidate:desc", label: "Candidate — Z to A" },
  { value: "status:asc", label: "Status — invited first" },
  { value: "status:desc", label: "Status — completed first" },
];

const nameOf = (r: Row) => r.full_name ?? r.email;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/* PostgREST returns a many-to-one embed as an object; tolerate an array too. */
const one = (x: any) => (Array.isArray(x) ? x[0] : x) ?? {};

export default function Candidates() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sortCol, setSortCol] = useState<SortCol>("sent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);   // row with an action in flight
  const [toast, setToast] = useState<Toast | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("assignments")
      .select("id,status,invited_at,completed_at,candidate:candidates!inner(user_id,email,full_name),instrument:instruments!inner(slug,name)")
      .order("invited_at", { ascending: false });
    setRows(((data ?? []) as any[]).map((a) => {
      const c = one(a.candidate), i = one(a.instrument);
      return {
        id: a.id, status: a.status, invited_at: a.invited_at, completed_at: a.completed_at ?? null,
        candidate_id: c.user_id, email: c.email, full_name: c.full_name,
        instrument_slug: i.slug, instrument_name: i.name,
      } as Row;
    }));
  }, []);

  useEffect(() => {
    (async () => {
      const [, { data: inst }] = await Promise.all([
        load(),
        supabase.from("instruments").select("slug,name").eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);
      setInstruments((inst ?? []) as Instrument[]);
      setLoading(false);
    })();
  }, [load]);

  /* Counts come from the full list so the filter labels don't shift as you filter. */
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, invited: 0, in_progress: 0, completed: 0 };
    for (const r of rows) if (STATUS_ORDER.includes(r.status)) c[r.status]++;
    return c;
  }, [rows]);

  /* Built from every row, not the filtered ones, so the "assign another" list
     never offers an instrument the candidate already has but the filter hides. */
  const assignedSlugs = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of rows) {
      let s = m.get(r.candidate_id);
      if (!s) { s = new Set(); m.set(r.candidate_id, s); }
      s.add(r.instrument_slug);
    }
    return m;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = rows.filter((r) =>
      (status === "all" || r.status === status) &&
      (!q || (r.full_name ?? "").toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
    );
    const dir = sortDir === "asc" ? 1 : -1;
    return out.sort((a, b) => {
      if (sortCol === "candidate") return nameOf(a).localeCompare(nameOf(b), "en", { sensitivity: "base" }) * dir;
      if (sortCol === "status") return (STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)) * dir;
      if (sortCol === "completed") {
        /* An unfinished assignment has no date to order by, so those rows
           collect at the bottom whichever way the column is sorted. */
        const at = a.completed_at ? Date.parse(a.completed_at) : null;
        const bt = b.completed_at ? Date.parse(b.completed_at) : null;
        if (at === null || bt === null) return at === bt ? 0 : at === null ? 1 : -1;
        return (at - bt) * dir;
      }
      return (Date.parse(a.invited_at) - Date.parse(b.invited_at)) * dir;
    });
  }, [rows, query, status, sortCol, sortDir]);

  function sortBy(col: SortCol) {
    if (col === sortCol) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    // newest first is the natural default for dates
    else { setSortCol(col); setSortDir(col === "sent" || col === "completed" ? "desc" : "asc"); }
  }
  function clearFilters() { setQuery(""); setStatus("all"); }

  /* Long enough to read a two-line message; a failure stays longer, since it is
     the only place the reason is shown. */
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.ok ? 9000 : 16000);
    return () => window.clearTimeout(t);
  }, [toast]);

  /* Same edge function as the invite page. full_name is passed through because
     admin-invite upserts the candidate row and would otherwise clear it. */
  async function assign(r: Row, slug: string) {
    setAssigning(r.id); setAssignError(null);
    const { data, error } = await supabase.functions.invoke("admin-invite", {
      body: { email: r.email, full_name: r.full_name, instrument_slug: slug },
    });
    const failure = await failureMessage(error, data);
    if (failure) setAssignError(`${r.email} — ${failure}`);
    else await load();
    setAssigning(null);
  }

  /* The same public function the sign-in page calls. It answers 200 whether or
     not the address is known, by design — so a call that came back clean means
     the request was accepted, and this says that rather than claiming the mail
     arrived. */
  async function resend(r: Row) {
    setWorking(r.id); setToast(null);
    try {
      const { data, error } = await supabase.functions.invoke("request-link", { body: { email: r.email } });
      const failure = await failureMessage(error, data);
      setToast(failure
        ? { ok: false, text: `Could not request a link for ${r.email} — ${failure}` }
        : { ok: true, text: `A fresh sign-in link has been sent to ${r.email}. It is single-use and expires, and delivery isn't confirmed here — ask them to check spam if it doesn't arrive.` });
    } catch (e: any) {
      setToast({ ok: false, text: `Could not request a link for ${r.email} — ${String(e?.message ?? e)}` });
    } finally {
      setWorking(null);
    }
  }

  /* Sign-in links are single-use and expire, so there is no durable personal
     URL to hand out. What can be shared is the sign-in page itself. */
  async function copySignIn(r: Row) {
    const url = `${window.location.origin}/login`;
    try {
      if (!navigator.clipboard) throw new Error("the clipboard is unavailable in this browser");
      await navigator.clipboard.writeText(url);
      setToast({ ok: true, text: `Copied ${url} — ${nameOf(r)} enters their email address there and is sent a fresh link. This is the sign-in page, not a personal link.` });
    } catch (e: any) {
      setToast({ ok: false, text: `Could not copy — ${String(e?.message ?? e)}. The sign-in page is ${url}; the candidate enters their email there to be sent a fresh link.` });
    }
  }

  const th = (col: SortCol, label: string) => {
    const active = sortCol === col;
    return (
      <th className="cand-th" aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
        <button onClick={() => sortBy(col)} className="font-label cand-sort" style={{ color: active ? INK : MUTED }}>
          {label}<span className="cand-caret" aria-hidden="true">{active ? (sortDir === "asc" ? "▲" : "▼") : ""}</span>
        </button>
      </th>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: PAPER }}>
      <AdminNav />
      {/* 1120 rather than 1000: with Completed added, the seven columns need
          1006px before anything has to wrap, and a 1000px measure leaves only
          952px between the padding. 1120 is the width the Paradox report
          already uses, and it clears the row with room to spare. */}
      <div className="cand-wrap" style={{ maxWidth: 1120, margin: "0 auto", fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif" }}>
        <h1 className="font-display" style={{ fontSize: "1.8rem", color: INK, marginBottom: 20 }}>Candidates</h1>

        {loading ? <p style={{ color: MUTED }}>Loading…</p> : rows.length === 0 ? (
          <p style={{ color: MUTED }}>No candidates yet. Send an invitation to get started.</p>
        ) : (
          <>
            <div className="cand-controls">
              <input value={query} onChange={(e) => setQuery(e.target.value)} className="cand-search"
                placeholder="Search name or email" aria-label="Search name or email" />
              <div className="cand-filters">
                {([["all", "All"], ["invited", "Invited"], ["in_progress", "In progress"], ["completed", "Completed"]] as const).map(([key, label]) => {
                  const on = status === key;
                  return (
                    <button key={key} onClick={() => setStatus(key)} className="font-label cand-chip" aria-pressed={on}
                      style={{ background: on ? INK : "transparent", color: on ? PAPER : MUTED, border: `1px solid ${on ? INK : HAIR}` }}>
                      {label} ({counts[key]})
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="cand-sortbar">
              <label className="font-label cand-sortlbl" htmlFor="cand-sort-select">Sort</label>
              <select id="cand-sort-select" className="cand-select" value={`${sortCol}:${sortDir}`}
                onChange={(e) => {
                  const [col, dir] = e.target.value.split(":");
                  setSortCol(col as SortCol); setSortDir(dir as SortDir);
                }}>
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {assignError && (
              <p className="cand-count" style={{ color: FORZA, fontSize: 13 }}>Could not assign: {assignError}</p>
            )}

            {visible.length !== rows.length && (
              <p className="cand-count" style={{ color: MUTED, fontSize: 13 }}>
                Showing {visible.length} of {rows.length} assignments
              </p>
            )}

            {visible.length === 0 ? (
              <div style={{ padding: "28px 0" }}>
                <p style={{ color: MUTED, marginBottom: 14 }}>No candidates match your search.</p>
                <button onClick={clearFilters} className="font-label cand-clear">Clear filters</button>
              </div>
            ) : (
              <table className="cand-table">
                <thead className="cand-thead">
                  <tr>
                    {th("candidate", "Candidate")}
                    <th className="cand-th font-label">Assessment</th>
                    {th("status", "Status")}
                    {th("sent", "Sent")}
                    {th("completed", "Completed")}
                    <th className="cand-th font-label">Report</th>
                    <th className="cand-th font-label">Actions</th>
                  </tr>
                </thead>
                <tbody className="cand-tbody">
                  {visible.map((r) => {
                    const st = STATUS[r.status] ?? STATUS.invited;
                    const done = r.status === "completed";
                    const remaining = instruments.filter((i) => !assignedSlugs.get(r.candidate_id)?.has(i.slug));
                    const busy = assigning === r.id || working === r.id;
                    return (
                      <tr key={r.id} className="cand-row">
                        <td className="cand-cell cand-c-name">
                          <div className="font-display" style={{ fontSize: "1.05rem", color: INK }}>{r.full_name || r.email}</div>
                          {r.full_name && <div className="font-mono" style={{ fontSize: 12, color: MUTED }}>{r.email}</div>}
                        </td>
                        <td className="cand-cell" data-label="Assessment" style={{ color: INK, fontSize: 14 }}>{r.instrument_name}</td>
                        <td className="cand-cell" data-label="Status">
                          <span className="font-label cand-status" style={{ color: st.color, background: st.color + "18" }}>{st.label}</span>
                        </td>
                        <td className="cand-cell font-mono" data-label="Sent" style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>
                          {fmtDate(r.invited_at)}
                        </td>
                        <td className="cand-cell font-mono" data-label="Completed" style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>
                          {r.completed_at ? fmtDate(r.completed_at) : "—"}
                        </td>
                        <td className="cand-cell cand-c-report" data-label={done ? undefined : "Report"}>
                          {done
                            ? <button onClick={() => nav(`/admin/assignments/${r.id}`)} className="font-label cand-report">Generate report</button>
                            : <span style={{ color: MUTED }}>—</span>}
                        </td>
                        <td className="cand-cell cand-c-actions">
                          {/* Desktop gets a menu; the stacked card gets the same
                              options as plain buttons, where a popover would be
                              a worse fit than the space it saves. */}
                          <div className="cand-menu-slot">
                            <RowMenu who={nameOf(r)} busy={busy} remaining={remaining}
                              onAssign={(slug) => assign(r, slug)}
                              onResend={() => resend(r)}
                              onCopy={() => copySignIn(r)} />
                          </div>
                          <div className="cand-stack">
                            {remaining.map((i) => (
                              <button key={i.slug} onClick={() => assign(r, i.slug)} disabled={busy}
                                className="font-label cand-stackbtn">Assign {i.name}</button>
                            ))}
                            <button onClick={() => resend(r)} disabled={busy} className="font-label cand-stackbtn">
                              {working === r.id ? "Sending…" : "Resend link"}
                            </button>
                            <button onClick={() => copySignIn(r)} className="font-label cand-stackbtn">
                              Copy sign-in link
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {toast && (
        <div className="cand-toast" role={toast.ok ? "status" : "alert"} aria-live="polite"
          style={{ borderColor: toast.ok ? INK : FORZA }}>
          <span style={{ flex: 1, color: toast.ok ? INK : FORZA }}>{toast.text}</span>
          <button onClick={() => setToast(null)} className="font-label cand-toast-x" aria-label="Dismiss">✕</button>
        </div>
      )}

      <style>{`
        .cand-wrap{padding:24px 16px}
        .cand-controls{display:flex;flex-direction:column;gap:10px;margin-bottom:12px}
        .cand-search{width:100%;padding:12px 14px;border:1px solid ${HAIR};background:#fff;
          font-family:Archivo,ui-sans-serif,system-ui,sans-serif;font-size:15px;box-sizing:border-box}
        .cand-filters{display:flex;flex-wrap:wrap;gap:6px}
        .cand-chip{flex:1 1 auto;padding:8px 10px;font-size:11px;letter-spacing:.07em;
          text-transform:uppercase;cursor:pointer;white-space:nowrap}
        .cand-sortbar{display:flex;align-items:center;gap:10px;margin-bottom:12px}
        .cand-sortlbl{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:${MUTED}}
        .cand-select{flex:1;padding:10px 12px;border:1px solid ${HAIR};background:#fff;
          font-family:Archivo,ui-sans-serif,system-ui,sans-serif;font-size:14px;color:${INK}}
        .cand-count{margin:0 0 14px}
        .cand-clear{padding:8px 14px;font-size:11px;letter-spacing:.07em;text-transform:uppercase;
          background:none;color:${FORZA};border:1px solid ${FORZA};cursor:pointer}

        /* Mobile: the columns become a stacked card per assignment. */
        .cand-table{display:block;width:100%}
        .cand-thead{display:none}
        .cand-tbody{display:grid;gap:12px}
        .cand-row{display:block;border:1px solid ${HAIR};padding:14px 16px;background:${PAPER}}
        .cand-cell{display:block}
        /* An email is one unbreakable word, and a long one sets a floor under
           the whole column: with seven columns to place, a 50-character address
           is enough to push the table past even the widened measure. Letting it
           break keeps the table inside the column whatever the address. */
        .cand-c-name{margin-bottom:8px;overflow-wrap:anywhere}
        .cand-cell[data-label]{display:flex;align-items:baseline;justify-content:space-between;
          gap:12px;padding:5px 0}
        .cand-cell[data-label]::before{content:attr(data-label);
          font-family:Archivo,ui-sans-serif,system-ui,sans-serif;font-weight:500;font-size:11px;
          letter-spacing:.07em;text-transform:uppercase;color:${MUTED}}
        .cand-c-report{margin-top:8px}
        .cand-c-report .cand-report{width:100%}

        .cand-status{display:inline-block;font-size:11px;text-transform:uppercase;
          letter-spacing:.07em;padding:3px 8px;border-radius:4px}
        .cand-report{padding:8px 14px;font-size:11px;letter-spacing:.07em;text-transform:uppercase;
          background:${INK};color:${PAPER};border:none;cursor:pointer}

        /* Mobile: the menu's options, laid out as buttons on the card. */
        .cand-menu-slot{display:none}
        .cand-stack{display:grid;gap:6px;margin-top:10px}
        .cand-stackbtn{padding:9px 12px;font-size:11px;letter-spacing:.07em;text-transform:uppercase;
          background:none;color:${INK};border:1px solid ${HAIR};cursor:pointer;text-align:center}
        .cand-stackbtn:disabled{opacity:.5;cursor:default}
        .cand-dots{width:36px;height:36px;padding:0;background:none;border:1px solid ${HAIR};
          color:${INK};font-size:18px;line-height:1;cursor:pointer}
        .cand-dots:disabled{opacity:.5;cursor:default}
        .cand-dots-busy{font-size:12px;color:${MUTED}}
        .cand-menu{position:fixed;z-index:60;background:#fff;border:1px solid ${HAIR};
          box-shadow:0 8px 24px rgba(42,37,31,.14);padding:4px 0;text-align:left}
        .cand-mi{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;
          padding:10px 14px;background:none;border:none;cursor:pointer;text-align:left;
          font-family:Archivo,ui-sans-serif,system-ui,sans-serif;font-size:13px;color:${INK}}
        .cand-mi:hover:not(:disabled){background:${PAPER}}
        .cand-mi:disabled{color:${MUTED};cursor:default}
        .cand-mi-more{color:${MUTED}}
        .cand-mi-back{color:${MUTED};font-size:12px}
        .cand-mi-note{margin:0;padding:6px 14px;font-family:Archivo,ui-sans-serif,system-ui,sans-serif;
          font-weight:500;font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:${MUTED}}

        .cand-toast{position:fixed;left:16px;right:16px;bottom:16px;z-index:70;display:flex;
          align-items:flex-start;gap:12px;background:#fff;border:1px solid ${HAIR};border-left-width:3px;
          padding:14px 16px;box-shadow:0 8px 24px rgba(42,37,31,.14);
          font-family:Archivo,ui-sans-serif,system-ui,sans-serif;font-size:13px;line-height:1.55}
        .cand-toast-x{background:none;border:none;padding:0;color:${MUTED};font-size:12px;cursor:pointer}
        .cand-sort{display:inline-flex;align-items:center;gap:6px;padding:0;background:none;
          border:none;cursor:pointer;font-size:11px;letter-spacing:.07em;text-transform:uppercase}
        .cand-caret{font-size:9px;line-height:1}

        @media (min-width:768px){
          .cand-wrap{padding:40px 24px}
          .cand-controls{flex-direction:row;align-items:center;justify-content:space-between;gap:16px}
          .cand-search{flex:1;max-width:320px}
          .cand-filters{flex-wrap:nowrap}
          .cand-chip{flex:0 0 auto}
          .cand-sortbar{display:none}       /* column headers take over */
          .cand-table{display:table;border-collapse:collapse;table-layout:auto}
          .cand-thead{display:table-header-group}
          .cand-tbody{display:table-row-group}
          .cand-row{display:table-row;border:none;padding:0}
          .cand-cell,.cand-cell[data-label]{display:table-cell;vertical-align:middle;
            padding:14px 12px;border-bottom:1px solid ${HAIR}}
          .cand-cell[data-label]::before{display:none}
          .cand-cell:first-child{padding-left:0}
          .cand-cell:last-child{padding-right:0;text-align:right}
          .cand-c-name{margin-bottom:0}
          .cand-c-report{margin-top:0}
          .cand-c-report .cand-report{width:auto}
          .cand-c-actions{width:1%;white-space:nowrap}
          .cand-menu-slot{display:block}
          .cand-stack{display:none}
          .cand-toast{left:auto;right:24px;bottom:24px;max-width:440px}
          .cand-th{text-align:left;padding:0 12px 8px;border-bottom:1px solid ${HAIR};
            font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:${MUTED};
            white-space:nowrap}
          .cand-th:first-child{padding-left:0}
          .cand-th:last-child{padding-right:0;text-align:right}
        }
        button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid ${INK};outline-offset:2px}
      `}</style>
    </div>
  );
}

/* The row menu.

   The popover is positioned fixed from the button's rect rather than absolutely
   inside the cell: a table cell is an unreliable containing block, and anything
   drawn inside the last row would otherwise be cut off by the table's own box.
   Fixed placement also means the menu can flip above the button near the foot of
   the window. It closes on an outside click, on Escape, and on a scroll — once
   the page has moved under it, a menu pinned to a viewport coordinate no longer
   belongs to any row. */
const MENU_W = 260;

function RowMenu({ who, busy, remaining, onAssign, onResend, onCopy }: {
  who: string;
  busy: boolean;
  remaining: Instrument[];
  onAssign: (slug: string) => void;
  onResend: () => void;
  onCopy: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"root" | "assign">("root");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement | null>(null);
  const pop = useRef<HTMLDivElement | null>(null);

  const close = useCallback((focus: boolean) => {
    setOpen(false); setPanel("root");
    if (focus) btn.current?.focus();
  }, []);

  // measured after the panel renders, so a flip uses the real height
  useLayoutEffect(() => {
    if (!open) return;
    const b = btn.current?.getBoundingClientRect();
    if (!b) return;
    const h = pop.current?.offsetHeight ?? 0;
    const below = window.innerHeight - b.bottom;
    const top = h > 0 && below < h + 16 && b.top > h + 16 ? b.top - h - 6 : b.bottom + 6;
    const left = Math.max(12, Math.min(b.right - MENU_W, window.innerWidth - MENU_W - 12));
    setPos({ top, left });
  }, [open, panel]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) close(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(true); } };
    const onMove = () => close(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, close]);

  const items = () =>
    Array.from(pop.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? []);

  // opening, and moving between panels, lands focus on the first item
  useEffect(() => { if (open) items()[0]?.focus(); }, [open, panel]);

  function onKeyDown(e: React.KeyboardEvent) {
    const list = items();
    if (list.length === 0) return;
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") { e.preventDefault(); list[(i + 1) % list.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
    else if (e.key === "Home") { e.preventDefault(); list[0].focus(); }
    else if (e.key === "End") { e.preventDefault(); list[list.length - 1].focus(); }
  }

  const run = (fn: () => void) => { close(false); fn(); };

  return (
    <>
      <button ref={btn} onClick={() => (open ? close(false) : setOpen(true))} disabled={busy}
        className="cand-dots" aria-haspopup="menu" aria-expanded={open}
        aria-label={`Actions for ${who}`}>
        {busy ? <span className="font-mono cand-dots-busy">···</span> : <span aria-hidden="true">⋮</span>}
      </button>

      {open && (
        <div ref={pop} role="menu" aria-label={`Actions for ${who}`} onKeyDown={onKeyDown}
          className="cand-menu" style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: MENU_W,
            visibility: pos ? "visible" : "hidden" }}>
          {panel === "root" ? (
            <>
              <button role="menuitem" className="cand-mi" disabled={remaining.length === 0}
                onClick={() => setPanel("assign")}>
                <span>Assign another assessment</span>
                <span className="cand-mi-more" aria-hidden="true">›</span>
              </button>
              {remaining.length === 0 && (
                <p className="cand-mi-note">Every active assessment is already assigned.</p>
              )}
              <button role="menuitem" className="cand-mi" onClick={() => run(onResend)}>Resend link</button>
              <button role="menuitem" className="cand-mi" onClick={() => run(onCopy)}>Copy sign-in link</button>
            </>
          ) : (
            <>
              <button role="menuitem" className="cand-mi cand-mi-back" onClick={() => setPanel("root")}>
                <span aria-hidden="true">‹ </span>Back
              </button>
              <p className="cand-mi-note">Assign another assessment</p>
              {remaining.map((i) => (
                <button key={i.slug} role="menuitem" className="cand-mi" onClick={() => run(() => onAssign(i.slug))}>
                  {i.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}
