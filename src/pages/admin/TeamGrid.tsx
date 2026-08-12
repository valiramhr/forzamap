import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import AdminNav from "./AdminNav";
import { STRENGTHS_SLUG } from "../../lib/assignments";
import { DOMAINS, THEMES, score } from "../../lib/instrument";
import type { DomainKey, ThemeKey, Item, Answers } from "../../lib/instrument";
import {
  DOMAIN_ORDER, THEME_ORDER, GROUPS, SHORT, TOP_N, SHOWN_RANKS, SHARED_AT,
  CARD, IPSATIVE_CAVEAT, band, blend, emptyDomains, plural,
  type TeamPerson,
} from "../../lib/teamgrid";
import { PAPER, INK, MUTED, HAIR, FORZA, BODY } from "../../lib/ui";

/* Team strengths grid — people down the side, themes across the top.
   ─────────────────────────────────────────────────────────────────────
   Strengths scores are ipsative (docs/strengths-methodology.md §8): they
   describe themes relative to each other WITHIN one person, and carry no
   meaning across people. Everything drawn here respects that:

     * cells show a RANK POSITION, which is an intra-individual statement;
     * across people the only aggregate is a COUNT of how many hold a theme,
       which asks "how many" rather than "how much";
     * the 0-100 index is never shown, ranks are never summed or averaged
       across a column, and nobody is placed above anybody on a theme.

   The caveat under the heading says the same thing in the open, and is not
   dismissible — a grid this legible invites exactly the comparison the
   instrument cannot support. */

/* The column order, the rank bands and the thresholds are shared with the PDF
   export — see lib/teamgrid.ts. */

/* v2 keeps the row order beside the selection, so a dragged order survives a
   reload the way the team does. v1 held the selection alone, as a bare array,
   and is still read once so an existing team is not lost. */
const STORE_KEY = "forzamap.team-grid.v2";
const STORE_KEY_V1 = "forzamap.team-grid.v1";

/* No cap on team size, so "Add all" over a large pool must not open dozens of
   connections at once. Profiles load a few at a time with a breath between
   batches; every row renders immediately with its own loading state, so the
   grid is never waiting on the slowest fetch. */
const BATCH_SIZE = 4;
const BATCH_GAP = 250;

/* Header geometry. The second header row sticks directly under the first, so
   its offset has to be the first row's height — hence both as constants rather
   than whatever the content happens to measure. */
const HEAD1_H = 46;
const HEAD2_H = 96;
const NAME_W = 190;
const CELL_W = 30;

const FOOT_BG = "#F7F5F1";

/* Two automatic orders and one the admin arranged by hand. "custom" is only
   ever reached by dragging or by re-selecting a saved order — the automatic
   sorts do not fall back into it. */
type SortMode = "name" | "domain" | "custom";

/** A candidate with a completed Strengths Profile — one row of the pool. */
interface Eligible {
  id: string;              // assignment id — also the report URL and the stored key
  name: string;
  email: string;
}

type Profile =
  | { state: "loading" }
  | { state: "error"; message: string }
  | {
      state: "ready";
      rank: Record<ThemeKey, number>;      // 1..20, the person's own ordering
      top5: ThemeKey[];
      dom: Record<DomainKey, number>;      // top-five slots held in each domain
    };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* PostgREST returns a many-to-one embed as an object; tolerate an array too. */
const one = (x: any) => (Array.isArray(x) ? x[0] : x) ?? {};

/* Scored from the stored items and answers on every read rather than from the
   stored result JSON, for the same reason CandidateReport rescores: the result
   is a cache of one scoring pass, and the responses are the durable record. A
   grid drawn from results written under different passes would put ranks from
   two different scorings in the same column. */
async function loadProfile(assignmentId: string): Promise<Profile> {
  try {
    const { data, error } = await supabase.from("assessments")
      .select("items,answers").eq("assignment_id", assignmentId).eq("status", "submitted")
      .order("submitted_at", { ascending: false }).limit(1).maybeSingle();
    if (error) return { state: "error", message: error.message };

    const items = data?.items as Item[] | null | undefined;
    if (!Array.isArray(items) || items.length === 0)
      return { state: "error", message: "no stored responses to score" };

    const res = score(items, (data?.answers ?? {}) as Answers);
    const rank = {} as Record<ThemeKey, number>;
    res.themeScores.forEach((t, i) => { rank[t.key] = i + 1; });
    const top5 = res.themeScores.slice(0, TOP_N).map((t) => t.key);
    const dom = emptyDomains();
    top5.forEach((t) => { dom[THEMES[t].domain] += 1; });
    return { state: "ready", rank, top5, dom };
  } catch (e: any) {
    return { state: "error", message: String(e?.message ?? e) };
  }
}

/** The team and the order it is shown in, as they survive a reload. */
interface Store { selected: string[]; mode: SortMode; order: string[] }

const ids = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/* Anything unreadable is simply dropped: a corrupt store costs the admin one
   re-selection, and is not worth a failure state on the page. A custom mode
   with no order behind it is not restored — it would draw as an arbitrary
   order under a button claiming somebody arranged it. */
function readStore(): Store {
  const empty: Store = { selected: [], mode: "name", order: [] };
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return { ...empty, selected: ids(JSON.parse(window.localStorage.getItem(STORE_KEY_V1) || "null")) };
    const v = JSON.parse(raw) ?? {};
    const order = ids(v.order);
    const mode: SortMode = v.mode === "domain" ? "domain"
      : v.mode === "custom" && order.length ? "custom" : "name";
    return { selected: ids(v.selected), mode, order };
  } catch { return empty; }
}

export default function TeamGrid() {
  const [pool, setPool] = useState<Eligible[]>([]);
  const [poolState, setPoolState] = useState<"loading" | "ready" | "error">("loading");
  const [poolError, setPoolError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(() => readStore().selected);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>(() => readStore().mode);
  /* The dragged order, as ids. Empty until somebody arranges one; ids that are
     no longer on the team are simply skipped when the rows are drawn, so
     removing a person and adding them back does not corrupt the order. */
  const [order, setOrder] = useState<string[]>(() => readStore().order);
  const [dragId, setDragId] = useState<string | null>(null);
  /* Spoken to a screen reader after a move, since a row changing places is
     silent to anyone not watching the grid. */
  const [say, setSay] = useState("");
  const [pdfState, setPdfState] = useState<"idle" | "working" | "error">("idle");

  /* Every id ever queued. Dedupes without reading state, so a second "Add all"
     or a re-render mid-flight cannot double-fetch anyone. */
  const known = useRef<Set<string>>(new Set());
  const queue = useRef<string[]>([]);
  const running = useRef(false);
  /* What the order was when this drag began, so an abandoned drag — dropped
     outside the grid, or cancelled with Escape — puts the rows back. */
  const beforeDrag = useRef<{ mode: SortMode; order: string[] } | null>(null);

  /* Only candidates with a COMPLETED strengths assignment can appear: a grid
     row is a rank order, and there is no rank order before submission. */
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("assignments")
        .select("id,candidate:candidates!inner(email,full_name),instrument:instruments!inner(slug)")
        .eq("status", "completed").eq("instrument.slug", STRENGTHS_SLUG);
      if (error) { setPoolError(error.message); setPoolState("error"); return; }
      const rows = ((data ?? []) as any[]).map((a) => {
        const c = one(a.candidate);
        return { id: a.id, name: c.full_name || c.email, email: c.email } as Eligible;
      });
      rows.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
      setPool(rows);
      setPoolState("ready");
    })();
  }, []);

  const poolIds = useMemo(() => new Set(pool.map((p) => p.id)), [pool]);
  const byId = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);

  /* Written when a drag is not in flight: the order moves on every dragenter,
     and only the drop is worth committing. */
  useEffect(() => {
    if (dragId) return;
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ selected, mode: sortMode, order }));
    } catch { /* private mode */ }
  }, [selected, sortMode, order, dragId]);

  /* A stored id whose candidate or assignment has since been deleted no longer
     names anybody, so it leaves the selection rather than sitting there as a
     row that can never load. */
  useEffect(() => {
    if (poolState !== "ready") return;
    setSelected((s) => {
      const kept = s.filter((id) => poolIds.has(id));
      return kept.length === s.length ? s : kept;
    });
  }, [poolState, poolIds]);

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (queue.current.length) {
        const batch = queue.current.splice(0, BATCH_SIZE);
        const done = await Promise.all(
          batch.map(async (id) => [id, await loadProfile(id)] as const),
        );
        setProfiles((p) => {
          const n = { ...p };
          done.forEach(([id, prof]) => { n[id] = prof; });
          return n;
        });
        if (queue.current.length) await sleep(BATCH_GAP);
      }
    } finally { running.current = false; }
  }, []);

  const enqueue = useCallback((ids: string[]) => {
    const fresh = ids.filter((id) => !known.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => known.current.add(id));
    queue.current.push(...fresh);
    setProfiles((p) => {
      const n = { ...p };
      fresh.forEach((id) => { n[id] = { state: "loading" }; });
      return n;
    });
    void pump();
  }, [pump]);

  /* Lazy: a profile is fetched the first time its person is on the team, and
     never again for the life of the page. */
  useEffect(() => {
    if (poolState !== "ready") return;
    enqueue(selected.filter((id) => poolIds.has(id)));
  }, [poolState, selected, poolIds, enqueue]);

  const retry = useCallback((id: string) => {
    known.current.delete(id);
    enqueue([id]);
  }, [enqueue]);

  const add = (id: string) => setSelected((s) => (s.includes(id) ? s : [...s, id]));
  const drop = (id: string) => setSelected((s) => s.filter((x) => x !== id));
  const addAll = () => setSelected(pool.map((p) => p.id));
  const clearTeam = () => setSelected([]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return pool.filter((p) =>
      !selectedSet.has(p.id) &&
      (p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)));
  }, [pool, query, selectedSet]);

  /* Rows, in the order they are drawn. Alphabetical by default; by domain
     concentration the team clusters into the domain each person leads with,
     which is what makes a lopsided team visible at a glance. Anyone still
     loading sorts last — their lead domain isn't known yet. Custom is whatever
     the admin dragged: anyone added since sorts alphabetically after them,
     rather than appearing at an arbitrary point inside an order somebody
     arranged by hand. */
  const rows = useMemo(() => {
    const list = selected.map((id) => byId.get(id)).filter((p): p is Eligible => !!p);
    const alpha = (a: Eligible, b: Eligible) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    if (sortMode === "custom") {
      const at = new Map(order.map((id, i) => [id, i]));
      return list.sort((a, b) =>
        (at.get(a.id) ?? Infinity) - (at.get(b.id) ?? Infinity) || alpha(a, b));
    }
    if (sortMode === "name") return list.sort(alpha);
    const lead = (id: string) => {
      const p = profiles[id];
      if (p?.state !== "ready") return { d: DOMAIN_ORDER.length, n: 0 };
      let best = DOMAIN_ORDER.length, n = -1;
      DOMAIN_ORDER.forEach((d, i) => { if (p.dom[d] > n) { n = p.dom[d]; best = i; } });
      return { d: best, n };
    };
    return list.sort((a, b) => {
      const la = lead(a.id), lb = lead(b.id);
      return la.d - lb.d || lb.n - la.n || alpha(a, b);
    });
  }, [selected, byId, sortMode, profiles, order]);

  const ready = useMemo(
    () => rows.filter((r) => profiles[r.id]?.state === "ready"),
    [rows, profiles],
  );
  const pending = rows.filter((r) => profiles[r.id]?.state === "loading").length;
  const failed = rows.filter((r) => profiles[r.id]?.state === "error");

  /* How many people hold each theme among their top five. A count, not a
     total: the ranks in a column belong to different people and cannot be
     added together. */
  const holders = useMemo(() => {
    const m = {} as Record<ThemeKey, Eligible[]>;
    THEME_ORDER.forEach((t) => { m[t] = []; });
    ready.forEach((r) => {
      const p = profiles[r.id];
      if (p?.state === "ready") p.top5.forEach((t) => m[t].push(r));
    });
    return m;
  }, [ready, profiles]);

  /* Signature-strength slots by domain. Every scored person contributes
     exactly five, so the denominator is people x 5 and the shares are a
     genuine split of a fixed pool rather than an average of scores. */
  const slots = useMemo(() => {
    const s = emptyDomains();
    ready.forEach((r) => {
      const p = profiles[r.id];
      if (p?.state === "ready") DOMAIN_ORDER.forEach((d) => { s[d] += p.dom[d]; });
    });
    return s;
  }, [ready, profiles]);
  const totalSlots = ready.length * TOP_N;
  const pct = (n: number) => (totalSlots ? Math.round((n / totalSlots) * 100) : 0);

  const missing = THEME_ORDER.filter((t) => holders[t].length === 0);
  const shared = THEME_ORDER
    .filter((t) => holders[t].length >= SHARED_AT)
    .sort((a, b) => holders[b].length - holders[a].length ||
      THEME_ORDER.indexOf(a) - THEME_ORDER.indexOf(b));

  /* ── reordering by hand ───────────────────────────────────────────────
     No drag-and-drop library: the HTML5 drag events already carry a drop
     target and a cancel, and the keyboard path below is the part a library
     would not have given us for free anyway. */

  /* The rows as they stand, with `id` put at `to`. Taken from the drawn order
     rather than from `order`, so the first drag out of an automatic sort
     starts from what the admin can see. */
  const moved = useCallback((id: string, to: number) => {
    const ids = rows.map((r) => r.id);
    const from = ids.indexOf(id);
    if (from === -1) return ids;
    ids.splice(from, 1);
    ids.splice(Math.max(0, Math.min(to, ids.length)), 0, id);
    return ids;
  }, [rows]);

  const announce = (name: string, at: number) =>
    setSay(`${name} moved to position ${at + 1} of ${rows.length}.`);

  const startDrag = (id: string) => {
    beforeDrag.current = { mode: sortMode, order };
    setDragId(id);
  };

  /* Dragging reorders as the pointer passes each row, so the grid shows the
     result before it is committed; the drop is what makes it stick. */
  const dragOver = (id: string, index: number) => {
    if (!dragId || dragId === id) return;
    setOrder(moved(dragId, index));
    setSortMode("custom");
  };

  const endDrag = (committed: boolean) => {
    if (!committed && beforeDrag.current) {
      setSortMode(beforeDrag.current.mode);
      setOrder(beforeDrag.current.order);
    }
    if (committed && dragId) {
      const p = rows.find((r) => r.id === dragId);
      if (p) announce(p.name, rows.findIndex((r) => r.id === dragId));
    }
    beforeDrag.current = null;
    setDragId(null);
  };

  /* Arrow keys move a focused handle's row one place. Without this the order
     is mouse-only, and the grid is the one view where the order is the whole
     point of the interaction. */
  const nudge = (id: string, by: -1 | 1) => {
    const from = rows.findIndex((r) => r.id === id);
    const to = from + by;
    if (from === -1 || to < 0 || to >= rows.length) return;
    setOrder(moved(id, to));
    setSortMode("custom");
    announce(rows[from].name, to);
  };

  /* An automatic sort throws the arrangement away, so it asks first. */
  const chooseSort = (mode: SortMode) => {
    if (mode === sortMode) return;
    if (sortMode === "custom" && order.length &&
      !window.confirm("Discard the custom row order and sort automatically?")) return;
    if (mode !== "custom") setOrder([]);
    setSortMode(mode);
  };

  /* ── exports ──────────────────────────────────────────────────────────
     Both take the rows as they are drawn, so an arrangement made on screen is
     the arrangement that leaves the page. */

  function save(blob: Blob, ext: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-strengths-${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* The rows that have a rank order to export. Anyone still loading or failed
     is left out of the exports exactly as they are left out of every count. */
  const exportable = (): TeamPerson[] => ready.flatMap((r) => {
    const p = profiles[r.id];
    return p?.state === "ready" ? [{ id: r.id, name: r.name, rank: p.rank, dom: p.dom }] : [];
  });

  function downloadCsv() {
    const cell = (v: string | number) => {
      const s = String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ["Person", "Email",
      ...THEME_ORDER.map((t) => `${THEMES[t].name} (${DOMAINS[THEMES[t].domain].label})`)];
    const body = ready.map((r) => {
      const p = profiles[r.id];
      const ranks = p?.state === "ready" ? THEME_ORDER.map((t) => p.rank[t]) : [];
      return [r.name, r.email, ...ranks];
    });
    const csv = [head, ...body].map((r) => r.map(cell).join(",")).join("\r\n");
    save(new Blob([csv], { type: "text/csv;charset=utf-8" }), "csv");
  }

  /* The document — and the renderer behind it — is fetched on the click rather
     than with the page: a grid nobody exports should not pay for a PDF engine. */
  async function downloadPdf() {
    setPdfState("working");
    try {
      const { teamGridPdfBlob } = await import("../../report/TeamGridPDF");
      save(await teamGridPdfBlob({
        people: exportable(), generatedAt: new Date().toISOString(),
      }), "pdf");
      setPdfState("idle");
    } catch (e) {
      console.error("Team grid PDF failed", e);
      setPdfState("error");
    }
  }

  const reportHref = (id: string) => `/admin/assignments/${id}`;

  return (
    <div style={{ minHeight: "100vh", background: PAPER }}>
      <AdminNav />
      <div className="tg-wrap">
        <div className="tg-head">
          <h1 className="font-display" style={{ fontSize: "1.8rem", color: INK, margin: 0 }}>Team strengths</h1>
          <div className="tg-headbtns">
            <button onClick={downloadCsv} disabled={ready.length === 0}
              className="font-label tg-btn" title="Person-by-theme ranks, one row per person">
              Download CSV
            </button>
            <button onClick={downloadPdf} disabled={ready.length === 0 || pdfState === "working"}
              className="font-label tg-btn tg-btn-solid"
              title="The grid as it stands, landscape, one row per person">
              {pdfState === "working" ? "Preparing PDF…" : "Download PDF"}
            </button>
          </div>
        </div>
        {pdfState === "error" && (
          <p className="tg-fail" role="alert">
            The PDF could not be built — see the browser console.{" "}
            <button className="tg-linkbtn" onClick={downloadPdf}>Try again</button>
          </p>
        )}

        {/* Permanent, and never behind a disclosure. The grid is legible enough
            to invite a comparison the instrument cannot support, so the reason
            it cannot sits next to it at all times — and travels with the PDF. */}
        <p className="tg-caveat">{IPSATIVE_CAVEAT}</p>

        {/* A row changing places is silent to anyone not watching the grid. */}
        <div className="tg-sr" role="status" aria-live="polite">{say}</div>

        {poolState === "loading" && <p style={{ color: MUTED }}>Loading…</p>}
        {poolState === "error" && (
          <p style={{ color: FORZA }}>Could not load candidates — {poolError}</p>
        )}

        {poolState === "ready" && pool.length === 0 && (
          <div className="tg-empty">
            <p style={{ margin: "0 0 8px", color: INK }}>Nobody has completed the Strengths Profile yet.</p>
            <p style={{ margin: 0, color: MUTED, fontSize: 14 }}>
              A person appears here once their Strengths Profile assignment is submitted.
              Invite and follow them up from Candidates.
            </p>
          </div>
        )}

        {poolState === "ready" && pool.length > 0 && (
          <>
            {/* ── building the team ───────────────────────────────────── */}
            <div className="tg-builder">
              <div className="tg-buildrow">
                <input value={query} onChange={(e) => setQuery(e.target.value)} className="tg-search"
                  placeholder="Search name or email" aria-label="Search name or email" />
                <button onClick={addAll} disabled={selected.length === pool.length}
                  className="font-label tg-btn">Add all ({pool.length})</button>
                <button onClick={clearTeam} disabled={selected.length === 0}
                  className="font-label tg-btn">Clear team</button>
              </div>

              {query.trim() && (
                <div className="tg-results">
                  {matches.length === 0
                    ? <p className="tg-note">No one left to add matches "{query.trim()}".</p>
                    : matches.map((p) => (
                      <button key={p.id} onClick={() => { add(p.id); setQuery(""); }} className="tg-result">
                        <span style={{ color: INK }}>{p.name}</span>
                        <span className="font-mono" style={{ fontSize: 11, color: MUTED }}>{p.email}</span>
                      </button>
                    ))}
                </div>
              )}

              {selected.length === 0 ? (
                <p className="tg-note">
                  No one on the team yet. Search for a person, or add everyone who qualifies.
                </p>
              ) : (
                <>
                  <p className="font-label tg-count">
                    {plural(selected.length, "person", "people")} on the team
                    {selected.length < pool.length ? ` · ${pool.length - selected.length} more available` : ""}
                  </p>
                  {/* With no cap on team size the chips can run to dozens of
                      rows, which would push the grid clean off the page. They
                      scroll in place instead. */}
                  <div className="tg-chips">
                  {rows.map((p) => {
                    const st = profiles[p.id]?.state;
                    return (
                      <span key={p.id} className="tg-chip" data-state={st}>
                        {st === "loading" && <span className="tg-spin" aria-hidden="true" />}
                        {st === "error" && <span className="tg-warn" aria-hidden="true">!</span>}
                        {p.name}
                        <button onClick={() => drop(p.id)} aria-label={`Remove ${p.name}`}
                          className="tg-chip-x">✕</button>
                      </span>
                    );
                  })}
                  </div>
                </>
              )}

              {pending > 0 && (
                <div className="tg-progress" role="status" aria-live="polite">
                  <div className="tg-bar">
                    <div className="tg-bar-fill"
                      style={{ width: `${Math.round(((rows.length - pending) / rows.length) * 100)}%` }} />
                  </div>
                  <span className="font-mono tg-progress-t">
                    Loading profiles — {rows.length - pending} of {rows.length}
                  </span>
                </div>
              )}

              {failed.length > 0 && (
                <p className="tg-fail">
                  {plural(failed.length, "profile")} could not be scored and {failed.length === 1 ? "is" : "are"} left
                  out of every count below.{" "}
                  <button className="tg-linkbtn" onClick={() => failed.forEach((f) => retry(f.id))}>Try again</button>
                </p>
              )}
            </div>

            {ready.length > 0 && (
              <>
                {/* ── what the team is missing, sharing and leaning on ──── */}
                <div className="tg-gaps">
                  <section className="tg-gap">
                    <h2 className="font-label tg-gap-h">Nobody's top five</h2>
                    {missing.length === 0 ? (
                      <p className="tg-gap-p">Every one of the 20 themes is somebody's signature strength.</p>
                    ) : (
                      <>
                        <p className="tg-gap-p">
                          {plural(missing.length, "theme")} nobody on this team leads with.
                        </p>
                        {GROUPS.map(({ domain, themes }) => {
                          const gone = themes.filter((t) => missing.includes(t));
                          if (gone.length === 0) return null;
                          return (
                            <div key={domain} className="tg-gap-grp">
                              <span className="font-label tg-gap-dom" style={{ color: DOMAINS[domain].color }}>
                                {DOMAINS[domain].label}
                              </span>
                              <span className="tg-gap-list">{gone.map((t) => THEMES[t].name).join(", ")}</span>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </section>

                  <section className="tg-gap">
                    <h2 className="font-label tg-gap-h">Shared by three or more</h2>
                    {shared.length === 0 ? (
                      <p className="tg-gap-p">
                        No theme is in the top five of three or more people — the team's signature
                        strengths are spread thinly.
                      </p>
                    ) : (
                      <ul className="tg-shared">
                        {shared.map((t) => (
                          <li key={t}>
                            <span className="tg-dot" style={{ background: DOMAINS[THEMES[t].domain].color }} />
                            <span style={{ color: INK }}>{THEMES[t].name}</span>
                            <span className="font-mono tg-shared-n">{holders[t].length} people</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="tg-gap">
                    <h2 className="font-label tg-gap-h">Domain balance</h2>
                    <p className="tg-gap-p">
                      {plural(totalSlots, "signature slot")} across {plural(ready.length, "person", "people")}.
                    </p>
                    <div className="tg-balbar">
                      {DOMAIN_ORDER.map((d) => (
                        <div key={d} style={{ width: `${pct(slots[d])}%`, background: DOMAINS[d].color }} />
                      ))}
                    </div>
                    <ul className="tg-bal">
                      {DOMAIN_ORDER.map((d) => (
                        <li key={d}>
                          <span className="tg-dot" style={{ background: DOMAINS[d].color }} />
                          <span style={{ color: INK }}>{DOMAINS[d].label}</span>
                          <span className="font-mono tg-bal-n">{slots[d]} · {pct(slots[d])}%</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>

                <div className="tg-sortbar">
                  <span className="font-label tg-sortlbl">Rows</span>
                  {([["name", "A to Z"], ["domain", "By domain concentration"],
                    ["custom", "Custom"]] as const).map(([k, label]) => (
                    <button key={k} onClick={() => chooseSort(k)} aria-pressed={sortMode === k}
                      /* Custom is a state the grid arrives in by being dragged,
                         not a sort that can be asked for from nothing. */
                      disabled={k === "custom" && order.length === 0}
                      title={k === "custom" ? "Set by dragging a row by its handle" : undefined}
                      className="font-label tg-toggle"
                      style={{ background: sortMode === k ? INK : "transparent",
                        color: sortMode === k ? PAPER : MUTED,
                        borderColor: sortMode === k ? INK : HAIR }}>
                      {label}
                    </button>
                  ))}
                  <span className="tg-sorthint">Drag a row by its handle, or focus one and use ↑ ↓.</span>
                </div>
              </>
            )}

            {rows.length > 0 && (
              <>
                {/* ── the grid (desktop) ─────────────────────────────── */}
                <div className="tg-grid">
                  <div className="tg-scroll">
                    <table className="tg-table">
                      {/* The person column and the four summaries are the width
                          they need; the theme columns are given no width at
                          all, so a fixed layout hands them what is left of the
                          table over — one twentieth of the surplus each. That
                          is what fills the box rather than trailing paper at
                          the right, and it widens with the window. */}
                      <colgroup>
                        <col style={{ width: NAME_W }} />
                        {THEME_ORDER.map((t) => <col key={t} />)}
                        {DOMAIN_ORDER.map((d) => <col key={d} style={{ width: CELL_W }} />)}
                      </colgroup>

                      <thead>
                        <tr>
                          <th className="tg-corner tg-corner1" scope="col">
                            <span className="font-label tg-corner-t">Person</span>
                          </th>
                          {GROUPS.map(({ domain, themes }) => (
                            <th key={domain} colSpan={themes.length} scope="colgroup" className="tg-dhead"
                              style={{ background: DOMAINS[domain].color }}>
                              <span className="font-label tg-dhead-t">{DOMAINS[domain].label}</span>
                              <span className="font-mono tg-dhead-m">
                                {slots[domain]} slots · {pct(slots[domain])}%
                              </span>
                            </th>
                          ))}
                          <th colSpan={DOMAIN_ORDER.length} scope="colgroup" className="tg-dhead tg-sumsep"
                            style={{ background: INK }}>
                            <span className="font-label tg-dhead-t">Top 5 by domain</span>
                            <span className="font-mono tg-dhead-m">per person</span>
                          </th>
                        </tr>
                        <tr>
                          <th className="tg-corner tg-corner2" scope="col">
                            <span className="tg-corner-s">
                              Rank within the person · blank past {SHOWN_RANKS}
                            </span>
                          </th>
                          {GROUPS.map(({ domain, themes }) =>
                            themes.map((t, i) => (
                              <th key={t} scope="col" className={`tg-th2${i === 0 ? " tg-dsep" : ""}`}>
                                <span className="tg-vert">{THEMES[t].name}</span>
                              </th>
                            )))}
                          {DOMAIN_ORDER.map((d, i) => (
                            <th key={d} scope="col" className={`tg-th2${i === 0 ? " tg-sumsep" : ""}`}
                              title={`${DOMAINS[d].label} — top-5 slots per person`}>
                              <span className="tg-vert" style={{ color: DOMAINS[d].color }}>{SHORT[d]}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {rows.map((r, index) => {
                          const p = profiles[r.id];
                          return (
                            /* The row is the drop target, not the handle: the
                               pointer spends the drag over cells, and a target
                               the width of the handle would be unhittable. */
                            <tr key={r.id} className="tg-row" data-dragging={dragId === r.id || undefined}
                              onDragEnter={() => dragOver(r.id, index)}
                              onDragOver={(e) => { if (dragId) e.preventDefault(); }}
                              onDrop={(e) => { e.preventDefault(); endDrag(true); }}>
                              <th scope="row" className="tg-name">
                                <span className="tg-namewrap">
                                <button type="button" className="tg-handle" draggable
                                  onDragStart={(e) => {
                                    /* Firefox starts no drag without data on the
                                       transfer, whatever the payload is. */
                                    e.dataTransfer.setData("text/plain", r.id);
                                    e.dataTransfer.effectAllowed = "move";
                                    startDrag(r.id);
                                  }}
                                  onDragEnd={() => endDrag(false)}
                                  onKeyDown={(e) => {
                                    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                                    e.preventDefault();
                                    nudge(r.id, e.key === "ArrowUp" ? -1 : 1);
                                  }}
                                  aria-label={`Reorder ${r.name} — row ${index + 1} of ${rows.length}. Drag, or use the up and down arrow keys.`}
                                  title="Drag to reorder · ↑ ↓ to move">⠿</button>
                                <a href={reportHref(r.id)} target="_blank" rel="noopener noreferrer"
                                  className="tg-namelink" title={`${r.name} — ${r.email} · opens their report`}>
                                  {r.name}
                                </a>
                                </span>
                              </th>
                              {p?.state === "ready" ? (
                                <>
                                  {GROUPS.map(({ domain, themes }) =>
                                    themes.map((t, i) => {
                                      const rank = p.rank[t];
                                      const cls = `tg-cell${i === 0 ? " tg-dsep" : ""}`;
                                      if (rank > SHOWN_RANKS) return <td key={t} className={cls} />;
                                      const b = band(rank, DOMAINS[domain].color);
                                      return (
                                        <td key={t} className={`${cls} font-mono`}
                                          style={{ background: b.background, color: b.color,
                                            fontWeight: b.strong ? 500 : undefined }}
                                          title={`${r.name} — ${THEMES[t].name} ranks ${rank} of 20 for them`}>
                                          {rank}
                                        </td>
                                      );
                                    }))}
                                  {DOMAIN_ORDER.map((d, i) => (
                                    <td key={d} className={`tg-cell tg-sum font-mono${i === 0 ? " tg-sumsep" : ""}`}
                                      style={{ color: p.dom[d] ? DOMAINS[d].color : HAIR,
                                        background: p.dom[d] ? blend(DOMAINS[d].color, 0.1) : undefined }}
                                      title={`${r.name} — ${p.dom[d]} of their top 5 in ${DOMAINS[d].label}`}>
                                      {p.dom[d] || "·"}
                                    </td>
                                  ))}
                                </>
                              ) : (
                                <td className="tg-cell tg-rowstate"
                                  colSpan={THEME_ORDER.length + DOMAIN_ORDER.length}>
                                  {p?.state === "error" ? (
                                    <>
                                      <span style={{ color: FORZA }}>Could not score — {p.message}.</span>{" "}
                                      <button className="tg-linkbtn" onClick={() => retry(r.id)}>Try again</button>
                                    </>
                                  ) : <span style={{ color: MUTED }}>Loading…</span>}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>

                      <tfoot>
                        <tr>
                          <th scope="row" className="tg-foot tg-footname">
                            <span className="font-label tg-foot-t">In top 5</span>
                            <span className="tg-foot-s">count of people — not a column total</span>
                          </th>
                          {GROUPS.map(({ domain, themes }) =>
                            themes.map((t, i) => {
                              const n = holders[t].length;
                              return (
                                <td key={t} className={`tg-foot font-mono${i === 0 ? " tg-dsep" : ""}`}
                                  style={{ color: n ? DOMAINS[domain].color : HAIR }}
                                  title={`${plural(n, "person", "people")} hold ${THEMES[t].name} in their top 5`}>
                                  {n || "·"}
                                </td>
                              );
                            }))}
                          {DOMAIN_ORDER.map((d, i) => (
                            <td key={d} className={`tg-foot font-mono${i === 0 ? " tg-sumsep" : ""}`}
                              style={{ color: slots[d] ? DOMAINS[d].color : HAIR }}
                              title={`${slots[d]} of the team's ${totalSlots} signature slots are in ${DOMAINS[d].label}`}>
                              {slots[d] || "·"}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <p className="tg-legend">
                    <span className="tg-key" style={{ background: INK, color: "#fff" }}>1–3</span>
                    <span className="tg-key" style={{ background: blend(INK, 0.45), color: INK }}>4–7</span>
                    <span className="tg-key" style={{ background: blend(INK, 0.18), color: MUTED }}>8–10</span>
                    <span style={{ color: MUTED }}>
                      Rank within that person, in their theme's domain colour. Blank past {SHOWN_RANKS}.
                      Click a name to open their report.
                    </span>
                  </p>
                </div>

                {/* ── narrow screens: the same facts as two lists ────── */}
                <div className="tg-lists">
                  <p className="tg-note">
                    The grid needs a wider screen. Here are the same counts, theme by theme
                    and person by person.
                  </p>

                  <h2 className="font-label tg-list-h">Who holds each theme in their top five</h2>
                  {GROUPS.map(({ domain, themes }) => (
                    <div key={domain} className="tg-lgroup">
                      <div className="font-label tg-lgroup-h"
                        style={{ color: DOMAINS[domain].color, borderColor: DOMAINS[domain].color }}>
                        {DOMAINS[domain].label} — {slots[domain]} slots · {pct(slots[domain])}%
                      </div>
                      {themes.map((t) => (
                        <div key={t} className="tg-litem">
                          <div className="tg-litem-h">
                            <span style={{ color: INK }}>{THEMES[t].name}</span>
                            <span className="font-mono tg-litem-n" style={{ color: MUTED }}>
                              {holders[t].length === 1 ? "1 person" : `${holders[t].length} people`}
                            </span>
                          </div>
                          <div className="tg-litem-p">
                            {holders[t].length === 0
                              ? <span style={{ color: MUTED }}>Nobody</span>
                              : holders[t].map((h) => (
                                <a key={h.id} href={reportHref(h.id)} target="_blank" rel="noopener noreferrer"
                                  className="tg-pill">{h.name}</a>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}

                  <h2 className="font-label tg-list-h">Each person's top five</h2>
                  {rows.map((r) => {
                    const p = profiles[r.id];
                    return (
                      <div key={r.id} className="tg-person">
                        <a href={reportHref(r.id)} target="_blank" rel="noopener noreferrer"
                          className="tg-namelink tg-person-n">{r.name}</a>
                        {p?.state === "ready" ? (
                          <ol className="tg-top5">
                            {p.top5.map((t, i) => (
                              <li key={t}>
                                <span className="font-mono tg-top5-r"
                                  style={{ background: DOMAINS[THEMES[t].domain].color }}>{i + 1}</span>
                                <span style={{ color: INK }}>{THEMES[t].name}</span>
                                <span className="tg-top5-d" style={{ color: DOMAINS[THEMES[t].domain].color }}>
                                  {DOMAINS[THEMES[t].domain].label}
                                </span>
                              </li>
                            ))}
                          </ol>
                        ) : p?.state === "error" ? (
                          <p className="tg-gap-p" style={{ color: FORZA }}>
                            Could not score — {p.message}.{" "}
                            <button className="tg-linkbtn" onClick={() => retry(r.id)}>Try again</button>
                          </p>
                        ) : <p className="tg-gap-p">Loading…</p>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <style>{`
        .tg-wrap{max-width:1120px;margin:0 auto;padding:24px 16px 64px;
          font-family:Archivo,ui-sans-serif,system-ui,sans-serif}
        .tg-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px}
        .tg-headbtns{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
        /* Off screen, not display:none — a hidden live region is never read. */
        .tg-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;
          clip:rect(0 0 0 0);white-space:nowrap;border:0}
        .tg-caveat{max-width:70ch;margin:0 0 22px;padding:12px 14px;border-left:3px solid ${FORZA};
          background:#fff;font-size:13px;line-height:1.6;color:${BODY}}
        .tg-empty{padding:22px;border:1px solid ${HAIR};background:#fff}
        .tg-note{margin:10px 0 0;font-size:13px;color:${MUTED}}

        .tg-btn{padding:10px 14px;font-size:11px;letter-spacing:.07em;text-transform:uppercase;
          background:none;color:${INK};border:1px solid ${HAIR};cursor:pointer;white-space:nowrap}
        .tg-btn:disabled{opacity:.45;cursor:default}
        .tg-btn-solid{background:${INK};color:${PAPER};border-color:${INK}}
        .tg-linkbtn{padding:0;background:none;border:none;color:${INK};cursor:pointer;
          font:inherit;text-decoration:underline}

        .tg-builder{padding:16px;border:1px solid ${HAIR};background:#fff;margin-bottom:22px}
        .tg-buildrow{display:flex;flex-wrap:wrap;gap:8px}
        .tg-search{flex:1 1 220px;min-width:0;padding:11px 12px;border:1px solid ${HAIR};background:#fff;
          font-family:inherit;font-size:14px;box-sizing:border-box}
        .tg-results{display:grid;gap:1px;margin-top:8px;max-height:240px;overflow-y:auto;
          background:${HAIR};border:1px solid ${HAIR}}
        .tg-result{display:flex;align-items:baseline;justify-content:space-between;gap:12px;
          padding:9px 12px;background:#fff;border:none;cursor:pointer;text-align:left;
          font-family:inherit;font-size:14px}
        .tg-result:hover{background:${PAPER}}
        .tg-count{margin:14px 0 6px;font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:${MUTED}}
        .tg-chips{display:flex;flex-wrap:wrap;align-content:flex-start;gap:6px;
          max-height:118px;overflow-y:auto;padding-right:4px}
        .tg-chip{display:inline-flex;align-items:center;gap:7px;padding:5px 6px 5px 10px;
          border:1px solid ${HAIR};background:${PAPER};font-size:13px;color:${INK}}
        .tg-chip[data-state="error"]{border-color:${FORZA};color:${FORZA}}
        .tg-chip-x{padding:0 2px;background:none;border:none;color:${MUTED};font-size:11px;cursor:pointer}
        .tg-spin{width:8px;height:8px;border:2px solid ${HAIR};border-top-color:${INK};border-radius:50%;
          animation:tg-spin .7s linear infinite}
        .tg-warn{font-weight:700;font-size:11px}
        @keyframes tg-spin{to{transform:rotate(360deg)}}
        .tg-progress{display:flex;align-items:center;gap:10px;margin-top:12px}
        .tg-bar{flex:1;height:4px;background:${HAIR};overflow:hidden}
        .tg-bar-fill{height:100%;background:${INK};transition:width .2s linear}
        .tg-progress-t{font-size:11px;color:${MUTED};white-space:nowrap}
        .tg-fail{margin:10px 0 0;font-size:13px;color:${FORZA}}

        .tg-gaps{display:grid;gap:1px;background:${HAIR};border:1px solid ${HAIR};margin-bottom:22px}
        .tg-gap{background:#fff;padding:16px}
        .tg-gap-h{margin:0 0 10px;font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:${MUTED}}
        .tg-gap-p{margin:0 0 8px;font-size:13px;line-height:1.55;color:${BODY}}
        .tg-gap-grp{display:flex;gap:8px;margin-top:6px;font-size:13px;line-height:1.5}
        .tg-gap-dom{flex:0 0 96px;font-size:10px;letter-spacing:.07em;text-transform:uppercase;padding-top:2px}
        .tg-gap-list{color:${INK}}
        .tg-shared,.tg-bal{list-style:none;margin:0;padding:0;display:grid;gap:6px;font-size:13px}
        /* On a large team most themes clear the threshold, and an unbounded
           list would set the height of all three cards. */
        .tg-shared{max-height:232px;overflow-y:auto;padding-right:6px}
        .tg-shared li,.tg-bal li{display:flex;align-items:center;gap:8px}
        .tg-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto}
        .tg-shared-n,.tg-bal-n{margin-left:auto;font-size:11px;color:${MUTED}}
        .tg-balbar{display:flex;height:10px;overflow:hidden;margin:2px 0 12px;background:${HAIR}}

        .tg-sortbar{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:12px}
        .tg-sortlbl{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:${MUTED};margin-right:4px}
        .tg-toggle{padding:7px 11px;font-size:11px;letter-spacing:.07em;text-transform:uppercase;
          border:1px solid ${HAIR};cursor:pointer}
        .tg-toggle:disabled{opacity:.45;cursor:default}
        .tg-sorthint{font-size:12px;color:${MUTED};margin-left:4px}

        /* ── the grid ─────────────────────────────────────────────────
           Sticky lives inside this box rather than against the window: the
           column footer has to stay at the foot of the grid, not the foot of
           the page, and the same scroll container gives the header row and the
           name column something to stick to. */
        .tg-grid{display:none}
        /* Sized so that once the page is scrolled down to it the whole box —
           header, rows and footer — clears the sticky admin nav above and the
           legend below. */
        /* The box takes the whole container: the table is what fills it, and a
           frame that stopped where the columns happened to end left ~150px of
           bare paper down the right of a 1120px page. scrollbar-gutter reserves
           the vertical scrollbar's width up front, so a long team does not
           narrow the table when the scrollbar appears. */
        .tg-scroll{overflow:auto;width:100%;
          max-height:calc(100vh - 176px);min-height:300px;scroll-margin-top:70px;
          border:1px solid ${HAIR};background:${CARD};scrollbar-gutter:stable}
        /* separate, not collapse: a collapsed border belongs to the table and
           scrolls out from under a sticky cell.

           width:100% against a fixed layout is what widens the theme cells: the
           person column and the four summaries take their stated widths and the
           twenty columns with no width stated share what is left, one twentieth
           each. min-width is the old geometry — below it the cells would start
           squeezing the rank numerals, so the box gives way to a horizontal
           scrollbar instead, as it always has. */
        .tg-table{border-collapse:separate;border-spacing:0;table-layout:fixed;
          width:100%;min-width:${NAME_W + (THEME_ORDER.length + DOMAIN_ORDER.length) * CELL_W}px}
        .tg-table th,.tg-table td{border-right:1px solid ${HAIR};border-bottom:1px solid ${HAIR};
          padding:0;margin:0}
        .tg-dsep{border-left:2px solid ${HAIR}}
        .tg-sumsep{border-left:2px solid ${INK}}

        .tg-dhead{position:sticky;top:0;z-index:3;height:${HEAD1_H}px;color:#fff;
          text-align:center;padding:4px 6px;vertical-align:middle}
        .tg-dhead-t{display:block;font-size:11px;letter-spacing:.07em;text-transform:uppercase;
          line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .tg-dhead-m{display:block;font-size:10px;line-height:1.3;opacity:.82}
        .tg-corner{position:sticky;left:0;z-index:5;background:${CARD};text-align:left;padding:4px 10px}
        .tg-corner1{top:0;height:${HEAD1_H}px;vertical-align:middle}
        .tg-corner2{top:${HEAD1_H}px;height:${HEAD2_H}px;vertical-align:bottom;padding-bottom:8px}
        .tg-corner-t{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:${MUTED}}
        .tg-corner-s{display:block;font-size:10px;line-height:1.35;color:${MUTED}}
        .tg-th2{position:sticky;top:${HEAD1_H}px;z-index:3;background:${CARD};
          height:${HEAD2_H}px;vertical-align:bottom;padding:0 0 6px;text-align:center}
        .tg-vert{display:inline-block;writing-mode:vertical-rl;transform:rotate(180deg);
          white-space:nowrap;font-size:11px;letter-spacing:.02em;color:${INK}}

        .tg-name{position:sticky;left:0;z-index:2;background:${CARD};text-align:left;
          padding:0 10px 0 4px;font-weight:400;max-width:${NAME_W}px}
        /* The flex row is inside the cell, not the cell itself: a table cell
           set to display:flex stops being a cell, and takes the column width
           and the sticky column with it. */
        .tg-namewrap{display:flex;align-items:center;gap:4px}
        .tg-namelink{display:block;flex:1;min-width:0;font-size:13px;color:${INK};text-decoration:none;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .tg-namelink:hover{text-decoration:underline}
        /* Dim until the row is under the pointer or the handle has focus: a
           column of grab handles down a 60-row grid is a lot of furniture. */
        .tg-handle{flex:0 0 auto;padding:2px 3px;background:none;border:none;line-height:1;
          font-size:12px;color:${HAIR};cursor:grab;touch-action:none}
        .tg-row:hover .tg-handle,.tg-handle:focus-visible{color:${MUTED}}
        .tg-handle:active{cursor:grabbing}
        .tg-row{height:28px}
        .tg-row:hover .tg-name,.tg-row:hover .tg-cell{background:${PAPER}}
        /* The row under the pointer is the one being placed, so the one being
           moved says so by stepping back rather than by moving twice. */
        .tg-row[data-dragging] td,.tg-row[data-dragging] th{opacity:.4}
        .tg-cell{text-align:center;vertical-align:middle;font-size:12px;line-height:1}
        .tg-sum{font-size:11px}
        .tg-rowstate{text-align:left;padding:0 10px;font-size:12px}

        .tg-foot{position:sticky;bottom:0;z-index:3;background:${FOOT_BG};border-top:2px solid ${INK};
          text-align:center;vertical-align:middle;height:42px;font-size:12px}
        .tg-footname{left:0;z-index:5;text-align:left;padding:0 10px;font-weight:400}
        .tg-foot-t{display:block;font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:${INK}}
        .tg-foot-s{display:block;font-size:10px;line-height:1.3;color:${MUTED}}
        .tg-legend{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:10px 0 0;font-size:12px}
        .tg-key{display:inline-block;min-width:34px;padding:2px 6px;text-align:center;
          font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}

        /* ── narrow screens ─────────────────────────────────────────── */
        .tg-lists{display:block}
        .tg-list-h{margin:26px 0 10px;font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:${MUTED}}
        .tg-lgroup{margin-bottom:14px;border:1px solid ${HAIR};background:#fff}
        .tg-lgroup-h{padding:8px 12px;font-size:11px;letter-spacing:.07em;text-transform:uppercase;
          border-bottom:2px solid}
        .tg-litem{padding:10px 12px;border-top:1px solid ${HAIR};font-size:13px}
        .tg-litem:first-of-type{border-top:none}
        .tg-litem-h{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
        .tg-litem-n{font-size:11px}
        .tg-litem-p{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
        .tg-pill{padding:3px 8px;border:1px solid ${HAIR};background:${PAPER};font-size:12px;
          color:${INK};text-decoration:none}
        .tg-person{padding:12px;border:1px solid ${HAIR};background:#fff;margin-bottom:8px}
        .tg-person-n{font-size:14px;margin-bottom:8px}
        .tg-top5{list-style:none;margin:0;padding:0;display:grid;gap:5px;font-size:13px}
        .tg-top5 li{display:flex;align-items:center;gap:8px}
        .tg-top5-r{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;
          color:#fff;font-size:11px;flex:0 0 auto}
        .tg-top5-d{margin-left:auto;font-size:10px;letter-spacing:.07em;text-transform:uppercase}

        @media (min-width:640px){
          .tg-gaps{grid-template-columns:repeat(3,1fr)}
        }
        @media (min-width:1024px){
          .tg-wrap{padding:40px 24px 64px}
          .tg-grid{display:block}
          .tg-lists{display:none}
        }
        button:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid ${INK};outline-offset:2px}
      `}</style>
    </div>
  );
}
