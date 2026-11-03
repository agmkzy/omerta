// Condition: hit points, and the temporary effects that change a character's rolls. Hurt and unconscious are read from hit
// points, never stored, so the two can never disagree; shaken and drunk are stored until rest or an explicit clear ends them.
// Every effect's modifiers are listed in one table. See docs/overhaul/plans/character/README.md (Condition and temporary effects).
import { ATTRIBUTE_INFO, abilityModifier, type Attribute } from './attributes';
import { totalOf, type Modifier, type Total } from './check';
import { trainingModifier, type Abilities, type Skill } from './skills';

/** Hit points before Constitution and Toughness, as for a D&D d10 hit die at first level. */
export const BASE_HIT_POINTS = 10;

/** What a character's maximum hit points are made of: the base, then the Constitution modifier and Toughness training. */
export function hitPoints(a: Abilities): Total {
  const score = a.attributes.con;
  const toughness = trainingModifier(a, 'toughness');
  return { base: BASE_HIT_POINTS, modifiers: [{ value: abilityModifier(score), reason: `${ATTRIBUTE_INFO.con.name} ${score}` }, ...(toughness ? [toughness] : [])] };
}

/** Maximum hit points. The lowest possible is 5 (Constitution 1, untrained). */
export function maxHitPoints(a: Abilities): number {
  return totalOf(hitPoints(a));
}

/** The effects that are stored. */
export const STORED_EFFECTS = ['shaken', 'drunk'] as const;
export type StoredEffect = (typeof STORED_EFFECTS)[number];

/** Every effect: the stored ones, and hurt, which is read from hit points. */
export type Effect = 'hurt' | StoredEffect;

export const EFFECT_INFO: { readonly [E in Effect]: { readonly name: string; readonly description: string } } = {
  hurt: { name: 'Hurt', description: 'At or below half hit points. Ends on healing back above half.' },
  shaken: { name: 'Shaken', description: 'Lost their nerve in a fight, or gave in to intimidation. Ends on resting.' },
  drunk: { name: 'Drunk', description: 'Has had too much to drink. Ends on resting.' },
};

/** What a character's condition is stored as. */
export interface ConditionRecord {
  readonly hitPoints: number;
  /** Each stored effect at most once, in STORED_EFFECTS order. */
  readonly effects: readonly StoredEffect[];
  /** The last rest, from when it started until when it ends, in minutes. */
  readonly rest?: { readonly from: number; readonly until: number };
}

/** Whether a character with this condition is resting at `now`. */
export function restingAt(c: ConditionRecord, now: number): boolean {
  return c.rest !== undefined && c.rest.from <= now && now < c.rest.until;
}

/**
 * Throws RangeError unless a character can take part in something at `now`: conscious, and not resting. `what` says how
 * they would take part, for the message.
 */
export function assertAvailable(c: { readonly name: string; readonly condition: ConditionRecord }, now: number, what = 'take part'): void {
  if (c.condition.hitPoints === 0) throw new RangeError(`${c.name} is unconscious, so cannot ${what}`);
  if (restingAt(c.condition, now)) throw new RangeError(`${c.name} is resting at ${now}, so cannot ${what}`);
}

/** A condition as it stands. */
export interface Condition extends ConditionRecord {
  readonly maxHitPoints: number;
  readonly hurt: boolean;
  readonly unconscious: boolean;
}

export function conditionOf(a: Abilities, c: ConditionRecord): Condition {
  const max = maxHitPoints(a);
  return { ...c, maxHitPoints: max, hurt: c.hitPoints * 2 <= max, unconscious: c.hitPoints === 0 };
}

/** A complete, checked condition: full health and no effects unless given. Throws RangeError for anything out of range. */
export function conditionRecord(a: Abilities, given: Partial<ConditionRecord> = {}): ConditionRecord {
  const max = maxHitPoints(a);
  const hp = given.hitPoints ?? max;
  if (!Number.isInteger(hp) || hp < 0 || hp > max) throw new RangeError(`hit points run from 0 to ${max}, got ${hp}`);
  for (const e of given.effects ?? []) if (!STORED_EFFECTS.includes(e)) throw new RangeError(`unknown effect ${String(e)}`);
  const rest = given.rest;
  if (rest && !(Number.isInteger(rest.from) && Number.isInteger(rest.until) && 0 <= rest.from && rest.from < rest.until))
    throw new RangeError(`a rest runs from one whole minute to a later one, got ${JSON.stringify(rest)}`);
  return { hitPoints: hp, effects: STORED_EFFECTS.filter((e) => given.effects?.includes(e)), ...(rest && { rest: { from: rest.from, until: rest.until } }) };
}

/** Where an effect applies: to skills using one of `attributes`, and to the skills in `skills`. */
interface EffectRule {
  readonly effect: Effect;
  readonly attributes?: readonly Attribute[];
  readonly skills?: readonly Skill[];
  readonly value: number;
}

/** What each effect does to rolls. An effect gives a skill at most one modifier; different effects add together. */
export const EFFECT_RULES: readonly EffectRule[] = [
  { effect: 'hurt', attributes: ['str', 'agi', 'con'], value: -2 },
  { effect: 'shaken', skills: ['nerve'], value: -2 },
  { effect: 'drunk', attributes: ['agi', 'int'], skills: ['insight', 'notice'], value: -2 },
  { effect: 'drunk', skills: ['nerve'], value: 2 },
];

export interface EffectOptions {
  /** Hurt never applies during a fight: the nerve check at half health already marks that moment. */
  readonly inFight?: boolean;
}

/** The effects' modifiers on a skill roll made with `attribute`, in EFFECT_RULES order. */
export function effectModifiers(c: Condition, skill: Skill, attribute: Attribute, options: EffectOptions = {}): Modifier[] {
  return effectParts(c, skill, attribute, options).map((p) => p.modifier);
}

/** The same, each with the effect it comes from, for anything that needs to know which are visible (only hurt is). */
export function effectParts(c: Condition, skill: Skill, attribute: Attribute, options: EffectOptions = {}): { readonly effect: Effect; readonly modifier: Modifier }[] {
  const active = (e: Effect) => (e === 'hurt' ? c.hurt && !options.inFight : c.effects.includes(e));
  return EFFECT_RULES.filter((r) => active(r.effect) && (r.attributes?.includes(attribute) || r.skills?.includes(skill))).map((r) => ({
    effect: r.effect,
    modifier: { value: r.value, reason: EFFECT_INFO[r.effect].name },
  }));
}
