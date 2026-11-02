// Dice used for checks. D&D uses a flat d20; 2d10 and 3d6 cover a similar range with a bell curve, which reduces variance.
// The dice are a parameter so the options can be compared in the playground.
import type { Roller } from './random';

export const DICE_NAMES = ['d20', '2d10', '3d6'] as const;
export type DiceName = (typeof DICE_NAMES)[number];

export interface Dice {
  readonly name: DiceName;
  readonly count: number;
  readonly sides: number;
  readonly description: string;
}

export const DICE: { readonly [N in DiceName]: Dice & { readonly name: N } } = {
  d20: { name: 'd20', count: 1, sides: 20, description: 'One 20-sided die (D&D standard). Every result is equally likely, so outcomes vary a lot.' },
  '2d10': { name: '2d10', count: 2, sides: 10, description: 'Two 10-sided dice added. Middle results are more likely than extremes.' },
  '3d6': { name: '3d6', count: 3, sides: 6, description: 'Three 6-sided dice added. Strongly favours middle results, so skill matters more than luck.' },
};

/** The highest and lowest totals the dice can roll. On a d20 these are the natural 20 and natural 1. */
export function highestRoll(dice: Pick<Dice, 'count' | 'sides'>): number {
  return dice.count * dice.sides;
}

export function lowestRoll(dice: Pick<Dice, 'count'>): number {
  return dice.count;
}

/** Whether a dice result is the highest or lowest the dice can roll. */
export function extremeOf(kept: number, dice: Pick<Dice, 'count' | 'sides'>): 'highest' | 'lowest' | null {
  return kept === highestRoll(dice) ? 'highest' : kept === lowestRoll(dice) ? 'lowest' : null;
}

/** "natural 20" and "natural 1" on a d20; on other dice, "highest possible roll (18)" and "lowest possible roll (3)". */
export function extremeName(which: 'highest' | 'lowest', dice: Dice): string {
  if (dice.count === 1 && dice.sides === 20) return which === 'highest' ? 'natural 20' : 'natural 1';
  return which === 'highest' ? `highest possible roll (${highestRoll(dice)})` : `lowest possible roll (${lowestRoll(dice)})`;
}

/** The same with its article: "a natural 20", but "the highest possible roll (18)". */
export function extremePhrase(which: 'highest' | 'lowest', dice: Dice): string {
  return `${dice.count === 1 && dice.sides === 20 ? 'a' : 'the'} ${extremeName(which, dice)}`;
}

/** D&D's advantage and disadvantage: roll twice and keep the higher or lower total. */
export const EDGES = ['none', 'advantage', 'disadvantage'] as const;
export type Edge = (typeof EDGES)[number];

export const EDGE_INFO: { readonly [E in Edge]: { readonly name: string; readonly description: string } } = {
  none: { name: 'None', description: 'Roll once.' },
  advantage: { name: 'Advantage', description: 'Roll twice and keep the higher result.' },
  disadvantage: { name: 'Disadvantage', description: 'Roll twice and keep the lower result.' },
};

export interface DiceRoll {
  /** The faces of each throw: one throw, or two with advantage/disadvantage. */
  readonly throws: readonly (readonly number[])[];
  /** The total that is used. */
  readonly kept: number;
}

export function rollDice(dice: Dice, edge: Edge, roller: Roller): DiceRoll {
  const once = () => Array.from({ length: dice.count }, () => roller.roll(dice.sides));
  const throws = edge === 'none' ? [once()] : [once(), once()];
  const totals = throws.map(sum);
  const kept = edge === 'advantage' ? Math.max(...totals) : edge === 'disadvantage' ? Math.min(...totals) : totals[0]!;
  return { throws, kept };
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

/** Faces for `count` dice of `sides` that add up to `total`, as even as possible (e.g. 10 on 3d6 is 4, 3, 3). */
export function facesForTotal(total: number, count: number, sides: number): number[] {
  if (!Number.isInteger(total) || total < count || total > count * sides) throw new RangeError(`${count}d${sides} cannot make ${total}`);
  const base = Math.floor(total / count);
  const extra = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}
