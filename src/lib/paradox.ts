/* Paradox Profile — original instrument for internal talent discussion.
   12 paradoxes, 24 traits, 120 items, 10-point Likert.
   Not affiliated with, and using no content from, Harrison Assessments.
   See paradox-methodology.md for the full method. */

export const SCALE_MIN = 1;
export const SCALE_MAX = 10;
const REVERSE_CONSTANT = SCALE_MIN + SCALE_MAX; // 11 - x

export const NEUTRAL = 5.5;              // fixed-threshold quadrant boundary
export const CONSISTENCY_FLAG_GAP = 3.5; // |P - R| above this flags a trait

export type ParadoxKey =
  | "influence" | "communication" | "decisionMaking" | "execution"
  | "performance" | "teamContribution" | "leadership" | "standards"
  | "risk" | "learning" | "problemSolving" | "resilience";

export type TraitKey =
  | "assertiveness" | "receptiveness"
  | "frankness" | "diplomacy"
  | "decisiveness" | "reflectiveness"
  | "structure" | "adaptability"
  | "drive" | "patience"
  | "independence" | "collaboration"
  | "direction" | "empowerment"
  | "accountability" | "empathy"
  | "courage" | "prudence"
  | "confidence" | "curiosity"
  | "practicality" | "creativity"
  | "persistence" | "recovery";

export type Quadrant = "balanced" | "oneSidedDynamic" | "oneSidedGentle" | "deficient";

export interface Paradox {
  name: string;
  dynamic: TraitKey;          // y-axis
  gentle: TraitKey;           // x-axis
  labels: Record<Quadrant, string>;
}

export const PARADOXES: Record<ParadoxKey, Paradox> = {
  influence: {
    name: "Influence", dynamic: "assertiveness", gentle: "receptiveness",
    labels: {
      oneSidedDynamic: "Dominating Advocate", balanced: "Constructive Challenger",
      deficient: "Detached Contributor", oneSidedGentle: "Accommodating Listener",
    },
  },
  communication: {
    name: "Communication", dynamic: "frankness", gentle: "diplomacy",
    labels: {
      oneSidedDynamic: "Blunt Truth-teller", balanced: "Candid Diplomat",
      deficient: "Indirect Communicator", oneSidedGentle: "Tactful Avoider",
    },
  },
  decisionMaking: {
    name: "Decision-making", dynamic: "decisiveness", gentle: "reflectiveness",
    labels: {
      oneSidedDynamic: "Impulsive Decider", balanced: "Considered Decision-Maker",
      deficient: "Decision Avoider", oneSidedGentle: "Analytical Delayer",
    },
  },
  execution: {
    name: "Execution", dynamic: "structure", gentle: "adaptability",
    labels: {
      oneSidedDynamic: "Rigid Controller", balanced: "Agile Planner",
      deficient: "Reactive Operator", oneSidedGentle: "Flexible Improviser",
    },
  },
  performance: {
    name: "Performance", dynamic: "drive", gentle: "patience",
    labels: {
      oneSidedDynamic: "Impatient Driver", balanced: "Sustainable Achiever",
      deficient: "Low-pace Contributor", oneSidedGentle: "Supportive Stabiliser",
    },
  },
  teamContribution: {
    name: "Team contribution", dynamic: "independence", gentle: "collaboration",
    labels: {
      oneSidedDynamic: "Lone Operator", balanced: "Interdependent Performer",
      deficient: "Dependent Individualist", oneSidedGentle: "Consensus Seeker",
    },
  },
  leadership: {
    name: "Leadership", dynamic: "direction", gentle: "empowerment",
    labels: {
      oneSidedDynamic: "Controlling Director", balanced: "Enabling Leader",
      deficient: "Absent Leader", oneSidedGentle: "Hands-Off Delegator",
    },
  },
  standards: {
    name: "Standards", dynamic: "accountability", gentle: "empathy",
    labels: {
      oneSidedDynamic: "Rigid Enforcer", balanced: "Fair Leader",
      deficient: "Passive Manager", oneSidedGentle: "Compassionate Avoider",
    },
  },
  risk: {
    name: "Risk", dynamic: "courage", gentle: "prudence",
    labels: {
      oneSidedDynamic: "Reckless Challenger", balanced: "Calculated Risk-Taker",
      deficient: "Disengaged Observer", oneSidedGentle: "Over-cautious Protector",
    },
  },
  learning: {
    name: "Learning", dynamic: "confidence", gentle: "curiosity",
    labels: {
      oneSidedDynamic: "Certain Expert", balanced: "Confident Learner",
      deficient: "Stagnant Beginner", oneSidedGentle: "Inquiring Doubter",
    },
  },
  problemSolving: {
    name: "Problem-solving", dynamic: "practicality", gentle: "creativity",
    labels: {
      oneSidedDynamic: "Conventional Executor", balanced: "Pragmatic Innovator",
      deficient: "Unproductive Thinker", oneSidedGentle: "Imaginative Idealist",
    },
  },
  resilience: {
    name: "Resilience", dynamic: "persistence", gentle: "recovery",
    labels: {
      oneSidedDynamic: "Relentless Striver", balanced: "Resilient Perseverer",
      deficient: "Discouraged Deflater", oneSidedGentle: "Quick Rebounder",
    },
  },
};

export const PARADOX_ORDER: ParadoxKey[] = [
  "influence", "communication", "decisionMaking", "execution",
  "performance", "teamContribution", "leadership", "standards",
  "risk", "learning", "problemSolving", "resilience",
];

export const TRAITS: Record<TraitKey, { name: string; paradox: ParadoxKey; pole: "dynamic" | "gentle" }> =
  PARADOX_ORDER.reduce((acc, pk) => {
    const p = PARADOXES[pk];
    acc[p.dynamic] = { name: titleise(p.dynamic), paradox: pk, pole: "dynamic" };
    acc[p.gentle] = { name: titleise(p.gentle), paradox: pk, pole: "gentle" };
    return acc;
  }, {} as Record<TraitKey, { name: string; paradox: ParadoxKey; pole: "dynamic" | "gentle" }>);

function titleise(k: string) {
  return k.charAt(0).toUpperCase() + k.slice(1);
}

/* ── item bank: 3 positive + 2 reverse per trait ──────────────────────── */

interface Statement { s: string; r: boolean }

const BANK: Record<TraitKey, Statement[]> = {
  assertiveness: [
    { s: "I express my position even when others may disagree.", r: false },
    { s: "I am comfortable challenging a decision that I believe is flawed.", r: false },
    { s: "I speak up early rather than waiting to see which way a discussion goes.", r: false },
    { s: "I sometimes keep my views to myself to avoid resistance.", r: true },
    { s: "I let others carry the discussion rather than putting my own view forward.", r: true },
  ],
  receptiveness: [
    { s: "I actively seek perspectives that differ from my own.", r: false },
    { s: "I can change my mind when someone presents stronger reasoning.", r: false },
    { s: "I ask people to explain their reasoning before I evaluate their conclusion.", r: false },
    { s: "Once I have formed an opinion, further discussion rarely changes it.", r: true },
    { s: "I tend to hear out other views without really weighing them.", r: true },
  ],
  frankness: [
    { s: "I tell people clearly when their work does not meet expectations.", r: false },
    { s: "I prefer an uncomfortable truth to a comfortable half-answer.", r: false },
    { s: "I raise concerns directly with the person involved rather than around them.", r: false },
    { s: "I soften difficult messages so much that the main point can be lost.", r: true },
    { s: "I avoid saying things that might create an awkward moment.", r: true },
  ],
  diplomacy: [
    { s: "I consider how my words will affect the other person.", r: false },
    { s: "I can disagree without making the disagreement personal.", r: false },
    { s: "I choose my timing so that difficult feedback can actually be heard.", r: false },
    { s: "When I am convinced I am right, how I communicate matters less.", r: true },
    { s: "I say what I think without spending much thought on how it lands.", r: true },
  ],
  decisiveness: [
    { s: "I am prepared to make decisions with incomplete information.", r: false },
    { s: "I provide clear direction when others are uncertain.", r: false },
    { s: "I commit to a course of action once the key facts are in.", r: false },
    { s: "I delay decisions because I want to eliminate every uncertainty.", r: true },
    { s: "I put off choices in the hope that the situation will resolve itself.", r: true },
  ],
  reflectiveness: [
    { s: "I examine several explanations before reaching a conclusion.", r: false },
    { s: "I consider the second-order consequences of important decisions.", r: false },
    { s: "I revisit my assumptions when the stakes of a decision are high.", r: false },
    { s: "Once an obvious solution appears, further analysis is usually unnecessary.", r: true },
    { s: "I move on from a decision without reviewing how it turned out.", r: true },
  ],
  structure: [
    { s: "I translate broad goals into clear steps and timelines.", r: false },
    { s: "I keep track of commitments without needing others to remind me.", r: false },
    { s: "I set up systems that make progress visible to everyone involved.", r: false },
    { s: "Detailed planning tends to restrict rather than help me.", r: true },
    { s: "I start work without mapping out how the pieces fit together.", r: true },
  ],
  adaptability: [
    { s: "I adjust quickly when priorities or circumstances change.", r: false },
    { s: "I remain effective when instructions are unclear.", r: false },
    { s: "I find a workable path when the original plan stops being viable.", r: false },
    { s: "Sudden changes significantly reduce the quality of my work.", r: true },
    { s: "I need things to settle back into a routine before I regain my footing.", r: true },
  ],
  drive: [
    { s: "I naturally push myself and others toward ambitious results.", r: false },
    { s: "I look for ways to move work forward faster.", r: false },
    { s: "I set targets beyond what is required of me.", r: false },
    { s: "I am satisfied when expectations have been met.", r: true },
    { s: "I ease off once the work is good enough to pass.", r: true },
  ],
  patience: [
    { s: "I remain composed when progress is slower than expected.", r: false },
    { s: "I allow people enough time to understand and improve.", r: false },
    { s: "I stay with a slow process when rushing it would cost quality.", r: false },
    { s: "I can become frustrated when others cannot match my pace.", r: true },
    { s: "I show my irritation when things take longer than they should.", r: true },
  ],
  independence: [
    { s: "I am comfortable taking ownership without constant guidance.", r: false },
    { s: "I form my own judgement rather than simply following the group.", r: false },
    { s: "I make progress on my own when direction is not forthcoming.", r: false },
    { s: "I feel uneasy proceeding when no one has endorsed my view.", r: true },
    { s: "I wait for someone to confirm my approach before I act on it.", r: true },
  ],
  collaboration: [
    { s: "I involve others when their contribution could improve the outcome.", r: false },
    { s: "I share relevant information even when I could complete the task alone.", r: false },
    { s: "I build on other people's ideas rather than replacing them with my own.", r: false },
    { s: "Working with others who are less competent slows down what I could do myself.", r: true },
    { s: "I keep work to myself rather than bringing others into it.", r: true },
  ],
  direction: [
    { s: "I clarify responsibilities when a team lacks direction.", r: false },
    { s: "I am willing to take charge during difficult situations.", r: false },
    { s: "I set a clear standard for what good work looks like.", r: false },
    { s: "I hold back from taking charge even when a group is drifting.", r: true },
    { s: "I leave expectations open rather than stating them plainly.", r: true },
  ],
  empowerment: [
    { s: "I give people room to decide how their work should be done.", r: false },
    { s: "I delegate meaningful responsibility rather than only routine work.", r: false },
    { s: "I let people learn from decisions I would have made differently.", r: false },
    { s: "Important work should be closely controlled to prevent mistakes.", r: true },
    { s: "I step in and take over when I could let someone work it through.", r: true },
  ],
  accountability: [
    { s: "I address missed commitments rather than allowing them to pass.", r: false },
    { s: "I expect people to take responsibility for the consequences of their actions.", r: false },
    { s: "I follow through on consequences I have said would apply.", r: false },
    { s: "I find reasons not to raise a performance problem.", r: true },
    { s: "I let repeated shortfalls go unaddressed.", r: true },
  ],
  empathy: [
    { s: "I try to understand what may be affecting someone's behaviour.", r: false },
    { s: "I distinguish between someone who cannot perform and someone who will not.", r: false },
    { s: "I notice when someone is struggling before they say so.", r: false },
    { s: "Personal circumstances should rarely influence how performance is handled.", r: true },
    { s: "I focus on the outcome without considering what the person is dealing with.", r: true },
  ],
  courage: [
    { s: "I am willing to try an unproven approach when the potential benefit is worthwhile.", r: false },
    { s: "I raise difficult issues even when doing so carries personal risk.", r: false },
    { s: "I act on a decision that may not be popular when I believe it is right.", r: false },
    { s: "I generally choose the safest option when outcomes are uncertain.", r: true },
    { s: "I hold back from action until someone else has taken the risk first.", r: true },
  ],
  prudence: [
    { s: "I assess possible downsides before committing significant resources.", r: false },
    { s: "I establish safeguards when experimenting with new approaches.", r: false },
    { s: "I test on a small scale before committing fully.", r: false },
    { s: "Working through what could go wrong is usually unnecessary detail.", r: true },
    { s: "I commit resources without working through what could go wrong.", r: true },
  ],
  confidence: [
    { s: "I trust my ability to handle unfamiliar challenges.", r: false },
    { s: "I remain composed when my capability is being evaluated.", r: false },
    { s: "I take on work that stretches beyond my current experience.", r: false },
    { s: "I frequently doubt whether my judgement is good enough.", r: true },
    { s: "I hesitate to act until someone reassures me I am on the right track.", r: true },
  ],
  curiosity: [
    { s: "I enjoy discovering why things work the way they do.", r: false },
    { s: "I ask questions even when others appear satisfied with the answer.", r: false },
    { s: "I read or explore beyond what my role strictly requires.", r: false },
    { s: "Once I become competent in an area, I see little need to explore it further.", r: true },
    { s: "I take explanations at face value rather than looking further.", r: true },
  ],
  practicality: [
    { s: "I focus on solutions that can realistically be implemented.", r: false },
    { s: "I consider available time, people and resources when proposing an idea.", r: false },
    { s: "I check that a proposal can be resourced before advocating for it.", r: false },
    { s: "Delivery constraints can be worked out after a plan is agreed.", r: true },
    { s: "I propose things without working out how they would actually be delivered.", r: true },
  ],
  creativity: [
    { s: "I generate alternatives rather than accepting the first workable solution.", r: false },
    { s: "I make connections between ideas that others may see as unrelated.", r: false },
    { s: "I look for a different angle when the standard approach is not working.", r: false },
    { s: "Once a workable answer exists, searching for another adds little.", r: true },
    { s: "I stop searching once I have one solution that works.", r: true },
  ],
  persistence: [
    { s: "I continue working toward an important objective despite repeated setbacks.", r: false },
    { s: "Difficult conditions tend to strengthen my determination.", r: false },
    { s: "I keep going on long tasks after the initial interest has worn off.", r: false },
    { s: "I lose momentum when my initial efforts do not produce results.", r: true },
    { s: "I move on to something else when progress becomes hard.", r: true },
  ],
  recovery: [
    { s: "I regain my effectiveness quickly after disappointment or failure.", r: false },
    { s: "I can stop, reassess and change approach without seeing it as defeat.", r: false },
    { s: "I return to full focus soon after something goes badly.", r: false },
    { s: "A significant setback tends to affect my performance for a long time.", r: true },
    { s: "I carry the effect of a bad outcome into the work that follows.", r: true },
  ],
};

/* ── item generation ──────────────────────────────────────────────────── */

export interface Item { id: number; trait: TraitKey; statement: string; reverse: boolean }
export type Answers = Record<number, number>; // itemId -> 1..10

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 120 items in randomised order, so adjacent items rarely share a trait. */
export function buildItems(): Item[] {
  const flat: Omit<Item, "id">[] = [];
  (Object.keys(BANK) as TraitKey[]).forEach((t) => {
    BANK[t].forEach((st) => flat.push({ trait: t, statement: st.s, reverse: st.r }));
  });
  return shuffle(flat).map((it, i) => ({ ...it, id: i }));
}

/* ── scoring ──────────────────────────────────────────────────────────── */

export type ThresholdMode = "fixed" | "personCentred" | "local";

export interface ScoreOptions {
  /** How the quadrant boundary is chosen. Default "personCentred". */
  threshold?: ThresholdMode;
  /** Per-trait boundaries, required when threshold === "local". */
  localThresholds?: Partial<Record<TraitKey, number>>;
}

export interface TraitScore {
  key: TraitKey;
  name: string;
  score: number;        // 1..10, mean of 5 items
  positiveMean: number; // mean of 3 positive items
  reverseMean: number;  // mean of 2 reverse items, after conversion
  gap: number;          // |positiveMean - reverseMean|
  flagged: boolean;     // gap > CONSISTENCY_FLAG_GAP
  sd: number;           // within-trait SD, for the uncertainty box
  answered: number;     // items answered of 5
}

export interface ParadoxResult {
  key: ParadoxKey;
  name: string;
  dynamic: TraitScore;
  gentle: TraitScore;
  quadrant: Quadrant;
  label: string;
  /** Boundaries actually used, for rendering the crosshair. */
  thresholdX: number;
  thresholdY: number;
  /** True if either trait was flagged — render the point hollow. */
  flagged: boolean;
}

export interface Result {
  paradoxes: ParadoxResult[];
  traits: TraitScore[];
  /** Mean across all 24 traits; the boundary under "personCentred". */
  overallMean: number;
  thresholdMode: ThresholdMode;
  flaggedCount: number;
  consistency: "High" | "Moderate" | "Low";
  zoneCounts: Record<Quadrant, number>;
  completeness: number; // 0..1
}

function mean(xs: number[]) {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}
function stdev(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

export function itemScore(response: number, reverse: boolean) {
  return reverse ? REVERSE_CONSTANT - response : response;
}

export function score(items: Item[], answers: Answers, opts: ScoreOptions = {}): Result {
  const mode: ThresholdMode = opts.threshold ?? "personCentred";

  const byTrait = {} as Record<TraitKey, { pos: number[]; rev: number[] }>;
  (Object.keys(BANK) as TraitKey[]).forEach((t) => (byTrait[t] = { pos: [], rev: [] }));

  let answered = 0;
  items.forEach((it) => {
    const raw = answers[it.id];
    if (raw == null) return;
    answered += 1;
    const s = itemScore(raw, it.reverse);
    (it.reverse ? byTrait[it.trait].rev : byTrait[it.trait].pos).push(s);
  });

  const traits: TraitScore[] = (Object.keys(BANK) as TraitKey[]).map((t) => {
    const { pos, rev } = byTrait[t];
    const all = [...pos, ...rev];
    const pm = mean(pos), rm = mean(rev);
    const gap = pos.length && rev.length ? Math.abs(pm - rm) : 0;
    return {
      key: t,
      name: TRAITS[t].name,
      score: mean(all),
      positiveMean: pm,
      reverseMean: rm,
      gap,
      flagged: gap > CONSISTENCY_FLAG_GAP,
      sd: stdev(all),
      answered: all.length,
    };
  });

  const traitMap = traits.reduce((acc, t) => { acc[t.key] = t; return acc; },
    {} as Record<TraitKey, TraitScore>);

  const overallMean = mean(traits.map((t) => t.score));

  const boundaryFor = (t: TraitKey) => {
    if (mode === "fixed") return NEUTRAL;
    if (mode === "local") return opts.localThresholds?.[t] ?? NEUTRAL;
    return overallMean;
  };

  const zoneCounts: Record<Quadrant, number> = {
    balanced: 0, oneSidedDynamic: 0, oneSidedGentle: 0, deficient: 0,
  };

  const paradoxes: ParadoxResult[] = PARADOX_ORDER.map((pk) => {
    const p = PARADOXES[pk];
    const dyn = traitMap[p.dynamic], gen = traitMap[p.gentle];
    const ty = boundaryFor(p.dynamic), tx = boundaryFor(p.gentle);
    const highY = dyn.score >= ty, highX = gen.score >= tx;
    const quadrant: Quadrant =
      highY && highX ? "balanced"
        : highY ? "oneSidedDynamic"
          : highX ? "oneSidedGentle"
            : "deficient";
    zoneCounts[quadrant] += 1;
    return {
      key: pk, name: p.name, dynamic: dyn, gentle: gen,
      quadrant, label: p.labels[quadrant],
      thresholdX: tx, thresholdY: ty,
      flagged: dyn.flagged || gen.flagged,
    };
  });

  const flaggedCount = traits.filter((t) => t.flagged).length;
  const consistency = flaggedCount <= 3 ? "High" : flaggedCount <= 7 ? "Moderate" : "Low";

  return {
    paradoxes, traits, overallMean, thresholdMode: mode,
    flaggedCount, consistency, zoneCounts,
    completeness: answered / items.length,
  };
}
