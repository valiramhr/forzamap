import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import { PDF_FONTS, NO_BREAK } from "./ReportPDF";
import { DOMAINS, THEMES } from "../lib/instrument";
import {
  DOMAIN_ORDER, THEME_ORDER, GROUPS, SHORT, TOP_N, SHARED_AT,
  DEPTH_DEFAULT, CARD, IPSATIVE_CAVEAT, SCARCITY_NOTE,
  band, blend, contrastNote, depthHeadNote, depthNote, gapSummary, isSharp,
  legendKeys, plural, poolPeople, scopeTitle, share, shows, themeContrasts,
  type DepthMode, type GapScope, type GapSummary, type TeamRoster, type ThemeContrast,
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
   flow and lands on the last page of the GRID — a per-page repeat would state
   a whole-team count under a partial one.

   EACH TEAM GETS ITS OWN PAGE, however many sheets its rows then take. That is
   what keeps one team's `fixed` header — and its domain-band percentages,
   which are that team's — off another team's rows.

   The gap analysis travels at whichever of its three scopes the screen is
   showing, and every sheet says which in the footer, so a page found on its
   own on a desk states the reading it carries. "This team" is drawn inside
   each team's own page, above its grid, because that is where it belongs; the
   two cross-team scopes lead the document on a page of their own, because
   they belong to no single grid.

   A second-to-last Page follows with all twenty theme descriptions. It is a
   Page of its own rather than more flow, which is what makes it the last sheet
   whatever the team sizes: react-pdf lays Pages out in order, so however many
   sheets the rows take, the reference is the one after them.

   Everything the ranks mean, and cannot mean, is in lib/teamgrid.ts alongside
   the screen's own reading of them — including how far down each row is drawn,
   which the grid's depth control sets and this document follows. */

const { base: BASE, display: DISPLAY, displayWeight: DISPLAY_WEIGHT, mediumWeight: MEDIUM_WEIGHT } = PDF_FONTS;
const display = { fontFamily: DISPLAY, fontWeight: DISPLAY_WEIGHT };

/* A4 landscape is 841.89 × 595.28pt. The 25 columns are laid out against the
   live width rather than measured from content: the theme columns take
   whatever is left once the person column and the four summaries are paid
   for, which is the same bargain the screen grid strikes. */
const PAGE_W = 841.89;
const PAD_X = 22, PAD_TOP = 20, PAD_BOTTOM = 32;
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
const clip = (s: string, max = NAME_MAX) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

const hair = { borderRightWidth: 0.5, borderRightColor: HAIR };

/* The comparison table's own geometry. The theme names and the one-line
   reading take fixed columns; the teams share what is left. Past six teams the
   reading column is dropped rather than squeezing the counts, which are the
   part of the table that has to stay legible. */
const CMP_THEME_W = 104;
const CMP_NOTE_W = 148;
const CMP_ROW_H = 13;
function cmpWidths(n: number) {
  const note = n > 0 && n <= 6 ? CMP_NOTE_W : 0;
  return { note, team: Math.max(26, (CONTENT_W - CMP_THEME_W - note) / Math.max(1, n)) };
}

const s = StyleSheet.create({
  page: {
    paddingHorizontal: PAD_X, paddingTop: PAD_TOP, paddingBottom: PAD_BOTTOM,
    backgroundColor: PAPER, fontFamily: BASE, color: INK,
  },

  /* ── page preamble ───────────────────────────────────────────────── */
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 7 },
  h1: { ...display, fontSize: 17, letterSpacing: -0.6 },
  h1sub: { fontSize: 8, color: MUTED, marginTop: 2 },
  headMeta: { alignItems: "flex-end" },
  eyebrow: { fontSize: 7.5, letterSpacing: 1.6, color: MUTED, textTransform: "uppercase" },
  /* The same three-sided silence and one loud edge the screen gives it. */
  caveat: {
    borderLeftWidth: 2, borderLeftColor: FORZA, backgroundColor: CARD,
    paddingVertical: 6, paddingHorizontal: 8, marginBottom: 10,
  },
  caveatT: { fontSize: 7.5, lineHeight: 1.45, color: BODY },

  /* The scope, said in the body of the page as well as in the footer: a
     reader looking at the analysis should not have to look away to learn
     which population it is about. */
  scopeBar: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    borderBottomWidth: 1.5, borderBottomColor: INK, paddingBottom: 4, marginBottom: 8,
  },
  scopeT: { fontSize: 9, letterSpacing: 1.4, color: INK, textTransform: "uppercase" },
  scopeN: { fontSize: 7.5, color: BODY, maxWidth: 460, textAlign: "right", lineHeight: 1.4 },
  /* The one thing the numbers cannot say about themselves. */
  note: {
    borderLeftWidth: 1.5, borderLeftColor: HAIR, backgroundColor: CARD,
    paddingVertical: 5, paddingHorizontal: 7, marginBottom: 9,
  },
  noteT: { fontSize: 7, lineHeight: 1.45, color: MUTED },

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

  /* ── the comparison ──────────────────────────────────────────────── */
  cmpHead: { flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: INK, alignItems: "flex-end" },
  cmpHeadCell: { paddingBottom: 3, paddingHorizontal: 3, alignItems: "center" },
  cmpHeadT: { fontSize: 6.5, letterSpacing: 0.9, color: INK, textTransform: "uppercase" },
  cmpHeadS: { fontSize: 6, color: MUTED, marginTop: 0.5 },
  cmpRow: { flexDirection: "row", height: CMP_ROW_H, alignItems: "stretch",
    borderBottomWidth: 0.5, borderBottomColor: HAIR },
  cmpTheme: { width: CMP_THEME_W, flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  cmpThemeT: { fontSize: 7, color: INK },
  cmpCell: { alignItems: "center", justifyContent: "center", ...hair },
  cmpN: { fontSize: 7 },
  cmpNStrong: { fontSize: 7, fontFamily: BASE, fontWeight: MEDIUM_WEIGHT },
  cmpNote: { width: CMP_NOTE_W, justifyContent: "center", paddingLeft: 6 },
  cmpNoteT: { fontSize: 6.5, color: MUTED },
  cmpNoteSharp: { fontSize: 6.5, color: BODY },

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
  /* The bottom-five treatment: a rule around an unfilled cell, drawn as a box
     inside the cell rather than on the cell itself, so it cannot overwrite the
     hairline that separates the columns or the rule between domain groups. */
  outline: {
    flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center",
    borderWidth: 0.75,
  },
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
  legendT: { fontSize: 6.5, color: MUTED, flex: 1 },

  /* ── the reference page ──────────────────────────────────────────────
     Landscape A4 is 798pt of live width. One column of that is a ~150-character
     measure — unreadable — so the twenty descriptions run as four columns, one
     per domain, which lands the domain grouping and the column break on the
     same lines and gives each column a ~40-character measure. */
  refCols: { flexDirection: "row", marginTop: 8 },
  refCol: { flex: 1 },
  refColGutter: { marginRight: 18 },
  refDomain: {
    fontSize: 8.5, letterSpacing: 1.6, textTransform: "uppercase",
    borderBottomWidth: 1, paddingBottom: 4, marginBottom: 8,
  },
  refItem: { marginBottom: 10 },
  /* 10pt against a ~185pt column is a ~37-character measure — narrow, which is
     what the hyphenation callback below is for, but a page of reference text
     set at the grid's own 6.5pt would be unreadable. */
  refText: { fontSize: 10, color: BODY, lineHeight: 1.5 },
  refName: { ...display, fontSize: 10, color: INK, letterSpacing: -0.35 },
  refNote: { fontSize: 8.5, lineHeight: 1.45, color: MUTED, marginBottom: 2 },

  /* Two lines rather than one: the scope has to be readable at a glance on a
     sheet picked up on its own, and it will not fit beside the disclaimer. */
  pageFoot: { position: "absolute", bottom: 12, left: PAD_X, right: PAD_X },
  pageFootRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  pageFootScope: { fontSize: 6.5, letterSpacing: 1.1, color: INK, textTransform: "uppercase" },
  pageFootT: { fontSize: 6, color: MUTED },
});

/** Every sheet says which reading it is carrying, and what a rank is not. */
const PageFoot = ({ scope }: { scope: GapScope }) => (
  <View style={s.pageFoot} fixed>
    <View style={s.pageFootRow}>
      <Text style={s.pageFootScope}>{scopeTitle(scope)}</Text>
      <Text style={s.pageFootT} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
    <Text style={s.pageFootT}>
      Ipsative (intra-individual) profile for development use. Ranks are relative within
      each person and are not comparable across people. Not affiliated with Gallup CliftonStrengths.
    </Text>
  </View>
);

const Caveat = () => (
  <View style={s.caveat}>
    <Text style={s.caveatT}>{IPSATIVE_CAVEAT}</Text>
  </View>
);

/* ── the three cards ─────────────────────────────────────────────────────
   The same three questions whether they are asked of one team or of everybody
   pooled; only who they are asked about changes, so only the wording does. */
function GapCards({ summary, who, whose }: { summary: GapSummary; who: string; whose: string }) {
  const { holders, missing, shared, slots, totalSlots, people } = summary;
  const pct = (n: number) => share(n, totalSlots);
  return (
    <View style={s.gaps} wrap={false}>
      <View style={[s.gap, s.gapGutter]}>
        <Text style={s.gapH}>Nobody's top five</Text>
        {missing.length === 0 ? (
          <Text style={s.gapP}>
            Every one of the {THEME_ORDER.length} themes is somebody's signature strength.
          </Text>
        ) : (
          <>
            <Text style={s.gapP}>
              {plural(missing.length, "theme")} nobody on {who} leads with.
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
            No theme is in the top five of {SHARED_AT} or more people — {whose} signature
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
          {plural(totalSlots, "signature slot")} across {plural(people, "person", "people")}.
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
  );
}

/* ── the differential ────────────────────────────────────────────────────
   Themes down the side, teams across — the shape that makes "four here and
   none there" a single glance along a row. Every cell is a count of people,
   tinted by that count's share of its own team, because a 4 on a team of five
   and a 4 on a team of forty are not the same fact. */
function CompareTable({ rows, teams }: { rows: ThemeContrast[]; teams: TeamRoster[] }) {
  const { note, team: TW } = cmpWidths(teams.length);
  return (
    <View>
      <View style={s.cmpHead}>
        <View style={{ ...s.cmpHeadCell, width: CMP_THEME_W, alignItems: "flex-start" }}>
          <Text style={s.cmpHeadT}>Theme</Text>
          <Text style={s.cmpHeadS}>sharpest contrast first</Text>
        </View>
        {teams.map((t) => (
          <View key={t.id} style={{ ...s.cmpHeadCell, width: TW }}>
            <Text style={s.cmpHeadT}>{clip(t.name, 14)}</Text>
            <Text style={s.cmpHeadS}>{t.people.length}</Text>
          </View>
        ))}
        {note > 0 && (
          <View style={{ ...s.cmpHeadCell, width: note, alignItems: "flex-start", paddingLeft: 6 }}>
            <Text style={s.cmpHeadT}>Reading</Text>
          </View>
        )}
      </View>

      {rows.map((c) => {
        const color = DOMAINS[THEMES[c.theme].domain].color;
        return (
          <View key={c.theme} style={s.cmpRow} wrap={false}>
            <View style={s.cmpTheme}>
              <View style={{ ...s.dot, backgroundColor: color }} />
              <Text style={s.cmpThemeT}>{clip(THEMES[c.theme].name, 18)}</Text>
            </View>
            {c.teams.map((tc) => (
              <View key={tc.id}
                style={tc.n === 0
                  ? { ...s.cmpCell, width: TW }
                  : { ...s.cmpCell, width: TW, backgroundColor: blend(color, 0.1 + 0.45 * tc.share) }}>
                <Text style={tc.id === c.peak?.id
                  ? { ...s.cmpNStrong, color: INK }
                  : { ...s.cmpN, color: tc.n === 0 ? HAIR : INK }}>
                  {tc.n || "·"}
                </Text>
              </View>
            ))}
            {note > 0 && (
              <View style={s.cmpNote}>
                <Text style={isSharp(c) ? s.cmpNoteSharp : s.cmpNoteT}>{contrastNote(c)}</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export interface TeamGridPDFProps {
  /** In the order the screen is showing them, each with its rows in the order
      the screen is showing those. */
  teams: TeamRoster[];
  /** Which gap reading the screen has open; the document carries the same one
      and says so on every sheet. */
  scope: GapScope;
  /** ISO date the export was taken. */
  generatedAt: string;
  /** How far down each ranking the screen is drawing; the document follows it. */
  depth?: DepthMode;
}

export function TeamGridPDF({ teams, scope, generatedAt, depth = DEPTH_DEFAULT }: TeamGridPDFProps) {
  /* A team with nobody scored has no counts to draw and no absence to read:
     "nobody leads with it here" and "nobody here was measured" are different
     facts, and only the first one belongs in a comparison. */
  const live = teams.filter((t) => t.people.length > 0);
  const pooled = poolPeople(teams);
  const pooledGaps = gapSummary(pooled.people);
  const contrasts = scope === "compare" ? themeContrasts(teams) : [];
  const sharp = contrasts.filter(isSharp);

  return (
    <Document title={`Team strengths — ${scopeTitle(scope)}`}>
      {/* ── the cross-team readings, on a page of their own ────────────
          They belong to no single grid, so they lead the document rather than
          sitting above whichever team happened to be drawn first. */}
      {scope !== "team" && (
        <Page size="A4" orientation="landscape" style={s.page}>
          <View style={s.headRow}>
            <View>
              <Text style={s.h1}>Team strengths</Text>
              <Text style={s.h1sub}>
                {plural(live.length, "team")} · {plural(pooled.people.length, "person", "people")}
              </Text>
            </View>
            <View style={s.headMeta}>
              <Text style={s.eyebrow}>ForzaMap strengths profile</Text>
              <Text style={s.eyebrow}>{fmtReportDate(generatedAt)}</Text>
            </View>
          </View>

          <Caveat />

          {scope === "all" ? (
            <>
              <View style={s.scopeBar}>
                <Text style={s.scopeT}>All teams combined</Text>
                <Text style={s.scopeN}>
                  {plural(pooled.people.length, "person", "people")} across{" "}
                  {plural(live.length, "team")}, each counted once
                  {pooled.repeated > 0
                    ? ` — ${plural(pooled.repeated, "person", "people")} on more than one team, ` +
                      `${pooled.memberships} memberships in all`
                    : ""}.
                </Text>
              </View>
              <View style={s.note}>
                <Text style={s.noteT}>{SCARCITY_NOTE}</Text>
              </View>
              <GapCards summary={pooledGaps} who="any team" whose="the pool's" />
            </>
          ) : (
            <>
              <View style={s.scopeBar}>
                <Text style={s.scopeT}>Compare teams</Text>
                <Text style={s.scopeN}>
                  {sharp.length === 0
                    ? "No theme sits in one team's top fives and in nobody's on another."
                    : `${plural(sharp.length, "theme")} sit in one team's top fives and in ` +
                      "nobody's on another — those come first."}
                  {" "}People, team by team; a share is against that team's own size.
                </Text>
              </View>
              {live.length < 2
                ? <Text style={s.gapP}>Two teams with scored people are needed to compare.</Text>
                : <CompareTable rows={contrasts} teams={live} />}
            </>
          )}

          <PageFoot scope={scope} />
        </Page>
      )}

      {/* ── one page per team ──────────────────────────────────────── */}
      {teams.map((t) => {
        const summary = gapSummary(t.people);
        const { holders, slots, totalSlots } = summary;
        const pct = (n: number) => share(n, totalSlots);
        return (
          <Page key={t.id} size="A4" orientation="landscape" style={s.page}>
            <View style={s.headRow}>
              <View>
                <Text style={s.h1}>{clip(t.name, 42)}</Text>
                <Text style={s.h1sub}>
                  Team strengths · {plural(t.people.length, "person", "people")}
                </Text>
              </View>
              <View style={s.headMeta}>
                <Text style={s.eyebrow}>ForzaMap strengths profile</Text>
                <Text style={s.eyebrow}>{fmtReportDate(generatedAt)}</Text>
              </View>
            </View>

            {/* Never behind a disclosure on screen, and never dropped from the
                export: the grid is legible enough to invite a comparison the
                instrument cannot support, so the reason it cannot travels with
                every sheet of it. */}
            <Caveat />

            {/* Scope 1 is a fact about this team, so it is drawn here. The
                other two led the document and are not repeated per team. */}
            {scope === "team" && t.people.length > 0 && (
              <GapCards summary={summary} who="this team" whose="the team's" />
            )}

            {t.people.length === 0 ? (
              <Text style={s.gapP}>Nobody on this team has a scored profile.</Text>
            ) : (
              <>
                {/* ── the two header rows, repeated on every page ─────── */}
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
                      <Text style={s.cornerS}>{depthHeadNote(depth)}</Text>
                    </View>
                    {GROUPS.map(({ themes }) =>
                      themes.map((th, i) => (
                        <View key={th} style={i === 0 ? { ...s.vcell, ...s.dsep } : s.vcell}>
                          <Text style={s.vtext}>{THEMES[th].name}</Text>
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

                {/* ── one row per person, never split across a page ───── */}
                {t.people.map((p) => (
                  <View key={p.id} style={s.row} wrap={false}>
                    <View style={s.nameCell}>
                      <Text style={s.nameT}>{clip(p.name)}</Text>
                    </View>
                    {GROUPS.map(({ domain, themes }) =>
                      themes.map((th, i) => {
                        const rank = p.rank[th];
                        const b = band(rank, DOMAINS[domain].color, depth);
                        const cell = {
                          ...s.cell,
                          ...(i === 0 ? s.dsep : null),
                          ...(b.background ? { backgroundColor: b.background } : null),
                        };
                        const numeral = (
                          <Text style={b.strong ? { ...s.rankStrong, color: b.color } : { ...s.rank, color: b.color }}>
                            {rank}
                          </Text>
                        );
                        return (
                          <View key={th} style={cell}>
                            {b.outline
                              ? <View style={{ ...s.outline, borderColor: b.outline }}>{numeral}</View>
                              : shows(rank, depth) && numeral}
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

                {/* Whole-team counts, so they belong under the last row rather
                    than under every page's last row. */}
                <View style={s.foot} wrap={false}>
                  <View style={s.footName}>
                    <Text style={s.footT}>In top 5</Text>
                    <Text style={s.footS}>count of people — not a column total</Text>
                  </View>
                  {GROUPS.map(({ domain, themes }) =>
                    themes.map((th, i) => (
                      <View key={th}
                        style={i === 0
                          ? { ...s.footCell, ...s.dsep, width: THEME_W }
                          : { ...s.footCell, width: THEME_W }}>
                        <Text style={{ ...s.rank, color: holders[th] ? DOMAINS[domain].color : HAIR }}>
                          {holders[th] || "·"}
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

                {/* Drawn from the same `band` the cells are, so the key cannot
                    describe a banding the document is not using. */}
                <View style={s.legend} wrap={false}>
                  {legendKeys(depth).map(({ label, band: b }) => (
                    <Text key={label}
                      style={{
                        ...s.key,
                        ...(b.background ? { backgroundColor: b.background } : null),
                        ...(b.outline ? { borderWidth: 0.75, borderColor: b.outline } : null),
                        color: b.color,
                      }}>
                      {label}
                    </Text>
                  ))}
                  <Text style={s.legendT}>
                    Rank within that person, in their theme's domain colour. {depthNote(depth)}
                  </Text>
                </View>
              </>
            )}

            <PageFoot scope={scope} />
          </Page>
        );
      })}

      {/* ── the twenty themes, as reference ──────────────────────────────
          The last sheet however many the rows took. Nobody reading a grid of
          rank numerals is carrying twenty theme definitions in their head, and
          the descriptions are the instrument's own words for them — verbatim
          from lib/instrument.ts, the same text the individual report sets. */}
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.headRow}>
          <Text style={s.h1}>The twenty themes</Text>
          <View style={s.headMeta}>
            <Text style={s.eyebrow}>ForzaMap strengths profile</Text>
            <Text style={s.eyebrow}>Reference</Text>
          </View>
        </View>
        <Text style={s.refNote}>
          What each column of the grid means. Every person is ranked on all
          {" "}{THEME_ORDER.length} of them, whichever ranks the grid is showing.
        </Text>

        <View style={s.refCols}>
          {GROUPS.map(({ domain, themes }, c) => (
            <View key={domain}
              style={c === GROUPS.length - 1 ? s.refCol : { ...s.refCol, ...s.refColGutter }}>
              <Text style={{ ...s.refDomain, color: DOMAINS[domain].color,
                borderBottomColor: DOMAINS[domain].color }}>
                {DOMAINS[domain].label}
              </Text>
              {themes.map((t) => (
                <View key={t} style={s.refItem}>
                  {/* The column measure is ~40 characters, at which react-pdf's
                      default breaking sets "nav-igate" and "ap-proach". */}
                  <Text style={s.refText} hyphenationCallback={NO_BREAK}>
                    <Text style={s.refName}>{THEMES[t].name}</Text> — {THEMES[t].desc}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <PageFoot scope={scope} />
      </Page>
    </Document>
  );
}

/* The renderer is reached through here rather than from the page, so the whole
   of @react-pdf/renderer stays behind this module's dynamic import and the
   grid route does not carry it until somebody asks for a document. */
export const teamGridPdfBlob = (props: TeamGridPDFProps): Promise<Blob> =>
  pdf(<TeamGridPDF {...props} />).toBlob();
