/* What the team grid on screen and the PDF it exports both have to agree on.
   ─────────────────────────────────────────────────────────────────────────
   The column order, the rank bands and the thresholds live here rather than in
   either view, so a change to the way a rank is coloured reaches the screen and
   the export in the same commit. Nothing here imports @react-pdf/renderer: the
   PDF module is loaded on demand, and a shared constant must not be what drags
   the renderer into the main bundle. */

import { DOMAINS, THEMES } from "./instrument";
import type { DomainKey, ThemeKey } from "./instrument";
import { INK, MUTED } from "./ui";

export const DOMAIN_ORDER = Object.keys(DOMAINS) as DomainKey[];
/* THEMES is declared domain by domain, so its key order already groups the
   columns the way the header does. */
export const THEME_ORDER = Object.keys(THEMES) as ThemeKey[];
export const GROUPS = DOMAIN_ORDER.map((d) => ({
  domain: d,
  themes: THEME_ORDER.filter((t) => THEMES[t].domain === d),
}));

/* Set vertically in the four summary columns, where the full label would be
   twice the height of the longest theme name and would set the header row's
   height on its own. The group header above them carries the full names. */
export const SHORT: Record<DomainKey, string> = {
  executing: "Executing", influencing: "Influencing",
  relating: "Relating", thinking: "Thinking",
};

/** A person's signature strengths — the same top five the report leads with. */
export const TOP_N = 5;
/** Ranks below this are left blank in the default depth: past ten, the
    ordering is noise. */
export const SHOWN_RANKS = 10;
/** Where the bottom five begins — 16 of 20, the mirror of TOP_N. */
export const BOTTOM_FROM = THEME_ORDER.length - TOP_N + 1;
/** A theme this many people share is a concentration worth naming. */
export const SHARED_AT = 3;

/** The grid's own ground — white paper inside the page's PAPER surround. */
export const CARD = "#FFFFFF";

/** One row of the grid: a person and the rank order that is theirs alone. */
export interface TeamPerson {
  id: string;
  /** Who this is, across teams. A person on three teams is three rows and one
      key, and the key is what stops them counting three times when the teams
      are pooled — see `poolPeople`. */
  key: string;
  name: string;
  rank: Record<ThemeKey, number>;   // 1..20, the person's own ordering
  dom: Record<DomainKey, number>;   // top-five slots held in each domain
}

/** A team as anything that draws it needs it: a name, and the scored people on
    it in the order the screen is showing them. */
export interface TeamRoster {
  id: string;
  name: string;
  people: TeamPerson[];
}

/** `hex` at `a` opacity over `base`, as an opaque 6-digit hex.
    Opaque rather than an 8-digit alpha because react-pdf's colour parser wants
    a solid value, and a pre-blend over the card is the same pixel either way. */
export function blend(hex: string, a: number, base = CARD): string {
  const ch = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  const mix = (i: number) => Math.round(ch(hex, i) * a + ch(base, i) * (1 - a));
  return "#" + [0, 1, 2].map((i) => mix(i).toString(16).padStart(2, "0")).join("");
}

/* ── how much of each ranking the grid shows ─────────────────────────────
   One person's row is 20 ranks long and the grid has only ever drawn the
   first ten of them. Two more readings are worth having: the whole ranking,
   and the two ends of it with the middle dropped. The mode belongs here
   rather than in the page, because the screen, the CSV and the PDF all have
   to draw and export the same cells. */

/** Which part of each person's ranking the grid draws. */
export type DepthMode = "top10" | "all20" | "ends";

export const DEPTH_DEFAULT: DepthMode = "top10";

/** The modes as the control offers them, in the order it offers them. */
export const DEPTH_MODES: { key: DepthMode; label: string; title: string }[] = [
  { key: "top10", label: `Top ${SHOWN_RANKS}`,
    title: `Ranks 1–${SHOWN_RANKS}; blank below` },
  { key: "all20", label: `All ${THEME_ORDER.length}`,
    title: "Every theme carries a rank" },
  { key: "ends", label: `Top ${TOP_N} & bottom ${TOP_N}`,
    title: `Ranks 1–${TOP_N} and ${BOTTOM_FROM}–${THEME_ORDER.length}; the middle blank` },
];

export const isDepthMode = (v: unknown): v is DepthMode =>
  DEPTH_MODES.some((m) => m.key === v);

/** Whether a rank is drawn at all under `mode`. */
export function shows(rank: number, mode: DepthMode): boolean {
  if (mode === "all20") return true;
  if (mode === "ends") return rank <= TOP_N || rank >= BOTTOM_FROM;
  return rank <= SHOWN_RANKS;
}

/** How one cell is drawn. `outline` is a rule around an UNFILLED cell — the
    bottom five are a deliberate reading, not a faded one, so they are given a
    different kind of cell rather than the palest step of the same gradient. */
export interface RankBand {
  background?: string;
  color?: string;
  strong: boolean;
  outline?: string;
}

/** A numeral pale enough to sit on the faintest tint without shouting, but
    still darker than the hairlines around it. */
const FAINT = blend(MUTED, 0.62);

/** How a rank reads in its theme's domain colour. The leading three carry the
    colour solid everywhere; below that each mode has its own descent, because
    twenty filled cells in a row need the lower bands to recede much harder
    than ten do, and the bottom five are not a low band at all. */
export function band(rank: number, color: string, mode: DepthMode = DEPTH_DEFAULT): RankBand {
  if (!shows(rank, mode)) return { strong: false };
  if (rank <= 3) return { background: color, color: CARD, strong: true };
  if (mode === "ends") {
    return rank <= TOP_N
      ? { background: blend(color, 0.45), color: INK, strong: false }
      : { outline: color, color, strong: false };
  }
  if (rank <= 7) return { background: blend(color, 0.45), color: INK, strong: false };
  if (mode === "top10" || rank <= 13) return { background: blend(color, 0.18), color: MUTED, strong: false };
  return { background: blend(color, 0.07), color: FAINT, strong: false };
}

/** The legend's swatches for `mode`, drawn from `band` itself so the key can
    never describe a banding the grid is not using. In ink rather than a domain
    colour: the legend is about the steps, not about one domain. */
export function legendKeys(mode: DepthMode): { label: string; band: RankBand }[] {
  const key = (rank: number, label: string) => ({ label, band: band(rank, INK, mode) });
  if (mode === "all20")
    return [key(1, "1–3"), key(4, "4–7"), key(8, "8–13"), key(14, `14–${THEME_ORDER.length}`)];
  if (mode === "ends")
    return [key(1, "1–3"), key(4, `4–${TOP_N}`), key(BOTTOM_FROM, `${BOTTOM_FROM}–${THEME_ORDER.length}`)];
  return [key(1, "1–3"), key(4, "4–7"), key(8, `8–${SHOWN_RANKS}`)];
}

/** What the legend says after the swatches. */
export function depthNote(mode: DepthMode): string {
  if (mode === "all20") return `Every one of the ${THEME_ORDER.length} themes carries a rank.`;
  if (mode === "ends")
    return `Ranks 1–${TOP_N} filled and ${BOTTOM_FROM}–${THEME_ORDER.length} outlined — ` +
      "the two ends of one ranking, not a scale. Ranks in between are blank.";
  return `Blank past ${SHOWN_RANKS}.`;
}

/** The same fact in the two lines the grid's top-left corner has room for. */
export function depthHeadNote(mode: DepthMode): string {
  if (mode === "all20") return `all ${THEME_ORDER.length} shown`;
  if (mode === "ends") return `1–${TOP_N} and ${BOTTOM_FROM}–${THEME_ORDER.length} only`;
  return `blank past ${SHOWN_RANKS}`;
}

export function emptyDomains(): Record<DomainKey, number> {
  return { executing: 0, influencing: 0, relating: 0, thinking: 0 };
}

/** How many people hold each theme among their top five. A count, not a total:
    the ranks in a column belong to different people and cannot be added. */
export function holderCounts(people: TeamPerson[]): Record<ThemeKey, number> {
  const m = {} as Record<ThemeKey, number>;
  THEME_ORDER.forEach((t) => { m[t] = 0; });
  people.forEach((p) => THEME_ORDER.forEach((t) => { if (p.rank[t] <= TOP_N) m[t] += 1; }));
  return m;
}

/** Signature-strength slots by domain. Every scored person contributes exactly
    five, so the denominator is people × 5 and the shares are a genuine split of
    a fixed pool rather than an average of scores. */
export function domainSlots(people: TeamPerson[]): Record<DomainKey, number> {
  const s = emptyDomains();
  people.forEach((p) => DOMAIN_ORDER.forEach((d) => { s[d] += p.dom[d]; }));
  return s;
}

export const share = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

export const plural = (n: number, w: string, many = w + "s") => `${n} ${n === 1 ? w : many}`;

/** The caveat that travels with every rendering of this grid. */
export const IPSATIVE_CAVEAT =
  "Strengths are ranked within each person, so a rank of 3 for one person is not equivalent " +
  "to a rank of 3 for another. This grid shows what each person leads with and where the team " +
  "is concentrated or thin — not who is stronger.";

/* ── the gap analysis, at three widths ───────────────────────────────────
   The same three questions — what is missing, what is concentrated, how the
   signature slots split by domain — asked of one team, of everybody at once,
   or of the teams against each other. Every one of them is a COUNT OF PEOPLE:
   no scope sums a rank, averages one, or puts one person above another, so
   the ipsative caveat above holds unchanged at all three widths. */

/** Which population the gap analysis is asking about. */
export type GapScope = "team" | "all" | "compare";

/** The scopes as the control offers them, in the order it offers them. */
export const GAP_SCOPES: { key: GapScope; label: string; title: string }[] = [
  { key: "team", label: "This team",
    title: "Each team's own gaps, inside that team's section" },
  { key: "all", label: "All teams combined",
    title: "Everybody pooled into one picture, each person counted once" },
  { key: "compare", label: "Compare teams",
    title: "Theme by theme — which teams have it concentrated, which have none" },
];

export const isGapScope = (v: unknown): v is GapScope =>
  GAP_SCOPES.some((s) => s.key === v);

/** One team is its own picture and has nothing to compare against; two or more
    and the differential is the reading worth opening on. */
export const defaultScope = (teams: number): GapScope => (teams >= 2 ? "compare" : "team");

/** What a printed page says it is showing. */
export function scopeTitle(scope: GapScope): string {
  if (scope === "all") return "Gap analysis — all teams combined";
  if (scope === "compare") return "Gap analysis — teams compared";
  return "Gap analysis — each team on its own";
}

/** Said once beside the pooled reading. Scarcity is the half of this analysis
    that a large pool quietly destroys, and the reader has no way to see that
    from the numbers themselves. */
export const SCARCITY_NOTE =
  "Scarcity reads weaker as the pool grows — in a large enough group nearly every theme is " +
  "somebody's signature strength, so \"nobody leads with X\" gets rare and says less, while " +
  "concentration stays meaningful at any size.";

/** The three answers, for whatever set of people is asked about. */
export interface GapSummary {
  /** How many people hold each theme in their top five. */
  holders: Record<ThemeKey, number>;
  /** Themes in nobody's top five. */
  missing: ThemeKey[];
  /** Themes at or over the concentration threshold, most-held first. */
  shared: ThemeKey[];
  slots: Record<DomainKey, number>;
  totalSlots: number;
  people: number;
}

export function gapSummary(people: TeamPerson[]): GapSummary {
  const holders = holderCounts(people);
  return {
    holders,
    slots: domainSlots(people),
    people: people.length,
    totalSlots: people.length * TOP_N,
    missing: THEME_ORDER.filter((t) => holders[t] === 0),
    shared: THEME_ORDER
      .filter((t) => holders[t] >= SHARED_AT)
      .sort((a, b) => holders[b] - holders[a] ||
        THEME_ORDER.indexOf(a) - THEME_ORDER.indexOf(b)),
  };
}

/** Everybody across every team, each counted once. */
export interface Pool {
  people: TeamPerson[];
  /** Rows before deduplication — team memberships, which is not a headcount. */
  memberships: number;
  /** How many people sit on more than one team. */
  repeated: number;
}

/** Pooled by person, not by row. Somebody on three teams contributes one set of
    five signature slots to the organisational picture, not three: without this
    they would carry three times the weight of somebody on one team, and the
    "nobody leads with X" reading would be answered largely by whoever happens
    to be on the most teams. The first row for a person wins — every row for
    one person is the same scored profile, so which one is arbitrary. */
export function poolPeople(teams: TeamRoster[]): Pool {
  const first = new Map<string, TeamPerson>();
  const times = new Map<string, number>();
  teams.forEach((t) => t.people.forEach((p) => {
    const k = p.key || p.id;
    times.set(k, (times.get(k) ?? 0) + 1);
    if (!first.has(k)) first.set(k, p);
  }));
  let memberships = 0, repeated = 0;
  times.forEach((n) => { memberships += n; if (n > 1) repeated += 1; });
  return { people: [...first.values()], memberships, repeated };
}

/** One team's hold on one theme. `share` is against that team's own size, so a
    count of 4 means something different on a team of 5 than on a team of 40. */
export interface TeamCount {
  id: string;
  name: string;
  n: number;
  of: number;
  share: number;
}

/** One theme across the teams — where it is concentrated, where it is absent. */
export interface ThemeContrast {
  theme: ThemeKey;
  /** Aligned with the teams that have scored people, in their screen order. */
  teams: TeamCount[];
  /** Where it is most concentrated; null when nobody anywhere leads with it. */
  peak: TeamCount | null;
  /** Teams where it is in nobody's top five. */
  absent: TeamCount[];
  /** Highest share minus lowest — 1 when a team is saturated and another has
      none, 0 when every team holds it in the same proportion. */
  contrast: number;
  /** Holders summed across teams: memberships, not a headcount. */
  total: number;
}

/** Every theme, sharpest contrast first. A theme in one team's top fives and
    in nobody's on another is exactly the case the difference of shares puts at
    the top: the absent team drags the low end to zero, so nothing that is
    spread evenly can outrank it. Teams with nobody scored are left out —
    "absent" there would mean "not measured", which is a different fact. */
export function themeContrasts(teams: TeamRoster[]): ThemeContrast[] {
  const live = teams.filter((t) => t.people.length > 0)
    .map((t) => ({ t, held: holderCounts(t.people) }));
  return THEME_ORDER.map((theme) => {
    const per: TeamCount[] = live.map(({ t, held }) => ({
      id: t.id, name: t.name, n: held[theme], of: t.people.length,
      share: held[theme] / t.people.length,
    }));
    const shares = per.map((c) => c.share);
    const hi = shares.length ? Math.max(...shares) : 0;
    const lo = shares.length ? Math.min(...shares) : 0;
    return {
      theme,
      teams: per,
      peak: per.find((c) => c.n > 0 && c.share === hi) ?? null,
      absent: per.filter((c) => c.n === 0),
      contrast: hi - lo,
      total: per.reduce((sum, c) => sum + c.n, 0),
    };
  }).sort((a, b) =>
    b.contrast - a.contrast ||
    (b.peak?.share ?? 0) - (a.peak?.share ?? 0) ||
    b.total - a.total ||
    THEME_ORDER.indexOf(a.theme) - THEME_ORDER.indexOf(b.theme));
}

/** A contrast is sharp when some team leads with the theme and some team has
    nobody who does — the pair the comparison exists to surface. */
export const isSharp = (c: ThemeContrast) => !!c.peak && c.absent.length > 0;

const nameList = (cs: TeamCount[], max = 2): string => {
  const names = cs.map((c) => c.name);
  if (names.length <= max) return names.join(" and ");
  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
};

/** The contrast in a line, for the row that carries the counts. */
export function contrastNote(c: ThemeContrast): string {
  if (!c.peak) return "In nobody's top five on any team";
  if (c.absent.length === 0) return "In every team's top fives";
  return `${c.peak.n} of ${c.peak.of} on ${c.peak.name} · none on ${nameList(c.absent)}`;
}
