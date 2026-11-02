// How a fight is likely to go for the Left side, in words rather than numbers. The chances are estimated by simulating
// the fight (with a fixed seed, so the same line-up always gives the same assessment) and then described on a fixed
// scale of likelihood words.
import { runFight, type FightSpec } from './fight';
import { roller, seeded } from './random';

export interface FightAssessment {
  readonly runs: number;
  /** The chance Left wins. */
  readonly win: number;
  readonly stalemate: number;
  /** The chance at least one Left fighter is knocked out. */
  readonly anyKnockedOut: number;
  /** The chance at least one Left fighter loses their nerve (flees, surrenders or backs off). */
  readonly anyLostNerve: number;
  /** For each Left fighter, the chance they are knocked out or lose their nerve. */
  readonly fighters: readonly { readonly id: string; readonly name: string; readonly downed: number }[];
}

export const LIKELIHOODS = ['almost certain', 'very likely', 'likely', 'about even', 'unlikely', 'very unlikely', 'almost no chance'] as const;
export type Likelihood = (typeof LIKELIHOODS)[number];

/** The lowest chance for each word; below the last is "almost no chance". */
const THRESHOLDS: readonly [number, Likelihood][] = [
  [0.93, 'almost certain'], [0.75, 'very likely'], [0.58, 'likely'], [0.42, 'about even'], [0.25, 'unlikely'], [0.07, 'very unlikely'],
];

export function likelihood(chance: number): Likelihood {
  return THRESHOLDS.find(([min]) => chance >= min)?.[1] ?? 'almost no chance';
}

/** The fixed seed for assessments, so they do not change unless the fight does. */
const ASSESSMENT_SEED = 1;

export function assessFight(spec: FightSpec, runs = 2000): FightAssessment {
  const dice = roller(seeded(ASSESSMENT_SEED));
  let win = 0, stalemate = 0, anyKnockedOut = 0, anyLostNerve = 0;
  const downed = new Map<string, { name: string; count: number }>();
  for (let i = 0; i < runs; i++) {
    const r = runFight(spec, dice);
    if (r.winner === 'attacker') win++;
    if (r.winner === null) stalemate++;
    const left = r.fighters.filter((f) => f.side === 'attacker');
    if (left.some((f) => f.status === 'knocked-out')) anyKnockedOut++;
    if (left.some((f) => f.status !== 'fighting' && f.status !== 'knocked-out')) anyLostNerve++;
    for (const f of left) {
      const entry = downed.get(f.id) ?? { name: f.character.name, count: 0 };
      if (f.status !== 'fighting') entry.count++;
      downed.set(f.id, entry);
    }
  }
  return {
    runs,
    win: win / runs,
    stalemate: stalemate / runs,
    anyKnockedOut: anyKnockedOut / runs,
    anyLostNerve: anyLostNerve / runs,
    fighters: [...downed].map(([id, { name, count }]) => ({ id, name, downed: count / runs })),
  };
}

export interface RiskDescription {
  readonly outcome: string;
  readonly hurt: string;
  readonly nerve: string;
  /** Null when Left is one fighter, or the risk is spread evenly. */
  readonly mostAtRisk: string | null;
}

/** A fighter counts as clearly most at risk if their chance of going down is this much higher than the next. */
const STANDS_OUT_BY = 0.15;

export function describeRisk(a: FightAssessment): RiskDescription {
  return { outcome: outcome(a), hurt: someoneOnLeft(a.anyKnockedOut, 'be knocked out', 'being knocked out'), nerve: nerve(a.anyLostNerve), mostAtRisk: mostAtRisk(a) };
}

function outcome(a: FightAssessment): string {
  const words: Record<Likelihood, string> = {
    'almost certain': 'Left will almost certainly win.',
    'very likely': 'Left will very likely win.',
    likely: 'Left will probably win.',
    'about even': 'It is about even.',
    unlikely: 'Left will probably lose.',
    'very unlikely': 'Left will very likely lose.',
    'almost no chance': 'Left has almost no chance of winning.',
  };
  const stalemate = a.stalemate >= 0.58 ? ' It will probably end in a stalemate.' : a.stalemate >= 0.25 ? ' It may well end in a stalemate.' : '';
  return words[likelihood(a.win)] + stalemate;
}

/** "Someone on Left will probably …", down to "Nobody on Left is at real risk of …". */
function someoneOnLeft(chance: number, verb: string, gerund: string, fullVerb = verb): string {
  switch (likelihood(chance)) {
    case 'almost certain':
      return `Someone on Left will almost certainly ${fullVerb}.`;
    case 'very likely':
      return `Someone on Left will very likely ${fullVerb}.`;
    case 'likely':
      return `Someone on Left will probably ${fullVerb}.`;
    case 'about even':
      return `Someone on Left may well ${fullVerb}.`;
    case 'unlikely':
      return `Probably nobody on Left will ${verb}.`;
    case 'very unlikely':
      return `It is very unlikely anyone on Left will ${verb}.`;
    case 'almost no chance':
      return `Nobody on Left is at real risk of ${gerund}.`;
  }
}

function nerve(chance: number): string {
  return someoneOnLeft(chance, 'lose their nerve', 'losing their nerve', 'lose their nerve and run, surrender or back off');
}

function mostAtRisk(a: FightAssessment): string | null {
  if (a.fighters.length < 2) return null;
  const [first, second] = [...a.fighters].sort((x, y) => y.downed - x.downed);
  if (first!.downed - second!.downed < STANDS_OUT_BY) return null;
  const will = { 'almost certain': 'will almost certainly', 'very likely': 'will very likely', likely: 'will probably', 'about even': 'may well', unlikely: 'probably won’t', 'very unlikely': 'very probably won’t', 'almost no chance': 'almost certainly won’t' }[likelihood(first!.downed)];
  return `${first!.name} is the most at risk: they ${will} be knocked out or lose their nerve.`;
}
