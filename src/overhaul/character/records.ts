// Changes to a cast's record, as pure functions from one record to the next. The cast (cast.ts) makes each change through
// these and checks the result; nothing outside the overhaul's own modules can apply them, so every change still goes through
// the cast's rules. One action, such as a social roll, can make several of them and become one change of the cast.
import type { CastRecord } from './cast';
import { createCharacter, type CharacterInput, type CharacterRecord, type Id } from './character';
import { factId, type Fact, type FactInput } from './facts';
import { firstVersions, type Version } from './knowledge';
import { learnFact, meetPeople, meetings } from './learning';

/** The record with one character changed; the new character record is checked as any other. */
export function withCharacter(data: CastRecord, id: Id, next: (c: CharacterRecord) => CharacterInput): CastRecord {
  return { ...data, characters: data.characters.map((c) => (c.id === id ? createCharacter(next(c)) : c)) };
}

export interface RecordOptions {
  readonly now: number;
  readonly witnesses?: readonly Id[];
  /** Who learns it, with their version. By default whoever did it, whoever it was done to and the witnesses (firstVersions). */
  readonly learners?: ReadonlyMap<Id, Version>;
  /** Who meets whom over it. By default everyone it names meets everyone else it names (meetings). */
  readonly meets?: ReadonlyMap<Id, readonly Id[]>;
}

/** The record with a fact added at `now`, an id from the counter, its learners' versions and feelings, and its meetings. */
export function recordFact(data: CastRecord, input: FactInput, options: RecordOptions): { readonly data: CastRecord; readonly fact: Fact } {
  const { now, witnesses = [] } = options;
  const fact: Fact = { ...input, id: factId(data.nextId), at: now, witnesses: [...witnesses] };
  const learners = options.learners ?? new Map(firstVersions(fact));
  const meets = options.meets ?? meetings(fact);
  const characters = data.characters.map((c) => {
    const v = learners.get(c.id);
    const met = meetPeople(c, meets.get(c.id) ?? [], now);
    return v ? createCharacter(learnFact(met, fact, v, now)) : met === c ? c : createCharacter(met);
  });
  return { data: { ...data, facts: [...data.facts, fact], nextId: data.nextId + 1, characters }, fact };
}

/** Everyone in `people` meeting everyone else in it. */
export function allMeet(people: readonly Id[]): ReadonlyMap<Id, readonly Id[]> {
  return new Map(people.map((a) => [a, people.filter((b) => b !== a)]));
}
