// A check: dice plus modifiers against a difficulty (DC), or against another man's roll. The result is graded, not pass/fail,
// because a success that costs something makes more story than a clean one.
import { rollDice, type Dice, type DiceRoll, type Edge } from './dice';
import { atLeast, diceDistribution, minus, shift, type Distribution } from './distribution';
import type { Roller } from './random';

/** A bonus or penalty, with the reason for it in words, so a result can always be explained. */
export interface Modifier {
  readonly value: number;
  readonly reason: string;
}

export const OUTCOMES = ['botch', 'failure', 'partial', 'success', 'triumph'] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** The least margin for each outcome. Below `failure` is a botch. */
export interface Bands {
  readonly triumph: number;
  readonly success: number;
  readonly partial: number;
  readonly failure: number;
}

/** Meet the DC: done, at a cost. Beat it by 5: clean. By 10: better than hoped. Miss by 6 or more: it goes badly wrong. */
export const DEFAULT_BANDS: Bands = { triumph: 10, success: 5, partial: 0, failure: -5 };

/** One side's roll: what it is thrown on, and what is added to it. */
export interface Roll {
  readonly dice: Dice;
  readonly edge: Edge;
  readonly modifiers: readonly Modifier[];
}

export interface CheckSpec extends Roll {
  readonly dc: number;
  readonly bands?: Bands;
}

export interface OpposedSpec {
  /** The side trying to change things. */
  readonly active: Roll;
  /** The side resisting. It holds on a tie. */
  readonly passive: Roll;
  readonly bands?: Bands;
}

export interface RollResult {
  readonly dice: DiceRoll;
  readonly modifiers: readonly Modifier[];
  readonly bonus: number;
  readonly total: number;
}

export interface CheckResult {
  readonly roll: RollResult;
  readonly dc: number;
  readonly margin: number;
  readonly outcome: Outcome;
}

export interface OpposedResult {
  readonly active: RollResult;
  readonly passive: RollResult;
  /** How far the active side cleared what it had to beat (the passive total + 1). */
  readonly margin: number;
  readonly outcome: Outcome;
}

export type Odds = Readonly<Record<Outcome, number>>;

export function grade(margin: number, bands: Bands = DEFAULT_BANDS): Outcome {
  assertOrdered(bands);
  if (margin >= bands.triumph) return 'triumph';
  if (margin >= bands.success) return 'success';
  if (margin >= bands.partial) return 'partial';
  if (margin >= bands.failure) return 'failure';
  return 'botch';
}

/** A partial success or better: it got done. */
export function succeeded(outcome: Outcome): boolean {
  return OUTCOMES.indexOf(outcome) >= OUTCOMES.indexOf('partial');
}

/** Several sources of edge, combined as D&D does: they don't stack, and any advantage cancels any disadvantage. */
export function combineEdges(edges: readonly Edge[]): Edge {
  const up = edges.includes('advantage');
  const down = edges.includes('disadvantage');
  return up === down ? 'none' : up ? 'advantage' : 'disadvantage';
}

export function bonusOf(modifiers: readonly Modifier[]): number {
  return modifiers.reduce((sum, m) => sum + m.value, 0);
}

export function resolveCheck(spec: CheckSpec, roller: Roller): CheckResult {
  const roll = throwRoll(spec, roller);
  const margin = roll.total - spec.dc;
  return { roll, dc: spec.dc, margin, outcome: grade(margin, spec.bands) };
}

export function resolveOpposed(spec: OpposedSpec, roller: Roller): OpposedResult {
  const active = throwRoll(spec.active, roller);
  const passive = throwRoll(spec.passive, roller);
  const margin = active.total - (passive.total + 1);
  return { active, passive, margin, outcome: grade(margin, spec.bands) };
}

export function checkOdds(spec: CheckSpec): Odds {
  return oddsOf(shift(totalDistribution(spec), -spec.dc), spec.bands);
}

export function opposedOdds(spec: OpposedSpec): Odds {
  return oddsOf(shift(minus(totalDistribution(spec.active), totalDistribution(spec.passive)), -1), spec.bands);
}

function throwRoll(roll: Roll, roller: Roller): RollResult {
  const dice = rollDice(roll.dice, roll.edge, roller);
  const bonus = bonusOf(roll.modifiers);
  return { dice, modifiers: roll.modifiers, bonus, total: dice.kept + bonus };
}

function totalDistribution(roll: Roll): Distribution {
  return shift(diceDistribution(roll.dice, roll.edge), bonusOf(roll.modifiers));
}

/** The chance of each outcome, from the distribution of the margin. */
function oddsOf(margin: Distribution, bands: Bands = DEFAULT_BANDS): Odds {
  assertOrdered(bands);
  const from = (k: number) => atLeast(margin, k);
  return {
    triumph: from(bands.triumph),
    success: from(bands.success) - from(bands.triumph),
    partial: from(bands.partial) - from(bands.success),
    failure: from(bands.failure) - from(bands.partial),
    botch: 1 - from(bands.failure),
  };
}

function assertOrdered(b: Bands): void {
  if (!(b.triumph > b.success && b.success > b.partial && b.partial > b.failure))
    throw new RangeError(`bands must fall from triumph to failure, got ${JSON.stringify(b)}`);
}
