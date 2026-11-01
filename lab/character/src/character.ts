// A character: attributes, training and the bonus training gives. Players and NPCs alike.
import { ATTRIBUTE_INFO, abilityModifier, attributeScores, type Attribute, type AttributeScores } from './attributes';
import type { BackgroundName } from './backgrounds';
import { combineEdges, type Modifier, type Roll } from './check';
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
  /** Added to trained skills, twice to expert ones. D&D's runs from 2 to 6 as a character grows. */
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

/** The attribute a man brings to a skill: the best it allows, its own on a tie. */
export function attributeUsed(c: Character, skill: Skill): Attribute {
  return attributesFor(skill).reduce((best, a) => (c.attributes[a] > c.attributes[best] ? a : best));
}

/**
 * What a man adds to a roll of the skill: his attribute modifier and his training, each with its reason. Unless told which, he
 * uses the best of the attributes the skill allows.
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
  /** The moments his temperament may bear on. */
  readonly situations?: readonly Situation[];
  /** What the moment adds: a gun, a crowd, a debt. */
  readonly modifiers?: readonly Modifier[];
  readonly edges?: readonly Edge[];
  readonly dice?: Dice;
  readonly using?: Attribute;
}

/** A man's roll of a skill: his skill, then his temperament in the situation, then what the moment adds. */
export function rollFor(c: Character, skill: Skill, options: RollOptions = {}): Roll {
  return {
    dice: options.dice ?? DICE.d20,
    edge: combineEdges(options.edges ?? []),
    modifiers: [...skillModifiers(c, skill, options.using), ...temperamentModifiers(c.temperament, options.situations ?? []), ...(options.modifiers ?? [])],
  };
}
