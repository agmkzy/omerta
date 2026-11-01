// The dice a check is rolled on. D&D uses a flat d20; 2d10 and 3d6 cover the same range on a curve, so an expert fails less
// often. Which feels right is for the playground to show, so the dice are a setting, not a constant.
import type { Roller } from './random';

export const DICE_NAMES = ['d20', '2d10', '3d6'] as const;
export type DiceName = (typeof DICE_NAMES)[number];

export interface Dice {
  readonly name: DiceName;
  readonly count: number;
  readonly sides: number;
}

export const DICE: { readonly [N in DiceName]: Dice & { readonly name: N } } = {
  d20: { name: 'd20', count: 1, sides: 20 },
  '2d10': { name: '2d10', count: 2, sides: 10 },
  '3d6': { name: '3d6', count: 3, sides: 6 },
};

/** D&D's advantage and disadvantage: throw twice, keep the better or the worse total. */
export const EDGES = ['none', 'advantage', 'disadvantage'] as const;
export type Edge = (typeof EDGES)[number];

export interface DiceRoll {
  /** The faces of each throw: one throw, or two with an edge. */
  readonly throws: readonly (readonly number[])[];
  /** The total that counts. */
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
