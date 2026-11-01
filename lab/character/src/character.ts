// Characters (player and NPC): attributes, skill training, proficiency bonus and temperament.
import { ATTRIBUTE_INFO, abilityModifier, attributeScores, type Attribute, type AttributeScores } from './attributes';
import type { BackgroundName } from './backgrounds';
import { bonusOf, combineEdges, type Modifier, type Roll } from './check';
import { DICE, type Dice, type Edge } from './dice';
import { SKILL_INFO, attributesFor, type Skill } from './skills';
import { temperament as fullTemperament, temperamentModifiers, type Situation, type Temperament } from './temperament';

export const PROFICIENCIES = ['untrained', 'trained', 'expert'] as const;
export type Proficiency = (typeof PROFICIENCIES)[number];
export type Training = Readonly<Partial<Record<Skill, Proficiency>>>;

export interface Character {
  readonly name: string;
  readonly background?: BackgroundName;
  readonly attributes: AttributeScores;
  readonly training: Training;
  /** Added once to trained skills and twice to expert skills. Ranges from 2 to 6, as in D&D. */
  readonly proficiencyBonus: number;
  readonly temperament: Temperament;
}

export interface CharacterInput {
  readonly name: string;
  readonly background?: BackgroundName;
  readonly attributes?: AttributeScores;
  readonly training?: Training;
  readonly proficiencyBonus?: number;
  readonly temperament?: Temperament;
}

export const PROFICIENCY_MIN = 2;
export const PROFICIENCY_MAX = 6;

export function createCharacter(input: CharacterInput): Character {
  const proficiencyBonus = input.proficiencyBonus ?? PROFICIENCY_MIN;
  if (!Number.isInteger(proficiencyBonus) || proficiencyBonus < PROFICIENCY_MIN || proficiencyBonus > PROFICIENCY_MAX)
    throw new RangeError(`the proficiency bonus runs from ${PROFICIENCY_MIN} to ${PROFICIENCY_MAX}, got ${proficiencyBonus}`);
  return {
    name: input.name,
    ...(input.background && { background: input.background }),
    attributes: attributeScores(input.attributes ?? {}),
    training: { ...input.training },
    proficiencyBonus,
    temperament: input.temperament ?? fullTemperament({}),
  };
}

/** The attribute a character uses for a skill: the highest of those allowed, preferring the primary one on a tie. */
export function attributeUsed(c: Character, skill: Skill): Attribute {
  return attributesFor(skill).reduce((best, a) => (c.attributes[a] > c.attributes[best] ? a : best));
}

/**
 * The modifiers a character adds to a skill roll: the attribute modifier and any proficiency bonus, each with a reason. Uses
 * `attributeUsed` unless a specific allowed attribute is given.
 */
export function skillModifiers(c: Character, skill: Skill, using?: Attribute): Modifier[] {
  if (using !== undefined && !attributesFor(skill).includes(using))
    throw new RangeError(`${SKILL_INFO[skill].name} cannot be done with ${ATTRIBUTE_INFO[using].name}`);
  const attribute = using ?? attributeUsed(c, skill);
  const score = c.attributes[attribute];
  const modifiers: Modifier[] = [{ value: abilityModifier(score), reason: `${ATTRIBUTE_INFO[attribute].name} ${score}` }];
  const proficiency = c.training[skill] ?? 'untrained';
  const name = SKILL_INFO[skill].name;
  if (proficiency === 'trained') modifiers.push({ value: c.proficiencyBonus, reason: `Trained in ${name}` });
  if (proficiency === 'expert') modifiers.push({ value: 2 * c.proficiencyBonus, reason: `Expert at ${name}` });
  return modifiers;
}

export interface RollOptions {
  /** Situations in which temperament modifiers apply. */
  readonly situations?: readonly Situation[];
  /** Situational modifiers. */
  readonly modifiers?: readonly Modifier[];
  readonly edges?: readonly Edge[];
  readonly dice?: Dice;
  readonly using?: Attribute;
}

/** Builds a skill roll: skill modifiers, then temperament modifiers for the situations, then situational modifiers. */
export function rollFor(c: Character, skill: Skill, options: RollOptions = {}): Roll {
  return {
    dice: options.dice ?? DICE.d20,
    edge: combineEdges(options.edges ?? []),
    modifiers: [...skillModifiers(c, skill, options.using), ...temperamentModifiers(c.temperament, options.situations ?? []), ...(options.modifiers ?? [])],
  };
}

/** Hit points before Constitution and Toughness, as for a D&D d10 hit die at first level. */
export const BASE_HIT_POINTS = 10;

/** What a character's maximum hit points are made of: the base, the Constitution modifier and Toughness training. */
export function hitPointModifiers(c: Character): Modifier[] {
  const score = c.attributes.con;
  const modifiers: Modifier[] = [
    { value: BASE_HIT_POINTS, reason: 'Base' },
    { value: abilityModifier(score), reason: `${ATTRIBUTE_INFO.con.name} ${score}` },
  ];
  const toughness = c.training.toughness;
  if (toughness === 'trained') modifiers.push({ value: c.proficiencyBonus, reason: 'Trained in Toughness' });
  if (toughness === 'expert') modifiers.push({ value: 2 * c.proficiencyBonus, reason: 'Expert at Toughness' });
  return modifiers;
}

/** Maximum hit points. The lowest possible is 5 (Constitution 1, untrained). */
export function maxHitPoints(c: Character): number {
  return bonusOf(hitPointModifiers(c));
}

/** Defence before Reflexes, as for D&D's unarmoured Armour Class. */
export const BASE_DEFENCE = 10;

/** What a character's Defence is made of: the base and their Reflexes bonus. */
export function defenceModifiers(c: Character): Modifier[] {
  return [{ value: BASE_DEFENCE, reason: 'Base' }, ...skillModifiers(c, 'reflexes')];
}

/** The total an attack roll must meet to hit this character. */
export function defence(c: Character): number {
  return bonusOf(defenceModifiers(c));
}
