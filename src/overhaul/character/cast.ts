// The cast: one plain record of every character, with handles that give the fluent interface over it. A cast is never
// changed in place. A change returns a new cast that shares every unchanged character record with the old one, and the old
// cast is marked replaced: it can still be read, but a change from it, or from a handle that came from it, is refused, so one
// change can never silently undo another. See docs/overhaul/plans/character/README.md (Shape).
import type { Attribute } from './attributes';
import { bonusOf, type Modifier } from './check';
import { createCharacter, type CharacterInput, type CharacterRecord, type Id } from './character';
import { conditionOf, effectModifiers, type Condition, type StoredEffect } from './condition';
import { SKILLS, attributeUsed, skillModifiers, type Proficiency, type Skill } from './skills';
import type { Temperament } from './temperament';
import { HOUR, assertTime } from './time';
import { seen, type Seen } from './view';

/** Increment when the saved shape changes, and add a migration in save.ts. */
export const CAST_FORMAT = 2;

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
  readonly condition: Condition;
  /** False while unconscious: no check can be made by them. */
  readonly canAct: boolean;
  /** Whether the character is resting at `now`. */
  restingAt(now: number): boolean;
  /** What the viewer, a character in the same cast, can see of this character. */
  seenBy(viewer: Character): Seen;
  /** A new cast in which the character has lost `amount` hit points (a whole number from 1), down to 0. */
  damage(amount: number): Cast;
  /** A new cast in which the character has the effect. An effect does not stack with itself. */
  affect(effect: StoredEffect): Cast;
  /** A new cast in which the character no longer has the effect. */
  clear(effect: StoredEffect): Cast;
  /**
   * A new cast in which the character rests from `now` for `hours`, a whole number of minutes: they are back to full hit
   * points, no longer shaken or drunk, and recorded as resting for that time.
   */
  rest(when: { readonly now: number; readonly hours: number }): Cast;
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
      if (handle === undefined) handles.set(id, (handle = characterHandle(record, self, update)));
      return handle;
    },
    add: (input) => change(() => ({ ...data, characters: [...data.characters, createCharacter(input)] })),
  };

  /** A change to one character, whose new record is checked as any other. */
  function update(id: Id, next: (c: CharacterRecord) => CharacterInput): Cast {
    return change(() => ({ ...data, characters: data.characters.map((c) => (c.id === id ? createCharacter(next(c)) : c)) }));
  }
  return self;
}

type Update = (id: Id, next: (c: CharacterRecord) => CharacterInput) => Cast;

function characterHandle(data: CharacterRecord, owner: Cast, update: Update): Character {
  const condition = conditionOf(data, data.condition);
  let skills: Character['skills'] | undefined;
  const withCondition = (next: (c: CharacterRecord['condition']) => CharacterRecord['condition']) =>
    update(data.id, (c) => ({ ...c, condition: next(c.condition) }));
  return {
    id: data.id,
    name: data.name,
    data,
    cast: owner,
    get skills() {
      return (skills ??= Object.fromEntries(SKILLS.map((s) => [s, skillStatus(data, condition, s)])) as Character['skills']);
    },
    get temperament() {
      return data.startingTemperament;
    },
    condition,
    canAct: !condition.unconscious,
    restingAt(now) {
      assertTime(now);
      return data.condition.rest !== undefined && data.condition.rest.from <= now && now < data.condition.rest.until;
    },
    seenBy(viewer) {
      if (viewer.cast !== owner) throw new RangeError(`${viewer.name} is from another cast`);
      return seen(data);
    },
    damage(amount) {
      if (!Number.isInteger(amount) || amount < 1) throw new RangeError(`damage is a whole number from 1, got ${amount}`);
      return withCondition((c) => ({ ...c, hitPoints: Math.max(0, c.hitPoints - amount) }));
    },
    affect: (effect) => withCondition((c) => ({ ...c, effects: [...c.effects, effect] })),
    clear: (effect) => withCondition((c) => ({ ...c, effects: c.effects.filter((e) => e !== effect) })),
    rest({ now, hours }) {
      assertTime(now);
      const minutes = hours * HOUR;
      if (!Number.isInteger(minutes) || minutes < 1) throw new RangeError(`a rest lasts a whole number of minutes from 1, got ${hours} hours`);
      return withCondition(() => ({ hitPoints: condition.maxHitPoints, effects: [], rest: { from: now, until: now + minutes } }));
    },
  };
}

function skillStatus(c: CharacterRecord, condition: Condition, skill: Skill): SkillStatus {
  const attribute = attributeUsed(c, skill);
  const modifiers = [...skillModifiers(c, skill), ...effectModifiers(condition, skill, attribute)];
  return { training: c.training[skill] ?? 'untrained', attribute, bonus: bonusOf(modifiers), modifiers };
}
