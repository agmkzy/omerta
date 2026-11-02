// The nerve check, shared by fights and social actions: whether a character holds together when threatened or hurt, and
// how they react if they do not. It follows D&D's optional morale rule (a Wisdom save against DC 10), using the Nerve skill.
import { passes, resolveCheck, type CheckResult, type CheckSpec } from './check';
import { rollFor, type Character } from './character';
import type { Dice } from './dice';
import type { Roller } from './random';
import { TRAIT_INFO, leaning, type Trait } from './temperament';

export type Side = 'attacker' | 'defender';

export function otherSide(side: Side): Side {
  return side === 'attacker' ? 'defender' : 'attacker';
}

/**
 * What prompts a nerve check: a weapon drawn on them, first dropping to half hit points in a fight, or seeing half their
 * side out of a fight.
 */
export type Trigger = 'weapon-drawn' | 'hurt' | 'allies-down';

export const NERVE_DC: Readonly<Record<Trigger, number>> = { 'weapon-drawn': 12, hurt: 10, 'allies-down': 10 };

/** How a character reacts to failing a nerve check. */
export type NerveResponse = 'flees' | 'fights' | 'yields';

/**
 * How temperament decides the response to a failed nerve check, in order: the first rule that applies wins, and anyone
 * else yields. `whenThreatened` rules apply only when the character can fight back (threatened with a weapon).
 */
const NERVE_RULES: readonly { readonly trait: Trait; readonly leaning: 'high' | 'low'; readonly response: Exclude<NerveResponse, 'yields'>; readonly whenThreatened: boolean }[] = [
  { trait: 'courage', leaning: 'low', response: 'flees', whenThreatened: false },
  { trait: 'caution', leaning: 'high', response: 'flees', whenThreatened: false },
  { trait: 'temper', leaning: 'high', response: 'fights', whenThreatened: true },
];

/** Who flees on a failed nerve check, in words: "someone with low courage or high caution" reads "low courage or high caution". */
export const FLEES_WHEN = NERVE_RULES.filter((r) => r.response === 'flees').map((r) => `${r.leaning} ${TRAIT_INFO[r.trait].name.toLowerCase()}`).join(' or ');

/** For each trait that decides a failed nerve check, what it does, in words. */
export const NERVE_FAILURE: Readonly<Partial<Record<Trait, string>>> = Object.fromEntries(
  NERVE_RULES.map((r) => [r.trait, `If ${r.leaning}: ${r.response === 'flees' ? 'flees' : 'fights back'} on a failed nerve check${r.whenThreatened ? ' when threatened with a weapon' : ''}.`]),
);

export interface NerveCheck {
  readonly trigger: Trigger;
  readonly result: CheckResult;
  readonly passed: boolean;
  /** The reaction to a failure; null if the check passed. */
  readonly response: NerveResponse | null;
}

/**
 * The dice + Nerve (with the hold-nerve temperament modifiers) against the trigger's DC. On a failure, a timid or cautious
 * character flees; a hot-tempered one fights back if `canFightBack`; anyone else yields.
 */
export function nerveCheck(c: Character, trigger: Trigger, canFightBack: boolean, dice: Dice, roller: Roller): NerveCheck {
  const result = resolveCheck(nerveCheckSpec(c, trigger, dice), roller);
  if (passes(result.margin)) return { trigger, result, passed: true, response: null };
  return { trigger, result, passed: false, response: nerveResponse(c, canFightBack) };
}

/** The roll and DC of a nerve check, for working out its odds. */
export function nerveCheckSpec(c: Character, trigger: Trigger, dice: Dice): CheckSpec {
  return { ...rollFor(c, 'nerve', { dice, situations: ['hold-nerve'] }), dc: NERVE_DC[trigger] };
}

/** How a character reacts to failing a nerve check. It depends only on temperament, so it is known in advance. */
export function nerveResponse(c: Character, canFightBack: boolean): NerveResponse {
  const rule = NERVE_RULES.find((r) => (canFightBack || !r.whenThreatened) && leaning(c.temperament[r.trait]) === r.leaning);
  return rule?.response ?? 'yields';
}
