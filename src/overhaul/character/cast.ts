// The cast: one plain record of every character, with handles that give the fluent interface over it. A cast is never
// changed in place. A change returns a new cast that shares every unchanged character record with the old one, and the old
// cast is marked replaced: it can still be read, but a change from it, or from a handle that came from it, is refused, so one
// change can never silently undo another. See docs/overhaul/plans/character/README.md (Shape).
import type { Attribute } from './attributes';
import { bonusOf, passes, resolveCheck, type CheckResult, type Modifier } from './check';
import { createCharacter, type CharacterInput, type CharacterRecord, type Id } from './character';
import { conditionOf, effectModifiers, type Condition, type StoredEffect } from './condition';
import { DICE } from './dice';
import { auditFacts, factId, type Fact, type FactId, type FactInput } from './facts';
import { DRINK_DC, ITEM_INFO, itemModifiers, type InventoryRecord, type Item, type ItemOptions, type ItemState } from './items';
import { auditKnowledge, firstVersions, toldVersion, type Knowledge, type Version } from './knowledge';
import { learnFact, meetPeople, meetings } from './learning';
import type { Roller } from './random';
import type { Relationship, Relationships } from './relationships';
import { SKILLS, attributeUsed, skillModifiers, type Proficiency, type Skill } from './skills';
import type { Temperament } from './temperament';
import { HOUR, assertTime } from './time';
import { WORLD, auditCash, type Party, type Transfer } from './transfers';
import { seen, type Seen } from './view';

/** Increment when the saved shape changes, and add a migration in save.ts. */
export const CAST_FORMAT = 5;

export interface CastRecord {
  readonly format: number;
  readonly characters: readonly CharacterRecord[];
  /** Every cash transfer, in time order. */
  readonly transfers: readonly Transfer[];
  /** Every fact, in time order. */
  readonly facts: readonly Fact[];
  /** The next number for an id made by the cast, such as a fact's. */
  readonly nextId: number;
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
  /**
   * A new cast with the cash moved and the transfer recorded. Throws RangeError for an amount the payer does not have, a
   * party not in the cast, or a time before the last transfer.
   */
  transfer(t: { readonly from: Party; readonly to: Party; readonly amount: number; readonly why: string; readonly now: number }): Cast;
  readonly facts: readonly Fact[];
  /** Throws RangeError for an id not recorded. */
  fact(id: FactId): Fact;
  /**
   * Records a fact at `now`. Everyone it names meets, and whoever did it, whoever it was done to and the witnesses learn it,
   * their feelings changing by the learning tables. Throws RangeError for a fact that names someone not in the cast, or a
   * time before the last fact.
   */
  record(fact: Omit<FactInput, 'invented'>, when: { readonly now: number; readonly witnesses?: readonly Id[] }): { readonly fact: Fact; readonly cast: Cast };
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
  readonly inventory: InventoryRecord;
  readonly cash: number;
  /** Their own version of each fact they know about. */
  readonly knowledge: Knowledge;
  /** Their version of a fact, or undefined if they do not know it. */
  versionOf(fact: FactId): Version | undefined;
  readonly relationships: Relationships;
  /** How they feel about another character, or undefined if they are strangers. */
  towards(other: Character): Relationship | undefined;
  /** A skill as it stands in a situation and with the items used for the check, such as Larceny for locks using lockpicks. */
  skill(skill: Skill, options?: ItemOptions): SkillStatus;
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
  /** A new cast in which the character has paid `amount` to another character in the cast, or to the world. */
  pay(to: Character | typeof WORLD, amount: number, record: { readonly why: string; readonly now: number }): Cast;
  /** Shows a carried weapon, which anyone present can then see. */
  show(item: Item): Cast;
  /** Puts a shown weapon away. */
  hide(item: Item): Cast;
  wear(item: Item): Cast;
  takeOff(item: Item): Cast;
  /**
   * A new cast in which the character has told the listener what they believe of a fact, at `now`, and the listener's
   * feelings have changed by the learning tables. A listener who already knows it keeps their own version. Throws RangeError
   * for a fact the character does not know, or one they know is false (telling it would be a lie).
   */
  tell(listener: Character, fact: FactId, when: { readonly now: number }): Cast;
  /** Drinks a bottle of spirits, which is used up: a Carousing check against DRINK_DC, and on a failure the character is drunk. */
  drink(roller: Roller): { readonly result: CheckResult; readonly drunk: boolean; readonly cast: Cast };
}

/** Thrown for a change made from a cast that has already been replaced by a change. */
export class ReplacedCastError extends Error {}

/** A cast of the given characters. Throws as createCharacter does, and RangeError for an id given twice. */
export function cast(given: { readonly characters?: readonly CharacterInput[] } = {}): Cast {
  return castOf({ format: CAST_FORMAT, characters: (given.characters ?? []).map(createCharacter), transfers: [], facts: [], nextId: 1 });
}

/**
 * A cast over a complete record of checked characters (from cast() or a save). Throws RangeError for an id used twice, for
 * cash that does not agree with the transfers (auditCash), for facts that are not valid (auditFacts), and for knowledge that
 * does not fit them (auditKnowledge).
 */
export function castOf(data: CastRecord): Cast {
  const records = new Map<Id, CharacterRecord>();
  for (const c of data.characters) {
    if (records.has(c.id)) throw new RangeError(`two characters have the id ${c.id}`);
    records.set(c.id, c);
  }
  auditCash(data.characters, data.transfers);
  auditFacts(data.facts, new Set(records.keys()), data.nextId);
  auditKnowledge(data.characters, data.facts);
  for (const c of data.characters)
    for (const id of Object.keys(c.relationships)) if (!records.has(id)) throw new RangeError(`${c.id} has a relationship with ${id}, who is not in the cast`);
  const facts = new Map(data.facts.map((f) => [f.id, f]));
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
    transfer: ({ from, to, amount, why, now }) =>
      change(() => {
        const has = records.get(from)?.inventory.cash;
        if (has !== undefined && has < amount) throw new RangeError(`${from} has ${has} in cash, so cannot pay ${amount}`);
        const moved = (c: CharacterRecord) => (c.id === from ? -amount : c.id === to ? amount : 0);
        return {
          ...data,
          characters: data.characters.map((c) => (moved(c) ? createCharacter({ ...c, inventory: { ...c.inventory, cash: c.inventory.cash + moved(c) } }) : c)),
          transfers: [...data.transfers, { from, to, amount, why, at: now }],
        };
      }),
    facts: data.facts,
    fact(id) {
      const f = facts.get(id);
      if (f === undefined) throw new RangeError(`no fact has the id ${id}`);
      return f;
    },
    record(input, { now, witnesses = [] }) {
      const made: Fact = { ...input, id: factId(data.nextId), at: now, witnesses: [...witnesses] };
      const learners = new Map(firstVersions(made));
      const meets = meetings(made);
      const next = change(() => ({
        ...data,
        facts: [...data.facts, made],
        nextId: data.nextId + 1,
        characters: data.characters.map((c) => {
          // (everyone who learns a fact as it is recorded is named in it, so meets the others it names)
          const v = learners.get(c.id);
          return v ? createCharacter(learnFact(meetPeople(c, meets.get(c.id)!, now), made, v, now)) : c;
        }),
      }));
      return { fact: made, cast: next };
    },
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
  const withItems = (next: (items: InventoryRecord['items']) => InventoryRecord['items']) =>
    update(data.id, (c) => ({ ...c, inventory: { ...c.inventory, items: next(c.inventory.items) } }));
  /** Moves one held item from one state to another. */
  const move = (item: Item, from: ItemState, to: ItemState) =>
    withItems((items) => {
      const i = items.findIndex((h) => h.item === item && h.state === from);
      if (i < 0) throw new RangeError(`${data.name} has no ${from} ${ITEM_INFO[item].name.toLowerCase()}`);
      return items.map((h, j) => (j === i ? { item, state: to } : h));
    });
  const status = (skill: Skill, options: ItemOptions = {}): SkillStatus => skillStatus(data, condition, skill, options);
  return {
    id: data.id,
    name: data.name,
    data,
    cast: owner,
    get skills() {
      return (skills ??= Object.fromEntries(SKILLS.map((s) => [s, status(s)])) as Character['skills']);
    },
    skill: status,
    get temperament() {
      return data.startingTemperament;
    },
    condition,
    canAct: !condition.unconscious,
    inventory: data.inventory,
    cash: data.inventory.cash,
    knowledge: data.knowledge,
    versionOf: (fact) => data.knowledge[fact],
    relationships: data.relationships,
    towards(other) {
      if (other.cast !== owner) throw new RangeError(`${other.name} is from another cast`);
      return data.relationships[other.id];
    },
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
    pay(to, amount, { why, now }) {
      if (to !== WORLD && to.cast !== owner) throw new RangeError(`${to.name} is from another cast`);
      return owner.transfer({ from: data.id, to: to === WORLD ? WORLD : to.id, amount, why, now });
    },
    show: (item) => move(item, 'carried', 'shown'),
    hide: (item) => move(item, 'shown', 'carried'),
    wear: (item) => move(item, 'carried', 'worn'),
    takeOff: (item) => move(item, 'worn', 'carried'),
    tell(listener, fact, { now }) {
      if (listener.cast !== owner) throw new RangeError(`${listener.name} is from another cast`);
      if (listener.id === data.id) throw new RangeError(`${data.name} cannot tell themselves`);
      const theirs = data.knowledge[fact];
      if (theirs === undefined) throw new RangeError(`${data.name} does not know ${fact}`);
      if (theirs.knownFalse) throw new RangeError(`${data.name} knows ${fact} is false, so telling it would be a lie`);
      assertTime(now);
      if (now < theirs.learnedAt) throw new RangeError(`${data.name} cannot tell ${fact} at ${now}, before learning it at ${theirs.learnedAt}`);
      return update(listener.id, (c) => (c.knowledge[fact] ? c : learnFact(c, owner.fact(fact), toldVersion(data.id, theirs, now), now)));
    },
    drink(roller) {
      if (condition.unconscious) throw new RangeError(`${data.name} is unconscious`);
      if (!data.inventory.items.some((h) => h.item === 'bottle')) throw new RangeError(`${data.name} has no bottle of spirits`);
      const result = resolveCheck({ dice: DICE.d20, edge: 'none', modifiers: status('carousing').modifiers, dc: DRINK_DC }, roller);
      const drunk = !passes(result.margin) || condition.effects.includes('drunk');
      const next = update(data.id, (c) => {
        const i = c.inventory.items.findIndex((h) => h.item === 'bottle');
        return {
          ...c,
          condition: { ...c.condition, effects: drunk ? [...c.condition.effects, 'drunk'] : c.condition.effects },
          inventory: { ...c.inventory, items: c.inventory.items.filter((_, j) => j !== i) },
        };
      });
      return { result, drunk, cast: next };
    },
  };
}

function skillStatus(c: CharacterRecord, condition: Condition, skill: Skill, options: ItemOptions): SkillStatus {
  const attribute = attributeUsed(c, skill);
  const modifiers = [...skillModifiers(c, skill), ...effectModifiers(condition, skill, attribute), ...itemModifiers(c.inventory, skill, options)];
  return { training: c.training[skill] ?? 'untrained', attribute, bonus: bonusOf(modifiers), modifiers };
}
