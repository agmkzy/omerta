// Contests: an automatically resolved, multi-round opposed check modelled as a tug-of-war.
//
// A marker starts at 0 on a track from -track (defender wins) to +track (attacker wins). Each round both sides make an
// opposed roll and the marker moves one step per POINTS_PER_STEP of the difference. Neither side chooses actions. Nerve checks
// are triggered by events (being pushed past halfway, taking a hit, a gun being drawn); a failed nerve check ends the
// contest in a way determined by temperament. Every step is recorded as an event.
import { resolveCheck, resolveOpposed, type CheckResult, type Modifier, type OpposedResult, type Roll } from './check';
import { rollFor, type Character } from './character';
import { DICE, type Dice } from './dice';
import type { Roller } from './random';
import { leaning, type Trait } from './temperament';

export const APPROACHES = ['intimidate', 'gunpoint', 'brawl'] as const;
export type Approach = (typeof APPROACHES)[number];

export const APPROACH_INFO: { readonly [A in Approach]: { readonly name: string; readonly description: string } } = {
  intimidate: { name: 'Intimidate', description: 'Attacker’s Intimidation against the defender’s Nerve each round.' },
  gunpoint: {
    name: 'Gunpoint',
    description: 'As Intimidate, but the attacker has advantage and the defender must pass a DC 12 nerve check before the first round.',
  },
  brawl: { name: 'Brawl', description: 'Brawling against Brawling. Winning a round by 5 or more lands a hit (−1 to later rolls); three hits is a knockout.' },
};

export type Side = 'attacker' | 'defender';

export interface ContestSpec {
  readonly attacker: Character;
  readonly defender: Character;
  readonly approach: Approach;
  readonly dice?: Dice;
  /** Steps from the centre to either end. Default 5. */
  readonly track?: number;
  /** If set, the attacker withdraws when the marker reaches -walkAwayAt. */
  readonly walkAwayAt?: number;
  /** Default 12. */
  readonly maxRounds?: number;
}

export type Trigger = 'gun-drawn' | 'pushed-back' | 'hit';

export type Ending =
  | { readonly how: 'pushed' | 'knocked-out' | 'yields' | 'flees' | 'walked-away'; readonly loser: Side }
  | { readonly how: 'stalemate'; readonly loser: null };

export type ContestEvent =
  | { readonly kind: 'exchange'; readonly round: number; readonly approach: Approach; readonly result: OpposedResult; readonly moved: number; readonly marker: number }
  | { readonly kind: 'hit'; readonly round: number; readonly side: Side; readonly hits: number }
  | { readonly kind: 'nerve'; readonly round: number; readonly side: Side; readonly trigger: Trigger; readonly result: CheckResult; readonly held: boolean }
  | { readonly kind: 'lash-out'; readonly round: number; readonly side: Side }
  | { readonly kind: 'end'; readonly round: number; readonly ending: Ending };

export interface ContestResult {
  readonly events: readonly ContestEvent[];
  readonly ending: Ending;
  readonly marker: number;
  readonly rounds: number;
  readonly hits: Readonly<Record<Side, number>>;
}

/** How temperament decides the result of a failed nerve check (implemented in runContest). */
export const NERVE_FAILURE: Readonly<Partial<Record<Trait, string>>> = {
  temper: 'If high: lashes out on a failed nerve check (once per contest) and the contest becomes a brawl.',
  courage: 'If low: flees on a failed nerve check.',
  caution: 'If high: flees on a failed nerve check.',
};

/** Points of roll difference per step of marker movement (rounded up). */
export const POINTS_PER_STEP = 5;
/** In a brawl, winning a round by at least this much lands a hit. */
export const HIT_MARGIN = 5;
export const HITS_TO_KNOCK_OUT = 3;
export const NERVE_DC: Readonly<Record<Trigger, number>> = { 'gun-drawn': 12, 'pushed-back': 10, hit: 10 };
/** Added to the DC of the nerve check after a hit, per hit taken (including the current one). */
export const HIT_DC_STEP = 2;

export function runContest(spec: ContestSpec, roller: Roller): ContestResult {
  const dice = spec.dice ?? DICE.d20;
  const track = spec.track ?? 5;
  const maxRounds = spec.maxRounds ?? 12;
  assertTerms(track, maxRounds, spec.walkAwayAt);
  const halfway = Math.ceil(track / 2);
  const sides: Record<Side, Character> = { attacker: spec.attacker, defender: spec.defender };

  const events: ContestEvent[] = [];
  const hits: Record<Side, number> = { attacker: 0, defender: 0 };
  const pushedBack: Record<Side, boolean> = { attacker: false, defender: false };
  const lashedOut: Record<Side, boolean> = { attacker: false, defender: false };
  let approach = spec.approach;
  let marker = 0;
  let round = 0;

  const injuryModifiers = (side: Side): Modifier[] => (hits[side] ? [{ value: -hits[side], reason: `Injured (${hits[side]})` }] : []);

  const roundRoll = (side: Side): Roll => {
    const c = sides[side];
    const modifiers = injuryModifiers(side);
    if (approach === 'brawl') return rollFor(c, 'brawling', { dice, modifiers });
    if (side === 'attacker') return rollFor(c, 'intimidation', { dice, modifiers, situations: ['intimidate'], edges: approach === 'gunpoint' ? ['advantage'] : [] });
    return rollFor(c, 'nerve', { dice, modifiers, situations: ['hold-nerve', 'resist-intimidation'] });
  };

  const finish = (ending: Ending): ContestResult => {
    events.push({ kind: 'end', round, ending });
    return { events, ending, marker, rounds: round, hits };
  };

  /**
   * Makes a nerve check. Returns null if it passes. On a failure: a hot-tempered character lashes out (once per contest),
   * which turns the contest into a brawl; a timid or cautious one flees; anyone else yields.
   */
  const nerveCheck = (side: Side, trigger: Trigger): Ending | 'lashed-out' | null => {
    const dc = NERVE_DC[trigger] + (trigger === 'hit' ? HIT_DC_STEP * hits[side] : 0);
    const result = resolveCheck({ ...rollFor(sides[side], 'nerve', { dice, situations: ['hold-nerve'], modifiers: injuryModifiers(side) }), dc }, roller);
    const held = result.margin >= 0;
    events.push({ kind: 'nerve', round, side, trigger, result, held });
    if (held) return null;
    const t = sides[side].temperament;
    if (leaning(t.temper) === 'high' && !lashedOut[side]) {
      lashedOut[side] = true;
      approach = 'brawl';
      events.push({ kind: 'lash-out', round, side });
      return 'lashed-out';
    }
    return { how: leaning(t.courage) === 'low' || leaning(t.caution) === 'high' ? 'flees' : 'yields', loser: side };
  };

  if (approach === 'gunpoint') {
    const failed = nerveCheck('defender', 'gun-drawn');
    if (failed && failed !== 'lashed-out') return finish(failed);
  }

  while (round < maxRounds) {
    round++;
    const brawling = approach === 'brawl';
    const result = resolveOpposed({ active: roundRoll('attacker'), passive: roundRoll('defender') }, roller);
    const difference = result.margin + 1;
    const before = marker;
    marker = Math.max(-track, Math.min(track, marker + Math.sign(difference) * Math.ceil(Math.abs(difference) / POINTS_PER_STEP)));
    events.push({ kind: 'exchange', round, approach, result, moved: marker - before, marker });
    if (difference === 0) continue;

    const loser: Side = difference > 0 ? 'defender' : 'attacker';
    const triggers: Trigger[] = [];
    if (brawling && Math.abs(difference) >= HIT_MARGIN) {
      hits[loser]++;
      events.push({ kind: 'hit', round, side: loser, hits: hits[loser] });
      if (hits[loser] >= HITS_TO_KNOCK_OUT) return finish({ how: 'knocked-out', loser });
      triggers.push('hit');
    }
    if (Math.abs(marker) === track) return finish({ how: 'pushed', loser });
    if (!pushedBack[loser] && (loser === 'defender' ? marker >= halfway : marker <= -halfway)) {
      pushedBack[loser] = true;
      triggers.push('pushed-back');
    }
    // At most one nerve check per round; a hit takes precedence over being pushed back.
    const trigger = triggers[0];
    if (trigger) {
      const failed = nerveCheck(loser, trigger);
      if (failed && failed !== 'lashed-out') return finish(failed);
    }
    if (spec.walkAwayAt !== undefined && marker <= -spec.walkAwayAt) return finish({ how: 'walked-away', loser: 'attacker' });
  }
  return finish({ how: 'stalemate', loser: null });
}

/** The key used by `tally` for an ending, e.g. "pushed:defender" or "stalemate". */
export function endingKey(ending: Ending): string {
  return ending.loser ? `${ending.how}:${ending.loser}` : ending.how;
}

/** Runs the contest `runs` times and counts the endings by `endingKey`. */
export function tally(spec: ContestSpec, roller: Roller, runs: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let i = 0; i < runs; i++) {
    const key = endingKey(runContest(spec, roller).ending);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function assertTerms(track: number, maxRounds: number, walkAwayAt: number | undefined): void {
  if (!Number.isInteger(track) || track < 1) throw new RangeError(`track must be a positive integer, got ${track}`);
  if (!Number.isInteger(maxRounds) || maxRounds < 1) throw new RangeError(`maxRounds must be a positive integer, got ${maxRounds}`);
  if (walkAwayAt !== undefined && (!Number.isInteger(walkAwayAt) || walkAwayAt < 1 || walkAwayAt > track))
    throw new RangeError(`walkAwayAt must be an integer from 1 to track (${track}), got ${walkAwayAt}`);
}
