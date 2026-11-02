// The nerve check, shared by fights and social actions: whether a character holds together when threatened or hurt, and
// how they react if they do not. It follows D&D's optional morale rule (a Wisdom save against DC 10), using the Nerve skill.
import { resolveCheck, type CheckResult, type CheckSpec } from './check';
import { rollFor, type Character } from './character';
import type { Dice } from './dice';
import type { Roller } from './random';
import { leaning, type Trait } from './temperament';

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

/** How temperament decides the response to a failed nerve check (implemented in nerveCheck). */
export const NERVE_FAILURE: Readonly<Partial<Record<Trait, string>>> = {
  temper: 'If high: fights back on a failed nerve check when threatened with a weapon.',
  courage: 'If low: flees on a failed nerve check.',
  caution: 'If high: flees on a failed nerve check.',
};

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
  if (result.margin >= 0) return { trigger, result, passed: true, response: null };
  return { trigger, result, passed: false, response: nerveResponse(c, canFightBack) };
}

/** The roll and DC of a nerve check, for working out its odds. */
export function nerveCheckSpec(c: Character, trigger: Trigger, dice: Dice): CheckSpec {
  return { ...rollFor(c, 'nerve', { dice, situations: ['hold-nerve'] }), dc: NERVE_DC[trigger] };
}

/** How a character reacts to failing a nerve check. It depends only on temperament, so it is known in advance. */
export function nerveResponse(c: Character, canFightBack: boolean): NerveResponse {
  const t = c.temperament;
  if (leaning(t.courage) === 'low' || leaning(t.caution) === 'high') return 'flees';
  if (canFightBack && leaning(t.temper) === 'high') return 'fights';
  return 'yields';
}
