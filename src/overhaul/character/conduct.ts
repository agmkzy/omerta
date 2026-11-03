// Conduct: how what a character does, how they react and what is done to them move their temperament. A character stores
// their starting traits and their conduct, the steps that moved each trait with the cause of each; their current traits are
// worked out from the two, so there is never a second copy of the traits. Each kind of conduct moves a character's traits at
// most once a week, by small steps that shrink near the ends. See docs/overhaul/plans/character/README.md (Temperament moves
// with conduct).
import type { CharacterRecord } from './character';
import type { Fact, FactId, FactKind } from './facts';
import type { Item } from './items';
import type { JobId } from './jobs';
import { TRAITS, leaning, temperament, type Temperament, type Trait } from './temperament';
import { DAY, assertTime } from './time';

/** Every step is this size: a step raises a trait by STEP × (1 − value) and lowers it by STEP × value. */
export const STEP = 0.01;

/** Each kind of conduct moves a character's traits at most once in this long. */
export const CONDUCT_INTERVAL = 7 * DAY;

/** A trait moved up or down by one step. */
export type Move = readonly [trait: Trait, direction: 1 | -1];

/** What a kind of conduct is, and which traits it moves, given the character's current traits and the circumstances. */
export interface ConductInfo {
  readonly what: string;
  moves(t: Temperament, circumstances: Circumstances): readonly Move[];
}

/** What a kind of conduct can depend on beyond the character's traits. */
export interface Circumstances {
  /** Drinking: whether anyone else was there. */
  readonly inCompany?: boolean;
}

const fixed = (what: string, ...moves: Move[]): ConductInfo => ({ what, moves: () => moves });
const depending = (what: string, moves: ConductInfo['moves']): ConductInfo => ({ what, moves });

/** The plan's three conduct tables: what characters choose to do, how they react, and what is done to them. */
export const CONDUCT = {
  // What they choose to do
  'starting-a-fight': fixed('Starting a real fight', ['violence', 1]),
  'starting-a-fight-outmatched': fixed('Starting one against a bigger squad, or against a weapon that outclasses theirs', ['courage', 1]),
  'starting-a-fight-rashly': fixed('Starting one while hurt, or against a bigger squad', ['caution', -1]),
  'setting-an-ambush': fixed('Setting an ambush', ['caution', 1]),
  'beating-the-helpless': fixed('Beating someone who could not fight back', ['cruelty', 1], ['empathy', -1]),
  'fighting-when-provoked': fixed('Starting a fight with someone who provoked them, the same day', ['volatility', 1]),
  intimidating: fixed('Intimidating someone', ['violence', 1]),
  persuading: fixed('Persuading someone', ['agreeable', 1]),
  lying: fixed('Lying', ['honesty', -1]),
  'lying-to-the-trusting': fixed('Lying to someone whose trust in them is high', ['loyalty', -1]),
  robbing: fixed('Robbery', ['greed', 1], ['violence', 1]),
  stealing: fixed('Theft, burglary or a scam', ['greed', 1], ['honesty', -1]),
  drinking: depending('Drinking a bottle', (_t, c) => [['vice', 1], ['sociability', c.inCompany ? 1 : -1]]),
  planning: fixed('Planning a job', ['caution', 1], ['ambition', 1]),
  'taking-a-hard-job': fixed('Taking part in a hard job', ['ambition', 1]),
  // How they react
  'holding-their-nerve': fixed('Holding their nerve', ['courage', 1]),
  'standing-by-their-squad': fixed('Standing by their squad', ['loyalty', 1]),
  running: fixed('Running', ['courage', -1], ['caution', 1]),
  'leaving-their-squad': fixed('Leaving their squad', ['loyalty', -1]),
  surrendering: fixed('Surrendering in a fight', ['courage', -1], ['pride', -1]),
  'giving-in-to-a-threat': fixed('Giving in to a threat', ['courage', -1], ['pride', -1]),
  'standing-up-to-a-threat': fixed('Standing up to a threat', ['courage', 1], ['pride', 1]),
  'losing-their-temper': fixed('Losing their temper', ['volatility', 1]),
  // What is done to them
  beaten: depending('Being beaten', (t) => [leaning(t.courage) === 'high' ? ['volatility', 1] : ['caution', 1]]),
  'lied-to': fixed('Finding out they were lied to', ['agreeable', -1]),
} as const satisfies Readonly<Record<string, ConductInfo>>;

export type Conduct = keyof typeof CONDUCT;
export const CONDUCTS = Object.keys(CONDUCT) as Conduct[];

/** What caused a step: a fact, an item used up, or a job (its plan, or taking part in it). */
export type Cause = { readonly fact: FactId } | { readonly item: Item } | { readonly job: JobId };

/** One step of a character's conduct: a trait moved one step up or down, by a kind of conduct, at a time, for a cause. */
export interface ConductStep {
  readonly conduct: Conduct;
  readonly trait: Trait;
  readonly direction: 1 | -1;
  readonly at: number;
  readonly cause: Cause;
}

const current = new WeakMap<CharacterRecord, Temperament>();

/** A character's current traits: their starting traits with every step of their conduct applied in order. */
export function currentTemperament(c: CharacterRecord): Temperament {
  let t = current.get(c);
  if (t === undefined) current.set(c, (t = applySteps(c.startingTemperament, c.conduct)));
  return t;
}

/** Traits with steps applied in order. */
export function applySteps(start: Temperament, steps: readonly ConductStep[]): Temperament {
  const t: Record<Trait, number> = { ...start };
  for (const s of steps) t[s.trait] += s.direction === 1 ? STEP * (1 - t[s.trait]) : -STEP * t[s.trait];
  return temperament(t);
}

/**
 * The steps a kind of conduct adds at `now`: none if it already moved the character's traits within the last week, otherwise
 * one for each trait it moves, by the character's current traits.
 */
export function conductSteps(c: CharacterRecord, conduct: Conduct, now: number, cause: Cause, circumstances: Circumstances = {}): ConductStep[] {
  assertTime(now);
  if (c.conduct.some((s) => s.conduct === conduct && now - s.at < CONDUCT_INTERVAL)) return [];
  return CONDUCT[conduct].moves(currentTemperament(c), circumstances).map(([trait, direction]) => ({ conduct, trait, direction, at: now, cause }));
}

/** The character with a kind of conduct added at `now`, if it can still move their traits this week. */
export function withConduct(c: CharacterRecord, conduct: Conduct, now: number, cause: Cause, circumstances: Circumstances = {}): CharacterRecord {
  const steps = conductSteps(c, conduct, now, cause, circumstances);
  return steps.length ? { ...c, conduct: [...c.conduct, ...steps] } : c;
}

/** The conduct a recorded fact is for whoever did it, and for whoever it was done to. Social rolls and fights add their own. */
export const FACT_CONDUCT: { readonly actor: Readonly<Partial<Record<FactKind, Conduct>>>; readonly victim: Readonly<Partial<Record<FactKind, Conduct>>> } = {
  actor: { robbery: 'robbing', theft: 'stealing', burglary: 'stealing', scam: 'stealing' },
  victim: { beating: 'beaten' },
};

/** The character with the conduct a recorded fact is for them, if any. A fact that never happened is no one's conduct. */
export function withFactConduct(c: CharacterRecord, f: Fact): CharacterRecord {
  if (f.invented !== undefined) return c;
  const conduct = f.actor === c.id ? FACT_CONDUCT.actor[f.kind] : f.victim === c.id ? FACT_CONDUCT.victim[f.kind] : undefined;
  return conduct ? withConduct(c, conduct, f.at, { fact: f.id }) : c;
}

/** Throws RangeError for conduct that is not steps of known kinds and traits, in time order, at whole minutes. */
export function assertConduct(steps: readonly ConductStep[], what: string): void {
  let last = 0;
  for (const s of steps) {
    if (!(s.conduct in CONDUCT)) throw new RangeError(`${what}: unknown kind of conduct ${String(s.conduct)}`);
    if (!TRAITS.includes(s.trait)) throw new RangeError(`${what}: unknown trait ${String(s.trait)}`);
    if (s.direction !== 1 && s.direction !== -1) throw new RangeError(`${what}: a step moves a trait up (1) or down (-1), got ${String(s.direction)}`);
    assertTime(s.at, `${what}: a step’s time`);
    if (s.at < last) throw new RangeError(`${what}: a step at ${s.at} is recorded after one at ${last}`);
    last = s.at;
  }
}
