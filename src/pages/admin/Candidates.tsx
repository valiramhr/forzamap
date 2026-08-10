import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
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
}
interface Instrument { slug: string; name: string }

const STATUS: Record<string, { label: string; color: string }> = {
  invited: { label: "Invited", color: "#7A736B" },
  in_progress: { label: "In progress", color: "#B8862F" },
  completed: { label: "Completed", color: "#4F7D6C" },
};
/* Logical progression through the funnel, not alphabetical — drives the Status sort. */
const STATUS_ORDER = ["invited", "in_progress", "completed"];

type SortCol = "candidate" | "status" | "sent";
type SortDir = "asc" | "desc";

/* Mobile has no column headers to click, so the same sorts are offered as a select. */
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "sent:desc", label: "Sent — newest first" },
  { value: "sent:asc", label: "Sent — oldest first" },
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

  const load = useCallback(async () => {
    const { data } = await supabase.from("assignments")
      .select("id,status,invited_at,candidate:candidates!inner(user_id,email,full_name),instrument:instruments!inner(slug,name)")
      .order("invited_at", { ascending: false });
    setRows(((data ?? []) as any[]).map((a) => {
      const c = one(a.candidate), i = one(a.instrument);
      return {
        id: a.id, status: a.status, invited_at: a.invited_at,
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
      return (Date.parse(a.invited_at) - Date.parse(b.invited_at)) * dir;
    });
  }, [rows, query, status, sortCol, sortDir]);

  function sortBy(col: SortCol) {
    if (col === sortCol) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir(col === "sent" ? "desc" : "asc"); } // newest first is the natural default for dates
  }
  function clearFilters() { setQuery(""); setStatus("all"); }

  /* Same edge function as the invite page. full_name is passed through because
     admin-invite upserts the candidate row and would otherwise clear it. */
  async function assign(r: Row, slug: string) {
    setAssigning(r.id); setAssignError(null);
    const { data, error } = await supabase.functions.invoke("admin-invite", {
      body: { email: r.email, full_name: r.full_name, instrument_slug: slug },
    });
    const failure = error?.message ?? (data as any)?.error;
    if (failure) setAssignError(`${r.email} — ${failure}`);
    else await load();
    setAssigning(null);
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
      <div className="cand-wrap" style={{ maxWidth: 1000, margin: "0 auto", fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif" }}>
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
                    <th className="cand-th font-label">Report</th>
                    <th className="cand-th font-label">Assign</th>
                  </tr>
                </thead>
                <tbody className="cand-tbody">
                  {visible.map((r) => {
                    const st = STATUS[r.status] ?? STATUS.invited;
                    const done = r.status === "completed";
                    const remaining = instruments.filter((i) => !assignedSlugs.get(r.candidate_id)?.has(i.slug));
                    const busy = assigning === r.id;
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
                        <td className="cand-cell cand-c-report" data-label={done ? undefined : "Report"}>
                          {done
                            ? <button onClick={() => nav(`/admin/assignments/${r.id}`)} className="font-label cand-report">Generate report</button>
                            : <span style={{ color: MUTED }}>—</span>}
                        </td>
                        <td className="cand-cell cand-c-assign" data-label="Assign">
                          {remaining.length === 0
                            ? <span style={{ color: MUTED }}>—</span>
                            : (
                              <select className="cand-assign" value="" disabled={busy}
                                aria-label={`Assign another assessment to ${nameOf(r)}`}
                                onChange={(e) => { if (e.target.value) assign(r, e.target.value); }}>
                                <option value="">{busy ? "Sending…" : "Assign another…"}</option>
                                {remaining.map((i) => <option key={i.slug} value={i.slug}>{i.name}</option>)}
                              </select>
                            )}
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
        .cand-c-name{margin-bottom:8px}
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
        .cand-assign{max-width:190px;padding:7px 8px;border:1px solid ${HAIR};background:#fff;
          font-family:Archivo,ui-sans-serif,system-ui,sans-serif;font-size:12px;color:${INK};cursor:pointer}
        .cand-assign:disabled{opacity:.6;cursor:default}
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
