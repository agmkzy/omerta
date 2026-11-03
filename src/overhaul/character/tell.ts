// Telling: one character telling another what they believe of a fact. Telling someone who does not know it, or filling a gap
// in what they know (they know of it, but not who did it), is accepted as any telling is. Telling them what they already
// believe changes nothing. Telling them something that contradicts what they believe is a roll: the teller's Persuasion
// against TELL_DC, with what the listener knows of that part of the fact and how they feel about the teller as modifiers. If
// the belief it overturns came from a lie, told as something the liar saw, the lie comes out. However it goes, the two have
// met: telling someone anything means being with them. Asking the odds reveals nothing more of the listener's version than a
// lie's odds would. See docs/overhaul/plans/character/README.md (Knowledge).
import type { CastRecord } from './cast';
import { checkOdds, resolveCheck, succeeded, type CheckResult, type Modifier, type Odds } from './check';
import type { CharacterRecord, Id } from './character';
import { assertAvailable } from './condition';
import { withConduct } from './conduct';
import { assertOnJob, type JobId } from './jobs';
import type { Fact, FactId } from './facts';
import { partOf, passOn, rebelieve, toldVersion, type Belief, type Part as KnowledgePart, type Version } from './knowledge';
import { believedActor, learnFact, meetPeople } from './learning';
import { d20, knownBy, rollParts, seenBy, truthOf, type Part } from './parts';
import type { Roller } from './random';
import { withCharacter } from './records';
import { feel, feelingModifiers } from './relationships';
import { knowledgePart } from './social';
import { assertTime } from './time';

/** The DC of persuading someone that what they believe of a fact is wrong. */
export const TELL_DC = 10;

/** The aftermath of a lie coming out: as for a lie seen through. */
const LIE_FOUND_OUT = [{ feeling: 'trust', amount: -0.15 }, { feeling: 'grudge', amount: 0.05 }] as const;

interface CastLike {
  readonly data: CastRecord;
}
interface Viewer {
  readonly id: Id;
  readonly name: string;
  readonly cast: CastLike;
}

export interface TellSetup {
  readonly data: CastRecord;
  readonly teller: CharacterRecord;
  readonly listener: CharacterRecord;
  readonly fact: FactId;
  /** The job the telling is for, whose plan counts on the teller's Persuasion. */
  readonly job?: JobId;
}

/** What really happened when telling: for the simulation and tests, never shown to a character. */
export interface TellTruth {
  /** The roll, if what was told contradicted what the listener believed. */
  readonly roll: CheckResult | null;
  /** The parts of the fact the listener now believes as the teller does: all of it, if they had not known of it. */
  readonly changed: readonly KnowledgePart[] | 'all';
  /** Lies that came out. */
  readonly exposed: readonly FactId[];
}

export interface TellCheck<C extends CastLike> {
  odds(o: { readonly for: Viewer }): Odds;
  explain(o: { readonly for: Viewer }): readonly Modifier[];
  /** Tells it at `now`: refused if the cast it came from has been replaced. The dice are rolled only if a roll is needed. */
  roll(roller: Roller, when: { readonly now: number }): { readonly cast: C; readonly truth: TellTruth };
}

/** What the teller believes of each part, and what the listener does, as one value for each part. */
const beliefOf = (f: Fact, v: Version, part: KnowledgePart): Id | boolean | undefined => (part === 'who' ? believedActor(f, v) : v.exaggerated === true);

/** The parts where the listener has no belief, and those where they believe otherwise than the teller. */
function compare(f: Fact, mine: Version, theirs: Version): { readonly gaps: KnowledgePart[]; readonly contradicted: KnowledgePart[] } {
  const gaps: KnowledgePart[] = [];
  const contradicted: KnowledgePart[] = [];
  for (const part of ['who', 'size'] as const) {
    const t = beliefOf(f, mine, part);
    const l = beliefOf(f, theirs, part);
    if (t === undefined || t === l) continue;
    (l === undefined ? gaps : contradicted).push(part);
  }
  return { gaps, contradicted };
}

/** The listener's belief about a part changed to the teller's, as telling passes it on (toldVersion), with the teller's provenance. */
function teach(v: Version, mine: Version, teller: Id, part: KnowledgePart): Version {
  const from = passOn(partOf(mine, part)!, teller);
  const change: Belief =
    part === 'who'
      ? { part, knowsActor: mine.knowsActor, ...(mine.blame !== undefined && { blame: mine.blame }), from }
      : { part, exaggerated: mine.exaggerated === true, from };
  return rebelieve(v, change);
}

export function tellCheck<C extends CastLike>(setup: TellSetup, owner: C, commit: (next: (data: CastRecord) => CastRecord) => C): TellCheck<C> {
  const { data, teller, listener } = setup;
  const f = data.facts.find((x) => x.id === setup.fact);
  const mine = teller.knowledge[setup.fact];
  if (f === undefined || mine === undefined) throw new RangeError(`${teller.name} does not know ${setup.fact}`);
  if (mine.knownFalse) throw new RangeError(`${teller.name} knows ${setup.fact} is false, so telling it would be a lie`);
  if (listener.id === teller.id) throw new RangeError(`${teller.name} cannot tell themselves`);
  for (const c of [teller, listener]) if (c.condition.hitPoints === 0) throw new RangeError(`${c.name} is unconscious`);
  const theirs = listener.knowledge[setup.fact];
  const { contradicted } = theirs ? compare(f, mine, theirs) : { contradicted: [] };

  // the roll's parts: the teller's Persuasion, how the listener feels about the teller, and what the listener knows of the parts told
  assertOnJob(data.jobs, teller, setup.job);
  const persuasion = rollParts(data, teller, 'persuasion', ['persuade'], {}, setup.job);
  const feelings = (whose: 'actor' | 'target') =>
    feelingModifiers(
      'persuade',
      { name: teller.name, ...(whose === 'actor' && teller.relationships[listener.id] && { towards: teller.relationships[listener.id] }) },
      { name: listener.name, ...(whose === 'target' && listener.relationships[teller.id] && { towards: listener.relationships[teller.id] }) },
    ).map((m) => knownBy([whose === 'actor' ? teller.id : listener.id], m));
  const knowing = (['who', 'size'] as const).flatMap((part) => {
    const told = beliefOf(f, mine, part);
    if (told === undefined) return [];
    const ps = knowledgePart(data, listener, f, part, told, 'What they are told');
    // (agreement is no roll at all, so only a contradiction's modifier counts)
    return ps.filter((p) => p.truth === null || p.truth.value !== 2);
  });
  const parts: Part[] = [...persuasion.parts, ...knowing, ...feelings('target'), ...feelings('actor')];
  const roll = (modifiers: readonly Modifier[]) => ({ ...d20(modifiers, persuasion.advantage.truth ? 'advantage' : 'none'), dc: TELL_DC });
  const viewerIn = (v: Viewer) => {
    if (v.cast !== owner) throw new RangeError(`${v.name} is from another cast`);
    return v.id;
  };

  return {
    odds: ({ for: v }) => checkOdds({ ...roll(seenBy(parts, viewerIn(v))), edge: persuasion.advantage.knownTo(v.id) ? 'advantage' : 'none' }),
    explain: ({ for: v }) => seenBy(parts, viewerIn(v)),
    roll(roller, { now }) {
      assertTime(now);
      for (const c of [teller, listener]) assertAvailable(c, now, 'be told or tell anything');
      if (now < mine.learnedAt) throw new RangeError(`${teller.name} cannot tell ${f.id} at ${now}, before learning it at ${mine.learnedAt}`);
      const result = contradicted.length ? resolveCheck(roll(truthOf(parts)), roller) : null;
      const exposed: FactId[] = [];
      let changed: TellTruth['changed'] = [];
      const cast = commit((d) => {
        const met = (x: CastRecord) => withCharacter(withCharacter(x, listener.id, (c) => meetPeople(c, [teller.id], now)), teller.id, (c) => meetPeople(c, [listener.id], now));
        if (theirs === undefined) {
          changed = 'all';
          return met(withCharacter(d, listener.id, (c) => learnFact(c, f, toldVersion(teller.id, mine, now), now)));
        }
        const { gaps } = compare(f, mine, theirs);
        const overturned = result && succeeded(result.outcome) ? contradicted : [];
        changed = [...gaps, ...overturned];
        let after = theirs;
        for (const part of changed) after = teach(after, mine, teller.id, part);
        let next = changed.length ? withCharacter(d, listener.id, (c) => learnFact(c, f, after, now)) : d;
        next = met(next);
        for (const part of overturned) {
          const lie = lieBehind(next, f, theirs, listener.id, part);
          if (lie === undefined) continue;
          exposed.push(lie.id);
          next = foundOut(next, lie, listener.id, now);
        }
        return next;
      });
      return { cast, truth: { roll: result, changed, exposed } };
    },
  };
}

/**
 * The lie behind a listener's belief about a part, if it came straight from someone who told it as something they saw, and
 * that person's lie to the listener about this fact claimed that part.
 */
function lieBehind(data: CastRecord, f: Fact, theirs: Version, listener: Id, part: KnowledgePart): Fact | undefined {
  const from = partOf(theirs, part);
  if (from?.how !== 'told' || from.teller === undefined) return undefined;
  return data.facts.find(
    (l) => l.kind === 'lie' && l.actor === from.teller && l.victim === listener && l.cause === f.id && l.claim !== undefined && (part === 'who' ? 'blame' in l.claim : 'exaggerated' in l.claim),
  );
}

/** A lie come out: the one lied to learns it, trusts the liar less, holds a grudge, and is less agreeable for having been lied to. */
function foundOut(data: CastRecord, lie: Fact, listener: Id, now: number): CastRecord {
  const liar = lie.actor!;
  const knows: Version = { learnedAt: now, source: 'witness', how: 'seen', knowsActor: true };
  return withCharacter(data, listener, (c) => {
    let after = learnFact(c, lie, knows, now);
    for (const a of LIE_FOUND_OUT) after = { ...after, relationships: { ...after.relationships, [liar]: feel(after.relationships[liar]!, a.feeling, a.amount, { now, why: lie.id }) } };
    return withConduct(after, 'lied-to', now, { fact: lie.id });
  });
}

