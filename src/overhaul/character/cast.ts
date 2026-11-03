// The cast: one plain record of every character, with handles that give the fluent interface over it. A cast is never
// changed in place. A change returns a new cast that shares every unchanged character record with the old one, and the old
// cast is marked replaced: it can still be read, but a change from it, or from a handle that came from it, is refused, so one
// change can never silently undo another. See docs/overhaul/plans/character/README.md (Shape).
import type { Attribute } from './attributes';
import { bonusOf, type Modifier } from './check';
import { createCharacter, type CharacterInput, type CharacterRecord, type Id } from './character';
import { SKILLS, attributeUsed, skillModifiers, type Proficiency, type Skill } from './skills';
import type { Temperament } from './temperament';
import { seen, type Seen } from './view';

/** Increment when the saved shape changes, and add a migration in save.ts. */
export const CAST_FORMAT = 1;

export interface CastRecord {
  readonly format: number;
  readonly characters: readonly CharacterRecord[];
}

export interface Cast {
  /** The plain record, ready to save. */
  readonly data: CastRecord;
  /** False once a change has been made from this cast. */
  readonly current: boolean;
  readonly characters: readonly Character[];
  has(id: Id): boolean;
  /** Throws RangeError for an id not in the cast. */
  character(id: Id): Character;
  /** A new cast with the character added. Throws RangeError for an id already in the cast. */
  add(input: CharacterInput): Cast;
}

/** A skill as it stands for a character: their training, the attribute used and the bonus, with every part of it. */
export interface SkillStatus {
  readonly training: Proficiency;
  readonly attribute: Attribute;
  readonly bonus: number;
  readonly modifiers: readonly Modifier[];
}

export interface Character {
  readonly id: Id;
  readonly name: string;
  /** The plain record. */
  readonly data: CharacterRecord;
  /** The cast this handle came from. */
  readonly cast: Cast;
  readonly skills: { readonly [S in Skill]: SkillStatus };
  /** The character's current traits. */
  readonly temperament: Temperament;
  /** What the viewer, a character in the same cast, can see of this character. */
  seenBy(viewer: Character): Seen;
}

/** Thrown for a change made from a cast that has already been replaced by a change. */
export class ReplacedCastError extends Error {}

/** A cast of the given characters. Throws as createCharacter does, and RangeError for an id given twice. */
export function cast(given: { readonly characters?: readonly CharacterInput[] } = {}): Cast {
  return castOf({ format: CAST_FORMAT, characters: (given.characters ?? []).map(createCharacter) });
}

/** A cast over a complete, checked record (from cast() or a save). Throws RangeError for an id used twice. */
export function castOf(data: CastRecord): Cast {
  const records = new Map<Id, CharacterRecord>();
  for (const c of data.characters) {
    if (records.has(c.id)) throw new RangeError(`two characters have the id ${c.id}`);
    records.set(c.id, c);
  }
  const handles = new Map<Id, Character>();
  let current = true;

  /** Makes a change: refused if this cast is replaced; otherwise this cast is replaced by the one the change returns. */
  const change = (next: () => CastRecord): Cast => {
    if (!current) throw new ReplacedCastError('this cast has been replaced by a change; make changes from the newest cast');
    const replacement = castOf(next());
    current = false;
    return replacement;
  };

  const self: Cast = {
    data,
    get current() {
      return current;
    },
    get characters() {
      return data.characters.map((c) => self.character(c.id));
    },
    has: (id) => records.has(id),
    character(id) {
      const record = records.get(id);
      if (record === undefined) throw new RangeError(`no character has the id ${id}`);
      let handle = handles.get(id);
      if (handle === undefined) handles.set(id, (handle = characterHandle(record, self)));
      return handle;
    },
    add: (input) => change(() => ({ ...data, characters: [...data.characters, createCharacter(input)] })),
  };
  return self;
}

function characterHandle(data: CharacterRecord, owner: Cast): Character {
  let skills: Character['skills'] | undefined;
  return {
    id: data.id,
    name: data.name,
    data,
    cast: owner,
    get skills() {
      return (skills ??= Object.fromEntries(SKILLS.map((s) => [s, skillStatus(data, s)])) as Character['skills']);
    },
    get temperament() {
      return data.startingTemperament;
    },
    seenBy(viewer) {
      if (viewer.cast !== owner) throw new RangeError(`${viewer.name} is from another cast`);
      return seen(data);
    },
  };
}

function skillStatus(c: CharacterRecord, skill: Skill): SkillStatus {
  const modifiers = skillModifiers(c, skill);
  return { training: c.training[skill] ?? 'untrained', attribute: attributeUsed(c, skill), bonus: bonusOf(modifiers), modifiers };
}
