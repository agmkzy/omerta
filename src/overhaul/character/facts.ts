// Facts: every event, recorded once in the cast, as in the game (Fact in src/types.ts). What each character knows of a fact is
// their own version of it (knowledge.ts). A fact that never happened, invented by a lie, is still recorded, marked invented,
// so the simulation always knows the truth. See docs/overhaul/plans/character/README.md (Knowledge).
import { OUTCOMES, type Outcome } from './check';
import type { Id } from './character';
import { assertTime } from './time';

/** The game's fact kinds (src/types.ts FactKind), in its order; a test checks they have not drifted apart. */
export const GAME_FACT_KINDS = [
  'attempt', 'loan', 'debt_missed', 'debt_paid', 'debt_default', 'protection_started', 'protection_refused', 'poach', 'beating',
  'vandalism', 'robbery', 'murder', 'business_struggling', 'business_failed', 'gambling_loss', 'arrest', 'promotion', 'theft',
  'burglary', 'scam', 'raid', 'ownership', 'terms', 'report', 'shortfall', 'discipline', 'levy', 'side_operation', 'ruling',
  'sitdown', 'gathering', 'exposed', 'trouble', 'protection_late', 'rumour', 'favour', 'event', 'threat', 'informant',
] as const;

/** Kinds the game does not have: a fight someone fled from or that ended in a stalemate, a persuasion roll and a deception roll. */
export const ADDED_FACT_KINDS = ['fight', 'persuasion', 'lie'] as const;

export const FACT_KINDS = [...GAME_FACT_KINDS, ...ADDED_FACT_KINDS] as const;
export type FactKind = (typeof FACT_KINDS)[number];

export type FactId = string;

export interface Fact {
  readonly id: FactId;
  readonly kind: FactKind;
  /** Who did it. */
  readonly actor?: Id;
  /** Who it was done to. */
  readonly victim?: Id;
  readonly business?: string;
  readonly amount?: number;
  /** When it happened, in minutes. */
  readonly at: number;
  readonly where?: string;
  /** The fact that led to this one. */
  readonly cause?: FactId;
  /** The matter it belongs to, linking the facts of one fight or one dispute, as the game's story does. */
  readonly story?: string;
  /** Who did it is not known to those it was done to. */
  readonly hiddenActor?: true;
  /** It never happened: this character's lie invented it. */
  readonly invented?: Id;
  /** Who saw it, besides whoever did it and whoever it was done to. */
  readonly witnesses: readonly Id[];
  /** A social roll's fact: how it ended. The simulation's truth; only its target knows it exactly. */
  readonly ending?: FactEnding;
  /** A lie's fact: what it claimed. */
  readonly claim?: LieClaim;
}

/** How a social roll ended: one of the check's outcomes, or provoked. */
export type FactEnding = Outcome | 'provoked';
export const FACT_ENDINGS: readonly FactEnding[] = [...OUTCOMES, 'provoked'];

/** What a lie claimed: who did a real fact, how big it was, or that a fact it invented happened. */
export type LieClaim = { readonly blame: Id } | { readonly exaggerated: boolean } | { readonly invented: true };

/** What a caller gives to record a fact; the cast adds the id and the time. */
export type FactInput = Omit<Fact, 'id' | 'at' | 'witnesses'>;

/**
 * Throws RangeError for a fact that is not complete and consistent: a known kind, a time, actor, victim and witnesses who
 * are in the cast and named once each, a cause among the facts recorded before it, and a whole amount from 0.
 */
export function assertFact(f: Fact, characters: ReadonlySet<Id>, earlier: ReadonlySet<FactId>): void {
  if (!FACT_KINDS.includes(f.kind)) throw new RangeError(`unknown kind of fact ${String(f.kind)}`);
  assertTime(f.at, 'a fact’s time');
  for (const id of [f.actor, f.victim, f.invented, ...f.witnesses]) if (id !== undefined && !characters.has(id)) throw new RangeError(`fact ${f.id} names ${id}, who is not in the cast`);
  const named = [f.actor, f.victim, ...f.witnesses].filter((id) => id !== undefined);
  if (new Set(named).size !== named.length) throw new RangeError(`fact ${f.id} names someone twice`);
  if (f.cause !== undefined && !earlier.has(f.cause)) throw new RangeError(`fact ${f.id} is caused by ${f.cause}, which is not recorded before it`);
  if (f.amount !== undefined && !(Number.isInteger(f.amount) && f.amount >= 0)) throw new RangeError(`an amount is a whole number from 0, got ${f.amount}`);
  if (f.hiddenActor && f.actor === undefined) throw new RangeError(`fact ${f.id} hides an actor it does not have`);
  if (f.invented !== undefined && f.witnesses.length) throw new RangeError(`fact ${f.id} never happened, so no one witnessed it`);
  if (f.ending !== undefined && !FACT_ENDINGS.includes(f.ending)) throw new RangeError(`unknown ending ${String(f.ending)}`);
  if (f.claim !== undefined && f.kind !== 'lie') throw new RangeError(`only a lie records a claim, not ${f.kind}`);
  if (f.claim !== undefined && 'blame' in f.claim && !characters.has(f.claim.blame)) throw new RangeError(`fact ${f.id}'s claim names ${f.claim.blame}, who is not in the cast`);
}

/** A fact's id, made from the cast's counter. */
export const factId = (n: number): FactId => `f${n}`;

/**
 * Throws RangeError unless the facts are each valid (assertFact), in time order, with distinct ids made from the counter
 * below `nextId`.
 */
export function auditFacts(facts: readonly Fact[], characters: ReadonlySet<Id>, nextId: number): void {
  if (!Number.isInteger(nextId) || nextId < 1) throw new RangeError(`the id counter is a whole number from 1, got ${nextId}`);
  const earlier = new Set<FactId>();
  let last = 0;
  for (const f of facts) {
    const n = /^f(\d+)$/.exec(f.id)?.[1];
    if (n === undefined || Number(n) >= nextId) throw new RangeError(`fact id ${f.id} was not made by the counter, which is at ${nextId}`);
    if (earlier.has(f.id)) throw new RangeError(`two facts have the id ${f.id}`);
    assertFact(f, characters, earlier);
    if (f.at < last) throw new RangeError(`fact ${f.id} at ${f.at} is recorded after one at ${last}`);
    last = f.at;
    earlier.add(f.id);
  }
}
