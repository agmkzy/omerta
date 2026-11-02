// How fights are likely to go: simulated fights are tallied (with a fixed seed, so the same line-up always gives the same
// numbers), and the chances for the Left side are described in words on a fixed scale of likelihood words.
import { FIGHTER_STATUSES, runFight, type FightSpec, type FighterStatus } from './fight';
import { SIDE_NAME } from './fight-log';
import type { Side } from './nerve';
import { roller, seeded, type Roller } from './random';

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

/** How many simulated fights an assessment, and the playground's Simulate button, are built on. */
export const SIMULATED_FIGHTS = 2000;

const LEFT = SIDE_NAME.attacker;

/** The fixed seed for simulated fights, so the numbers do not change unless the fight does. */
const SIMULATION_SEED = 1;

export interface FightTally {
  readonly runs: number;
  readonly wins: Readonly<Record<Side | 'stalemate', number>>;
  /** Every fighter (attackers, then defenders), with how often they finished with each status. */
  readonly fighters: readonly { readonly id: string; readonly name: string; readonly side: Side; readonly statuses: Readonly<Record<FighterStatus, number>> }[];
  /** For each side, how many fights ended with at least one of its fighters knocked out. */
  readonly anyKnockedOut: Readonly<Record<Side, number>>;
  /** For each side, how many fights ended with at least one of its fighters out because they lost their nerve. */
  readonly anyLostNerve: Readonly<Record<Side, number>>;
}

/** Runs the fight `runs` times and counts the winners and how each fighter ended up. */
export function tallyFights(spec: FightSpec, roller: Roller, runs: number): FightTally {
  const wins = { attacker: 0, defender: 0, stalemate: 0 };
  const anyKnockedOut = { attacker: 0, defender: 0 };
  const anyLostNerve = { attacker: 0, defender: 0 };
  const fighters = new Map<string, { id: string; name: string; side: Side; statuses: Record<FighterStatus, number> }>();
  for (let i = 0; i < runs; i++) {
    const r = runFight(spec, roller);
    wins[r.winner ?? 'stalemate']++;
    for (const side of SIDES) {
      const mine = r.fighters.filter((f) => f.side === side);
      if (mine.some((f) => f.status === 'knocked-out')) anyKnockedOut[side]++;
      if (mine.some((f) => lostNerve(f.status))) anyLostNerve[side]++;
    }
    for (const f of r.fighters) {
      const entry = fighters.get(f.id) ?? { id: f.id, name: f.character.name, side: f.side, statuses: Object.fromEntries(FIGHTER_STATUSES.map((s) => [s, 0])) as Record<FighterStatus, number> };
      entry.statuses[f.status]++;
      fighters.set(f.id, entry);
    }
  }
  return { runs, wins, fighters: [...fighters.values()], anyKnockedOut, anyLostNerve };
}

const SIDES = ['attacker', 'defender'] as const;
const lostNerve = (s: FighterStatus) => s === 'surrendered' || s === 'backed-off' || s === 'fled';

/** The simulated fights an assessment is built on: a fixed seed, so the same line-up always gives the same numbers. */
export function simulateFights(spec: FightSpec, runs = SIMULATED_FIGHTS): FightTally {
  return tallyFights(spec, roller(seeded(SIMULATION_SEED)), runs);
}

/** The chances for the left side, from a tally. */
export function assess(t: FightTally): FightAssessment {
  return {
    runs: t.runs,
    win: t.wins.attacker / t.runs,
    stalemate: t.wins.stalemate / t.runs,
    anyKnockedOut: t.anyKnockedOut.attacker / t.runs,
    anyLostNerve: t.anyLostNerve.attacker / t.runs,
    fighters: t.fighters.filter((f) => f.side === 'attacker').map((f) => ({ id: f.id, name: f.name, downed: (t.runs - f.statuses.fighting) / t.runs })),
  };
}

export function assessFight(spec: FightSpec, runs = SIMULATED_FIGHTS): FightAssessment {
  return assess(simulateFights(spec, runs));
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

/**
 * How the fight is likely to end. Who would win is judged from the fights that end with a winner, so a stalemate is
 * never counted as a loss; a stalemate that is a real possibility (unlikely or more) is said first.
 */
function outcome(a: FightAssessment): string {
  const stalemate = STALEMATE[likelihood(a.stalemate)];
  const decisive = 1 - a.stalemate;
  if (likelihood(decisive) === 'almost no chance') return stalemate;
  const verdict = winner(a.win / decisive);
  return stalemate ? `${stalemate} If not, ${verdict}.` : `${capitalise(verdict)}.`;
}

const STALEMATE: Record<Likelihood, string> = {
  'almost certain': 'It will almost certainly end in a stalemate.',
  'very likely': 'It will very likely end in a stalemate.',
  likely: 'It will probably end in a stalemate.',
  'about even': 'It may well end in a stalemate.',
  unlikely: 'It could end in a stalemate.',
  'very unlikely': '',
  'almost no chance': '',
};

/** Who is likely to win, given the chance that Left wins a fight that has a winner. A clause, without the full stop. */
function winner(chance: number): string {
  const words: Record<Likelihood, string> = {
    'almost certain': `${LEFT} will almost certainly win`,
    'very likely': `${LEFT} will very likely win`,
    likely: `${LEFT} will probably win`,
    'about even': 'it is about even',
    unlikely: `${LEFT} will probably lose`,
    'very unlikely': `${LEFT} will very likely lose`,
    'almost no chance': `${LEFT} has almost no chance of winning`,
  };
  return words[likelihood(chance)];
}

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** "Someone on Left will probably …", down to "Nobody on Left is at real risk of …". */
function someoneOnLeft(chance: number, verb: string, gerund: string, fullVerb = verb): string {
  switch (likelihood(chance)) {
    case 'almost certain':
      return `Someone on ${LEFT} will almost certainly ${fullVerb}.`;
    case 'very likely':
      return `Someone on ${LEFT} will very likely ${fullVerb}.`;
    case 'likely':
      return `Someone on ${LEFT} will probably ${fullVerb}.`;
    case 'about even':
      return `Someone on ${LEFT} may well ${fullVerb}.`;
    case 'unlikely':
      return `Probably nobody on ${LEFT} will ${verb}.`;
    case 'very unlikely':
      return `It is very unlikely anyone on ${LEFT} will ${verb}.`;
    case 'almost no chance':
      return `Nobody on ${LEFT} is at real risk of ${gerund}.`;
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
