// Checks: dice plus modifiers against a difficulty class (DC), or against an opposing roll. Results are graded into five
// outcomes rather than pass/fail, so a success can carry a cost.
import { rollDice, type Dice, type DiceRoll, type Edge } from './dice';
import { atLeast, diceDistribution, minus, shift, type Distribution } from './distribution';
import type { Roller } from './random';

/** A bonus or penalty with a human-readable reason, so every result can be explained. */
export interface Modifier {
  readonly value: number;
  readonly reason: string;
}

export const OUTCOMES = ['critical-failure', 'failure', 'partial', 'success', 'critical-success'] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** The minimum margin for each outcome. Anything below `failure` is a critical failure. */
export interface Bands {
  readonly criticalSuccess: number;
  readonly success: number;
  readonly partial: number;
  readonly failure: number;
}

/** Meet the DC: partial success. Beat it by 5: success. By 10: critical success. Miss by 6 or more: critical failure. */
export const DEFAULT_BANDS: Bands = { criticalSuccess: 10, success: 5, partial: 0, failure: -5 };

/** One side's roll: the dice, any advantage/disadvantage, and the modifiers. */
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
  /** The side attempting the action. */
  readonly active: Roll;
  /** The side resisting. Ties go to this side. */
  readonly passive: Roll;
  readonly bands?: Bands;
}

export interface RollResult {
  readonly dice: Dice;
  readonly edge: Edge;
  readonly thrown: DiceRoll;
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
  /** The active total minus the target (the passive total + 1). */
  readonly margin: number;
  readonly outcome: Outcome;
}

export type Odds = Readonly<Record<Outcome, number>>;

export function grade(margin: number, bands: Bands = DEFAULT_BANDS): Outcome {
  assertOrdered(bands);
  if (margin >= bands.criticalSuccess) return 'critical-success';
  if (margin >= bands.success) return 'success';
  if (margin >= bands.partial) return 'partial';
  if (margin >= bands.failure) return 'failure';
  return 'critical-failure';
}

/** True for a partial success or better. */
export function succeeded(outcome: Outcome): boolean {
  return OUTCOMES.indexOf(outcome) >= OUTCOMES.indexOf('partial');
}

/** Combines advantage/disadvantage from several sources as D&D does: they don't stack, and one of each cancels out. */
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
  const thrown = rollDice(roll.dice, roll.edge, roller);
  const bonus = bonusOf(roll.modifiers);
  return { dice: roll.dice, edge: roll.edge, thrown, modifiers: roll.modifiers, bonus, total: thrown.kept + bonus };
}

function totalDistribution(roll: Roll): Distribution {
  return shift(diceDistribution(roll.dice, roll.edge), bonusOf(roll.modifiers));
}

/** The probability of each outcome, from the distribution of the margin. */
function oddsOf(margin: Distribution, bands: Bands = DEFAULT_BANDS): Odds {
  assertOrdered(bands);
  const from = (k: number) => atLeast(margin, k);
  return {
    'critical-success': from(bands.criticalSuccess),
    success: from(bands.success) - from(bands.criticalSuccess),
    partial: from(bands.partial) - from(bands.success),
    failure: from(bands.failure) - from(bands.partial),
    'critical-failure': 1 - from(bands.failure),
  };
}

function assertOrdered(b: Bands): void {
  if (!(b.criticalSuccess > b.success && b.success > b.partial && b.partial > b.failure))
    throw new RangeError(`bands must be in descending order from criticalSuccess to failure, got ${JSON.stringify(b)}`);
}
