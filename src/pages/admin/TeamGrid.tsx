import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import AdminNav from "./AdminNav";
import { STRENGTHS_SLUG } from "../../lib/assignments";
import { DOMAINS, THEMES, score } from "../../lib/instrument";
import type { DomainKey, ThemeKey, Item, Answers } from "../../lib/instrument";
import {
  DOMAIN_ORDER, THEME_ORDER, GROUPS, SHORT, TOP_N, SHARED_AT,
  DEPTH_DEFAULT, DEPTH_MODES, GAP_SCOPES, CARD, IPSATIVE_CAVEAT, SCARCITY_NOTE,
  band, blend, contrastNote, defaultScope, depthHeadNote, depthNote, emptyDomains,
  gapSummary, isDepthMode, isGapScope, isSharp, legendKeys, plural, poolPeople,
  share, shows, themeContrasts,
  type DepthMode, type GapScope, type GapSummary, type TeamPerson, type TeamRoster,
  type ThemeContrast,
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
   instrument cannot support.

   The page holds SEVERAL named teams, each with its own selection, row order
   and grid. The gap analysis then reads at one of three widths — one team, all
   of them pooled, or the teams against each other — and the scope control
   picks which. All three are counts of people, so the caveat holds at every
   width and stays on screen whichever is showing. */

/* The column order, the rank bands, the thresholds and the three scopes are
   shared with the PDF export — see lib/teamgrid.ts. */

/* v3 holds several teams, each carrying the selection, the row order and the
   name somebody gave it, plus the page-wide rank depth and gap scope. v2 held
   one unnamed team; v1 held a bare array of ids. Both are still read once, and
   both arrive as a single team called "Team 1", so nobody's arrangement is
   lost to the upgrade. */
const STORE_KEY = "forzamap.team-grid.v3";
const STORE_KEY_V2 = "forzamap.team-grid.v2";
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

/** A candidate with a completed Strengths Profile — one row of the pool, and
    exactly one per person however many completed assignments they have. */
interface Eligible {
  id: string;              // assignment id — also the report URL and the stored key
  candidateId: string;     // who this is; the identity that outlives an assignment
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

/** One named team: who is on it, how its rows are arranged, and how far down
    each ranking its grid is drawn. All three belong to the team rather than to
    the page — two teams are read for different reasons, and a depth that suits
    a leadership group of five is not the one that suits a function of forty. */
interface Team {
  id: string;
  name: string;
  selected: string[];
  mode: SortMode;
  order: string[];
  depth: DepthMode;
}

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

/** The teams, each carrying its own arrangement, and which gap reading is
    open, as they survive a reload. */
interface Store {
  teams: Team[];
  activeId: string;
  /** null until somebody picks one, so the default can follow the team count. */
  scope: GapScope | null;
}

const ids = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/* Unique for the life of the page, and stable across reloads once stored.
   Nothing outside the browser ever sees these, so a counter behind the clock
   is identity enough. */
let seq = 0;
const tid = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`;

/* `fallback` is the depth a team inherits when it carries none of its own —
   the one the older store held for the whole page. */
function makeTeam(name: string, t: Partial<Team> = {}, fallback = DEPTH_DEFAULT): Team {
  const order = ids(t.order);
  return {
    id: typeof t.id === "string" && t.id ? t.id : tid(),
    name,
    selected: ids(t.selected),
    /* A custom mode with no order behind it is not restored — it would draw as
       an arbitrary order under a button claiming somebody arranged it. */
    mode: t.mode === "domain" ? "domain" : t.mode === "custom" && order.length ? "custom" : "name",
    order,
    depth: isDepthMode(t.depth) ? t.depth : fallback,
  };
}

/* Anything unreadable is simply dropped: a corrupt store costs the admin one
   re-selection, and is not worth a failure state on the page. */
function readStore(): Store {
  const base = (teams: Team[], scope: GapScope | null = null): Store =>
    ({ teams, activeId: teams[0].id, scope });
  const blank = () => base([makeTeam("Team 1")]);
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const v = JSON.parse(raw) ?? {};
      /* A page-wide `depth` is what this store held before the setting moved
         onto the team; it becomes every team's starting depth. */
      const was = isDepthMode(v.depth) ? v.depth : DEPTH_DEFAULT;
      const teams = (Array.isArray(v.teams) ? v.teams : [])
        .filter((t: any) => t && typeof t === "object")
        .map((t: any, i: number) =>
          makeTeam(typeof t.name === "string" && t.name.trim() ? t.name : `Team ${i + 1}`, t, was));
      if (teams.length === 0) return blank();
      const activeId = teams.some((t: Team) => t.id === v.activeId) ? v.activeId : teams[0].id;
      return { teams, activeId, scope: isGapScope(v.scope) ? v.scope : null };
    }

    /* One team, carrying whatever the older store held. */
    const two = window.localStorage.getItem(STORE_KEY_V2);
    if (two) {
      const v = JSON.parse(two) ?? {};
      return base([makeTeam("Team 1", v, isDepthMode(v.depth) ? v.depth : DEPTH_DEFAULT)]);
    }
    const oneUp = ids(JSON.parse(window.localStorage.getItem(STORE_KEY_V1) || "null"));
    return oneUp.length ? base([makeTeam("Team 1", { selected: oneUp })]) : blank();
  } catch { return blank(); }
}

/** The rows of one team, in the order they are drawn. Alphabetical by default;
    by domain concentration the team clusters into the domain each person leads
    with, which is what makes a lopsided team visible at a glance. Anyone still
    loading sorts last — their lead domain isn't known yet. Custom is whatever
    the admin dragged: anyone added since sorts alphabetically after them,
    rather than appearing at an arbitrary point inside an order somebody
    arranged by hand. */
function orderRows(
  team: Team, byId: Map<string, Eligible>, profiles: Record<string, Profile>,
): Eligible[] {
  const list = team.selected.map((id) => byId.get(id)).filter((p): p is Eligible => !!p);
  const alpha = (a: Eligible, b: Eligible) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  if (team.mode === "custom") {
    const at = new Map(team.order.map((id, i) => [id, i]));
    return list.sort((a, b) =>
      (at.get(a.id) ?? Infinity) - (at.get(b.id) ?? Infinity) || alpha(a, b));
  }
  if (team.mode === "name") return list.sort(alpha);
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
}

/** Everything one team's section needs, derived once per render. */
interface TeamView {
  team: Team;
  rows: Eligible[];
  /** Scored rows only — the ones every count below is made from. */
  people: TeamPerson[];
  summary: GapSummary;
  /** Who holds each theme, by name, for the narrow-screen lists. */
  holders: Record<ThemeKey, Eligible[]>;
}

export default function TeamGrid() {
  const [pool, setPool] = useState<Eligible[]>([]);
  const [poolState, setPoolState] = useState<"loading" | "ready" | "error">("loading");
  const [poolError, setPoolError] = useState<string | null>(null);
  /* Every completed assignment id → the pool row kept for that person, so a
     stored team naming a superseded assignment can be pointed at the one that
     replaced it. */
  const [supersededBy, setSupersededBy] = useState<Map<string, string>>(() => new Map());
  /* Read once, not once per piece of state: a first visit has no store to read
     and mints a team id, and four reads would mint four different ones. */
  const [boot] = useState(readStore);
  const [teams, setTeams] = useState<Team[]>(boot.teams);
  const [activeId, setActiveId] = useState<string>(boot.activeId);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [query, setQuery] = useState("");
  /* What somebody chose, not what is showing: with no choice made the scope
     follows the team count, and "compare" is not a reading a single team has. */
  const [scopePick, setScopePick] = useState<GapScope | null>(boot.scope);
  const [drag, setDrag] = useState<{ teamId: string; id: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  /* Spoken to a screen reader after a move, since a row changing places is
     silent to anyone not watching the grid. */
  const [say, setSay] = useState("");
  const [pdfState, setPdfState] = useState<"idle" | "working" | "error">("idle");

  /* Every id ever queued. Dedupes without reading state, so a second "Add all"
     or a re-render mid-flight cannot double-fetch anyone — including somebody
     added to a second team, whose profile is already in hand. */
  const known = useRef<Set<string>>(new Set());
  const queue = useRef<string[]>([]);
  const running = useRef(false);
  /* What the order was when this drag began, so an abandoned drag — dropped
     outside the grid, or cancelled with Escape — puts the rows back. */
  const beforeDrag = useRef<{ teamId: string; mode: SortMode; order: string[] } | null>(null);
  /* Escape out of a rename must not be undone by the blur that follows. */
  const cancelEdit = useRef(false);

  /* Only candidates with a COMPLETED strengths assignment can appear: a grid
     row is a rank order, and there is no rank order before submission.

     ONE ROW PER CANDIDATE, not per assignment. Deleting an assignment and
     re-inviting leaves a person with two completed ones, and keyed by
     assignment they would arrive twice in the search and could be put on a
     team twice as two rows of the same person — doubling their weight in
     every count the grid makes. The newest submission wins: an older ranking
     is a superseded reading of the same person, not a second person.

     `submitted_at` is the assessment's own stamp and is what loadProfile picks
     a scoring by, so the row the pool keeps and the responses it is scored
     from are chosen the same way. `completed_at` stands in for assignments
     backfilled before that stamp existed. */
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("assignments")
        .select("id,completed_at,candidate:candidates!inner(user_id,email,full_name)," +
          "instrument:instruments!inner(slug),assessments(submitted_at)")
        .eq("status", "completed").eq("instrument.slug", STRENGTHS_SLUG);
      if (error) { setPoolError(error.message); setPoolState("error"); return; }

      const stamp = (v: unknown) => (typeof v === "string" ? Date.parse(v) || 0 : 0);
      const newest = new Map<string, { row: Eligible; at: number }>();
      /* Every assignment id points at the row the pool kept for that person,
         itself included, so a team saved against a superseded assignment can
         be carried across rather than silently losing them. */
      const to = new Map<string, string>();
      const seen: { id: string; candidateId: string }[] = [];

      ((data ?? []) as any[]).forEach((a) => {
        const c = one(a.candidate);
        if (!c.user_id) return;
        const at = Math.max(
          ...(Array.isArray(a.assessments) ? a.assessments : [])
            .map((x: any) => stamp(x?.submitted_at)),
          stamp(a.completed_at));
        const row: Eligible = {
          id: a.id, candidateId: c.user_id,
          name: c.full_name || c.email, email: c.email,
        };
        seen.push({ id: a.id, candidateId: c.user_id });
        const held = newest.get(c.user_id);
        if (!held || at > held.at) newest.set(c.user_id, { row, at });
      });

      seen.forEach(({ id, candidateId }) => {
        const kept = newest.get(candidateId);
        if (kept) to.set(id, kept.row.id);
      });

      const rows = [...newest.values()].map((v) => v.row);
      rows.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
      setPool(rows);
      setSupersededBy(to);
      setPoolState("ready");
    })();
  }, []);

  const poolIds = useMemo(() => new Set(pool.map((p) => p.id)), [pool]);
  const byId = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);

  const active = teams.find((t) => t.id === activeId) ?? teams[0];

  /* Written when a drag is not in flight: the order moves on every dragenter,
     and only the drop is worth committing. */
  useEffect(() => {
    if (drag) return;
    try {
      window.localStorage.setItem(STORE_KEY,
        JSON.stringify({ teams, activeId: active.id, scope: scopePick }));
    } catch { /* private mode */ }
  }, [teams, active, scopePick, drag]);

  const patchTeam = useCallback((id: string, f: (t: Team) => Team) =>
    setTeams((ts) => ts.map((t) => (t.id === id ? f(t) : t))), []);

  /* Stored ids are carried onto the row the pool kept for that person before
     anything is dropped: somebody re-invited since the team was saved is on it
     under an assignment that has since been superseded, and simply dropping
     unknown ids would quietly shrink a team that nobody edited. Two ids for
     one person — the old and the new — collapse to a single row.

     What is left after that names nobody: a candidate or assignment deleted
     outright leaves every team rather than sitting there as a row that can
     never load. */
  useEffect(() => {
    if (poolState !== "ready") return;
    const carry = (list: string[], keep?: (id: string) => boolean) => {
      const out: string[] = [];
      const seen = new Set<string>();
      list.forEach((id) => {
        const now = supersededBy.get(id) ?? id;
        if (seen.has(now) || (keep && !keep(now))) return;
        seen.add(now);
        out.push(now);
      });
      return out;
    };
    const same = (a: string[], b: string[]) =>
      a.length === b.length && a.every((x, i) => x === b[i]);
    setTeams((ts) => {
      let changed = false;
      const next = ts.map((t) => {
        const selected = carry(t.selected, (id) => poolIds.has(id));
        const order = carry(t.order);
        if (same(selected, t.selected) && same(order, t.order)) return t;
        changed = true;
        return { ...t, selected, order };
      });
      return changed ? next : ts;
    });
  }, [poolState, poolIds, supersededBy]);

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

  const enqueue = useCallback((want: string[]) => {
    const fresh = want.filter((id) => !known.current.has(id));
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

  /* Everybody on any team, once. A person on three teams is one fetch and one
     profile — the grids all read the same scored ranking. */
  const rostered = useMemo(() => {
    const s = new Set<string>();
    teams.forEach((t) => t.selected.forEach((id) => s.add(id)));
    return [...s];
  }, [teams]);

  /* Lazy: a profile is fetched the first time its person is on any team, and
     never again for the life of the page. */
  useEffect(() => {
    if (poolState !== "ready") return;
    enqueue(rostered.filter((id) => poolIds.has(id)));
  }, [poolState, rostered, poolIds, enqueue]);

  const retry = useCallback((id: string) => {
    known.current.delete(id);
    enqueue([id]);
  }, [enqueue]);

  /* ── the teams ────────────────────────────────────────────────────── */

  const addTeam = () => {
    const taken = new Set(teams.map((t) => t.name.toLowerCase()));
    let n = teams.length + 1;
    while (taken.has(`team ${n}`)) n += 1;
    const t = makeTeam(`Team ${n}`);
    setTeams((ts) => [...ts, t]);
    setActiveId(t.id);
    setSay(`${t.name} added.`);
  };

  /* The last team is never removed — the page would have nowhere to add the
     next person to. Emptying it is the same gesture and leaves the section. */
  const removeTeam = (id: string) => {
    const t = teams.find((x) => x.id === id);
    if (!t || teams.length === 1) return;
    if (t.selected.length &&
      !window.confirm(`Delete ${t.name}? The ${plural(t.selected.length, "person", "people")} on it stay in the pool.`)) return;
    const next = teams.filter((x) => x.id !== id);
    setTeams(next);
    if (id === active.id) setActiveId(next[0].id);
    setSay(`${t.name} deleted.`);
  };

  const startRename = (t: Team) => { cancelEdit.current = false; setDraft(t.name); setEditing(t.id); };

  const commitName = (id: string) => {
    if (cancelEdit.current) { cancelEdit.current = false; setEditing(null); return; }
    const name = draft.trim();
    if (name) patchTeam(id, (t) => ({ ...t, name }));
    setEditing(null);
  };

  const add = (id: string) => patchTeam(active.id, (t) =>
    t.selected.includes(id) ? t : { ...t, selected: [...t.selected, id] });
  const drop = (teamId: string, id: string) => patchTeam(teamId, (t) =>
    ({ ...t, selected: t.selected.filter((x) => x !== id) }));
  const addAll = () => patchTeam(active.id, (t) => ({ ...t, selected: pool.map((p) => p.id) }));
  const clearTeam = () => patchTeam(active.id, (t) => ({ ...t, selected: [], order: [], mode: "name" }));

  const activeSet = useMemo(() => new Set(active.selected), [active]);

  /* Which other teams a person is already on, so the search says so before
     they are added twice by accident. Being on two teams is legitimate — the
     pooled scope is built to survive it — but it should not be a surprise. */
  const onTeams = useMemo(() => {
    const m = new Map<string, string[]>();
    teams.forEach((t) => t.selected.forEach((id) =>
      m.set(id, [...(m.get(id) ?? []), t.name])));
    return m;
  }, [teams]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return pool.filter((p) =>
      !activeSet.has(p.id) &&
      (p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)));
  }, [pool, query, activeSet]);

  /* ── each team's rows and counts ──────────────────────────────────── */

  const views = useMemo<TeamView[]>(() => teams.map((team) => {
    const rows = orderRows(team, byId, profiles);
    const holders = {} as Record<ThemeKey, Eligible[]>;
    THEME_ORDER.forEach((t) => { holders[t] = []; });
    const people: TeamPerson[] = [];
    rows.forEach((r) => {
      const p = profiles[r.id];
      if (p?.state !== "ready") return;
      p.top5.forEach((t) => holders[t].push(r));
      people.push({ id: r.id, key: r.candidateId, name: r.name, rank: p.rank, dom: p.dom });
    });
    return { team, rows, people, holders, summary: gapSummary(people) };
  }), [teams, byId, profiles]);

  const viewOf = useCallback((id: string) => views.find((v) => v.team.id === id), [views]);

  /* Progress and failures are page-wide: the profiles are shared, so a person
     on two teams is one fetch that either succeeded or did not. */
  const allRows = useMemo(() => {
    const seen = new Set<string>();
    const out: Eligible[] = [];
    views.forEach((v) => v.rows.forEach((r) => {
      if (!seen.has(r.id)) { seen.add(r.id); out.push(r); }
    }));
    return out;
  }, [views]);
  const pending = allRows.filter((r) => profiles[r.id]?.state === "loading").length;
  const failed = allRows.filter((r) => profiles[r.id]?.state === "error");

  /* ── the gap analysis, at the chosen width ────────────────────────── */

  const rosters = useMemo<TeamRoster[]>(
    () => views.map((v) =>
      ({ id: v.team.id, name: v.team.name, people: v.people, depth: v.team.depth })),
    [views],
  );
  const anyReady = rosters.some((r) => r.people.length > 0);

  /* An explicit pick wins, except that "compare" is not a reading a single
     team has — one team back on the page falls to the default rather than to
     an empty table. */
  const scope: GapScope =
    scopePick && (scopePick !== "compare" || teams.length >= 2)
      ? scopePick : defaultScope(teams.length);

  const pooled = useMemo(() => poolPeople(rosters), [rosters]);
  const pooledGaps = useMemo(() => gapSummary(pooled.people), [pooled]);
  const contrasts = useMemo(
    () => (scope === "compare" ? themeContrasts(rosters) : []),
    [scope, rosters],
  );
  const liveTeams = useMemo(() => rosters.filter((r) => r.people.length > 0), [rosters]);
  const sharp = contrasts.filter(isSharp);

  /* ── reordering by hand ───────────────────────────────────────────────
     No drag-and-drop library: the HTML5 drag events already carry a drop
     target and a cancel, and the keyboard path below is the part a library
     would not have given us for free anyway. A row only ever moves within its
     own team — dragging across sections would be a transfer, not a sort. */

  /* One team's rows as they stand, with `id` put at `to`. Taken from the drawn
     order rather than from `order`, so the first drag out of an automatic sort
     starts from what the admin can see. */
  const moved = useCallback((teamId: string, id: string, to: number) => {
    const rows = viewOf(teamId)?.rows ?? [];
    const list = rows.map((r) => r.id);
    const from = list.indexOf(id);
    if (from === -1) return list;
    list.splice(from, 1);
    list.splice(Math.max(0, Math.min(to, list.length)), 0, id);
    return list;
  }, [viewOf]);

  const startDrag = (teamId: string, id: string) => {
    const t = teams.find((x) => x.id === teamId);
    if (t) beforeDrag.current = { teamId, mode: t.mode, order: t.order };
    setDrag({ teamId, id });
  };

  /* Dragging reorders as the pointer passes each row, so the grid shows the
     result before it is committed; the drop is what makes it stick. */
  const dragOver = (teamId: string, id: string, index: number) => {
    if (!drag || drag.teamId !== teamId || drag.id === id) return;
    const order = moved(teamId, drag.id, index);
    patchTeam(teamId, (t) => ({ ...t, order, mode: "custom" }));
  };

  const endDrag = (committed: boolean) => {
    const b = beforeDrag.current;
    if (!committed && b) patchTeam(b.teamId, (t) => ({ ...t, mode: b.mode, order: b.order }));
    if (committed && drag) {
      const v = viewOf(drag.teamId);
      const at = v?.rows.findIndex((r) => r.id === drag.id) ?? -1;
      const p = v?.rows[at];
      if (v && p && at >= 0)
        setSay(`${p.name} moved to position ${at + 1} of ${v.rows.length} on ${v.team.name}.`);
    }
    beforeDrag.current = null;
    setDrag(null);
  };

  /* Arrow keys move a focused handle's row one place. Without this the order
     is mouse-only, and the grid is the one view where the order is the whole
     point of the interaction. */
  const nudge = (teamId: string, id: string, by: -1 | 1) => {
    const v = viewOf(teamId);
    if (!v) return;
    const from = v.rows.findIndex((r) => r.id === id);
    const to = from + by;
    if (from === -1 || to < 0 || to >= v.rows.length) return;
    const order = moved(teamId, id, to);
    patchTeam(teamId, (t) => ({ ...t, order, mode: "custom" }));
    setSay(`${v.rows[from].name} moved to position ${to + 1} of ${v.rows.length} on ${v.team.name}.`);
  };

  /* An automatic sort throws the arrangement away, so it asks first. */
  const chooseSort = (teamId: string, mode: SortMode) => {
    const t = teams.find((x) => x.id === teamId);
    if (!t || mode === t.mode) return;
    if (t.mode === "custom" && t.order.length &&
      !window.confirm(`Discard the custom row order on ${t.name} and sort automatically?`)) return;
    patchTeam(teamId, (x) => ({ ...x, mode, order: mode === "custom" ? x.order : [] }));
  };

  /* An explicit pick, so a scope chosen on two teams survives dropping to one
     and coming back. */
  const chooseScope = (s: GapScope) => setScopePick(s);

  /* ── exports ──────────────────────────────────────────────────────────
     Both take the teams as they are drawn AND the depth they are drawn at, so
     an arrangement made on screen is the arrangement that leaves the page and
     a ranking cut short on screen is cut short in the file. The PDF also takes
     the scope, so the document states which reading it is carrying. */

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

  function downloadCsv() {
    const cell = (v: string | number) => {
      const s = String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ["Team", "Person", "Email",
      ...THEME_ORDER.map((t) => `${THEMES[t].name} (${DOMAINS[THEMES[t].domain].label})`)];
    /* One row per membership, not per person: somebody on two teams is on two
       teams, and a file that hid one of them would not be the grid. A rank the
       grid is not showing leaves an empty field rather than a zero or a dash —
       the file is the grid, and the grid says nothing there. */
    const body = views.flatMap((v) => v.rows.flatMap((r) => {
      const p = profiles[r.id];
      if (p?.state !== "ready") return [];
      const ranks = THEME_ORDER.map((t) => (shows(p.rank[t], v.team.depth) ? p.rank[t] : ""));
      return [[v.team.name, r.name, r.email, ...ranks]];
    }));
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
        teams: rosters, scope, generatedAt: new Date().toISOString(),
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
            <button onClick={downloadCsv} disabled={!anyReady}
              className="font-label tg-btn" title="Person-by-theme ranks, one row per person per team">
              Download CSV
            </button>
            <button onClick={downloadPdf} disabled={!anyReady || pdfState === "working"}
              className="font-label tg-btn tg-btn-solid"
              title="The grids as they stand, landscape, with the gap analysis at the scope showing">
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
            {/* ── the teams, and building them ────────────────────────── */}
            <div className="tg-builder">
              <div className="tg-teams" role="group" aria-label="Teams">
                <span className="font-label tg-sortlbl">Teams</span>
                {teams.map((t) => (editing === t.id ? (
                  <input key={t.id} className="tg-teamedit" value={draft} autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commitName(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); commitName(t.id); }
                      if (e.key === "Escape") { cancelEdit.current = true; setEditing(null); }
                    }}
                    aria-label={`Rename ${t.name}`} />
                ) : (
                  <span key={t.id} className="tg-team" data-active={t.id === active.id || undefined}>
                    <button type="button" className="tg-team-n" onClick={() => setActiveId(t.id)}
                      aria-pressed={t.id === active.id}
                      title={t.id === active.id ? "People are added to this team" : `Add people to ${t.name}`}>
                      {t.name}
                      <span className="font-mono tg-team-c">{t.selected.length}</span>
                    </button>
                    <button type="button" className="tg-team-b" onClick={() => startRename(t)}
                      aria-label={`Rename ${t.name}`} title="Rename">✎</button>
                    <button type="button" className="tg-team-b" onClick={() => removeTeam(t.id)}
                      disabled={teams.length === 1} aria-label={`Delete ${t.name}`}
                      title={teams.length === 1 ? "The last team stays" : "Delete"}>✕</button>
                  </span>
                )))}
                <button type="button" onClick={addTeam} className="font-label tg-toggle tg-teamadd">
                  + New team
                </button>
              </div>

              <div className="tg-buildrow">
                <input value={query} onChange={(e) => setQuery(e.target.value)} className="tg-search"
                  placeholder={`Search name or email — adds to ${active.name}`}
                  aria-label={`Search name or email to add to ${active.name}`} />
                <button onClick={addAll} disabled={active.selected.length === pool.length}
                  className="font-label tg-btn">Add all ({pool.length})</button>
                <button onClick={clearTeam} disabled={active.selected.length === 0}
                  className="font-label tg-btn">Clear {active.name}</button>
              </div>

              {query.trim() && (
                <div className="tg-results">
                  {matches.length === 0
                    ? <p className="tg-note">No one left to add to {active.name} matches "{query.trim()}".</p>
                    : matches.map((p) => {
                      const also = onTeams.get(p.id) ?? [];
                      return (
                        <button key={p.id} onClick={() => { add(p.id); setQuery(""); }} className="tg-result">
                          <span style={{ color: INK }}>
                            {p.name}
                            {also.length > 0 && (
                              <span className="tg-also"> · already on {also.join(", ")}</span>
                            )}
                          </span>
                          <span className="font-mono" style={{ fontSize: 11, color: MUTED }}>{p.email}</span>
                        </button>
                      );
                    })}
                </div>
              )}

              {active.selected.length === 0 ? (
                <p className="tg-note">
                  Nobody on {active.name} yet. Search for a person, or add everyone who qualifies.
                </p>
              ) : (
                <>
                  <p className="font-label tg-count">
                    {plural(active.selected.length, "person", "people")} on {active.name}
                    {active.selected.length < pool.length
                      ? ` · ${pool.length - active.selected.length} more available` : ""}
                  </p>
                  {/* With no cap on team size the chips can run to dozens of
                      rows, which would push the grid clean off the page. They
                      scroll in place instead. */}
                  <div className="tg-chips">
                    {(viewOf(active.id)?.rows ?? []).map((p) => {
                      const st = profiles[p.id]?.state;
                      return (
                        <span key={p.id} className="tg-chip" data-state={st}>
                          {st === "loading" && <span className="tg-spin" aria-hidden="true" />}
                          {st === "error" && <span className="tg-warn" aria-hidden="true">!</span>}
                          {p.name}
                          <button onClick={() => drop(active.id, p.id)}
                            aria-label={`Remove ${p.name} from ${active.name}`}
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
                      style={{ width: `${Math.round(((allRows.length - pending) / allRows.length) * 100)}%` }} />
                  </div>
                  <span className="font-mono tg-progress-t">
                    Loading profiles — {allRows.length - pending} of {allRows.length}
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

            {anyReady && (
              <>
                {/* ── how wide the gap analysis reads ───────────────────── */}
                <div className="tg-scopebar">
                  <div className="tg-sortgrp" role="group" aria-label="Gap analysis scope">
                    <span className="font-label tg-sortlbl">Gap analysis</span>
                    {GAP_SCOPES.map(({ key, label, title }) => (
                      <button key={key} onClick={() => chooseScope(key)} aria-pressed={scope === key}
                        disabled={key === "compare" && teams.length < 2}
                        title={key === "compare" && teams.length < 2
                          ? "Needs a second team to compare against" : title}
                        className="font-label tg-toggle"
                        style={{ background: scope === key ? INK : "transparent",
                          color: scope === key ? PAPER : MUTED,
                          borderColor: scope === key ? INK : HAIR }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {/* The caveat above governs all three; this is the reason it
                      does, said where the scope is chosen. */}
                  <span className="tg-scopenote">
                    Every scope counts people, never scores.
                  </span>
                </div>

                {scope === "all" && (
                  <section className="tg-panel">
                    <div className="tg-panel-h">
                      <h2 className="font-label tg-panel-t">All teams combined</h2>
                      <p className="tg-panel-n">
                        {plural(pooled.people.length, "person", "people")} across{" "}
                        {plural(liveTeams.length, "team")}, each counted once
                        {pooled.repeated > 0
                          ? ` — ${plural(pooled.repeated, "person", "people")} on more than one team, ` +
                            `${pooled.memberships} memberships in all`
                          : ""}.
                      </p>
                    </div>
                    <p className="tg-panel-note">{SCARCITY_NOTE}</p>
                    <GapCards summary={pooledGaps} who="any team" whose="the pool's" />
                  </section>
                )}

                {scope === "compare" && (
                  <section className="tg-panel">
                    <div className="tg-panel-h">
                      <h2 className="font-label tg-panel-t">Compare teams</h2>
                      <p className="tg-panel-n">
                        {sharp.length === 0
                          ? "No theme sits in one team's top fives and in nobody's on another."
                          : `${plural(sharp.length, "theme")} sit in one team's top fives and in nobody's ` +
                            "on another — those come first."}{" "}
                        People, team by team; a share is against that team's own size.
                      </p>
                    </div>
                    <CompareTable rows={contrasts} teams={liveTeams} />
                  </section>
                )}

              </>
            )}

            {/* ── one section per team ─────────────────────────────────── */}
            {views.map((v) => (
              <section key={v.team.id} className="tg-section"
                data-active={v.team.id === active.id || undefined}>
                <div className="tg-sec-h">
                  <h2 className="font-display tg-sec-t">{v.team.name}</h2>
                  <span className="font-mono tg-sec-n">
                    {plural(v.rows.length, "person", "people")}
                    {v.people.length !== v.rows.length ? ` · ${v.people.length} scored` : ""}
                  </span>
                </div>

                {v.rows.length === 0 ? (
                  <p className="tg-note">
                    Nobody on this team yet.{" "}
                    {v.team.id === active.id
                      ? "Search above to add somebody."
                      : <button className="tg-linkbtn" onClick={() => setActiveId(v.team.id)}>
                          Add people to it
                        </button>}
                  </p>
                ) : (
                  <>
                    {/* Scope 1 lives inside the section it describes. */}
                    {scope === "team" && v.people.length > 0 && (
                      <GapCards summary={v.summary} who="this team" whose="the team's" />
                    )}

                    <div className="tg-sortbar">
                      <div className="tg-sortgrp" role="group" aria-label={`Row order on ${v.team.name}`}>
                        <span className="font-label tg-sortlbl">Rows</span>
                        {([["name", "A to Z"], ["domain", "By domain concentration"],
                          ["custom", "Custom"]] as const).map(([k, label]) => (
                          <button key={k} onClick={() => chooseSort(v.team.id, k)}
                            aria-pressed={v.team.mode === k}
                            /* Custom is a state the grid arrives in by being
                               dragged, not a sort that can be asked for from
                               nothing. */
                            disabled={k === "custom" && v.team.order.length === 0}
                            title={k === "custom" ? "Set by dragging a row by its handle" : undefined}
                            className="font-label tg-toggle"
                            style={{ background: v.team.mode === k ? INK : "transparent",
                              color: v.team.mode === k ? PAPER : MUTED,
                              borderColor: v.team.mode === k ? INK : HAIR }}>
                            {label}
                          </button>
                        ))}
                      </div>
                      {/* Beside the row sort because the two together are the
                          whole of "how this team's grid is set", and each team
                          is set on its own. */}
                      <div className="tg-sortgrp" role="group" aria-label={`Ranks shown on ${v.team.name}`}>
                        <span className="font-label tg-sortlbl tg-sortlbl2">Ranks</span>
                        {DEPTH_MODES.map(({ key, label, title }) => (
                          <button key={key} aria-pressed={v.team.depth === key}
                            onClick={() => patchTeam(v.team.id, (t) => ({ ...t, depth: key }))}
                            title={title} className="font-label tg-toggle"
                            style={{ background: v.team.depth === key ? INK : "transparent",
                              color: v.team.depth === key ? PAPER : MUTED,
                              borderColor: v.team.depth === key ? INK : HAIR }}>
                            {label}
                          </button>
                        ))}
                      </div>
                      <span className="tg-sorthint">Drag a row by its handle, or focus one and use ↑ ↓.</span>
                    </div>

                    <TeamTable
                      view={v} profiles={profiles}
                      dragId={drag?.teamId === v.team.id ? drag.id : null}
                      onStartDrag={(id) => startDrag(v.team.id, id)}
                      onDragOver={(id, i) => dragOver(v.team.id, id, i)}
                      onEndDrag={endDrag}
                      onNudge={(id, by) => nudge(v.team.id, id, by)}
                      onRetry={retry} href={reportHref} />
                  </>
                )}
              </section>
            ))}
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
        /* The teams sit above the search, because which team is taking the next
           person is the first thing the search needs settled. */
        .tg-teams{display:flex;align-items:center;flex-wrap:wrap;gap:6px;
          padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid ${HAIR}}
        .tg-team{display:inline-flex;align-items:stretch;border:1px solid ${HAIR};background:#fff}
        .tg-team[data-active]{border-color:${INK};box-shadow:inset 0 0 0 1px ${INK}}
        .tg-team-n{display:inline-flex;align-items:center;gap:7px;padding:6px 4px 6px 10px;
          background:none;border:none;cursor:pointer;font:inherit;font-size:13px;color:${INK}}
        .tg-team-c{font-size:10px;color:${MUTED};background:${PAPER};padding:1px 5px}
        .tg-team-b{padding:0 6px;background:none;border:none;color:${MUTED};font-size:11px;
          cursor:pointer;line-height:1}
        .tg-team-b:disabled{opacity:.35;cursor:default}
        .tg-teamedit{padding:6px 8px;border:1px solid ${INK};background:#fff;
          font-family:inherit;font-size:13px;color:${INK};width:150px}
        .tg-teamadd{padding:7px 11px}
        .tg-buildrow{display:flex;flex-wrap:wrap;gap:8px}
        .tg-search{flex:1 1 220px;min-width:0;padding:11px 12px;border:1px solid ${HAIR};background:#fff;
          font-family:inherit;font-size:14px;box-sizing:border-box}
        .tg-results{display:grid;gap:1px;margin-top:8px;max-height:240px;overflow-y:auto;
          background:${HAIR};border:1px solid ${HAIR}}
        .tg-result{display:flex;align-items:baseline;justify-content:space-between;gap:12px;
          padding:9px 12px;background:#fff;border:none;cursor:pointer;text-align:left;
          font-family:inherit;font-size:14px}
        .tg-result:hover{background:${PAPER}}
        .tg-also{font-size:12px;color:${MUTED}}
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

        /* ── the scope, and what it reads ─────────────────────────────── */
        .tg-scopebar{display:flex;align-items:center;flex-wrap:wrap;gap:6px 14px;margin-bottom:12px}
        .tg-scopenote{font-size:12px;color:${MUTED}}
        .tg-panel{border:1px solid ${HAIR};background:#fff;padding:16px;margin-bottom:22px}
        .tg-panel-h{margin-bottom:10px}
        .tg-panel-t{display:block;margin:0 0 4px;font-size:11px;letter-spacing:.07em;
          text-transform:uppercase;color:${MUTED}}
        .tg-panel-n{margin:0;font-size:13px;line-height:1.55;color:${BODY}}
        /* The one thing the numbers cannot say about themselves. */
        .tg-panel-note{margin:0 0 14px;padding:8px 10px;border-left:2px solid ${HAIR};
          background:${PAPER};font-size:12px;line-height:1.5;color:${MUTED}}
        .tg-panel .tg-gaps{margin-bottom:0}

        .tg-cmp-scroll{overflow-x:auto;border:1px solid ${HAIR}}
        .tg-cmp{border-collapse:separate;border-spacing:0;width:100%;font-size:13px}
        .tg-cmp th,.tg-cmp td{border-bottom:1px solid ${HAIR};padding:6px 8px;text-align:center}
        .tg-cmp thead th{background:${CARD};font-weight:400;
          border-bottom:2px solid ${INK};vertical-align:bottom}
        .tg-cmp-team{display:block;font-size:11px;letter-spacing:.07em;text-transform:uppercase;
          color:${INK};white-space:nowrap}
        .tg-cmp-of{display:block;font-size:10px;color:${MUTED}}
        .tg-cmp-theme{text-align:left;font-weight:400;white-space:nowrap}
        .tg-cmp-name{display:inline-flex;align-items:center;gap:8px;color:${INK}}
        .tg-cmp-n{font-size:12px}
        .tg-cmp-note{text-align:left;font-size:12px;color:${MUTED};white-space:nowrap}
        .tg-cmp tbody tr[data-sharp] .tg-cmp-note{color:${BODY}}
        .tg-cmp tbody tr:hover td,.tg-cmp tbody tr:hover th{background:${PAPER}}

        /* ── one section per team ─────────────────────────────────────── */
        .tg-section{padding-top:8px;margin-bottom:34px}
        .tg-sec-h{display:flex;align-items:baseline;gap:10px;padding-bottom:8px;margin-bottom:14px;
          border-bottom:2px solid ${INK}}
        .tg-sec-t{margin:0;font-size:1.15rem;color:${INK}}
        .tg-sec-n{font-size:11px;color:${MUTED}}

        .tg-sortbar{display:flex;align-items:center;flex-wrap:wrap;gap:6px 14px;margin-bottom:12px}
        /* Each group holds together when the bar wraps, so a label never ends
           up on one line with its buttons on the next. */
        .tg-sortgrp{display:flex;align-items:center;flex-wrap:wrap;gap:6px}
        .tg-sortlbl{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:${MUTED};margin-right:4px}
        /* The second group is fenced off from the first, so the two reads —
           which rows, how deep — are visibly two controls and not six buttons. */
        .tg-sortlbl2{border-left:1px solid ${HAIR};padding-left:14px;margin-left:0}
        .tg-toggle{padding:7px 11px;font-size:11px;letter-spacing:.07em;text-transform:uppercase;
          border:1px solid ${HAIR};cursor:pointer;background:none;color:${MUTED}}
        .tg-toggle:disabled{opacity:.45;cursor:default}
        .tg-sorthint{font-size:12px;color:${MUTED};margin-left:4px}

        /* ── the grid ─────────────────────────────────────────────────
           Sticky lives inside this box rather than against the window: the
           column footer has to stay at the foot of the grid, not the foot of
           the page, and the same scroll container gives the header row and the
           name column something to stick to. */
        .tg-grid{display:none}
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

/* ── the three cards ────────────────────────────────────────────────────
   The same three questions whether they are asked of one team or of everybody
   pooled; only who they are asked about changes, so only the wording does. */
function GapCards({ summary, who, whose }: { summary: GapSummary; who: string; whose: string }) {
  const { holders, missing, shared, slots, totalSlots, people } = summary;
  const pct = (n: number) => share(n, totalSlots);
  return (
    <div className="tg-gaps">
      <section className="tg-gap">
        <h2 className="font-label tg-gap-h">Nobody's top five</h2>
        {missing.length === 0 ? (
          <p className="tg-gap-p">
            Every one of the {THEME_ORDER.length} themes is somebody's signature strength.
          </p>
        ) : (
          <>
            <p className="tg-gap-p">
              {plural(missing.length, "theme")} nobody on {who} leads with.
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
            No theme is in the top five of {SHARED_AT} or more people — {whose} signature
            strengths are spread thinly.
          </p>
        ) : (
          <ul className="tg-shared">
            {shared.map((t) => (
              <li key={t}>
                <span className="tg-dot" style={{ background: DOMAINS[THEMES[t].domain].color }} />
                <span style={{ color: INK }}>{THEMES[t].name}</span>
                <span className="font-mono tg-shared-n">{holders[t]} people</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="tg-gap">
        <h2 className="font-label tg-gap-h">Domain balance</h2>
        <p className="tg-gap-p">
          {plural(totalSlots, "signature slot")} across {plural(people, "person", "people")}.
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
  );
}

/* ── the differential ───────────────────────────────────────────────────
   Themes down the side, teams across — the shape that makes "four here and
   none there" a single glance along a row. Every cell is a count of people,
   tinted by that count's share of its own team, because a 4 on a team of five
   and a 4 on a team of forty are not the same fact. */
function CompareTable({ rows, teams }: { rows: ThemeContrast[]; teams: TeamRoster[] }) {
  if (teams.length < 2) {
    return <p className="tg-note">Two teams with scored people are needed to compare.</p>;
  }
  return (
    <div className="tg-cmp-scroll">
      <table className="tg-cmp">
        <thead>
          <tr>
            <th scope="col" className="tg-cmp-theme">
              <span className="font-label tg-cmp-team">Theme</span>
              <span className="tg-cmp-of">sharpest contrast first</span>
            </th>
            {teams.map((t) => (
              <th key={t.id} scope="col">
                <span className="tg-cmp-team">{t.name}</span>
                <span className="tg-cmp-of">{plural(t.people.length, "person", "people")}</span>
              </th>
            ))}
            <th scope="col" className="tg-cmp-note">
              <span className="font-label tg-cmp-team">Reading</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const color = DOMAINS[THEMES[c.theme].domain].color;
            return (
              <tr key={c.theme} data-sharp={isSharp(c) || undefined}>
                <th scope="row" className="tg-cmp-theme">
                  <span className="tg-cmp-name">
                    <span className="tg-dot" style={{ background: color }} />
                    {THEMES[c.theme].name}
                  </span>
                </th>
                {c.teams.map((tc) => (
                  <td key={tc.id} className="font-mono tg-cmp-n"
                    style={tc.n === 0 ? { color: HAIR } : {
                      background: blend(color, 0.1 + 0.45 * tc.share),
                      color: INK,
                      fontWeight: tc.id === c.peak?.id ? 500 : undefined,
                    }}
                    title={`${tc.name} — ${plural(tc.n, "person", "people")} of ${tc.of} hold ` +
                      `${THEMES[c.theme].name} in their top five`}>
                    {tc.n || "·"}
                  </td>
                ))}
                <td className="tg-cmp-note">{contrastNote(c)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── one team's grid ────────────────────────────────────────────────────
   Lifted out of the page so a section is one call rather than 150 lines
   repeated per team. The drag handlers arrive already bound to this team: a
   row only ever moves within the grid it is drawn in. */
interface TeamTableProps {
  view: TeamView;
  profiles: Record<string, Profile>;
  dragId: string | null;
  onStartDrag(id: string): void;
  onDragOver(id: string, index: number): void;
  onEndDrag(committed: boolean): void;
  onNudge(id: string, by: -1 | 1): void;
  onRetry(id: string): void;
  href(id: string): string;
}

function TeamTable({
  view, profiles, dragId, onStartDrag, onDragOver, onEndDrag, onNudge, onRetry, href,
}: TeamTableProps) {
  const { rows, holders, summary, team } = view;
  const { slots, totalSlots } = summary;
  const { depth } = team;
  const pct = (n: number) => share(n, totalSlots);

  return (
    <>
      {/* ── the grid (desktop) ─────────────────────────────────────── */}
      <div className="tg-grid">
        <div className="tg-scroll">
          <table className="tg-table">
            {/* The person column and the four summaries are the width they
                need; the theme columns are given no width at all, so a fixed
                layout hands them what is left of the table over — one
                twentieth of the surplus each. That is what fills the box
                rather than trailing paper at the right, and it widens with
                the window. */}
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
                    Rank within the person · {depthHeadNote(depth)}
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
                  /* The row is the drop target, not the handle: the pointer
                     spends the drag over cells, and a target the width of the
                     handle would be unhittable. */
                  <tr key={r.id} className="tg-row" data-dragging={dragId === r.id || undefined}
                    onDragEnter={() => onDragOver(r.id, index)}
                    onDragOver={(e) => { if (dragId) e.preventDefault(); }}
                    onDrop={(e) => { e.preventDefault(); onEndDrag(true); }}>
                    <th scope="row" className="tg-name">
                      <span className="tg-namewrap">
                        <button type="button" className="tg-handle" draggable
                          onDragStart={(e) => {
                            /* Firefox starts no drag without data on the
                               transfer, whatever the payload is. */
                            e.dataTransfer.setData("text/plain", r.id);
                            e.dataTransfer.effectAllowed = "move";
                            onStartDrag(r.id);
                          }}
                          onDragEnd={() => onEndDrag(false)}
                          onKeyDown={(e) => {
                            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                            e.preventDefault();
                            onNudge(r.id, e.key === "ArrowUp" ? -1 : 1);
                          }}
                          aria-label={`Reorder ${r.name} on ${team.name} — row ${index + 1} of ${rows.length}. Drag, or use the up and down arrow keys.`}
                          title="Drag to reorder · ↑ ↓ to move">⠿</button>
                        <a href={href(r.id)} target="_blank" rel="noopener noreferrer"
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
                            if (!shows(rank, depth)) return <td key={t} className={cls} />;
                            const b = band(rank, DOMAINS[domain].color, depth);
                            return (
                              <td key={t} className={`${cls} font-mono`}
                                style={{ background: b.background, color: b.color,
                                  fontWeight: b.strong ? 500 : undefined,
                                  /* An inset rule rather than a border: the
                                     cell's own hairlines belong to the table
                                     and a real border would move the column. */
                                  boxShadow: b.outline
                                    ? `inset 0 0 0 1.5px ${b.outline}` : undefined }}
                                title={`${r.name} — ${THEMES[t].name} ranks ${rank} of ${THEME_ORDER.length} for them`}>
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
                            <button className="tg-linkbtn" onClick={() => onRetry(r.id)}>Try again</button>
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
                    title={`${slots[d]} of this team's ${totalSlots} signature slots are in ${DOMAINS[d].label}`}>
                    {slots[d] || "·"}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        {/* Drawn from the same `band` the cells are, so the key cannot
            describe a banding the grid is not using. */}
        <p className="tg-legend">
          {legendKeys(depth).map(({ label, band: b }) => (
            <span key={label} className="tg-key"
              style={{ background: b.background, color: b.color,
                fontWeight: b.strong ? 500 : undefined,
                boxShadow: b.outline ? `inset 0 0 0 1.5px ${b.outline}` : undefined }}>
              {label}
            </span>
          ))}
          <span style={{ color: MUTED }}>
            Rank within that person, in their theme's domain colour. {depthNote(depth)}{" "}
            Click a name to open their report.
          </span>
        </p>
      </div>

      {/* ── narrow screens: the same facts as two lists ────────────── */}
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
                    {plural(holders[t].length, "person", "people")}
                  </span>
                </div>
                <div className="tg-litem-p">
                  {holders[t].length === 0
                    ? <span style={{ color: MUTED }}>Nobody</span>
                    : holders[t].map((h) => (
                      <a key={h.id} href={href(h.id)} target="_blank" rel="noopener noreferrer"
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
              <a href={href(r.id)} target="_blank" rel="noopener noreferrer"
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
                  <button className="tg-linkbtn" onClick={() => onRetry(r.id)}>Try again</button>
                </p>
              ) : <p className="tg-gap-p">Loading…</p>}
            </div>
          );
        })}
      </div>
    </>
  );
}
