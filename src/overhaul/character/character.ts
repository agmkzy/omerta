// A character's own record: plain, serialisable data, the same for the player and every NPC. Handles (cast.ts) give the
// fluent interface over it; this module only builds and checks the record.
import type { AttributeScores } from './attributes';
import type { BackgroundName } from './backgrounds';
import { conditionRecord, type ConditionRecord } from './condition';
import { abilities, type Abilities, type Training } from './skills';
import { temperament, type Temperament } from './temperament';

/** A character's id, unique within a cast. */
export type Id = string;

export interface CharacterRecord extends Abilities {
  readonly id: Id;
  readonly name: string;
  readonly background?: BackgroundName;
  /** The traits the character started with. Their current traits are worked out from these and their conduct. */
  readonly startingTemperament: Temperament;
  readonly condition: ConditionRecord;
}

export interface CharacterInput {
  readonly id: Id;
  readonly name: string;
  readonly background?: BackgroundName;
  readonly attributes?: AttributeScores;
  readonly training?: Training;
  readonly proficiencyBonus?: number;
  readonly startingTemperament?: Partial<Temperament>;
  readonly condition?: Partial<ConditionRecord>;
}

/**
 * A complete record: average attributes and temperament, no training, a proficiency bonus of 2, full health and no effects
 * unless given. Throws TypeError for an id that is not a non-empty string, and RangeError for anything out of range.
 */
export function createCharacter(input: CharacterInput): CharacterRecord {
  if (typeof input.id !== 'string' || input.id === '') throw new TypeError('a character needs an id');
  const able = abilities({
    ...(input.attributes && { attributes: input.attributes }),
    ...(input.training && { training: input.training }),
    ...(input.proficiencyBonus !== undefined && { proficiencyBonus: input.proficiencyBonus }),
  });
  return {
    id: input.id,
    name: input.name,
    ...(input.background && { background: input.background }),
    ...able,
    startingTemperament: temperament(input.startingTemperament ?? {}),
    condition: conditionRecord(able, input.condition),
  };
}
