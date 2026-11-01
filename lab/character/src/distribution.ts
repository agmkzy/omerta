// Exact odds. A roll's outcomes as a table of probabilities, so the chance of a check succeeding is computed, not sampled: the
// playground can show it, and a man deciding what to try (later, the game's utility AI) can weigh it without rolling.
import type { Dice, Edge } from './dice';

/** probabilities[i] is the chance of the value min + i. */
export interface Distribution {
  readonly min: number;
  readonly probabilities: readonly number[];
}

export function pointAt(value: number): Distribution {
  return { min: value, probabilities: [1] };
}

export function diceDistribution(dice: Dice, edge: Edge): Distribution {
  const face: Distribution = { min: 1, probabilities: Array.from({ length: dice.sides }, () => 1 / dice.sides) };
  let once = pointAt(0);
  for (let i = 0; i < dice.count; i++) once = plus(once, face);
  if (edge === 'none') return once;
  // The better of two throws is at most k when both are; the worse is at least k when both are.
  const below = cumulative(once);
  const probabilities = once.probabilities.map((_, i) => {
    const upTo = below[i + 1]!;
    const before = below[i]!;
    return edge === 'advantage' ? upTo ** 2 - before ** 2 : (1 - before) ** 2 - (1 - upTo) ** 2;
  });
  return { min: once.min, probabilities };
}

export function shift(d: Distribution, by: number): Distribution {
  return { min: d.min + by, probabilities: d.probabilities };
}

/** The distribution of X + Y, for independent X and Y. */
export function plus(x: Distribution, y: Distribution): Distribution {
  const probabilities = new Array<number>(x.probabilities.length + y.probabilities.length - 1).fill(0);
  x.probabilities.forEach((px, i) => y.probabilities.forEach((py, j) => (probabilities[i + j]! += px * py)));
  return { min: x.min + y.min, probabilities };
}

/** The distribution of X − Y, for independent X and Y. */
export function minus(x: Distribution, y: Distribution): Distribution {
  return plus(x, negate(y));
}

export function probabilityOf(d: Distribution, value: number): number {
  return d.probabilities[value - d.min] ?? 0;
}

/** The chance of a value of at least k. */
export function atLeast(d: Distribution, k: number): number {
  return d.probabilities.reduce((sum, p, i) => (d.min + i >= k ? sum + p : sum), 0);
}

export function mean(d: Distribution): number {
  return d.probabilities.reduce((sum, p, i) => sum + p * (d.min + i), 0);
}

export function total(d: Distribution): number {
  return d.probabilities.reduce((a, b) => a + b, 0);
}

function negate(d: Distribution): Distribution {
  return { min: -(d.min + d.probabilities.length - 1), probabilities: [...d.probabilities].reverse() };
}

/** below[i] is the chance of a value under min + i (so below[0] is 0 and below[length] is 1). */
function cumulative(d: Distribution): number[] {
  const below = [0];
  for (const p of d.probabilities) below.push(below[below.length - 1]! + p);
  return below;
}
