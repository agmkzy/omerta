// The six attributes: what a man is made of. D&D's six, named for 1970 New York.
import type { Roller } from './random';

export const ATTRIBUTES = ['str', 'agi', 'con', 'int', 'wis', 'cha'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

export const ATTRIBUTE_INFO: { readonly [A in Attribute]: { readonly name: string; readonly short: string; readonly covers: string } } = {
  str: { name: 'Strength', short: 'STR', covers: 'Force: lifting, hitting, holding a man down.' },
  agi: { name: 'Agility', short: 'AGI', covers: 'Hands and speed: a fast draw, a steady wheel, light fingers.' },
  con: { name: 'Grit', short: 'CON', covers: 'Taking punishment: a beating, a long night, a bottle.' },
  int: { name: 'Wits', short: 'INT', covers: 'Reasoning, memory and numbers: books, plans, angles.' },
  wis: { name: 'Savvy', short: 'WIS', covers: 'Instinct and perception: spotting the cop, reading the room.' },
  cha: { name: 'Presence', short: 'CHA', covers: 'Force of personality: charm and menace alike.' },
};

export type AttributeScores = Readonly<Record<Attribute, number>>;

export const SCORE_MIN = 1;
export const SCORE_MAX = 20;
export const AVERAGE_SCORE = 10;

/** D&D's modifier: (score − 10) / 2, rounded down. */
export function abilityModifier(score: number): number {
  assertScore(score);
  return Math.floor((score - AVERAGE_SCORE) / 2);
}

/** A full set of scores; any not given are average. */
export function attributeScores(given: Partial<AttributeScores>): AttributeScores {
  const scores = Object.fromEntries(ATTRIBUTES.map((a) => [a, given[a] ?? AVERAGE_SCORE])) as Record<Attribute, number>;
  Object.values(scores).forEach(assertScore);
  return scores;
}

/** Six scores, each the best three of four d6, as D&D rolls them. */
export function rollScores(roller: Roller): number[] {
  return ATTRIBUTES.map(() => {
    const faces = [roller.roll(6), roller.roll(6), roller.roll(6), roller.roll(6)].sort((a, b) => b - a);
    return faces[0]! + faces[1]! + faces[2]!;
  });
}

/** Puts the best score in the first attribute named, the next best in the second, and so on. */
export function assignScores(scores: readonly number[], priorities: readonly Attribute[]): AttributeScores {
  if (scores.length !== ATTRIBUTES.length) throw new RangeError(`need ${ATTRIBUTES.length} scores, got ${scores.length}`);
  if (new Set(priorities).size !== ATTRIBUTES.length || priorities.length !== ATTRIBUTES.length)
    throw new RangeError(`priorities must name each attribute once, got ${priorities.join(', ')}`);
  const best = [...scores].sort((a, b) => b - a);
  return attributeScores(Object.fromEntries(priorities.map((a, i) => [a, best[i]!])));
}

function assertScore(score: number): void {
  if (!Number.isInteger(score) || score < SCORE_MIN || score > SCORE_MAX)
    throw new RangeError(`an attribute score is a whole number from ${SCORE_MIN} to ${SCORE_MAX}, got ${score}`);
}
