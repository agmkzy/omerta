// The six core attributes, as in D&D.
import type { Roller } from './random';

export const ATTRIBUTES = ['str', 'agi', 'con', 'int', 'wis', 'cha'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

export const ATTRIBUTE_INFO: { readonly [A in Attribute]: { readonly name: string; readonly short: string; readonly covers: string } } = {
  str: { name: 'Strength', short: 'STR', covers: 'Physical power.' },
  agi: { name: 'Agility', short: 'AGI', covers: 'Speed, coordination and manual dexterity.' },
  con: { name: 'Constitution', short: 'CON', covers: 'Endurance and resistance to injury.' },
  int: { name: 'Intelligence', short: 'INT', covers: 'Reasoning, memory and numeracy.' },
  wis: { name: 'Wisdom', short: 'WIS', covers: 'Perception, intuition and judgement.' },
  cha: { name: 'Charisma', short: 'CHA', covers: 'Force of personality, for persuasion or intimidation.' },
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

/** Six scores, each 4d6 dropping the lowest die (the standard D&D method). */
export function rollScores(roller: Roller): number[] {
  return ATTRIBUTES.map(() => {
    const faces = [roller.roll(6), roller.roll(6), roller.roll(6), roller.roll(6)].sort((a, b) => b - a);
    return faces[0]! + faces[1]! + faces[2]!;
  });
}

/** Assigns the highest score to the first attribute in `priorities`, the next highest to the second, and so on. */
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
