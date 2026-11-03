// Temperament: personality traits that describe what a character is inclined to do, as opposed to what they are able to do.
// Temperament mainly drives behaviour; in a few situations it also modifies rolls. Those effects are listed in one table.
import type { Modifier } from './check';
import type { Roller } from './random';

/**
 * The game's seven stored traits (src/types.ts Traits); then pride, volatility, agreeable and empathy, which the game works out
 * from them (src/temper.ts) and which are stored here; then loyalty, honesty and cruelty, from the character lab.
 */
export const TRAITS = [
  'greed', 'violence', 'ambition', 'caution', 'sociability', 'vice', 'courage',
  'pride', 'volatility', 'agreeable', 'empathy',
  'loyalty', 'honesty', 'cruelty',
] as const;
export type Trait = (typeof TRAITS)[number];

/** Each trait from 0 to 1; 0.5 is average. */
export type Temperament = Readonly<Record<Trait, number>>;

export const TRAIT_INFO: { readonly [T in Trait]: { readonly name: string; readonly low: string; readonly high: string; readonly description: string } } = {
  greed: { name: 'Greed', low: 'content', high: 'greedy', description: 'How strongly money motivates them.' },
  violence: { name: 'Violence', low: 'gentle', high: 'violent', description: 'Willingness to use force to get what they want.' },
  ambition: { name: 'Ambition', low: 'unambitious', high: 'ambitious', description: 'Desire for status and promotion.' },
  caution: { name: 'Caution', low: 'reckless', high: 'cautious', description: 'How much they weigh risk before acting.' },
  sociability: { name: 'Sociability', low: 'solitary', high: 'sociable', description: 'How much they seek company and conversation.' },
  vice: { name: 'Vice', low: 'abstemious', high: 'indulgent', description: 'Appetite for drinking, gambling and other indulgences.' },
  courage: { name: 'Courage', low: 'timid', high: 'brave', description: 'Willingness to face danger.' },
  pride: { name: 'Pride', low: 'humble', high: 'proud', description: 'Sensitivity to their standing and to being disrespected.' },
  volatility: { name: 'Volatility', low: 'calm', high: 'volatile', description: 'How quickly they lose control when provoked.' },
  agreeable: { name: 'Agreeable', low: 'stubborn', high: 'agreeable', description: 'Readiness to look for a deal and meet someone halfway.' },
  empathy: { name: 'Empathy', low: 'detached', high: 'compassionate', description: 'How much they are moved by another’s circumstances.' },
  loyalty: { name: 'Loyalty', low: 'disloyal', high: 'loyal', description: 'How firmly they stand by their organisation and allies.' },
  honesty: { name: 'Honesty', low: 'dishonest', high: 'honest', description: 'Reluctance to lie or cheat.' },
  cruelty: { name: 'Cruelty', low: 'kind', high: 'cruel', description: 'Willingness to cause suffering beyond what is necessary.' },
};

export type Leaning = 'low' | 'average' | 'high';
export const LOW = 0.3;
export const HIGH = 0.7;

export function leaning(value: number): Leaning {
  return value <= LOW ? 'low' : value >= HIGH ? 'high' : 'average';
}

/** A complete temperament; traits not given default to 0.5. */
export function temperament(given: Partial<Temperament>): Temperament {
  const t = Object.fromEntries(TRAITS.map((k) => [k, given[k] ?? 0.5])) as Record<Trait, number>;
  for (const k of TRAITS) if (!(t[k] >= 0 && t[k] <= 1)) throw new RangeError(`${k} must be between 0 and 1, got ${t[k]}`);
  return t;
}

/** Adjectives for the traits that are not average, ordered by distance from 0.5. */
export function notableTraits(t: Temperament): string[] {
  return TRAITS.filter((k) => leaning(t[k]) !== 'average')
    .sort((a, b) => Math.abs(t[b] - 0.5) - Math.abs(t[a] - 0.5))
    .map((k) => (leaning(t[k]) === 'high' ? TRAIT_INFO[k].high : TRAIT_INFO[k].low));
}

/**
 * A random temperament. Each trait is centred on the given value (0.5 if not given) plus the mean of two uniform draws,
 * giving a triangular distribution, clamped to 0–1 and rounded to two decimal places.
 */
export function rollTemperament(roller: Roller, centres: Partial<Temperament> = {}): Temperament {
  const centre = temperament(centres);
  const draw = () => (roller.roll(101) - 1) / 100;
  return Object.fromEntries(
    TRAITS.map((k) => {
      const value = centre[k] + (draw() + draw()) / 2 - 0.5;
      return [k, Number(Math.min(1, Math.max(0, value)).toFixed(2))];
    }),
  ) as Temperament;
}

/** Situations in which temperament modifies a roll. */
export const SITUATIONS = ['intimidate', 'resist-intimidation', 'hold-nerve', 'deceive', 'persuade'] as const;
export type Situation = (typeof SITUATIONS)[number];

export const SITUATION_INFO: { readonly [S in Situation]: { readonly name: string; readonly description: string } } = {
  intimidate: { name: 'Intimidating', description: 'Making threats to coerce someone.' },
  'resist-intimidation': { name: 'Resisting intimidation', description: 'Being threatened by someone.' },
  'hold-nerve': { name: 'Holding nerve', description: 'Staying composed under danger or pressure.' },
  deceive: { name: 'Deceiving', description: 'Lying or bluffing.' },
  persuade: { name: 'Persuading', description: 'Negotiating or convincing someone.' },
};

export interface Effect {
  readonly situation: Situation;
  readonly trait: Trait;
  readonly when: Exclude<Leaning, 'average'>;
  readonly value: number;
}

export const TEMPERAMENT_EFFECTS: readonly Effect[] = [
  { situation: 'intimidate', trait: 'cruelty', when: 'high', value: 2 },
  { situation: 'intimidate', trait: 'violence', when: 'high', value: 1 },
  { situation: 'intimidate', trait: 'violence', when: 'low', value: -1 },
  { situation: 'resist-intimidation', trait: 'pride', when: 'high', value: 2 },
  { situation: 'hold-nerve', trait: 'courage', when: 'high', value: 2 },
  { situation: 'hold-nerve', trait: 'courage', when: 'low', value: -2 },
  { situation: 'deceive', trait: 'honesty', when: 'high', value: -2 },
  { situation: 'deceive', trait: 'honesty', when: 'low', value: 1 },
  { situation: 'persuade', trait: 'sociability', when: 'high', value: 1 },
  { situation: 'persuade', trait: 'sociability', when: 'low', value: -1 },
];

/** The roll modifiers a trait can give, in table order. */
export function effectsOf(trait: Trait): Effect[] {
  return TEMPERAMENT_EFFECTS.filter((e) => e.trait === trait);
}

/** Temperament modifiers for the given situations, in the order the situations are listed. The reason is the trait adjective. */
export function temperamentModifiers(t: Temperament, situations: readonly Situation[]): Modifier[] {
  return situations.flatMap((s) =>
    TEMPERAMENT_EFFECTS.filter((e) => e.situation === s && leaning(t[e.trait]) === e.when).map((e) => ({
      value: e.value,
      reason: capitalise(TRAIT_INFO[e.trait][e.when]),
    })),
  );
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
