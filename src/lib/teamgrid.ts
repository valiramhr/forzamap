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
  name: string;
  rank: Record<ThemeKey, number>;   // 1..20, the person's own ordering
  dom: Record<DomainKey, number>;   // top-five slots held in each domain
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
