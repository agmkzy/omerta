// Temperament: what a man is inclined to do, as opposed to what he can do. Mostly it decides what he tries; in a few deliberate
// places it also changes how a roll goes, and those places are listed in one table so they can be tuned.
import type { Modifier } from './check';
import type { Roller } from './random';

/** The game's seven traits (src/types.ts Traits), then five more that its dialogue voices already imply. */
export const TRAITS = ['greed', 'violence', 'ambition', 'caution', 'sociability', 'vice', 'courage', 'loyalty', 'pride', 'temper', 'honesty', 'cruelty'] as const;
export type Trait = (typeof TRAITS)[number];

/** Each trait from 0 to 1; 0.5 is middling. */
export type Temperament = Readonly<Record<Trait, number>>;

export const TRAIT_INFO: { readonly [T in Trait]: { readonly name: string; readonly low: string; readonly high: string } } = {
  greed: { name: 'Greed', low: 'content', high: 'greedy' },
  violence: { name: 'Violence', low: 'gentle', high: 'violent' },
  ambition: { name: 'Ambition', low: 'unambitious', high: 'ambitious' },
  caution: { name: 'Caution', low: 'reckless', high: 'cautious' },
  sociability: { name: 'Sociability', low: 'solitary', high: 'sociable' },
  vice: { name: 'Vice', low: 'abstemious', high: 'dissolute' },
  courage: { name: 'Courage', low: 'timid', high: 'brave' },
  loyalty: { name: 'Loyalty', low: 'faithless', high: 'loyal' },
  pride: { name: 'Pride', low: 'humble', high: 'proud' },
  temper: { name: 'Temper', low: 'even-tempered', high: 'hot-headed' },
  honesty: { name: 'Honesty', low: 'deceitful', high: 'honest' },
  cruelty: { name: 'Cruelty', low: 'kind', high: 'cruel' },
};

export type Leaning = 'low' | 'middling' | 'high';
export const LOW = 0.3;
export const HIGH = 0.7;

export function leaning(value: number): Leaning {
  return value <= LOW ? 'low' : value >= HIGH ? 'high' : 'middling';
}

/** A full temperament; any trait not given is middling. */
export function temperament(given: Partial<Temperament>): Temperament {
  const t = Object.fromEntries(TRAITS.map((k) => [k, given[k] ?? 0.5])) as Record<Trait, number>;
  for (const k of TRAITS) if (!(t[k] >= 0 && t[k] <= 1)) throw new RangeError(`${k} runs from 0 to 1, got ${t[k]}`);
  return t;
}

/** The words for a man's traits that are not middling, the furthest from middling first. */
export function notableTraits(t: Temperament): string[] {
  return TRAITS.filter((k) => leaning(t[k]) !== 'middling')
    .sort((a, b) => Math.abs(t[b] - 0.5) - Math.abs(t[a] - 0.5))
    .map((k) => (leaning(t[k]) === 'high' ? TRAIT_INFO[k].high : TRAIT_INFO[k].low));
}

/**
 * A temperament rolled around its leanings (middling where none is given). Each trait is the leaning plus the average of two
 * draws, so most men sit near it and a few are far off.
 */
export function rollTemperament(roller: Roller, leanings: Partial<Temperament> = {}): Temperament {
  const centre = temperament(leanings);
  const draw = () => (roller.roll(101) - 1) / 100;
  return Object.fromEntries(
    TRAITS.map((k) => {
      const value = centre[k] + (draw() + draw()) / 2 - 0.5;
      return [k, Number(Math.min(1, Math.max(0, value)).toFixed(2))];
    }),
  ) as Temperament;
}

/** The moments in which temperament changes a roll. */
export const SITUATIONS = ['intimidate', 'resist-intimidation', 'hold-nerve', 'deceive', 'persuade'] as const;
export type Situation = (typeof SITUATIONS)[number];

interface Effect {
  readonly situation: Situation;
  readonly trait: Trait;
  readonly when: Exclude<Leaning, 'middling'>;
  readonly value: number;
  readonly reason: string;
}

export const TEMPERAMENT_EFFECTS: readonly Effect[] = [
  { situation: 'intimidate', trait: 'cruelty', when: 'high', value: 2, reason: 'Plainly enjoys it' },
  { situation: 'intimidate', trait: 'violence', when: 'high', value: 1, reason: 'Looks ready to use his hands' },
  { situation: 'intimidate', trait: 'violence', when: 'low', value: -1, reason: 'Doesn’t look like he means it' },
  { situation: 'resist-intimidation', trait: 'pride', when: 'high', value: 2, reason: 'Too proud to be pushed around' },
  { situation: 'hold-nerve', trait: 'courage', when: 'high', value: 2, reason: 'Brave' },
  { situation: 'hold-nerve', trait: 'courage', when: 'low', value: -2, reason: 'Timid' },
  { situation: 'deceive', trait: 'honesty', when: 'high', value: -2, reason: 'A poor liar' },
  { situation: 'deceive', trait: 'honesty', when: 'low', value: 1, reason: 'Lies easily' },
  { situation: 'persuade', trait: 'sociability', when: 'high', value: 1, reason: 'Easy company' },
  { situation: 'persuade', trait: 'sociability', when: 'low', value: -1, reason: 'Hard to warm to' },
];

/** What a man's temperament adds to a roll in these situations, in the order the situations are given. */
export function temperamentModifiers(t: Temperament, situations: readonly Situation[]): Modifier[] {
  return situations.flatMap((s) =>
    TEMPERAMENT_EFFECTS.filter((e) => e.situation === s && leaning(t[e.trait]) === e.when).map(({ value, reason }) => ({ value, reason })),
  );
}
