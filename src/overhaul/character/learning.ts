// What learning a fact does to the learner's feelings, carried over from the game's learn (src/core.ts): respect for what
// someone has done, fear of someone violent (more for the less brave), and for the one it was done to, a grudge or fear by
// their courage, with less trust either way. A test reads the game's tables from its source, so the two cannot drift apart.
// See docs/overhaul/plans/character/README.md (Knowledge, Fact kinds).
import type { CharacterRecord, Id } from './character';
import { maxHitPoints } from './condition';
import { currentTemperament } from './conduct';
import type { Fact, FactId, FactKind } from './facts';
import type { Version } from './knowledge';
import { feel, firstRelationship, meet, type Feeling, type Relationship } from './relationships';
import { HIGH } from './temperament';

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
  /** Their maximum hit points, against which the share of them a beating took is measured. */
  readonly maxHitPoints: number;
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
    if (violent && isViolent(f)) out.push(change(actor, 'fear', violent * (1 - brave)));
  }
  const grudge = GRUDGE[kind];
  if (!grudge) return out;
  if (f.victim === learner.id) {
    // done to them: a brave one answers it with a grudge, a timid one with fear, and either way they trust the one who did it less
    const victim: FeelingChange[] = [change(actor, 'grudge', violent !== undefined ? grudge * (0.4 + 0.6 * brave) : grudge)];
    if (violent !== undefined) victim.push(change(actor, 'fear', grudge * (1 - brave) * 0.8));
    victim.push(change(actor, 'trust', -grudge * 0.5));
    out.push(...(f.amount !== undefined && kind === 'beating' ? scaledByDamage(victim, f, learner) : victim));
  } else if (f.victim !== undefined && (learner.affectionFor(f.victim) ?? 0) >= HIGH) {
    out.push(change(actor, 'grudge', grudge * 0.3));
  }
  return out;
}

/**
 * A fight's changes for whoever it was done to, scaled by the share of their hit points that attacker took (the fact's
 * amount). A beating's are never less than a successful intimidation's; a fled fight's have no minimum.
 */
export const BEATING_AT_LEAST: Readonly<Partial<Record<Feeling, number>>> = { fear: 0.1, grudge: 0.05, trust: -0.05 };

function scaledByDamage(changes: readonly FeelingChange[], f: Fact, learner: Learner): FeelingChange[] {
  const share = Math.min(1, f.amount! / learner.maxHitPoints);
  return changes.map((ch) => {
    const scaled = ch.amount * share;
    const least = f.kind === 'beating' ? BEATING_AT_LEAST[ch.feeling] : undefined;
    return { ...ch, amount: least === undefined ? scaled : least < 0 ? Math.min(scaled, least) : Math.max(scaled, least) };
  });
}

/** Whether a fact is violence by its actor: of a violent kind, and, for a beating or a fight, with a blow struck (its amount is the damage done). */
export function isViolent(f: Fact): boolean {
  const kind = LEARNED_AS[f.kind] ?? f.kind;
  return VIOLENT[kind] !== undefined && !(kind === 'beating' && f.amount === 0);
}

/** The least grudge that makes someone a suspect. */
export const SUSPECT_GRUDGE = 0.3;

/**
 * Whom the victim of a hidden actor guesses did it, with no randomness: among those they hold a grudge of at least
 * SUSPECT_GRUDGE against (and, for a violent kind, believe to have been violent before), the one they hold the biggest grudge
 * against. A tie, or no one, is no guess. Only a kind that changes how its victim feels (GRUDGE) is guessed at.
 */
export function guessActor(c: CharacterRecord, f: Fact, facts: readonly Fact[]): Id | undefined {
  const kind = LEARNED_AS[f.kind] ?? f.kind;
  if (!f.hiddenActor || f.victim !== c.id || !GRUDGE[kind]) return undefined;
  const violent = (id: Id) => facts.some((x) => x.id !== f.id && isViolent(x) && c.knowledge[x.id] !== undefined && believedActor(x, c.knowledge[x.id]!) === id);
  const suspects = Object.entries(c.relationships)
    .filter(([id, r]) => r.grudge >= SUSPECT_GRUDGE && id !== c.id && (VIOLENT[kind] === undefined || violent(id)))
    .sort(([, a], [, b]) => b.grudge - a.grudge);
  const [first, second] = suspects;
  return first && (second === undefined || second[1].grudge < first[1].grudge) ? first[0] : undefined;
}

/** Whom a learner believes did a fact: whoever did it if they know, otherwise whom they blame. */
export const believedActor = (f: Fact, v: { readonly knowsActor: boolean; readonly blame?: Id }): Id | undefined => (v.knowsActor ? f.actor : v.blame);

/**
 * A character after learning a fact, at `now`: their version added, a relationship with whoever they believe did it and
 * whoever it was done to (learning about someone makes them no longer a stranger), and their feelings changed by the tables.
 */
export function learnFact(c: CharacterRecord, f: Fact, v: Version, now: number): CharacterRecord {
  const actor = believedActor(f, v);
  const learner: Learner = { id: c.id, courage: currentTemperament(c).courage, maxHitPoints: maxHitPoints(c), affectionFor: (id) => c.relationships[id]?.affection };
  const relationships: Record<Id, Relationship> = { ...c.relationships };
  for (const id of [actor, f.victim]) if (id !== undefined && id !== c.id) relationships[id] ??= firstRelationship(currentTemperament(c));
  // the tables hold someone responsible for a fact once only, however often this character changes their mind about it
  const before = blamedFor(f, c.knowledge[f.id]);
  const counts = actor !== undefined && !before.includes(actor);
  if (counts) for (const ch of learningChanges(f, learner, actor)) relationships[ch.towards] = feel(relationships[ch.towards]!, ch.feeling, ch.amount, { now, why: ch.why });
  const blamed = counts ? [...before, actor] : before;
  // (recorded only where it holds more than whom they now believe did it, which it otherwise is)
  const extra = blamed.some((id) => id !== actor);
  const { blamed: _old, ...version } = v;
  return { ...c, knowledge: { ...c.knowledge, [f.id]: extra ? { ...version, blamed } : version }, relationships };
}

/** Everyone the learning tables have already held responsible for a fact, for a character who holds this version of it. */
export function blamedFor(f: Fact, v: Version | undefined): readonly Id[] {
  if (v === undefined) return [];
  if (v.blamed) return v.blamed;
  const actor = believedActor(f, v);
  return actor === undefined ? [] : [actor];
}

/** A character after meeting each of `others` at `now`. */
export function meetPeople(c: CharacterRecord, others: readonly Id[], now: number): CharacterRecord {
  if (others.length === 0) return c;
  const relationships: Record<Id, Relationship> = { ...c.relationships };
  for (const id of others) relationships[id] = meet(relationships[id] ?? firstRelationship(currentTemperament(c)), now);
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
