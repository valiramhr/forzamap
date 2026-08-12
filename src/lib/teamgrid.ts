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
/** Ranks below this are left blank: past ten, the ordering is noise. */
export const SHOWN_RANKS = 10;
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

/** How a rank reads in its theme's domain colour: the leading three carry the
    colour solid, the next four a wash of it, the rest a hint. Past
    SHOWN_RANKS a cell says nothing at all. */
export function band(rank: number, color: string):
  { background?: string; color?: string; strong: boolean } {
  if (rank > SHOWN_RANKS) return { strong: false };
  if (rank <= 3) return { background: color, color: CARD, strong: true };
  if (rank <= 7) return { background: blend(color, 0.45), color: INK, strong: false };
  return { background: blend(color, 0.18), color: MUTED, strong: false };
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
