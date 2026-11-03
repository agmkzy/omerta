// The nerve check, shared by fights and social actions: whether a character holds together when threatened or hurt, and
// how they react if they do not. It follows D&D's optional morale rule (a Wisdom save against a DC), using the Nerve skill.
// What prompts a check, and its DC, belongs to whatever calls it (a fight's start, half health, half a squad down).
import { passes, resolveCheck, type CheckResult, type Roll } from './check';
import type { Roller } from './random';
import type { Skill } from './skills';
import { TRAIT_INFO, leaning, type Situation, type Temperament, type Trait } from './temperament';

/** What a nerve check rolls: the Nerve skill, with the temperament modifiers for holding nerve. */
export const NERVE_ROLL: { readonly skill: Skill; readonly situations: readonly Situation[] } = { skill: 'nerve', situations: ['hold-nerve'] };

/** How a character reacts to failing a nerve check. */
export type NerveResponse = 'flees' | 'yields';

/** How temperament decides the response to a failed nerve check, in order: the first rule that applies wins, and anyone else yields. */
const NERVE_RULES: readonly { readonly trait: Trait; readonly leaning: 'high' | 'low'; readonly response: Exclude<NerveResponse, 'yields'> }[] = [
  { trait: 'courage', leaning: 'low', response: 'flees' },
  { trait: 'caution', leaning: 'high', response: 'flees' },
];

/** Who flees on a failed nerve check, in words: "someone with low courage or high caution" reads "low courage or high caution". */
export const FLEES_WHEN = NERVE_RULES.map((r) => `${r.leaning} ${TRAIT_INFO[r.trait].name.toLowerCase()}`).join(' or ');

/** For each trait that decides a failed nerve check, what it does, in words. */
export const NERVE_FAILURE: Readonly<Partial<Record<Trait, string>>> = Object.fromEntries(
  NERVE_RULES.map((r) => [r.trait, `If ${r.leaning}: flees on a failed nerve check.`]),
);

export interface NerveCheck {
  readonly result: CheckResult;
  readonly passed: boolean;
  /** The reaction to a failure; null if the check passed. */
  readonly response: NerveResponse | null;
}

/** A character's nerve roll (see NERVE_ROLL) against a DC. On a failure, a timid or cautious character flees; anyone else yields. */
export function nerveCheck(roll: Roll, dc: number, t: Temperament, roller: Roller): NerveCheck {
  const result = resolveCheck({ ...roll, dc }, roller);
  if (passes(result.margin)) return { result, passed: true, response: null };
  return { result, passed: false, response: nerveResponse(t) };
}

/** How a character reacts to failing a nerve check. It depends only on temperament, so it is known in advance. */
export function nerveResponse(t: Temperament): NerveResponse {
  return NERVE_RULES.find((r) => leaning(t[r.trait]) === r.leaning)?.response ?? 'yields';
}
