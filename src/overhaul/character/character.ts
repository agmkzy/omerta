// A character's own record: plain, serialisable data, the same for the player and every NPC. Handles (cast.ts) give the
// fluent interface over it; this module only builds and checks the record.
import type { BackgroundName } from './backgrounds';
import { abilities, type Abilities, type Training } from './skills';
import { temperament, type Temperament } from './temperament';
import type { AttributeScores } from './attributes';

/** A character's id, unique within a cast. */
export type Id = string;

export interface CharacterRecord extends Abilities {
  readonly id: Id;
  readonly name: string;
  readonly background?: BackgroundName;
  /** The traits the character started with. Their current traits are worked out from these and their conduct. */
  readonly startingTemperament: Temperament;
}

export interface CharacterInput {
  readonly id: Id;
  readonly name: string;
  readonly background?: BackgroundName;
  readonly attributes?: AttributeScores;
  readonly training?: Training;
  readonly proficiencyBonus?: number;
  readonly startingTemperament?: Partial<Temperament>;
}

/**
 * A complete record: average attributes and temperament, no training and a proficiency bonus of 2 unless given. Throws
 * TypeError for an id that is not a non-empty string, and RangeError for anything out of range.
 */
export function createCharacter(input: CharacterInput): CharacterRecord {
  if (typeof input.id !== 'string' || input.id === '') throw new TypeError('a character needs an id');
  return {
    id: input.id,
    name: input.name,
    ...(input.background && { background: input.background }),
    ...abilities({
      ...(input.attributes && { attributes: input.attributes }),
      ...(input.training && { training: input.training }),
      ...(input.proficiencyBonus !== undefined && { proficiencyBonus: input.proficiencyBonus }),
    }),
    startingTemperament: temperament(input.startingTemperament ?? {}),
  };
}
