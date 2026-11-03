// What learning a fact does to the learner's feelings, carried over from the game's learn (src/core.ts): respect for what
// someone has done, fear of someone violent (more for the less brave), and for the one it was done to, a grudge or fear by
// their courage, with less trust either way. A test reads the game's tables from its source, so the two cannot drift apart.
// See docs/overhaul/plans/character/README.md (Knowledge, Fact kinds).
import type { CharacterRecord, Id } from './character';
import { currentTemperament } from './conduct';
import type { Fact, FactId, FactKind } from './facts';
import type { Version } from './knowledge';
import { NEW_RELATIONSHIP, feel, meet, type Feeling, type Relationship } from './relationships';

/** What a deed does to the respect of those who hear of it: for whoever did it, and for whoever it was done to (src/core.ts DEED). */
export const DEED: Readonly<Partial<Record<FactKind, readonly [actor: number, victim: number]>>> = {
  protection_started: [1.5, 0],
  protection_refused: [0, -0.3],
  beating: [0.8, -1.5],
  vandalism: [0.3, -0.5],
  robbery: [0.3, -0.5],
  murder: [3, 0],
  attempt: [0.5, -1],
  poach: [1.5, -1.5],
  threat: [0.2, -0.3],
  discipline: [0.3, -2],
  shortfall: [-1, 0],
  debt_missed: [-0.5, 0],
  debt_default: [-4, 0],
  raid: [-1, 0],
  informant: [-20, 0],
  exposed: [-4, 2],
};

/** The share of a deed's weight that becomes respect in someone who hears of it (src/core.ts HEARD). */
export const HEARD = 0.01;

/** How much someone who hears of violence comes to fear whoever did it, before their courage (src/core.ts VIOLENT). */
export const VIOLENT: Readonly<Partial<Record<FactKind, number>>> = { beating: 0.04, vandalism: 0.02, robbery: 0.02, murder: 0.12, attempt: 0.06 };

/** How much whoever it was done to resents whoever did it (src/core.ts GRUDGE). */
export const GRUDGE: Readonly<Partial<Record<FactKind, number>>> = {
  beating: 0.5,
  vandalism: 0.5,
  murder: 0.8,
  robbery: 0.4,
  poach: 0.4,
  debt_missed: 0.15,
  debt_default: 0.4,
  protection_refused: 0.2,
};

/** Kinds the game does not have that are learned as one of its kinds: a fight someone fled from, as a beating. */
export const LEARNED_AS: Readonly<Partial<Record<FactKind, FactKind>>> = { fight: 'beating' };

/** One change to the learner's feelings about someone. */
export interface FeelingChange {
  readonly towards: Id;
  readonly feeling: Feeling;
  readonly amount: number;
  readonly why: FactId;
}

export interface Learner {
  readonly id: Id;
  readonly courage: number;
  /** Their affection for someone, or undefined for a stranger. */
  affectionFor(id: Id): number | undefined;
}

/**
 * The changes in feelings when the learner comes to believe `actor` did the fact: towards the one they believe did it, and
 * towards whoever it was done to. Nothing changes if they believe no one did it, or that they did it themselves.
 */
export function learningChanges(f: Fact, learner: Learner, actor: Id | undefined): FeelingChange[] {
  if (actor === undefined || actor === learner.id) return [];
  const kind = LEARNED_AS[f.kind] ?? f.kind;
  const change = (towards: Id, feeling: Feeling, amount: number): FeelingChange => ({ towards, feeling, amount, why: f.id });
  const out: FeelingChange[] = [];
  const deed = DEED[kind];
  const violent = VIOLENT[kind];
  const brave = learner.courage;
  if (deed && f.victim !== learner.id) {
    if (deed[0]) out.push(change(actor, 'respect', deed[0] * HEARD));
    if (deed[1] && f.victim !== undefined && f.victim !== actor) out.push(change(f.victim, 'respect', deed[1] * HEARD));
    if (violent) out.push(change(actor, 'fear', violent * (1 - brave)));
  }
  const grudge = GRUDGE[kind];
  if (!grudge) return out;
  if (f.victim === learner.id) {
    // done to them: a brave one answers it with a grudge, a timid one with fear, and either way they trust the one who did it less
    out.push(change(actor, 'grudge', violent !== undefined ? grudge * (0.4 + 0.6 * brave) : grudge));
    if (violent !== undefined) out.push(change(actor, 'fear', grudge * (1 - brave) * 0.8));
    out.push(change(actor, 'trust', -grudge * 0.5));
  } else if (f.victim !== undefined && (learner.affectionFor(f.victim) ?? 0) > 0.5) {
    out.push(change(actor, 'grudge', grudge * 0.3));
  }
  return out;
}

/** Whom a learner believes did a fact: whoever did it if they know, otherwise whom they blame. */
export const believedActor = (f: Fact, v: { readonly knowsActor: boolean; readonly blame?: Id }): Id | undefined => (v.knowsActor ? f.actor : v.blame);

/**
 * A character after learning a fact, at `now`: their version added, a relationship with whoever they believe did it and
 * whoever it was done to (learning about someone makes them no longer a stranger), and their feelings changed by the tables.
 */
export function learnFact(c: CharacterRecord, f: Fact, v: Version, now: number): CharacterRecord {
  const actor = believedActor(f, v);
  const learner: Learner = { id: c.id, courage: currentTemperament(c).courage, affectionFor: (id) => c.relationships[id]?.affection };
  const relationships: Record<Id, Relationship> = { ...c.relationships };
  for (const id of [actor, f.victim]) if (id !== undefined && id !== c.id) relationships[id] ??= NEW_RELATIONSHIP;
  for (const ch of learningChanges(f, learner, actor)) relationships[ch.towards] = feel(relationships[ch.towards]!, ch.feeling, ch.amount, { now, why: ch.why });
  return { ...c, knowledge: { ...c.knowledge, [f.id]: v }, relationships };
}

/** A character after meeting each of `others` at `now`. */
export function meetPeople(c: CharacterRecord, others: readonly Id[], now: number): CharacterRecord {
  if (others.length === 0) return c;
  const relationships: Record<Id, Relationship> = { ...c.relationships };
  for (const id of others) relationships[id] = meet(relationships[id] ?? NEW_RELATIONSHIP, now);
  return { ...c, relationships };
}

/**
 * Who meets whom when a fact is recorded: everyone it names meets everyone else it names, except that whoever it was done to
 * does not meet a hidden actor. Nobody meets anyone over an invented fact.
 */
export function meetings(f: Fact): ReadonlyMap<Id, readonly Id[]> {
  const named = f.invented ? [] : [f.actor, f.victim, ...f.witnesses].filter((id) => id !== undefined);
  const apart = (a: Id, b: Id) => f.hiddenActor === true && [a, b].includes(f.actor!) && [a, b].includes(f.victim!);
  return new Map(named.map((a) => [a, named.filter((b) => b !== a && !apart(a, b))]));
}
