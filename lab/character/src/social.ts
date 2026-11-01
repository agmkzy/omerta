// Social actions: getting someone to do something without force. As in D&D, each is a single check: the actor's skill
// against the target's resisting skill, graded into the usual five outcomes, each with a meaning for that action.
//
// Intimidation can be armed. The target then makes a nerve check against a weapon first (DC 12); failing it, they comply
// at once, flee or fight back, depending on temperament. If they hold their nerve, the intimidation is rolled with
// advantage. A critical failure at intimidating a hot-tempered target provokes them into starting a fight.
import { OUTCOME_INFO, OUTCOMES, checkOdds, opposedOdds, resolveOpposed, succeeded, type Modifier, type OpposedResult, type Outcome, type Roll } from './check';
import { rollFor, type Character } from './character';
import { DICE, type Dice } from './dice';
import { nerveCheck, nerveCheckSpec, nerveResponse, type NerveCheck, type NerveResponse } from './nerve';
import type { Roller } from './random';
import { SKILL_INFO, type Skill } from './skills';
import { leaning, type Situation } from './temperament';

export const SOCIAL_ACTIONS = ['intimidate', 'persuade', 'deceive'] as const;
export type SocialAction = (typeof SOCIAL_ACTIONS)[number];

export interface SocialActionInfo {
  readonly name: string;
  readonly description: string;
  readonly skill: Skill;
  /** The skill the target resists with. */
  readonly resist: Skill;
  readonly actorSituations: readonly Situation[];
  readonly targetSituations: readonly Situation[];
  /** What each outcome means for the target, as a verb phrase ("complies"). */
  readonly outcomes: Readonly<Record<Outcome, string>>;
}

export const SOCIAL_ACTION_INFO: { readonly [A in SocialAction]: SocialActionInfo } = {
  intimidate: {
    name: 'Intimidate',
    description: 'Get someone to do something by threatening them. Intimidation against the target’s Nerve.',
    skill: 'intimidation',
    resist: 'nerve',
    actorSituations: ['intimidate'],
    targetSituations: ['hold-nerve', 'resist-intimidation'],
    outcomes: {
      'critical-success': 'complies fully and will not make trouble afterwards',
      success: 'complies',
      partial: 'complies, but resents it and may make trouble later',
      failure: 'refuses',
      'critical-failure': 'refuses and takes offence',
    },
  },
  persuade: {
    name: 'Persuade',
    description: 'Get someone to agree to something by negotiating or convincing them. Persuasion against the target’s Insight.',
    skill: 'persuasion',
    resist: 'insight',
    actorSituations: ['persuade'],
    targetSituations: [],
    outcomes: {
      'critical-success': 'agrees, and thinks better of the persuader afterwards',
      success: 'agrees',
      partial: 'agrees, but wants something in return',
      failure: 'declines',
      'critical-failure': 'declines and is put off, making them harder to persuade next time',
    },
  },
  deceive: {
    name: 'Deceive',
    description: 'Get someone to believe something untrue. Deception against the target’s Insight.',
    skill: 'deception',
    resist: 'insight',
    actorSituations: ['deceive'],
    targetSituations: [],
    outcomes: {
      'critical-success': 'believes it completely and acts on it',
      success: 'believes it',
      partial: 'believes it for now, but has doubts',
      failure: 'does not believe it',
      'critical-failure': 'sees through it and knows they were lied to',
    },
  },
};

/** What the target does on failing the nerve check against a weapon. */
export const ARMED_NERVE_RESPONSE: Readonly<Record<NerveResponse, string>> = {
  yields: 'complies at once',
  flees: 'runs',
  fights: 'fights back: it becomes a fight',
};
export const PROVOKED = 'takes offence and starts a fight';

export interface SocialSpec {
  readonly actor: Character;
  readonly target: Character;
  readonly action: SocialAction;
  /** Intimidation only: the actor draws a weapon. */
  readonly armed?: boolean;
  /** Situational modifiers for the actor. */
  readonly modifiers?: readonly Modifier[];
  readonly dice?: Dice;
}

export type SocialEnding =
  /** Decided by the opposed check. */
  | { readonly kind: 'check'; readonly outcome: Outcome }
  /** Armed intimidation: the target failed the nerve check before any check was made. */
  | { readonly kind: 'nerve'; readonly response: NerveResponse }
  /** A critical failure at intimidating a hot-tempered target: they start a fight. */
  | { readonly kind: 'provoked' };

export interface SocialResult {
  readonly nerve: NerveCheck | null;
  readonly check: OpposedResult | null;
  readonly ending: SocialEnding;
}

export type SocialResultKey = Outcome | `nerve:${NerveResponse}` | 'provoked';

export function resolveSocial(spec: SocialSpec, roller: Roller): SocialResult {
  const { dice, armed } = settings(spec);
  let nerve: NerveCheck | null = null;
  if (armed) {
    nerve = nerveCheck(spec.target, 'weapon-drawn', true, dice, roller);
    if (nerve.response) return { nerve, check: null, ending: { kind: 'nerve', response: nerve.response } };
  }
  const check = resolveOpposed(rolls(spec), roller);
  return { nerve, check, ending: endingOf(spec, check.outcome) };
}

/** The exact chance of each result. */
export function socialOdds(spec: SocialSpec): Readonly<Record<SocialResultKey, number>> {
  const { dice, armed } = settings(spec);
  const odds: Record<SocialResultKey, number> = {
    ...(Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<Outcome, number>),
    'nerve:yields': 0,
    'nerve:flees': 0,
    'nerve:fights': 0,
    provoked: 0,
  };
  let reachesCheck = 1;
  if (armed) {
    const nerve = checkOdds(nerveCheckSpec(spec.target, 'weapon-drawn', dice));
    const holds = OUTCOMES.filter(succeeded).reduce((sum, o) => sum + nerve[o], 0);
    odds[`nerve:${nerveResponse(spec.target, true)}`] = 1 - holds;
    reachesCheck = holds;
  }
  const check = opposedOdds(rolls(spec));
  for (const o of OUTCOMES) odds[socialResultKey(endingOf(spec, o))] += reachesCheck * check[o];
  return odds;
}

export function socialResultKey(ending: SocialEnding): SocialResultKey {
  if (ending.kind === 'check') return ending.outcome;
  if (ending.kind === 'nerve') return `nerve:${ending.response}`;
  return 'provoked';
}

/** The result in words, e.g. "A rolled 17 for Intimidation against T’s 10 for Nerve: success. T complies." */
export function describeSocial(result: SocialResult, spec: SocialSpec): string {
  const { actor, target } = spec;
  const info = SOCIAL_ACTION_INFO[spec.action];
  const { ending } = result;
  if (ending.kind === 'nerve') {
    const roll = result.nerve!.result;
    return `${target.name} faces a weapon and fails a nerve check (needed ${roll.dc}, rolled ${roll.roll.total}). ${target.name} ${ARMED_NERVE_RESPONSE[ending.response]}.`;
  }
  const check = result.check!;
  const rolled = `${actor.name} rolled ${check.active.total} for ${SKILL_INFO[info.skill].name} against ${target.name}’s ${check.passive.total} for ${SKILL_INFO[info.resist].name}`;
  if (ending.kind === 'provoked') return `${rolled}: critical failure. ${target.name} ${PROVOKED}.`;
  return `${rolled}: ${OUTCOME_INFO[ending.outcome].name.toLowerCase()}. ${target.name} ${info.outcomes[ending.outcome]}.`;
}

function settings(spec: SocialSpec): { dice: Dice; armed: boolean } {
  const armed = spec.armed ?? false;
  if (armed && spec.action !== 'intimidate') throw new RangeError(`only intimidation can be armed, not ${spec.action}`);
  return { dice: spec.dice ?? DICE.d20, armed };
}

function rolls(spec: SocialSpec): { active: Roll; passive: Roll } {
  const { dice, armed } = settings(spec);
  const info = SOCIAL_ACTION_INFO[spec.action];
  return {
    active: rollFor(spec.actor, info.skill, { dice, situations: info.actorSituations, modifiers: spec.modifiers ?? [], edges: armed ? ['advantage'] : [] }),
    passive: rollFor(spec.target, info.resist, { dice, situations: info.targetSituations }),
  };
}

function endingOf(spec: SocialSpec, outcome: Outcome): SocialEnding {
  if (outcome === 'critical-failure' && spec.action === 'intimidate' && leaning(spec.target.temperament.temper) === 'high') return { kind: 'provoked' };
  return { kind: 'check', outcome };
}
