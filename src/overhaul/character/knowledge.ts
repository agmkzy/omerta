// Knowledge: each character's own version of the facts they know about, as in the game (Knowledge in src/types.ts). A
// version says when and how they learned it, from whom, whether they know who did it, and whom they blame if not, which can
// be wrong. Characters know only what they did, witnessed or were told. See docs/overhaul/plans/character/README.md (Knowledge).
import type { CharacterRecord, Id } from './character';
import type { Fact, FactId } from './facts';

/** Where a version came from: they did it, they were there (as a witness, or as the one it was done to), it was public, or someone told them. */
export type Source = 'self' | 'witness' | 'public' | 'told';

/** How they came by it: they saw it, a witness told them, or they heard it second-hand. */
export type How = 'seen' | 'told' | 'heard';

export interface Version {
  /** When they learned it, in minutes. */
  readonly learnedAt: number;
  readonly source: Source;
  /** Who told them, when they were told. */
  readonly teller?: Id;
  readonly how: How;
  readonly knowsActor: boolean;
  /** Whom they believe did it, when they do not know. */
  readonly blame?: Id;
  /** They heard it bigger than it was. */
  readonly exaggerated?: true;
  /** They know it never happened: the liar's own version of a fact they invented. */
  readonly knownFalse?: true;
}

export type Knowledge = Readonly<Record<FactId, Version>>;

/**
 * Who learns a fact when it is recorded, and their version: whoever did it, whoever it was done to and the witnesses, all of
 * whom saw it. Only those it was done to can miss who did it, when the actor is hidden. Nobody learns an invented fact this way.
 */
export function firstVersions(f: Fact): [Id, Version][] {
  if (f.invented) return [];
  const saw = (source: Source, knowsActor: boolean): Version => ({ learnedAt: f.at, source, how: 'seen', knowsActor });
  return [
    ...(f.actor !== undefined ? [[f.actor, saw('self', true)] as [Id, Version]] : []),
    ...(f.victim !== undefined ? [[f.victim, saw('witness', !f.hiddenActor)] as [Id, Version]] : []),
    ...f.witnesses.map((w) => [w, saw('witness', true)] as [Id, Version]),
  ];
}

/**
 * What a listener learns when told a fact by someone who knows it: what the teller believes, at `now`. A witness's telling
 * is "told"; anyone else's is "heard", second-hand.
 */
export function toldVersion(teller: Id, theirs: Version, now: number): Version {
  return {
    learnedAt: now,
    source: 'told',
    teller,
    how: theirs.how === 'seen' ? 'told' : 'heard',
    knowsActor: theirs.knowsActor,
    ...(theirs.blame !== undefined && { blame: theirs.blame }),
    ...(theirs.exaggerated && { exaggerated: true }),
  };
}

/**
 * Re-belief: a version someone already holds, changed by what they were told, with the teller now its source. Naming who did
 * it means they no longer know it but believe it; saying how big it was changes whether they think it exaggerated.
 */
export function rebelieve(v: Version, change: { readonly teller: Id; readonly blame?: Id; readonly exaggerated?: boolean }): Version {
  const { teller, blame, exaggerated } = change;
  const big = exaggerated ?? v.exaggerated === true;
  return {
    learnedAt: v.learnedAt,
    source: 'told',
    teller,
    how: 'told',
    knowsActor: blame === undefined && v.knowsActor,
    ...((blame ?? v.blame) !== undefined && { blame: blame ?? v.blame }),
    ...(big && { exaggerated: true }),
  };
}

/**
 * Throws RangeError unless every character's knowledge fits the facts: each version is of a recorded fact, learned no earlier
 * than it happened, told by someone else in the cast when told, blaming someone in the cast, and known false only by the
 * one who invented the fact.
 */
export function auditKnowledge(characters: readonly CharacterRecord[], facts: readonly Fact[]): void {
  const ids = new Set(characters.map((c) => c.id));
  const byId = new Map(facts.map((f) => [f.id, f]));
  for (const c of characters)
    for (const [id, v] of Object.entries(c.knowledge)) {
      const f = byId.get(id);
      const where = `${c.id}'s version of ${id}`;
      if (f === undefined) throw new RangeError(`${where} is of no recorded fact`);
      if (!Number.isInteger(v.learnedAt) || v.learnedAt < f.at) throw new RangeError(`${where} was learned before it happened`);
      if ((v.source === 'told') !== (v.teller !== undefined)) throw new RangeError(`${where} names a teller only if it was told`);
      if (v.teller !== undefined && (v.teller === c.id || !ids.has(v.teller))) throw new RangeError(`${where} was told by ${v.teller}, who is not someone else in the cast`);
      if (v.blame !== undefined && !ids.has(v.blame)) throw new RangeError(`${where} blames ${v.blame}, who is not in the cast`);
      if (v.knownFalse && f.invented !== c.id) throw new RangeError(`${where} is known false, but they did not invent it`);
    }
}
