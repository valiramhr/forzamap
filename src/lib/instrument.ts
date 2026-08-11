/* Original forced-choice strengths instrument — not Gallup CliftonStrengths.
   20 themes across 4 domains (5 each), 130 paired items, 20s per item.
   Each theme has 13 statements (10 positive, 3 reverse) and appears exactly
   13 times, so every statement is shown exactly once.
   See METHODOLOGY.md for the full method. */

export type DomainKey = "executing" | "influencing" | "relating" | "thinking";
export type ThemeKey =
  | "driver" | "organiser" | "finisher" | "mender" | "compass"
  | "persuader" | "catalyst" | "voice" | "contender" | "opener"
  | "connector" | "harmoniser" | "empathiser" | "cultivator" | "welcomer"
  | "analyst" | "visionary" | "learner" | "originator" | "navigator";

export const DOMAINS: Record<DomainKey, { label: string; color: string; note: string }> = {
  executing:   { label: "Executing",             color: "#9C3D54", note: "How you make things happen" },
  influencing: { label: "Influencing",           color: "#C08A2D", note: "How you reach others" },
  relating:    { label: "Relationship Building", color: "#2E7D74", note: "How you build bonds" },
  thinking:    { label: "Strategic Thinking",    color: "#3B5C99", note: "How you take in the world" },
};

export const THEMES: Record<ThemeKey, { name: string; domain: DomainKey; desc: string }> = {
  // ── Executing ───────────────────────────────────────────────────────
  driver:     { name: "Driver",     domain: "executing", desc: "You turn intention into motion. You feel restless until progress is visible and push work past the finish line." },
  organiser:  { name: "Organiser",  domain: "executing", desc: "You bring order to complexity — the systems, sequences and structures that let work run smoothly." },
  finisher:   { name: "Finisher",   domain: "executing", desc: "You are wired for completion. Loose ends bother you, and you take pride in closing things out well." },
  mender:     { name: "Mender",     domain: "executing", desc: "You are drawn to what is broken. Diagnosing a fault and restoring something to working order is its own reward." },
  compass:    { name: "Compass",    domain: "executing", desc: "Your work has to mean something. You navigate by fixed principles, and purpose is a precondition for your effort rather than a bonus." },
  // ── Influencing ─────────────────────────────────────────────────────
  persuader:  { name: "Persuader",  domain: "influencing", desc: "You bring people around to a point of view and enjoy the challenge of making the case." },
  catalyst:   { name: "Catalyst",   domain: "influencing", desc: "You supply the initial energy that overcomes inertia and gets others moving." },
  voice:      { name: "Voice",      domain: "influencing", desc: "You are comfortable being heard — you speak up and put words to what a group is thinking." },
  contender:  { name: "Contender",  domain: "influencing", desc: "You measure yourself against others. Comparison sharpens you, and coming first genuinely matters." },
  opener:     { name: "Opener",     domain: "influencing", desc: "You turn strangers into contacts. The approach that others find awkward is the part you enjoy." },
  // ── Relationship Building ───────────────────────────────────────────
  connector:  { name: "Connector",  domain: "relating", desc: "You build and tend relationships naturally, seeing how people fit together." },
  harmoniser: { name: "Harmoniser", domain: "relating", desc: "You seek common ground, reduce friction and keep a group working together." },
  empathiser: { name: "Empathiser", domain: "relating", desc: "You read the emotional temperature and sense what others feel, often before they say it." },
  cultivator: { name: "Cultivator", domain: "relating", desc: "You are energised by other people's growth. You see potential early and invest in it." },
  welcomer:   { name: "Welcomer",   domain: "relating", desc: "You notice who is on the edge of a group and widen the circle to bring them in." },
  // ── Strategic Thinking ──────────────────────────────────────────────
  analyst:    { name: "Analyst",    domain: "thinking", desc: "You reason from evidence — you want the data, test the logic and trust conclusions that hold up." },
  visionary:  { name: "Visionary",  domain: "thinking", desc: "You live slightly in the future, seeing what could be and pulling others toward it." },
  learner:    { name: "Learner",    domain: "thinking", desc: "You are energised by growth. Getting better at something matters as much as the result." },
  originator: { name: "Originator", domain: "thinking", desc: "Ideas arrive faster than you can use them. You connect things others see as unrelated and enjoy generating options for their own sake." },
  navigator:  { name: "Navigator",  domain: "thinking", desc: "You see the route through complexity — which option will work, where a plan will break, and how to get from here to there." },
};

// 10 positive statements per theme
const POS: Record<ThemeKey, string[]> = {
  driver: ["I keep things moving until they're done","Slow progress frustrates me","I'd rather act than plan for long","I measure my day by what I got done","Once I decide, I move on it at once","I push to keep momentum going","A visible result is what satisfies me","I'd rather be productive than idle","I dislike tasks that stall for no reason","I set the pace for the work"],
  organiser: ["I create systems to keep things in order","I break messy tasks into clear steps","A structured plan makes me feel in control","I sequence tasks logically before starting","I keep my work tidy and easy to find","When things are chaotic, I sort them out","I think in processes and checklists","I like structures others can rely on","I plan the steps before I begin","I bring order to a messy situation"],
  finisher: ["Leaving something unfinished nags at me","I tie up every loose end","I see tasks fully completed","I double-check before I call it done","I follow through after the excitement fades","Delivering on a promise matters to me","I like crossing a task fully off the list","I hold myself to finishing what I start","Open tasks bother me until they're closed","I stay with a task until it's complete"],
  mender: ["I'm drawn to things that are broken","I enjoy working out why something failed","I'd rather fix a problem than start something new","I notice faults that others walk past","Restoring something to working order satisfies me","I dig until I find the root of a fault","A recurring problem bothers me until it's solved","I like turning around something underperforming","I look for what isn't working and repair it","Troubleshooting energises me"],
  compass: ["My work has to align with what I believe","I hold to my principles under pressure","I need to know why the work matters","My values guide the decisions I make","I won't take on work that conflicts with my beliefs","Purpose matters more to me than reward","I stand by a position I believe is right","I decide by what's right, not what's easy","A clear sense of purpose keeps me going","I'm consistent about what I stand for"],
  persuader: ["I enjoy changing someone's mind","I find the argument that wins people over","Making a convincing case energises me","I like negotiating to the outcome I want","I sense which point will land with a person","I push back to defend my position","Winning people to an idea feels rewarding","I adapt my pitch to who I'm talking to","I try to influence a decision when it matters","I build a case that changes minds"],
  catalyst: ["I get a stalled group moving","I like being the spark that starts things","I'd rather kick things off than wait","I bring energy that gets people going","When nothing's happening, I make the move","I rally people around a fresh idea","I volunteer to get something off the ground","I'm comfortable saying 'let's begin'","I create momentum where there was none","I turn talk into action"],
  voice: ["I'm comfortable speaking up in a group","I put words to what others can't say","I don't mind holding people's attention","I'm at ease presenting to others","I say what everyone's thinking","I can command a room when needed","I like explaining things to the group","I state my views to senior people","People tend to listen when I speak","I speak first when a group hesitates"],
  contender: ["I want to outperform the people around me","I measure myself against others","Winning matters to me","Competition brings out my best work","I keep track of where I rank","Losing pushes me to work harder","I aim to be the best on the team","A leaderboard motivates me","I compare my results to my peers'","Coming second doesn't satisfy me"],
  opener: ["I enjoy meeting people I don't know","I start conversations with strangers easily","I like winning over someone new","Breaking the ice comes naturally to me","I can make a stranger comfortable quickly","I work a room without much effort","New faces energise me","I turn a cold contact into a warm one","I find it easy to be liked by new people","I approach people I've never met"],
  connector: ["I build new relationships easily","I introduce people who should connect","I keep in touch with a wide network","I recall details that help me connect","I feel energised after meeting people","I think of who I know when a need arises","I invest time maintaining relationships","I'm the person others ask for an intro","I enjoy weaving people into a circle","I remember who knows whom"],
  harmoniser: ["I look for where people can agree","I smooth over conflict when it appears","I'd rather reach consensus than force it","I look for a compromise for everyone","I step in to calm tension","I value peaceful working relationships","I steer away from needless conflict","I work to keep everyone aligned","I ease friction between people","I find the middle ground"],
  empathiser: ["I sense how someone feels before they say","I pick up the mood in a room","Others' moods affect me strongly","I can tell when someone hides being upset","I imagine how a situation feels for others","People open up to me about feelings","I notice small shifts in tone","I feel what others are feeling","I adjust to someone's emotional state","I sense what someone needs before asking"],
  cultivator: ["I get satisfaction from someone else's progress","I spot potential in people before they see it","I invest time helping others improve","Watching someone grow rewards me","I look for chances to stretch the people around me","I give feedback that helps someone develop","I notice small improvements in others","I'd rather build capability than do it myself","Helping someone succeed matters to me","I take on the role of coach naturally"],
  welcomer: ["I notice when someone is left out","I make sure everyone is included","I bring quiet people into the conversation","I widen the circle rather than narrow it","I look out for the person on the edge of a group","I invite people who might otherwise be missed","I think everyone should have a way in","I introduce newcomers to the group","I'm uncomfortable when someone is excluded","I make room for people at the table"],
  analyst: ["I want evidence before I accept a claim","I pick apart the logic of an argument","I trust data over gut feeling","I ask how we know something is true","I dig for the root cause","I'm sceptical of unproven conclusions","I work through problems step by step","I weigh the facts before deciding","I look for patterns behind what I see","I check the numbers before I agree"],
  visionary: ["I imagine what could be","I'm drawn to the big picture","I paint a picture of the future for others","I'm energised by where things could go","I see potential others miss","I tie today's work to a larger purpose","I get excited by bold, long-range ideas","I think several steps ahead","I'd rather explore what's possible","I describe where we could be in five years"],
  learner: ["Learning something excites me","I seek chances to build new skills","I feel best when I'm improving","I enjoy diving into new subjects","I'm curious how things work","I take on tasks that stretch me","Learning for its own sake appeals to me","I track my own progress","New topics draw me in regardless of payoff","I seek out what I don't yet know"],
  originator: ["New ideas come to me easily","I enjoy generating options for their own sake","I connect ideas others see as unrelated","I think of alternatives no one has raised","Brainstorming energises me","I find fresh angles on old problems","I'd rather invent than refine","I get restless with the obvious solution","Novel concepts excite me","I produce more ideas than I can use"],
  navigator: ["I see the path through a complicated situation","I can tell which option will work before testing it","I map the route from here to the goal","I spot the obstacles ahead of time","I sort many possibilities down to the workable few","I find a way through when others see a wall","I anticipate where a plan will break","I choose the best route among several","Complexity doesn't stop me finding a way","I see several moves ahead"],
};

// 3 reverse-keyed statements per theme
const REV: Record<ThemeKey, string[]> = {
  driver: ["I'm happy to let things move at their own pace","I often delay getting started","I feel little urgency to reach the finish"],
  organiser: ["I'm fine working without much structure","I tend to leave things where they land","I'd rather improvise than plan ahead"],
  finisher: ["I lose interest once the hard part is over","I'm fine leaving tasks partly done","I move on before things are wrapped up"],
  mender: ["I'd rather replace something than repair it","Fixing what's broken feels like a chore","I leave faults for someone else to sort out"],
  compass: ["I can work on anything, regardless of its purpose","I adjust my principles to fit the situation","Whether work aligns with my values rarely matters"],
  persuader: ["I avoid trying to talk people round","I'd rather not push my own view","I back off when someone disagrees"],
  catalyst: ["I wait for others to get things started","I hold back rather than make the first move","I'm slow to get behind something new"],
  voice: ["I stay quiet in group discussions","I'd rather not be the centre of attention","I find it hard to speak up in front of others"],
  contender: ["How I compare with others doesn't interest me","I'd rather everyone succeed than come first","Competition puts me off rather than driving me"],
  opener: ["Approaching strangers makes me uncomfortable","I wait for others to introduce themselves","Meeting new people drains me"],
  connector: ["I keep my circle small","I find meeting new people draining","I rarely stay in touch once contact drops"],
  harmoniser: ["I don't mind open conflict","I'd rather win the point than keep the peace","Disagreement in a group doesn't bother me"],
  empathiser: ["I often miss how others feel","I focus on the task more than moods","Others' emotions rarely affect me"],
  cultivator: ["Developing other people isn't my responsibility","I'd rather do the work than teach someone","Other people's growth doesn't concern me much"],
  welcomer: ["Who's included isn't something I track","Some people exclude themselves, and that's fine","I focus on the group, not on who's missing"],
  analyst: ["I trust instinct over the numbers","I don't need much proof to be convinced","I'd rather decide fast than analyse"],
  visionary: ["I focus on what's in front of me","Speculation about the future bores me","I prefer concrete detail to possibility"],
  learner: ["Once competent, I stop pushing to improve","I'd rather use skills I have than learn new","Learning something new feels like a chore"],
  originator: ["Coming up with new ideas is hard for me","I'd rather apply a known approach","Generating options feels unproductive"],
  navigator: ["I get lost in complicated situations","I'd rather follow a route than plan one","Working out the best path is difficult for me"],
};

export const ROUND_COUNT = 13;   // 13 rounds x 10 pairs = 130 items
export const TIME_LIMIT = 20;

// weight given to the LEFT / RIGHT statement at each of the 5 scale positions
const WL = [2, 1.5, 1, 0.5, 0];
const WR = [0, 0.5, 1, 1.5, 2];

export interface Statement { t: ThemeKey; s: string; r: boolean }
export interface Item { id: number; left: Statement; right: Statement }
export type Answers = Record<number, number>; // itemId -> 0..4

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** circle-method round robin: n-1 rounds of n/2 pairs; each theme once per round */
function buildRounds(keys: ThemeKey[]): [ThemeKey, ThemeKey][][] {
  const n = keys.length;
  const res: [ThemeKey, ThemeKey][][] = [];
  let list = keys.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const arr = [keys[0], ...list];
    const round: [ThemeKey, ThemeKey][] = [];
    for (let i = 0; i < n / 2; i++) round.push([arr[i], arr[n - 1 - i]]);
    res.push(round);
    list = [list[list.length - 1], ...list.slice(0, -1)];
  }
  return res;
}

export function buildItems(): Item[] {
  const keys = Object.keys(THEMES) as ThemeKey[];
  const rounds = buildRounds(keys);
  const pool: Record<ThemeKey, Statement[]> = {} as never;
  keys.forEach((k) => {
    pool[k] = shuffle([
      ...POS[k].map((s) => ({ t: k, s, r: false })),
      ...REV[k].map((s) => ({ t: k, s, r: true })),
    ]);
  });
  const ptr: Record<ThemeKey, number> = {} as never;
  keys.forEach((k) => (ptr[k] = 0));

  const items: Item[] = [];
  for (let r = 0; r < ROUND_COUNT; r++) {
    for (const [a, b] of rounds[r % rounds.length]) {
      const sa = pool[a][ptr[a]++ % pool[a].length];
      const sb = pool[b][ptr[b]++ % pool[b].length];
      const flip = Math.random() < 0.5;
      items.push({ id: 0, left: flip ? sb : sa, right: flip ? sa : sb });
    }
  }
  shuffle(items).forEach((it, i) => (it.id = i));
  return items;
}

/* ── scoring ──────────────────────────────────────────────────────────── */

export interface ThemeScore {
  key: ThemeKey; name: string; domain: DomainKey; desc: string;
  raw: number; norm: number;
}
export interface DomainScore {
  key: DomainKey; label: string; color: string; note: string; share: number;
}
export interface Quality {
  /** proportion of complete triads that are circular. Random ~= 0.25. */
  circularity: number;
  circularTriads: number;
  completeTriads: number;
  /** themes where positive AND reverse statements were both strongly endorsed */
  contradictions: number;
  /** share of items answered at the neutral midpoint */
  neutralRate: number;
  /** SD of raw theme scores. A differentiated profile spreads; noise flattens. */
  profileSpread: number;
  /** largest share taken by any single scale position (1.0 = always same key) */
  positionDominance: number;
  rating: "High" | "Moderate" | "Low";
  reasons: string[];
}
export interface Result {
  themeScores: ThemeScore[];
  domainShare: DomainScore[];
  top: ThemeScore[];
  quality: Quality;
  /** kept for backward compatibility with existing report components */
  consistency: "High" | "Moderate" | "Low";
}

export function score(items: Item[], answers: Answers): Result {
  const keys = Object.keys(THEMES) as ThemeKey[];
  const raw: Record<ThemeKey, number> = {} as never;
  keys.forEach((k) => (raw[k] = 0));

  const fS: Record<ThemeKey, number> = {} as never, fN: Record<ThemeKey, number> = {} as never;
  const aS: Record<ThemeKey, number> = {} as never, aN: Record<ThemeKey, number> = {} as never;
  keys.forEach((k) => { fS[k] = aS[k] = fN[k] = aN[k] = 0; });

  // directed preference graph for the transitivity check
  const wins = new Map<string, number>(); // "a|b" -> +1 if a beat b, -1 if b beat a
  let answered = 0, neutral = 0;
  const posCount = [0, 0, 0, 0, 0];

  items.forEach((it) => {
    const p = answers[it.id];
    if (p == null) return;
    answered += 1;
    posCount[p] += 1;
    if (p === 2) neutral += 1;

    const eL = WL[p], eR = WR[p];
    const L = it.left, R = it.right;
    const cL = (L.r ? -1 : 1) * eL;
    const cR = (R.r ? -1 : 1) * eR;
    raw[L.t] += cL;
    raw[R.t] += cR;

    ([[L, eL], [R, eR]] as [Statement, number][]).forEach(([st, e]) => {
      if (st.r) { aS[st.t] += e; aN[st.t] += 1; } else { fS[st.t] += e; fN[st.t] += 1; }
    });

    // Record which theme this item favoured. Only pairings of two POSITIVE
    // statements carry a clean signal: when a reverse statement is shown, the
    // losing side reflects the statement drawn rather than the theme's standing,
    // which manufactures circular triads independently of how the person answered.
    if (!L.r && !R.r && cL !== cR && L.t !== R.t) {
      const winner = cL > cR ? L.t : R.t;
      const loser = cL > cR ? R.t : L.t;
      wins.set(`${winner}|${loser}`, 1);
    }
  });

  // ── theme scores ──
  const vals = keys.map((k) => raw[k]);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const themeScores: ThemeScore[] = keys
    .map((k) => ({ key: k, ...THEMES[k], raw: raw[k], norm: ((raw[k] - min) / span) * 100 }))
    .sort((a, b) => b.raw - a.raw);

  const dTot: Record<DomainKey, number> = { executing: 0, influencing: 0, relating: 0, thinking: 0 };
  themeScores.forEach((t) => (dTot[t.domain] += t.norm));
  const grand = (Object.values(dTot) as number[]).reduce((s, x) => s + x, 0) || 1;
  const domainShare: DomainScore[] = (Object.keys(DOMAINS) as DomainKey[])
    .map((d) => ({ key: d, ...DOMAINS[d], share: (dTot[d] / grand) * 100 }))
    .sort((a, b) => b.share - a.share);

  // ── quality: transitivity ──
  const beat = (a: ThemeKey, b: ThemeKey): boolean | null => {
    if (wins.has(`${a}|${b}`)) return true;
    if (wins.has(`${b}|${a}`)) return false;
    return null;
  };
  let circularTriads = 0, completeTriads = 0;
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      for (let k = j + 1; k < keys.length; k++) {
        const ab = beat(keys[i], keys[j]);
        const bc = beat(keys[j], keys[k]);
        const ca = beat(keys[k], keys[i]);
        if (ab === null || bc === null || ca === null) continue;
        completeTriads += 1;
        // a cycle is a>b>c>a or its reverse
        if ((ab && bc && ca) || (!ab && !bc && !ca)) circularTriads += 1;
      }
    }
  }
  const circularity = completeTriads ? circularTriads / completeTriads : 0;

  // ── quality: self-contradiction ──
  let contradictions = 0;
  keys.forEach((k) => {
    const af = fN[k] ? fS[k] / fN[k] : 0;
    const aa = aN[k] ? aS[k] / aN[k] : 0;
    if (af > 1.15 && aa > 1.15) contradictions += 1;
  });

  const neutralRate = answered ? neutral / answered : 0;
  const positionDominance = answered ? Math.max(...posCount) / answered : 0;

  // ── quality: profile differentiation ──
  // Random responding regresses every theme toward zero; a real profile spreads.
  const rawVals = keys.map((k) => raw[k]);
  const rawMean = rawVals.reduce((s, x) => s + x, 0) / rawVals.length;
  const profileSpread = Math.sqrt(
    rawVals.reduce((s, x) => s + (x - rawMean) ** 2, 0) / rawVals.length,
  );

  // ── combined rating ──
  // Calibrated by simulation (see METHODOLOGY §6): across 200 trials each,
  // genuine respondents sit at 0-14% circularity and spread 3.9-4.8; uniform
  // random clicking sits at 14-41% and 1.7-3.1.
  let flags = 0;
  const reasons: string[] = [];
  if (circularity > 0.18) {
    flags += 2;
    reasons.push("preferences were largely circular — responses resemble random selection");
  } else if (circularity > 0.14) {
    flags += 1;
    reasons.push("preferences were often circular");
  }
  if (profileSpread < 3.4) {
    flags += 2;
    reasons.push("themes barely separated from one another");
  } else if (profileSpread < 3.8) {
    flags += 1;
    reasons.push("themes separated only weakly");
  }
  if (contradictions > 5) {
    flags += 2;
    reasons.push("many themes were both endorsed and denied");
  } else if (contradictions > 2) {
    flags += 1;
    reasons.push("some themes were both endorsed and denied");
  }
  if (neutralRate > 0.6) {
    flags += 2;
    reasons.push("most items were left at the midpoint");
  } else if (neutralRate > 0.4) {
    flags += 1;
    reasons.push("many items were left at the midpoint");
  }
  if (positionDominance > 0.7) {
    flags += 2;
    reasons.push("nearly every item was answered with the same option");
  } else if (positionDominance > 0.5) {
    flags += 1;
    reasons.push("one option was chosen far more than the others");
  }

  const rating: Quality["rating"] = flags >= 3 ? "Low" : flags >= 1 ? "Moderate" : "High";

  const quality: Quality = {
    circularity, circularTriads, completeTriads,
    contradictions, neutralRate, profileSpread, positionDominance, rating, reasons,
  };

  return {
    themeScores, domainShare, top: themeScores.slice(0, 5),
    quality, consistency: rating,
  };
}
