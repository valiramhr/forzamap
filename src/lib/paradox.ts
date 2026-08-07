/* Paradox Profile — 12 leadership paradoxes, each a pair of opposed traits.
   Every paradox pits a "dynamic" pole (forceful, agentic) against a "gentle"
   pole (receptive, communal). Neither pole is the good one: the model reads a
   person by where they sit on BOTH at once, which is why the report plots each
   pair as a quadrant rather than a single bar.

   Self-report, 1–10 agreement scale, 5 items per trait (3 keyed positive,
   2 keyed reverse). The reverse items are the consistency check: someone who
   agrees with both "I state what I want without hedging" and "I hold back
   rather than push my view" is not answering the trait, and the pair gets
   flagged rather than scored confidently. */

export type Pole = "dynamic" | "gentle";

export type ParadoxKey =
  | "authority" | "momentum" | "selfRegard" | "judgement"
  | "candour" | "control" | "tempo" | "risk"
  | "horizon" | "development" | "course" | "belonging";

export type TraitKey =
  | "assertiveness" | "receptiveness"
  | "drive" | "patience"
  | "confidence" | "humility"
  | "decisiveness" | "deliberation"
  | "candour" | "diplomacy"
  | "direction" | "delegation"
  | "urgency" | "composure"
  | "boldness" | "prudence"
  | "vision" | "realism"
  | "challenge" | "support"
  | "persistence" | "adaptability"
  | "independence" | "collaboration";

/* Where a person sits in a paradox. Named for the reading, not the geometry:
   the plot puts dynamic on y and gentle on x, so oneSidedDynamic is top-left,
   balanced top-right, deficient bottom-left, oneSidedGentle bottom-right. */
export type Quadrant = "oneSidedDynamic" | "balanced" | "deficient" | "oneSidedGentle";

/* fixed        — boundaries at the scale midpoint, 5.5 on both axes.
   personCentred — boundaries at this person's own mean across all 24 traits,
                   so the quadrants describe their profile's internal shape
                   rather than their standing against anyone else. */
export type ThresholdMode = "fixed" | "personCentred";

export const SCALE_MIN = 1;
export const SCALE_MAX = 10;
const MIDPOINT = (SCALE_MIN + SCALE_MAX) / 2; // 5.5

/* Within-trait SD at or above which the trait's responses are treated as
   internally contradictory. Consistent answering with ordinary wobble lands
   near 0.5; answering the positive and reverse items in the same direction
   forces the recoded values apart and lands near 2.4. */
export const FLAG_SD = 1.8;

export interface TraitDef { key: TraitKey; name: string; pole: Pole; paradox: ParadoxKey }

export interface ParadoxDef {
  key: ParadoxKey;
  name: string;
  dynamic: TraitKey;
  gentle: TraitKey;
  labels: Record<Quadrant, string>;
  tension: string;
}

export const PARADOX_ORDER: ParadoxKey[] = [
  "authority", "momentum", "selfRegard", "judgement",
  "candour", "control", "tempo", "risk",
  "horizon", "development", "course", "belonging",
];

export const PARADOXES: Record<ParadoxKey, ParadoxDef> = {
  authority: {
    key: "authority", name: "Assert & Listen",
    dynamic: "assertiveness", gentle: "receptiveness",
    labels: {
      oneSidedDynamic: "Domineering", balanced: "Persuasive Listener",
      deficient: "Disengaged", oneSidedGentle: "Deferential",
    },
    tension: "Holding a position while staying genuinely open to being moved off it.",
  },
  momentum: {
    key: "momentum", name: "Drive & Patience",
    dynamic: "drive", gentle: "patience",
    labels: {
      oneSidedDynamic: "Relentless", balanced: "Steady Momentum",
      deficient: "Drifting", oneSidedGentle: "Passive",
    },
    tension: "Pushing for results without forcing work that needs time.",
  },
  selfRegard: {
    key: "selfRegard", name: "Confidence & Humility",
    dynamic: "confidence", gentle: "humility",
    labels: {
      oneSidedDynamic: "Arrogant", balanced: "Grounded Confidence",
      deficient: "Uncertain", oneSidedGentle: "Self-Effacing",
    },
    tension: "Backing your judgement while assuming you have missed something.",
  },
  judgement: {
    key: "judgement", name: "Decide & Deliberate",
    dynamic: "decisiveness", gentle: "deliberation",
    labels: {
      oneSidedDynamic: "Impulsive", balanced: "Considered & Decisive",
      deficient: "Indecisive", oneSidedGentle: "Over-Analytical",
    },
    tension: "Making the call on time without skipping the thinking.",
  },
  candour: {
    key: "candour", name: "Candour & Diplomacy",
    dynamic: "candour", gentle: "diplomacy",
    labels: {
      oneSidedDynamic: "Blunt", balanced: "Honest & Tactful",
      deficient: "Evasive", oneSidedGentle: "Guarded",
    },
    tension: "Saying the hard thing in a way the other person can use.",
  },
  control: {
    key: "control", name: "Direct & Delegate",
    dynamic: "direction", gentle: "delegation",
    labels: {
      oneSidedDynamic: "Micromanaging", balanced: "Empowering Direction",
      deficient: "Absent", oneSidedGentle: "Hands-Off",
    },
    tension: "Setting a clear standard and then letting people own the work.",
  },
  tempo: {
    key: "tempo", name: "Urgency & Composure",
    dynamic: "urgency", gentle: "composure",
    labels: {
      oneSidedDynamic: "Frantic", balanced: "Calm Under Pressure",
      deficient: "Sluggish", oneSidedGentle: "Unhurried",
    },
    tension: "Moving fast without transmitting your own stress to everyone else.",
  },
  risk: {
    key: "risk", name: "Boldness & Prudence",
    dynamic: "boldness", gentle: "prudence",
    labels: {
      oneSidedDynamic: "Reckless", balanced: "Calculated Risk",
      deficient: "Aimless", oneSidedGentle: "Risk-Averse",
    },
    tension: "Taking the bet you have actually costed.",
  },
  horizon: {
    key: "horizon", name: "Vision & Realism",
    dynamic: "vision", gentle: "realism",
    labels: {
      oneSidedDynamic: "Unmoored", balanced: "Grounded Vision",
      deficient: "Short-Sighted", oneSidedGentle: "Literal",
    },
    tension: "Describing a future that the present can actually reach.",
  },
  development: {
    key: "development", name: "Challenge & Support",
    dynamic: "challenge", gentle: "support",
    labels: {
      oneSidedDynamic: "Harsh", balanced: "Stretching & Safe",
      deficient: "Indifferent", oneSidedGentle: "Protective",
    },
    tension: "Asking more of people than they would ask of themselves, safely.",
  },
  course: {
    key: "course", name: "Persist & Adapt",
    dynamic: "persistence", gentle: "adaptability",
    labels: {
      oneSidedDynamic: "Rigid", balanced: "Flexible Resolve",
      deficient: "Inconsistent", oneSidedGentle: "Pliable",
    },
    tension: "Holding the course while reading the evidence that it should change.",
  },
  belonging: {
    key: "belonging", name: "Independence & Collaboration",
    dynamic: "independence", gentle: "collaboration",
    labels: {
      oneSidedDynamic: "Lone Operator", balanced: "Connected Autonomy",
      deficient: "Adrift", oneSidedGentle: "Dependent",
    },
    tension: "Thinking for yourself without cutting yourself off.",
  },
};

export const TRAITS: Record<TraitKey, TraitDef> = (() => {
  const out = {} as Record<TraitKey, TraitDef>;
  const label: Record<TraitKey, string> = {
    assertiveness: "Assertiveness", receptiveness: "Receptiveness",
    drive: "Drive", patience: "Patience",
    confidence: "Confidence", humility: "Humility",
    decisiveness: "Decisiveness", deliberation: "Deliberation",
    candour: "Candour", diplomacy: "Diplomacy",
    direction: "Direction", delegation: "Delegation",
    urgency: "Urgency", composure: "Composure",
    boldness: "Boldness", prudence: "Prudence",
    vision: "Vision", realism: "Realism",
    challenge: "Challenge", support: "Support",
    persistence: "Persistence", adaptability: "Adaptability",
    independence: "Independence", collaboration: "Collaboration",
  };
  PARADOX_ORDER.forEach((pk) => {
    const p = PARADOXES[pk];
    out[p.dynamic] = { key: p.dynamic, name: label[p.dynamic], pole: "dynamic", paradox: pk };
    out[p.gentle] = { key: p.gentle, name: label[p.gentle], pole: "gentle", paradox: pk };
  });
  return out;
})();

/* Trait order follows PARADOX_ORDER, dynamic pole then gentle pole. */
export const TRAIT_ORDER: TraitKey[] = PARADOX_ORDER.flatMap((k) => [PARADOXES[k].dynamic, PARADOXES[k].gentle]);

const POS: Record<TraitKey, string[]> = {
  assertiveness: [
    "I state what I want without hedging",
    "I press my point when it matters",
    "I take charge when a group needs direction",
  ],
  receptiveness: [
    "I change my mind when someone makes a better case",
    "I ask questions before I argue",
    "I genuinely want to hear the objection",
  ],
  drive: [
    "I keep pushing until the work is done",
    "I set a demanding pace for myself",
    "I am after the next result before the last one has settled",
  ],
  patience: [
    "I can wait for the right moment to act",
    "I let slow work take the time it needs",
    "I stay steady when progress is gradual",
  ],
  confidence: [
    "I back my own judgement under pressure",
    "I speak with conviction about what I know",
    "I am comfortable being the one who decides",
  ],
  humility: [
    "I say plainly when I have got something wrong",
    "I credit others for work I was part of",
    "I assume there is something I have not seen",
  ],
  decisiveness: [
    "I make the call when a decision is overdue",
    "I am comfortable deciding on partial information",
    "I close open questions rather than leave them",
  ],
  deliberation: [
    "I weigh the options before I commit",
    "I look for what a decision might cost",
    "I sleep on choices that matter",
  ],
  candour: [
    "I say the difficult thing directly",
    "I give feedback people would rather not hear",
    "I name the problem in the room",
  ],
  diplomacy: [
    "I choose my words with the listener in mind",
    "I deliver hard messages without doing damage",
    "I read the room before I speak",
  ],
  direction: [
    "I set a clear standard for how work is done",
    "I make sure people know what is expected",
    "I step in when work drifts off course",
  ],
  delegation: [
    "I hand work over and let people run it",
    "I trust others to do it their own way",
    "I resist the urge to take a task back",
  ],
  urgency: [
    "I move on things the day they land",
    "I create pressure to get a decision made",
    "I treat a delay as a problem to solve",
  ],
  composure: [
    "I stay level when a situation heats up",
    "I think clearly when the pressure is on",
    "I slow my own reactions before responding",
  ],
  boldness: [
    "I back an option that could fail",
    "I would rather try and learn than wait and be sure",
    "I commit to moves others find uncomfortable",
  ],
  prudence: [
    "I think through what could go wrong",
    "I protect against the worst case",
    "I check the ground before I step on it",
  ],
  vision: [
    "I work towards a picture of where this ends up",
    "I describe a future others can see",
    "I think several years out",
  ],
  realism: [
    "I test an idea against what is actually possible",
    "I name the constraint everyone is ignoring",
    "I plan from the resources we really have",
  ],
  challenge: [
    "I ask more of people than they would ask of themselves",
    "I hold a high bar even when it is unpopular",
    "I push back on work that is not good enough",
  ],
  support: [
    "I make it safe to admit a problem early",
    "I back people publicly when they are struggling",
    "I notice when someone is carrying too much",
  ],
  persistence: [
    "I stay with a course when it gets hard",
    "I see a commitment through past the point of ease",
    "I do not abandon a plan at the first setback",
  ],
  adaptability: [
    "I change approach when the evidence changes",
    "I let go of a plan that is not working",
    "I am comfortable when the goalposts move",
  ],
  independence: [
    "I can hold a position no one else supports",
    "I work well without needing agreement",
    "I am willing to be the outlier",
  ],
  collaboration: [
    "I bring others in early rather than present a finished answer",
    "I share credit and ownership by default",
    "I build on other people's work rather than replace it",
  ],
};

const REV: Record<TraitKey, string[]> = {
  assertiveness: ["I hold back rather than push my view", "I let others set the agenda"],
  receptiveness: ["I have usually decided before the conversation starts", "Other people's input rarely shifts me"],
  drive: ["I am content to let work find its own pace", "I ease off once things are good enough"],
  patience: ["Waiting makes me restless", "I force things forward before they are ready"],
  confidence: ["I second-guess myself in front of others", "I need reassurance before I commit"],
  humility: ["I find it hard to admit a mistake", "I would rather look right than be corrected"],
  decisiveness: ["I defer decisions hoping they resolve themselves", "I struggle to commit to one option"],
  deliberation: ["I decide first and think it through later", "I skip the analysis and go with instinct"],
  candour: ["I soften a message until the point is lost", "I avoid raising things that might upset someone"],
  diplomacy: ["I say what I think regardless of how it lands", "I bruise people without meaning to"],
  direction: ["I leave people to work out the standard themselves", "I avoid setting expectations for others"],
  delegation: ["I check on work more often than it needs", "I would rather do it myself than hand it over"],
  urgency: ["I let things sit longer than they should", "I am slow to react when something breaks"],
  composure: ["I get rattled when things go wrong", "Pressure shows in how I speak to people"],
  boldness: ["I avoid choices with real downside", "I stay with what is already proven"],
  prudence: ["I take risks without counting the cost", "I skip the contingency and hope"],
  vision: ["I rarely look beyond the current quarter", "Long-range thinking feels like a distraction"],
  realism: ["I promise more than the situation allows", "I overlook the practical detail"],
  challenge: ["I accept work I know could be better", "I lower the bar to keep things comfortable"],
  support: ["I leave people to cope on their own", "I focus on the task and miss the person"],
  persistence: ["I switch approach as soon as it gets difficult", "I lose interest before things pay off"],
  adaptability: ["I stick to a plan after it stops making sense", "I find changes of direction hard to accept"],
  independence: ["I need the group with me before I act", "I go along with the room to avoid standing out"],
  collaboration: ["I would rather work alone than coordinate", "I keep my work to myself until it is done"],
};

export interface Item { id: number; trait: TraitKey; text: string; reverse: boolean }
export type Answers = Record<number, number>; // itemId -> 1..10

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* 120 items: 24 traits × (3 positive + 2 reverse), presented in random order so
   a trait's own items are spread through the run. */
export function buildItems(): Item[] {
  const items: Item[] = [];
  TRAIT_ORDER.forEach((t) => {
    POS[t].forEach((text) => items.push({ id: 0, trait: t, text, reverse: false }));
    REV[t].forEach((text) => items.push({ id: 0, trait: t, text, reverse: true }));
  });
  shuffle(items).forEach((it, i) => (it.id = i));
  return items;
}

export interface TraitScore {
  key: TraitKey;
  name: string;
  pole: Pole;
  /** Mean of the trait's recoded responses, on the 1–10 scale. */
  score: number;
  /** Spread of those responses — the uncertainty band drawn around the point. */
  sd: number;
  /** How many of the trait's items were answered. */
  n: number;
  /** True when sd crosses FLAG_SD: the responses contradict one another. */
  flagged: boolean;
}

export interface ParadoxResult {
  key: ParadoxKey;
  name: string;
  tension: string;
  /** Plotted on y. */
  dynamic: TraitScore;
  /** Plotted on x. */
  gentle: TraitScore;
  /** Quadrant boundary on the gentle (x) axis — not necessarily 5.5. */
  thresholdX: number;
  /** Quadrant boundary on the dynamic (y) axis — not necessarily 5.5. */
  thresholdY: number;
  quadrant: Quadrant;
  /** PARADOXES[key].labels[quadrant], resolved for convenience. */
  label: string;
  /** Either trait answered inconsistently — read the position with care. */
  flagged: boolean;
}

export interface ZoneCounts { balanced: number; oneSided: number; deficient: number }

export interface Result {
  paradoxes: ParadoxResult[];
  traitScores: TraitScore[];
  /** This person's mean across all 24 traits — the personCentred boundary. */
  overallMean: number;
  thresholdMode: ThresholdMode;
  consistency: "High" | "Moderate" | "Low";
  /** Paradoxes with at least one inconsistent trait. */
  flaggedCount: number;
  zones: ZoneCounts;
}

export interface ScoreOptions { threshold?: ThresholdMode }

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }

function quadrantOf(x: number, y: number, tx: number, ty: number): Quadrant {
  if (y >= ty) return x >= tx ? "balanced" : "oneSidedDynamic";
  return x >= tx ? "oneSidedGentle" : "deficient";
}

export function score(items: Item[], answers: Answers, opts: ScoreOptions = {}): Result {
  const mode: ThresholdMode = opts.threshold ?? "fixed";

  /* Recode reverse items so every value points the same way: agreeing strongly
     with a reverse item is evidence *against* the trait. */
  const responses = {} as Record<TraitKey, number[]>;
  TRAIT_ORDER.forEach((t) => (responses[t] = []));
  items.forEach((it) => {
    const a = answers[it.id];
    if (a == null || Number.isNaN(a)) return;
    const v = clamp(a, SCALE_MIN, SCALE_MAX);
    responses[it.trait].push(it.reverse ? SCALE_MIN + SCALE_MAX - v : v);
  });

  const byTrait = {} as Record<TraitKey, TraitScore>;
  const traitScores: TraitScore[] = TRAIT_ORDER.map((t) => {
    const vals = responses[t];
    const n = vals.length;
    const mean = n ? vals.reduce((s, v) => s + v, 0) / n : MIDPOINT;
    const variance = n ? vals.reduce((s, v) => s + (v - mean) ** 2, 0) / n : 0;
    const sd = Math.sqrt(variance);
    const ts: TraitScore = { key: t, name: TRAITS[t].name, pole: TRAITS[t].pole, score: mean, sd, n, flagged: sd >= FLAG_SD };
    byTrait[t] = ts;
    return ts;
  });

  const overallMean = traitScores.reduce((s, t) => s + t.score, 0) / traitScores.length;
  const boundary = mode === "personCentred" ? overallMean : MIDPOINT;

  const zones: ZoneCounts = { balanced: 0, oneSided: 0, deficient: 0 };
  const paradoxes: ParadoxResult[] = PARADOX_ORDER.map((k) => {
    const def = PARADOXES[k];
    const dynamic = byTrait[def.dynamic];
    const gentle = byTrait[def.gentle];
    const quadrant = quadrantOf(gentle.score, dynamic.score, boundary, boundary);
    if (quadrant === "balanced") zones.balanced += 1;
    else if (quadrant === "deficient") zones.deficient += 1;
    else zones.oneSided += 1;
    return {
      key: k, name: def.name, tension: def.tension,
      dynamic, gentle,
      thresholdX: boundary, thresholdY: boundary,
      quadrant, label: def.labels[quadrant],
      flagged: dynamic.flagged || gentle.flagged,
    };
  });

  const flaggedTraits = traitScores.filter((t) => t.flagged).length;
  const consistency = flaggedTraits <= 1 ? "High" : flaggedTraits <= 3 ? "Moderate" : "Low";

  return {
    paradoxes, traitScores, overallMean, thresholdMode: mode,
    consistency, flaggedCount: paradoxes.filter((p) => p.flagged).length, zones,
  };
}
