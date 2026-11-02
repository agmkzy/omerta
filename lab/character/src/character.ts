// Characters (player and NPC): attributes, skill training, proficiency bonus and temperament.
import { ATTRIBUTE_INFO, abilityModifier, attributeScores, type Attribute, type AttributeScores } from './attributes';
import type { BackgroundName } from './backgrounds';
import { combineEdges, totalOf, type Modifier, type Roll, type Total } from './check';
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
  /** Added once to trained skills and EXPERT_MULTIPLE times to expert skills. Ranges from 2 to 6, as in D&D. */
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
  const training = trainingModifier(c, skill);
  return training ? [...modifiers, training] : modifiers;
}

/** An expert adds the proficiency bonus this many times. */
export const EXPERT_MULTIPLE = 2;

/** What training in a skill adds: the proficiency bonus if trained, EXPERT_MULTIPLE times it if expert; null if untrained. */
export function trainingModifier(c: Character, skill: Skill): Modifier | null {
  const name = SKILL_INFO[skill].name;
  switch (c.training[skill] ?? 'untrained') {
    case 'trained':
      return { value: c.proficiencyBonus, reason: `Trained in ${name}` };
    case 'expert':
      return { value: EXPERT_MULTIPLE * c.proficiencyBonus, reason: `Expert at ${name}` };
    case 'untrained':
      return null;
  }
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

/** What a character's maximum hit points are made of: the base, then the Constitution modifier and Toughness training. */
export function hitPoints(c: Character): Total {
  const score = c.attributes.con;
  const toughness = trainingModifier(c, 'toughness');
  return { base: BASE_HIT_POINTS, modifiers: [{ value: abilityModifier(score), reason: `${ATTRIBUTE_INFO.con.name} ${score}` }, ...(toughness ? [toughness] : [])] };
}

/** Maximum hit points. The lowest possible is 5 (Constitution 1, untrained). */
export function maxHitPoints(c: Character): number {
  return totalOf(hitPoints(c));
}

/** Defence before Reflexes, as for D&D's unarmoured Armour Class. */
export const BASE_DEFENCE = 10;

/** What a character's Defence is made of: the base, then their Reflexes bonus. */
export function defenceOf(c: Character): Total {
  return { base: BASE_DEFENCE, modifiers: skillModifiers(c, 'reflexes') };
}

/** The total an attack roll must meet to hit this character. */
export function defence(c: Character): number {
  return totalOf(defenceOf(c));
}
