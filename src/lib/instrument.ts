/* Original forced-choice strengths instrument — not Gallup CliftonStrengths.
   Themes, statement bank, balanced item generation, ipsative scoring.
   See METHODOLOGY.md for the full method. */

export type DomainKey = "executing" | "influencing" | "relating" | "thinking";
export type ThemeKey =
  | "driver" | "organiser" | "finisher"
  | "persuader" | "catalyst" | "voice"
  | "connector" | "harmoniser" | "empathiser"
  | "analyst" | "visionary" | "learner";

export const DOMAINS: Record<DomainKey, { label: string; color: string; note: string }> = {
  executing:  { label: "Executing",             color: "#C96442", note: "How you make things happen" },
  influencing:{ label: "Influencing",           color: "#B8862F", note: "How you reach others" },
  relating:   { label: "Relationship Building", color: "#4F7D6C", note: "How you build bonds" },
  thinking:   { label: "Strategic Thinking",    color: "#4C6280", note: "How you take in the world" },
};

export const THEMES: Record<ThemeKey, { name: string; domain: DomainKey; desc: string }> = {
  driver:{name:"Driver",domain:"executing",desc:"You turn intention into motion — restless until progress shows, pushing work past the line."},
  organiser:{name:"Organiser",domain:"executing",desc:"You bring order to complexity: the systems and sequences that let work run smoothly."},
  finisher:{name:"Finisher",domain:"executing",desc:"You are wired for completion. Loose ends bother you and you close things out well."},
  persuader:{name:"Persuader",domain:"influencing",desc:"You bring people around to a point of view and enjoy making the case."},
  catalyst:{name:"Catalyst",domain:"influencing",desc:"You supply the initial energy that overcomes inertia and gets others moving."},
  voice:{name:"Voice",domain:"influencing",desc:"You are comfortable being heard — you speak up and put words to the room."},
  connector:{name:"Connector",domain:"relating",desc:"You build and tend relationships naturally, seeing how people fit together."},
  harmoniser:{name:"Harmoniser",domain:"relating",desc:"You seek common ground, reduce friction and keep a group together."},
  empathiser:{name:"Empathiser",domain:"relating",desc:"You read the emotional temperature and sense what others feel."},
  analyst:{name:"Analyst",domain:"thinking",desc:"You reason from evidence — you want the data and test the logic."},
  visionary:{name:"Visionary",domain:"thinking",desc:"You live slightly in the future, seeing what could be and pulling others toward it."},
  learner:{name:"Learner",domain:"thinking",desc:"You are energised by growth; getting better matters as much as the result."},
};

const POS: Record<ThemeKey, string[]> = {
  driver:["I keep things moving until they're done","Slow progress frustrates me","I'd rather act than plan for long","Once I decide, I move on it at once","I push to keep momentum going","A visible result is what satisfies me","I'd rather be productive than idle","I dislike tasks that stall","I measure my day by what I got done"],
  organiser:["I create systems to keep order","I break messy tasks into clear steps","A structured plan makes me feel in control","I sequence tasks before starting","I keep my work tidy and findable","When things are chaotic, I sort them out","I think in processes and checklists","I like structures others can rely on","I plan the steps before I begin"],
  finisher:["Leaving something unfinished nags at me","I tie up every loose end","I see tasks fully completed","I double-check before I call it done","I follow through after excitement fades","Delivering on a promise matters to me","I like crossing a task fully off","I finish what I start","Open tasks bother me until closed"],
  persuader:["I enjoy changing someone's mind","I find the argument that wins people","Making a case energises me","I negotiate to the outcome I want","I sense which point will land","I push back to defend my position","Winning people to an idea feels good","I adapt my pitch to the person","I try to influence a decision"],
  catalyst:["I get a stalled group moving","I like being the spark","I'd rather kick things off than wait","I bring energy that gets people going","When nothing's happening, I move","I rally people around a fresh idea","I volunteer to start things","I'm comfortable saying let's begin","I create momentum where there was none"],
  voice:["I'm comfortable speaking up","I put words to what others can't say","I don't mind holding attention","I'm at ease presenting","I say what everyone's thinking","I can command a room when needed","I like explaining to the group","I state my views to senior people","People tend to listen when I speak"],
  connector:["I build new relationships easily","I introduce people who should connect","I keep in touch with a wide network","I recall details that help me connect","I feel energised meeting people","I think of who I know when needs arise","I invest time in relationships","I'm the person asked for an intro","I weave people into a circle"],
  harmoniser:["I look for where people agree","I smooth over conflict","I'd rather reach consensus","I look for a compromise for all","I step in to calm tension","I value peaceful relationships","I steer from needless conflict","I keep everyone aligned","I ease friction between people"],
  empathiser:["I sense feelings before they're said","I pick up the mood in a room","Others' moods affect me strongly","I tell when someone hides upset","I imagine how it feels for others","People open up to me","I notice small shifts in tone","I feel what others feel","I adjust to someone's state"],
  analyst:["I want evidence before I accept a claim","I pick apart the logic","I trust data over gut","I ask how we know it's true","I dig for the root cause","I'm sceptical of unproven claims","I work through problems stepwise","I weigh facts before deciding","I look for patterns"],
  visionary:["I imagine what could be","I'm drawn to the big picture","I paint the future for others","I'm energised by where things go","I see potential others miss","I tie work to a larger purpose","I get excited by bold ideas","I think several steps ahead","I explore what's possible"],
  learner:["Learning excites me","I seek chances to build skills","I feel best when improving","I dive into new subjects","I'm curious how things work","I take on tasks that stretch me","Learning for its own sake appeals","I track my progress","New topics draw me in"],
};
const REV: Record<ThemeKey, string[]> = {
  driver:["I'm happy to let things move at their own pace","I often delay getting started","I feel little urgency to finish"],
  organiser:["I'm fine without much structure","I leave things where they land","I'd rather improvise than plan"],
  finisher:["I lose interest once the hard part's over","I'm fine leaving tasks partly done","I move on before things are wrapped up"],
  persuader:["I avoid trying to talk people round","I'd rather not push my view","I back off when someone disagrees"],
  catalyst:["I wait for others to start","I hold back from the first move","I'm slow to back something new"],
  voice:["I stay quiet in discussions","I'd rather not be centre of attention","I find it hard to speak up"],
  connector:["I keep my circle small","I find meeting new people draining","I rarely stay in touch"],
  harmoniser:["I don't mind open conflict","I'd rather win than keep peace","Disagreement doesn't bother me"],
  empathiser:["I often miss how others feel","I focus on task over mood","Others' emotions rarely affect me"],
  analyst:["I trust instinct over numbers","I don't need much proof","I'd rather decide fast than analyse"],
  visionary:["I focus on what's in front of me","Speculation bores me","I prefer detail to possibility"],
  learner:["Once competent I stop pushing","I'd rather use skills I have","Learning new feels like a chore"],
};

export const ROUND_COUNT = 17;
export const TIME_LIMIT = 20;
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

function buildRounds(keys: ThemeKey[]): [ThemeKey, ThemeKey][][] {
  const n = keys.length; const res: [ThemeKey, ThemeKey][][] = [];
  let list = keys.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const arr = [keys[0], ...list]; const round: [ThemeKey, ThemeKey][] = [];
    for (let i = 0; i < n / 2; i++) round.push([arr[i], arr[n - 1 - i]]);
    res.push(round);
    list = [list[list.length - 1], ...list.slice(0, -1)];
  }
  return res;
}

export function buildItems(): Item[] {
  const keys = Object.keys(THEMES) as ThemeKey[];
  const rounds = buildRounds(keys);
  const pool: Record<ThemeKey, Statement[]> = {} as any;
  keys.forEach((k) => {
    pool[k] = shuffle([
      ...POS[k].map((s) => ({ t: k, s, r: false })),
      ...REV[k].map((s) => ({ t: k, s, r: true })),
    ]);
  });
  const ptr: Record<ThemeKey, number> = {} as any; keys.forEach((k) => (ptr[k] = 0));
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

export interface ThemeScore { key: ThemeKey; name: string; domain: DomainKey; desc: string; raw: number; norm: number }
export interface DomainScore { key: DomainKey; label: string; color: string; note: string; share: number }
export interface Result {
  themeScores: ThemeScore[];
  domainShare: DomainScore[];
  top: ThemeScore[];
  consistency: "High" | "Moderate" | "Low";
}

export function score(items: Item[], answers: Answers): Result {
  const keys = Object.keys(THEMES) as ThemeKey[];
  const raw: Record<ThemeKey, number> = {} as any; keys.forEach((k) => (raw[k] = 0));
  const fS: Record<ThemeKey, number> = {} as any, fN: Record<ThemeKey, number> = {} as any;
  const aS: Record<ThemeKey, number> = {} as any, aN: Record<ThemeKey, number> = {} as any;
  keys.forEach((k) => { fS[k] = aS[k] = fN[k] = aN[k] = 0; });

  items.forEach((it) => {
    const p = answers[it.id]; if (p == null) return;
    const eL = WL[p], eR = WR[p];
    raw[it.left.t] += (it.left.r ? -1 : 1) * eL;
    raw[it.right.t] += (it.right.r ? -1 : 1) * eR;
    ([[it.left, eL], [it.right, eR]] as [Statement, number][]).forEach(([st, e]) => {
      if (st.r) { aS[st.t] += e; aN[st.t] += 1; } else { fS[st.t] += e; fN[st.t] += 1; }
    });
  });

  const vals = keys.map((k) => raw[k]);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const themeScores: ThemeScore[] = keys.map((k) => ({
    key: k, ...THEMES[k], raw: raw[k], norm: ((raw[k] - min) / span) * 100,
  })).sort((a, b) => b.raw - a.raw);

  const dTot: Record<DomainKey, number> = { executing: 0, influencing: 0, relating: 0, thinking: 0 };
  themeScores.forEach((t) => (dTot[t.domain] += t.norm));
  const grand = (Object.values(dTot) as number[]).reduce((s, x) => s + x, 0) || 1;
  const domainShare: DomainScore[] = (Object.keys(DOMAINS) as DomainKey[]).map((d) => ({
    key: d, ...DOMAINS[d], share: (dTot[d] / grand) * 100,
  })).sort((a, b) => b.share - a.share);

  let clash = 0;
  keys.forEach((k) => {
    const af = fN[k] ? fS[k] / fN[k] : 0, aa = aN[k] ? aS[k] / aN[k] : 0;
    if (af > 1.15 && aa > 1.15) clash += 1;
  });
  const consistency = clash <= 1 ? "High" : clash <= 3 ? "Moderate" : "Low";
  return { themeScores, domainShare, top: themeScores.slice(0, 5), consistency };
}
