// Knowledge: each character's own version of the facts they know about, as in the game (Knowledge in src/types.ts). A
// version says when and how they learned it, from whom, whether they know who did it, and whom they blame if not, which can
// be wrong. Characters know only what they did, witnessed or were told. See docs/overhaul/plans/character/README.md (Knowledge).
import type { CharacterRecord, Id } from './character';
import type { Fact, FactId } from './facts';

/** Where a version came from: they did it, they were there (as a witness, or as the one it was done to), it was public, or someone told them. */
export type Source = 'self' | 'witness' | 'public' | 'told';

/** How they came by it: they saw it, a witness told them, or they heard it second-hand. */
export type How = 'seen' | 'told' | 'heard';

/** How they came by one part of a fact (who did it, or how big it was): as for the fact, or they guessed it. */
export type PartHow = How | 'guessed';

/** Where one part of a version came from: how they came by it, and who told them, if anyone. */
export interface PartSource {
  readonly how: PartHow;
  readonly teller?: Id;
}

/** The parts of a fact a version holds a belief about, each with its own provenance. */
export type Part = 'who' | 'size';

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
  /** Where their belief about who did it came from, when that differs from the version's own provenance. */
  readonly who?: PartSource;
  /** Where their belief about how big it was came from, when that differs from the version's own provenance. */
  readonly size?: PartSource;
  /** Everyone the learning tables have held responsible for it, for this character, so none is counted twice. */
  readonly blamed?: readonly Id[];
}

/**
 * Where a version's belief about a part came from: its own record of that part, or else the version's provenance. No
 * provenance for who did it if they believe no one did it.
 */
export function partOf(v: Version, part: Part): PartSource | undefined {
  const own = part === 'who' ? v.who : v.size;
  if (own) return own;
  if (part === 'who' && !v.knowsActor && v.blame === undefined) return undefined;
  return { how: v.how, ...(v.teller !== undefined && { teller: v.teller }) };
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

/** A part's provenance passed on by a teller: a witness's account is "told", anyone else's "heard", and a guess stays a guess. */
export function passOn(p: PartSource, teller: Id): PartSource {
  return { how: p.how === 'seen' ? 'told' : p.how === 'guessed' ? 'guessed' : 'heard', teller };
}

/** A version with its parts' provenance, each recorded only where it differs from the version's own. */
function withParts(v: Version, parts: { readonly who?: PartSource | undefined; readonly size?: PartSource | undefined }): Version {
  const { who: _who, size: _size, ...rest } = v;
  const own: PartSource = { how: v.how, ...(v.teller !== undefined && { teller: v.teller }) };
  const same = (p: PartSource) => p.how === own.how && p.teller === own.teller;
  return { ...rest, ...(parts.who && !same(parts.who) && { who: parts.who }), ...(parts.size && !same(parts.size) && { size: parts.size }) };
}

/**
 * What a listener learns when told a fact by someone who knows it: what the teller believes, at `now`. A witness's telling
 * is "told"; anyone else's is "heard", second-hand; a guess passed on is still a guess.
 */
export function toldVersion(teller: Id, theirs: Version, now: number): Version {
  const who = partOf(theirs, 'who');
  const base: Version = {
    learnedAt: now,
    source: 'told',
    teller,
    how: theirs.how === 'seen' ? 'told' : 'heard',
    knowsActor: theirs.knowsActor,
    ...(theirs.blame !== undefined && { blame: theirs.blame }),
    ...(theirs.exaggerated && { exaggerated: true }),
  };
  return withParts(base, { who: who && passOn(who, teller), size: passOn(partOf(theirs, 'size')!, teller) });
}

/** A changed belief about a part of a fact: who did it (knowing it, or blaming someone), or how big it was, and where it came from. */
export type Belief =
  | { readonly part: 'who'; readonly knowsActor: boolean; readonly blame?: Id; readonly from: PartSource }
  | { readonly part: 'size'; readonly exaggerated: boolean; readonly from: PartSource };

/**
 * Re-belief: a version someone already holds, with their belief about one part changed, and that part's provenance now
 * where the change came from. The rest of the version, and how they came by the fact itself, are unchanged.
 */
export function rebelieve(v: Version, change: Belief): Version {
  const who = partOf(v, 'who');
  const size = partOf(v, 'size')!;
  if (change.part === 'who') {
    const { blame: _blame, ...rest } = v;
    const changed: Version = { ...rest, knowsActor: change.knowsActor, ...(change.blame !== undefined && { blame: change.blame }) };
    return withParts(changed, { who: change.from, size });
  }
  const { exaggerated: _big, ...rest } = v;
  return withParts({ ...rest, ...(change.exaggerated && { exaggerated: true }) }, { who, size: change.from });
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
