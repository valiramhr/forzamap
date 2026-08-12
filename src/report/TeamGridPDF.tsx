import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import { PDF_FONTS } from "./ReportPDF";
import { DOMAINS, THEMES } from "../lib/instrument";
import type { DomainKey, ThemeKey } from "../lib/instrument";
import {
  DOMAIN_ORDER, THEME_ORDER, GROUPS, SHORT, TOP_N, SHOWN_RANKS, SHARED_AT,
  CARD, IPSATIVE_CAVEAT, band, blend, domainSlots, holderCounts, plural, share,
  type TeamPerson,
} from "../lib/teamgrid";
import { PAPER, INK, MUTED, HAIR, BODY, FORZA, fmtReportDate } from "../lib/ui";

/* The team strengths grid as a document.
   ─────────────────────────────────────────────────────────────────────
   LANDSCAPE, because 20 theme columns plus the person column and the four
   domain summaries are 25 columns and portrait A4 has no width for them.

   A team has no upper bound, so the grid pages by ROW. react-pdf's `fixed`
   repeats a flow element on every page: the two header rows carry it, so a
   continuation page arrives with its domain band and its vertical theme
   labels rather than 24 anonymous columns. Each row is wrap={false} so a
   person is never cut in half by a page break, and the person's name is part
   of the row, so the left-hand column repeats by construction.

   The "in top 5" footer totals the whole team, so it is the last thing in the
   flow and lands on the last page — a per-page repeat would state a whole-team
   count under a partial one.

   Everything the ranks mean, and cannot mean, is in lib/teamgrid.ts alongside
   the screen's own reading of them. */

const { base: BASE, display: DISPLAY, displayWeight: DISPLAY_WEIGHT, mediumWeight: MEDIUM_WEIGHT } = PDF_FONTS;
const display = { fontFamily: DISPLAY, fontWeight: DISPLAY_WEIGHT };

/* A4 landscape is 841.89 × 595.28pt. The 25 columns are laid out against the
   live width rather than measured from content: the theme columns take
   whatever is left once the person column and the four summaries are paid
   for, which is the same bargain the screen grid strikes. */
const PAGE_W = 841.89;
const PAD_X = 22, PAD_TOP = 20, PAD_BOTTOM = 30;
const CONTENT_W = PAGE_W - PAD_X * 2;
const PERSON_W = 118;
const SUM_W = 21;
const THEME_W = (CONTENT_W - PERSON_W - DOMAIN_ORDER.length * SUM_W) / THEME_ORDER.length;

const ROW_H = 13;
const BAND_H = 21;
/* Tall enough for the longest label set on its side — "Harmoniser" at 6.5pt is
   ~34pt, "Influencing" in the summary columns ~37pt. */
const VHEAD_H = 52;
const FOOT_H = 20;

/* A name wider than the person column would run into the first theme cell.
   The column is clipped as well, so this only keeps the ellipsis honest. */
const NAME_MAX = 30;
const clip = (s: string) => (s.length > NAME_MAX ? s.slice(0, NAME_MAX - 1) + "…" : s);

const hair = { borderRightWidth: 0.5, borderRightColor: HAIR };

const s = StyleSheet.create({
  page: {
    paddingHorizontal: PAD_X, paddingTop: PAD_TOP, paddingBottom: PAD_BOTTOM,
    backgroundColor: PAPER, fontFamily: BASE, color: INK,
  },

  /* ── page 1 preamble ─────────────────────────────────────────────── */
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 7 },
  h1: { ...display, fontSize: 17, letterSpacing: -0.6 },
  headMeta: { alignItems: "flex-end" },
  eyebrow: { fontSize: 7.5, letterSpacing: 1.6, color: MUTED, textTransform: "uppercase" },
  /* The same three-sided silence and one loud edge the screen gives it. */
  caveat: {
    borderLeftWidth: 2, borderLeftColor: FORZA, backgroundColor: CARD,
    paddingVertical: 6, paddingHorizontal: 8, marginBottom: 10,
  },
  caveatT: { fontSize: 7.5, lineHeight: 1.45, color: BODY },

  gaps: { flexDirection: "row", marginBottom: 11 },
  gap: { flex: 1, backgroundColor: CARD, borderWidth: 0.5, borderColor: HAIR, padding: 8 },
  gapGutter: { marginRight: 8 },
  gapH: { fontSize: 7, letterSpacing: 1.4, color: MUTED, textTransform: "uppercase", marginBottom: 5 },
  gapP: { fontSize: 7.5, lineHeight: 1.45, color: BODY, marginBottom: 3 },
  gapGrp: { flexDirection: "row", marginTop: 2 },
  gapDom: { width: 62, fontSize: 6.5, letterSpacing: 0.9, textTransform: "uppercase", paddingTop: 0.5 },
  gapList: { flex: 1, fontSize: 7.5, lineHeight: 1.4, color: INK },
  /* Two to a line: on a team where most themes clear the threshold, one line
     each would be twenty lines and would push the grid onto its own page. */
  sharedWrap: { flexDirection: "row", flexWrap: "wrap" },
  sharedItem: { width: "50%", flexDirection: "row", alignItems: "center", marginBottom: 2.5 },
  dot: { width: 4, height: 4, borderRadius: 2, marginRight: 4 },
  sharedName: { fontSize: 7.5, color: INK },
  sharedN: { fontSize: 6.5, color: MUTED, marginLeft: 3 },
  balBar: { flexDirection: "row", height: 6, backgroundColor: HAIR, marginBottom: 6 },
  balRow: { flexDirection: "row", alignItems: "center", marginBottom: 2.5 },
  balLabel: { flex: 1, fontSize: 7.5, color: INK },
  balN: { fontSize: 6.5, color: MUTED },

  /* ── the grid ────────────────────────────────────────────────────── */
  head: { borderTopWidth: 0.5, borderTopColor: HAIR },
  hrow: { flexDirection: "row" },
  corner: { width: PERSON_W, backgroundColor: CARD, justifyContent: "center", paddingHorizontal: 6, ...hair },
  cornerT: { fontSize: 7, letterSpacing: 1.4, color: MUTED, textTransform: "uppercase" },
  cornerS: { fontSize: 6, lineHeight: 1.3, color: MUTED },
  dhead: { height: BAND_H, justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  dheadT: { fontSize: 7, letterSpacing: 1, color: CARD, textTransform: "uppercase" },
  dheadM: { fontSize: 6, color: CARD, opacity: 0.85, marginTop: 1 },
  vcell: { width: THEME_W, height: VHEAD_H, backgroundColor: CARD, alignItems: "center", justifyContent: "center", ...hair },
  /* Rotated about its own centre, so the label lands as a vertical strip in the
     middle of its column; left-aligned inside that strip, so short names start
     at the foot of the header the way they do on screen. */
  vtext: { width: VHEAD_H - 8, fontSize: 6.5, color: INK, transform: "rotate(-90deg)", transformOrigin: "center" },

  row: { flexDirection: "row", height: ROW_H, borderBottomWidth: 0.5, borderBottomColor: HAIR },
  nameCell: { width: PERSON_W, backgroundColor: CARD, justifyContent: "center", overflow: "hidden", paddingHorizontal: 6, ...hair },
  nameT: { fontSize: 7, color: INK },
  cell: { width: THEME_W, alignItems: "center", justifyContent: "center", ...hair },
  sumCell: { width: SUM_W, alignItems: "center", justifyContent: "center", backgroundColor: CARD, ...hair },
  rank: { fontSize: 6.5 },
  rankStrong: { fontSize: 6.5, fontFamily: BASE, fontWeight: MEDIUM_WEIGHT },
  /* Domain groups keep the rule the screen draws between them; the summary
     block is fenced off in ink, because it is a different kind of number. */
  dsep: { borderLeftWidth: 1, borderLeftColor: HAIR },
  sumsep: { borderLeftWidth: 1, borderLeftColor: INK },

  foot: { flexDirection: "row", height: FOOT_H, borderTopWidth: 1.5, borderTopColor: INK },
  footName: { width: PERSON_W, backgroundColor: "#F7F5F1", justifyContent: "center", paddingHorizontal: 6, ...hair },
  footT: { fontSize: 6.5, letterSpacing: 1.2, color: INK, textTransform: "uppercase" },
  footS: { fontSize: 5.5, color: MUTED, marginTop: 0.5 },
  footCell: { alignItems: "center", justifyContent: "center", backgroundColor: "#F7F5F1", ...hair },

  legend: { flexDirection: "row", alignItems: "center", marginTop: 7 },
  key: { width: 26, paddingVertical: 1.5, marginRight: 5, fontSize: 6, textAlign: "center" },
  legendT: { fontSize: 6.5, color: MUTED },

  pageFoot: {
    position: "absolute", bottom: 14, left: PAD_X, right: PAD_X,
    flexDirection: "row", justifyContent: "space-between",
  },
  pageFootT: { fontSize: 6, color: MUTED },
});

export interface TeamGridPDFProps {
  /** In the order the screen is showing them — alphabetical, by domain, or dragged. */
  people: TeamPerson[];
  /** ISO date the export was taken. */
  generatedAt: string;
}

export function TeamGridPDF({ people, generatedAt }: TeamGridPDFProps) {
  const holders = holderCounts(people);
  const slots = domainSlots(people);
  const totalSlots = people.length * TOP_N;
  const pct = (n: number) => share(n, totalSlots);
  const missing = THEME_ORDER.filter((t) => holders[t] === 0);
  const shared = THEME_ORDER
    .filter((t) => holders[t] >= SHARED_AT)
    .sort((a, b) => holders[b] - holders[a] || THEME_ORDER.indexOf(a) - THEME_ORDER.indexOf(b));

  return (
    <Document title="Team strengths">
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.headRow}>
          <Text style={s.h1}>Team strengths</Text>
          <View style={s.headMeta}>
            <Text style={s.eyebrow}>ForzaMap strengths profile</Text>
            <Text style={s.eyebrow}>
              {plural(people.length, "person", "people")} · {fmtReportDate(generatedAt)}
            </Text>
          </View>
        </View>

        {/* Never behind a disclosure on screen, and never dropped from the
            export: the grid is legible enough to invite a comparison the
            instrument cannot support, so the reason it cannot travels with it. */}
        <View style={s.caveat}>
          <Text style={s.caveatT}>{IPSATIVE_CAVEAT}</Text>
        </View>

        <View style={s.gaps}>
          <View style={[s.gap, s.gapGutter]}>
            <Text style={s.gapH}>Nobody's top five</Text>
            {missing.length === 0 ? (
              <Text style={s.gapP}>
                Every one of the {THEME_ORDER.length} themes is somebody's signature strength.
              </Text>
            ) : (
              <>
                <Text style={s.gapP}>
                  {plural(missing.length, "theme")} nobody on this team leads with.
                </Text>
                {GROUPS.map(({ domain, themes }) => {
                  const gone = themes.filter((t) => missing.includes(t));
                  if (gone.length === 0) return null;
                  return (
                    <View key={domain} style={s.gapGrp}>
                      <Text style={{ ...s.gapDom, color: DOMAINS[domain].color }}>
                        {DOMAINS[domain].label}
                      </Text>
                      <Text style={s.gapList}>{gone.map((t) => THEMES[t].name).join(", ")}</Text>
                    </View>
                  );
                })}
              </>
            )}
          </View>

          <View style={[s.gap, s.gapGutter]}>
            <Text style={s.gapH}>Shared by three or more</Text>
            {shared.length === 0 ? (
              <Text style={s.gapP}>
                No theme is in the top five of three or more people — the team's signature
                strengths are spread thinly.
              </Text>
            ) : (
              <View style={s.sharedWrap}>
                {shared.map((t) => (
                  <View key={t} style={s.sharedItem}>
                    <View style={{ ...s.dot, backgroundColor: DOMAINS[THEMES[t].domain].color }} />
                    <Text style={s.sharedName}>{THEMES[t].name}</Text>
                    <Text style={s.sharedN}>{holders[t]}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={s.gap}>
            <Text style={s.gapH}>Domain balance</Text>
            <Text style={s.gapP}>
              {plural(totalSlots, "signature slot")} across {plural(people.length, "person", "people")}.
            </Text>
            <View style={s.balBar}>
              {DOMAIN_ORDER.map((d) => (
                <View key={d} style={{ width: `${pct(slots[d])}%`, backgroundColor: DOMAINS[d].color }} />
              ))}
            </View>
            {DOMAIN_ORDER.map((d) => (
              <View key={d} style={s.balRow}>
                <View style={{ ...s.dot, backgroundColor: DOMAINS[d].color }} />
                <Text style={s.balLabel}>{DOMAINS[d].label}</Text>
                <Text style={s.balN}>{slots[d]} · {pct(slots[d])}%</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── the two header rows, repeated on every page ─────────────── */}
        <View style={s.head} fixed>
          <View style={s.hrow}>
            <View style={{ ...s.corner, height: BAND_H }}>
              <Text style={s.cornerT}>Person</Text>
            </View>
            {GROUPS.map(({ domain, themes }) => (
              <View key={domain}
                style={{ ...s.dhead, width: themes.length * THEME_W, backgroundColor: DOMAINS[domain].color }}>
                <Text style={s.dheadT}>{DOMAINS[domain].label}</Text>
                <Text style={s.dheadM}>{slots[domain]} slots · {pct(slots[domain])}%</Text>
              </View>
            ))}
            <View style={{ ...s.dhead, ...s.sumsep, width: DOMAIN_ORDER.length * SUM_W, backgroundColor: INK }}>
              <Text style={s.dheadT}>Top 5</Text>
              <Text style={s.dheadM}>by domain</Text>
            </View>
          </View>

          <View style={s.hrow}>
            <View style={{ ...s.corner, height: VHEAD_H, justifyContent: "flex-end", paddingBottom: 5 }}>
              <Text style={s.cornerS}>Rank within the person</Text>
              <Text style={s.cornerS}>blank past {SHOWN_RANKS}</Text>
            </View>
            {GROUPS.map(({ themes }) =>
              themes.map((t, i) => (
                <View key={t} style={i === 0 ? { ...s.vcell, ...s.dsep } : s.vcell}>
                  <Text style={s.vtext}>{THEMES[t].name}</Text>
                </View>
              )))}
            {DOMAIN_ORDER.map((d, i) => (
              <View key={d}
                style={i === 0
                  ? { ...s.vcell, ...s.sumsep, width: SUM_W }
                  : { ...s.vcell, width: SUM_W }}>
                <Text style={{ ...s.vtext, color: DOMAINS[d].color }}>{SHORT[d]}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── one row per person, never split across a page ───────────── */}
        {people.map((p) => (
          <View key={p.id} style={s.row} wrap={false}>
            <View style={s.nameCell}>
              <Text style={s.nameT}>{clip(p.name)}</Text>
            </View>
            {GROUPS.map(({ domain, themes }) =>
              themes.map((t, i) => {
                const b = band(p.rank[t], DOMAINS[domain].color);
                const cell = {
                  ...s.cell,
                  ...(i === 0 ? s.dsep : null),
                  ...(b.background ? { backgroundColor: b.background } : null),
                };
                return (
                  <View key={t} style={cell}>
                    {p.rank[t] <= SHOWN_RANKS && (
                      <Text style={b.strong ? { ...s.rankStrong, color: b.color } : { ...s.rank, color: b.color }}>
                        {p.rank[t]}
                      </Text>
                    )}
                  </View>
                );
              }))}
            {DOMAIN_ORDER.map((d, i) => (
              <View key={d}
                style={i === 0
                  ? { ...s.sumCell, ...s.sumsep, backgroundColor: p.dom[d] ? blend(DOMAINS[d].color, 0.1) : CARD }
                  : { ...s.sumCell, backgroundColor: p.dom[d] ? blend(DOMAINS[d].color, 0.1) : CARD }}>
                <Text style={{ ...s.rank, color: p.dom[d] ? DOMAINS[d].color : HAIR }}>
                  {p.dom[d] || "·"}
                </Text>
              </View>
            ))}
          </View>
        ))}

        {/* Whole-team counts, so they belong under the last row rather than
            under every page's last row. */}
        <View style={s.foot} wrap={false}>
          <View style={s.footName}>
            <Text style={s.footT}>In top 5</Text>
            <Text style={s.footS}>count of people — not a column total</Text>
          </View>
          {GROUPS.map(({ domain, themes }) =>
            themes.map((t, i) => (
              <View key={t}
                style={i === 0
                  ? { ...s.footCell, ...s.dsep, width: THEME_W }
                  : { ...s.footCell, width: THEME_W }}>
                <Text style={{ ...s.rank, color: holders[t] ? DOMAINS[domain].color : HAIR }}>
                  {holders[t] || "·"}
                </Text>
              </View>
            )))}
          {DOMAIN_ORDER.map((d, i) => (
            <View key={d}
              style={i === 0
                ? { ...s.footCell, ...s.sumsep, width: SUM_W }
                : { ...s.footCell, width: SUM_W }}>
              <Text style={{ ...s.rank, color: slots[d] ? DOMAINS[d].color : HAIR }}>
                {slots[d] || "·"}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.legend} wrap={false}>
          <Text style={{ ...s.key, backgroundColor: INK, color: CARD }}>1–3</Text>
          <Text style={{ ...s.key, backgroundColor: blend(INK, 0.45), color: INK }}>4–7</Text>
          <Text style={{ ...s.key, backgroundColor: blend(INK, 0.18), color: MUTED }}>8–10</Text>
          <Text style={s.legendT}>
            Rank within that person, in their theme's domain colour. Blank past {SHOWN_RANKS}.
          </Text>
        </View>

        {/* Page furniture, not flow content — `fixed` keeps it out of the height
            accounting, so it cannot push the last rows onto a page of their own. */}
        <View style={s.pageFoot} fixed>
          <Text style={s.pageFootT}>
            Ipsative (intra-individual) profile for development use. Ranks are relative within
            each person and are not comparable across people. Not affiliated with Gallup CliftonStrengths.
          </Text>
          <Text style={s.pageFootT} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/* The renderer is reached through here rather than from the page, so the whole
   of @react-pdf/renderer stays behind this module's dynamic import and the
   grid route does not carry it until somebody asks for a document. */
export const teamGridPdfBlob = (props: TeamGridPDFProps): Promise<Blob> =>
  pdf(<TeamGridPDF {...props} />).toBlob();
