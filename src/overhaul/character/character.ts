// A character's own record: plain, serialisable data, the same for the player and every NPC. Handles (cast.ts) give the
// fluent interface over it; this module only builds and checks the record.
import type { AttributeScores } from './attributes';
import type { BackgroundName } from './backgrounds';
import { conditionRecord, type ConditionRecord } from './condition';
import { inventoryRecord, type HeldItem, type InventoryRecord, type Item } from './items';
import type { Knowledge } from './knowledge';
import { assertRelationship, type Relationships } from './relationships';
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
  readonly inventory: InventoryRecord;
  /** Their own version of each fact they know about, by fact id. */
  readonly knowledge: Knowledge;
  /** How they feel about each character they have met or learned about, by id. */
  readonly relationships: Relationships;
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
  /** Cash must agree with the cast's transfers, so a new character's cash comes from a transfer, not from here. */
  readonly inventory?: { readonly cash?: number; readonly items?: readonly (Item | HeldItem)[] };
  /** Must agree with the cast's facts, so it comes from recording and telling facts, not from here. */
  readonly knowledge?: Knowledge;
  readonly relationships?: Relationships;
}

/**
 * A complete record: average attributes and temperament, no training, a proficiency bonus of 2, full health, no effects,
 * nothing held, nothing known and no relationships unless given. Throws TypeError for an id that is not a non-empty string, and RangeError for anything out of range.
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
    inventory: inventoryRecord(input.inventory),
    knowledge: { ...input.knowledge },
    relationships: Object.fromEntries(
      Object.entries(input.relationships ?? {}).map(([id, r]) => {
        if (id === input.id) throw new RangeError(`${input.id} cannot have a relationship with themselves`);
        assertRelationship(r, `${input.id}'s relationship with ${id}`);
        return [id, r];
      }),
    ),
  };
}
