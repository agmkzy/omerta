// Changes to a cast's record, as pure functions from one record to the next. The cast (cast.ts) makes each change through
// these and checks the result; nothing outside the overhaul's own modules can apply them, so every change still goes through
// the cast's rules. One action, such as a social roll, can make several of them and become one change of the cast.
import type { CastRecord } from './cast';
import { createCharacter, type CharacterInput, type CharacterRecord, type Id } from './character';
import { factId, type Fact, type FactInput } from './facts';
import { withFactConduct } from './conduct';
import { firstVersions, type Version } from './knowledge';
import { guessActor, learnFact, meetPeople, meetings } from './learning';

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
  /** Others it is made public to, as the game's broadcast: they hear it, knowing who did it unless the actor is hidden. */
  readonly public?: readonly Id[];
}

/**
 * The record with a fact added at `now`, an id from the counter, its learners' versions and feelings, its meetings, and the
 * conduct it is for whoever did it and whoever it was done to.
 */
export function recordFact(data: CastRecord, input: FactInput, options: RecordOptions): { readonly data: CastRecord; readonly fact: Fact } {
  const { now, witnesses = [] } = options;
  const fact: Fact = { ...input, id: factId(data.nextId), at: now, witnesses: [...witnesses] };
  const heard: Version = { learnedAt: now, source: 'public', how: 'heard', knowsActor: !fact.hiddenActor };
  const learners = new Map([...(options.learners ?? firstVersions(fact)), ...(options.public ?? []).map((id) => [id, heard] as const)]);
  const meets = options.meets ?? meetings(fact);
  const characters = data.characters.map((c) => {
    // (conduct comes last, so learning reads the traits the character had before it happened)
    const v = guessing(c, learners.get(c.id));
    const met = meetPeople(c, meets.get(c.id) ?? [], now);
    const after = withFactConduct(v ? learnFact(met, fact, v, now) : met, fact);
    return after === c ? c : createCharacter(after);
  });
  return { data: { ...data, facts: [...data.facts, fact], nextId: data.nextId + 1, characters }, fact };

  /** The victim of a hidden actor guesses who did it, and believes it as a guess. */
  function guessing(c: CharacterRecord, v: Version | undefined): Version | undefined {
    const guess = v && guessActor(c, fact, data.facts);
    return guess === undefined ? v : { ...v!, blame: guess, who: { how: 'guessed' } };
  }
}

/** Everyone in `people` meeting everyone else in it. */
export function allMeet(people: readonly Id[]): ReadonlyMap<Id, readonly Id[]> {
  return new Map(people.map((a) => [a, people.filter((b) => b !== a)]));
}
