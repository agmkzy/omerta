// The exact odds of a roll a fight asks for, worked out from the same rules the fight uses (attackOutcome, passes).
import { bonusOf, passes, totalOf } from './check';
import type { Dice } from './dice';
import { diceDistribution } from './distribution';
import { UNARMED_DAMAGE_DIE, attackOutcome, type AttackOutcome, type RollRequest } from './fight';

export interface RollBar {
  /** The dice result: the total of the dice (or, with advantage, of the higher throw), before bonuses. */
  readonly result: number;
  /** The result with bonuses added. */
  readonly total: number;
  readonly probability: number;
  /** For an attack or nerve check, whether this result succeeds; otherwise null. */
  readonly success: boolean | null;
}

export interface RollOdds {
  /** Every possible result of the whole roll. */
  readonly bars: readonly RollBar[];
  /** The average total. */
  readonly average: number;
  /** For an attack or nerve check, the chance it succeeds. */
  readonly success: { readonly label: 'to hit' | 'to hold'; readonly chance: number } | null;
  /** For an attack, the chance of a critical hit. */
  readonly critical: number | null;
  /** For an attack: average damage on a hit and on a critical hit, and the damage the attack is expected to do. */
  readonly damage: { readonly average: number; readonly criticalAverage: number; readonly expected: number } | null;
}

/** Each dice result with its chance, for these dice with or without advantage. */
function results(dice: Pick<Dice, 'count' | 'sides'>, edge: 'none' | 'advantage'): { readonly result: number; readonly probability: number }[] {
  const d = diceDistribution(dice, edge);
  return d.probabilities.map((probability, i) => ({ result: d.min + i, probability }));
}

/** The chance of each attack outcome with this bonus against this Defence. */
export function attackOdds(dice: Dice, bonus: number, defence: number, edge: 'none' | 'advantage' = 'none'): Readonly<Record<AttackOutcome, number>> {
  const odds = { critical: 0, hit: 0, miss: 0 };
  for (const { result, probability } of results(dice, edge)) odds[attackOutcome(result, bonus, defence, dice)] += probability;
  return odds;
}

/** The chance an attack with this bonus hits this Defence, critical hits included. */
export function attackHitChance(dice: Dice, bonus: number, defence: number, edge: 'none' | 'advantage' = 'none'): number {
  const odds = attackOdds(dice, bonus, defence, edge);
  return odds.critical + odds.hit;
}

/** The lowest dice result that hits with this bonus against this Defence; the highest possible roll always does. */
export function lowestHit(dice: Dice, bonus: number, defence: number, edge: 'none' | 'advantage' = 'none'): number {
  return Math.min(...results(dice, edge).filter(({ result }) => attackOutcome(result, bonus, defence, dice) !== 'miss').map(({ result }) => result));
}

/** The average damage of a hit (or a critical hit) with this damage modifier, counting the minimum of 1. */
export function averageDamage(modifier: number, critical = false): number {
  return damageBars(critical ? 2 : 1, modifier).reduce((sum, b) => sum + b.probability * b.total, 0);
}

/** The exact odds of a roll a fight is waiting for, over the whole roll (all its dice). */
export function rollOdds(request: RollRequest): RollOdds {
  const r = request.reason;
  const none = { success: null, critical: null, damage: null };
  const mean = (bars: readonly RollBar[]) => bars.reduce((sum, b) => sum + b.probability * b.total, 0);
  if (r.kind === 'target') {
    const n = r.options.length;
    const bars = r.options.map((_, i) => ({ result: i + 1, total: i + 1, probability: 1 / n, success: null }));
    return { bars, average: (n + 1) / 2, ...none };
  }
  if (r.kind === 'damage') {
    const bars = damageBars(r.of, bonusOf(r.modifiers));
    return { bars, average: mean(bars), ...none };
  }
  const bonus = bonusOf(r.modifiers);
  const edge = r.kind === 'attack' ? r.edge : 'none';
  const succeeds = (result: number): boolean | null => {
    if (r.kind === 'attack') return attackOutcome(result, bonus, totalOf(r.defence), request.dice) !== 'miss';
    if (r.kind === 'nerve') return passes(result + bonus - r.dc);
    return null;
  };
  const bars = results(request.dice, edge).map(({ result, probability }) => ({ result, total: result + bonus, probability, success: succeeds(result) }));
  const average = mean(bars);
  if (r.kind === 'initiative') return { bars, average, ...none };
  const chance = chanceOfSuccess(bars);
  if (r.kind === 'nerve') return { bars, average, success: { label: 'to hold', chance }, critical: null, damage: null };
  const critical = attackOdds(request.dice, bonus, totalOf(r.defence), r.edge).critical;
  const hit = averageDamage(bonusOf(r.damage));
  const criticalHit = averageDamage(bonusOf(r.damage), true);
  const damage = { average: hit, criticalAverage: criticalHit, expected: (chance - critical) * hit + critical * criticalHit };
  return { bars, average, success: { label: 'to hit', chance }, critical, damage };
}

/**
 * For an attack or nerve check, the lowest dice result that succeeds (with advantage, on either throw), or whether it
 * always or never does; null for other rolls.
 */
export function resultNeeded(request: RollRequest): number | 'always' | 'never' | null {
  const bars = rollOdds(request).bars;
  if (bars.some((b) => b.success === null)) return null;
  if (bars.every((b) => b.success)) return 'always';
  return bars.find((b) => b.success)?.result ?? 'never';
}

/** The chance that one of these results succeeds. */
function chanceOfSuccess(bars: readonly RollBar[]): number {
  return bars.reduce((sum, b) => (b.success ? sum + b.probability : sum), 0);
}

/** For an attack or nerve check, the chance it succeeds (to hit, or to hold); 0 for other rolls. */
export function successChanceOf(request: RollRequest): number {
  return chanceOfSuccess(rollOdds(request).bars);
}

/** Every damage result for this many d4s and modifier, with the minimum of 1. */
function damageBars(count: number, modifier: number): RollBar[] {
  return results({ count, sides: UNARMED_DAMAGE_DIE }, 'none').map(({ result, probability }) => ({ result, total: Math.max(1, result + modifier), probability, success: null }));
}
