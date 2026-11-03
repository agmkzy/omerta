// Social actions: getting someone to do something without force. Each is one opposed check, the actor's skill against the
// target's resisting skill, graded into the usual five outcomes, as in the lab. The roll decides the response; everything
// about the two characters is a modifier on it: temperament, effects, items, weapons, feelings and what the target knows.
// Odds, explanations and results are given to a viewer, and count another character's private state only where the viewer
// knows it. Each roll records a fact, which is the cause of its aftermath. See docs/overhaul/plans/character/README.md.
import { OUTCOMES, opposedOdds, resolveOpposed, succeeded, type Modifier, type OpposedResult, type Outcome } from './check';
import type { CastRecord } from './cast';
import type { CharacterRecord, Id } from './character';
import { assertAvailable } from './condition';
import { currentTemperament, withConduct, type Conduct } from './conduct';
import { FACT_KINDS, type Fact, type FactId, type FactKind, type LieClaim } from './facts';
import { ITEM_INFO, WEAPON_THREAT, strongestWeapon } from './items';
import { usingAdvantage } from './jobs';
import { partOf, rebelieve, toldVersion, type Part as KnowledgePartName, type Version } from './knowledge';
import { believedActor, isViolent, learnFact } from './learning';
import type { Roller } from './random';
import { allMeet, recordFact, withCharacter } from './records';
import { feel, feelingModifiers, type Feeling, type SocialAction } from './relationships';
import { d20, everyone, knownBy, rollParts, seenBy, truthOf, type Part, type PlanAdvantage } from './parts';
import type { Skill } from './skills';
import { HIGH, leaning, type Situation } from './temperament';

export type { SocialAction };
export const SOCIAL_ACTIONS = ['intimidate', 'persuade', 'deceive'] as const satisfies readonly SocialAction[];

/** How a social roll ends: one of the check's outcomes, or provoked (a critical failure at intimidating a volatile target). */
export type Ending = Outcome | 'provoked';
export const ENDINGS = [...OUTCOMES, 'provoked'] as const satisfies readonly Ending[];

/** How an ending looks to anyone but the target, who alone knows exactly how it went for them. */
export type Appearance = 'gives in' | 'resists' | 'provoked' | 'agrees' | 'agrees, for something in return' | 'declines' | 'sees through it' | 'no sign';

export interface SocialActionInfo {
  readonly name: string;
  readonly skill: Skill;
  /** The skill the target resists with. */
  readonly resist: Skill;
  readonly actorSituations: readonly Situation[];
  readonly targetSituations: readonly Situation[];
  /** What each ending means for the target. */
  readonly endings: Readonly<Partial<Record<Ending, string>>>;
  readonly appearance: Readonly<Partial<Record<Ending, Appearance>>>;
  /** The kind of fact the roll records. */
  readonly fact: FactKind;
}

export const SOCIAL_ACTION_INFO: { readonly [A in SocialAction]: SocialActionInfo } = {
  intimidate: {
    name: 'Intimidate',
    skill: 'intimidation',
    resist: 'nerve',
    actorSituations: ['intimidate'],
    targetSituations: ['hold-nerve', 'resist-intimidation'],
    endings: {
      'critical-success': 'gives in fully and will not make trouble afterwards',
      success: 'gives in',
      partial: 'gives in, but resents it and may make trouble later',
      failure: 'resists',
      'critical-failure': 'resists',
      provoked: 'takes offence: it may come to a fight',
    },
    appearance: { 'critical-success': 'gives in', success: 'gives in', partial: 'gives in', failure: 'resists', 'critical-failure': 'resists', provoked: 'provoked' },
    fact: 'threat',
  },
  persuade: {
    name: 'Persuade',
    skill: 'persuasion',
    resist: 'insight',
    actorSituations: ['persuade'],
    targetSituations: [],
    endings: {
      'critical-success': 'agrees, and thinks better of the persuader afterwards',
      success: 'agrees',
      partial: 'agrees, but wants something in return',
      failure: 'declines',
      'critical-failure': 'declines and is put off, making them harder to persuade next time',
    },
    // a price is said out loud, so anyone there hears it
    appearance: { 'critical-success': 'agrees', success: 'agrees', partial: 'agrees, for something in return', failure: 'declines', 'critical-failure': 'declines' },
    fact: 'persuasion',
  },
  deceive: {
    name: 'Deceive',
    skill: 'deception',
    resist: 'insight',
    actorSituations: ['deceive'],
    targetSituations: [],
    endings: {
      'critical-success': 'believes it completely',
      success: 'believes it',
      partial: 'believes it for now, but has doubts',
      failure: 'does not believe it',
      'critical-failure': 'sees through it and knows they were lied to',
    },
    appearance: { 'critical-success': 'no sign', success: 'no sign', partial: 'no sign', failure: 'no sign', 'critical-failure': 'sees through it' },
    fact: 'lie',
  },
};

/** A change in feelings after a social roll: whose (the target's about the actor, or the actor's about the target), and how much. */
interface Aftermath {
  readonly whose: 'target' | 'actor';
  readonly feeling: Feeling;
  readonly amount: number;
}

/** The aftermath of each ending, from the plan's tables. A deception that succeeds changes the target's version instead. */
export const AFTERMATH: { readonly [A in SocialAction]: Readonly<Partial<Record<Ending, readonly Aftermath[]>>> } = {
  intimidate: {
    'critical-success': [{ whose: 'target', feeling: 'fear', amount: 0.15 }, { whose: 'target', feeling: 'trust', amount: -0.05 }, { whose: 'actor', feeling: 'respect', amount: -0.05 }],
    success: [{ whose: 'target', feeling: 'fear', amount: 0.1 }, { whose: 'target', feeling: 'grudge', amount: 0.05 }, { whose: 'target', feeling: 'trust', amount: -0.05 }, { whose: 'actor', feeling: 'respect', amount: -0.05 }],
    partial: [{ whose: 'target', feeling: 'fear', amount: 0.1 }, { whose: 'target', feeling: 'grudge', amount: 0.1 }, { whose: 'target', feeling: 'trust', amount: -0.05 }, { whose: 'actor', feeling: 'respect', amount: -0.05 }],
    failure: [{ whose: 'target', feeling: 'respect', amount: -0.05 }, { whose: 'actor', feeling: 'respect', amount: 0.05 }],
    'critical-failure': [{ whose: 'target', feeling: 'respect', amount: -0.05 }, { whose: 'actor', feeling: 'respect', amount: 0.05 }],
    provoked: [{ whose: 'target', feeling: 'grudge', amount: 0.1 }, { whose: 'actor', feeling: 'respect', amount: 0.05 }],
  },
  persuade: {
    'critical-success': [{ whose: 'target', feeling: 'trust', amount: 0.05 }],
    success: [{ whose: 'target', feeling: 'trust', amount: 0.05 }],
    'critical-failure': [{ whose: 'target', feeling: 'trust', amount: -0.02 }],
  },
  deceive: {
    'critical-failure': [{ whose: 'target', feeling: 'trust', amount: -0.15 }, { whose: 'target', feeling: 'grudge', amount: 0.05 }],
  },
};

/** A modifier large enough that the check cannot succeed: a certain outcome, as decided in the lab. */
export const IMPOSSIBLE = -100;

/** A lie's claim: a different version of a real fact (who did it, or how big it was), or a fact that never happened. */
export type Claim =
  | { readonly about: FactId; readonly blame: Id }
  | { readonly about: FactId; readonly exaggerated: boolean }
  | { readonly invented: { readonly kind: FactKind; readonly actor?: Id; readonly victim?: Id; readonly amount?: number } };

/** What a viewer can know of a social check: the modifiers they know of on each roll. */
export interface Explanation {
  readonly actor: readonly Modifier[];
  readonly target: readonly Modifier[];
}

/** A social roll's result as a viewer saw it. */
export interface SeenResult {
  readonly action: SocialAction;
  /** The exact ending, for the target; how it looked, for the actor and witnesses; nothing, for anyone who was not there. */
  readonly ending: Ending | Appearance | null;
  readonly explanation: Explanation | null;
}

/** What really happened: for the simulation and tests, never shown to a character. */
export interface SocialTruth {
  readonly action: SocialAction;
  readonly ending: Ending;
  readonly check: OpposedResult;
  /** The facts the roll recorded: the threat, persuasion or lie, after any fact a lie invented. */
  readonly facts: readonly Fact[];
}

/** Whether a viewer saw the fact happen, with `who` there: then they know `who` saw it too. */
function sawWith(data: CastRecord, viewer: Id, f: Fact, who: Id): boolean {
  const v = data.characters.find((c) => c.id === viewer)?.knowledge[f.id];
  return v?.how === 'seen' && [f.actor, f.victim, ...f.witnesses].includes(who);
}

export interface SocialSetup {
  readonly action: SocialAction;
  readonly data: CastRecord;
  readonly actor: CharacterRecord;
  readonly target: CharacterRecord;
  readonly claim?: Claim;
  readonly extra: readonly Modifier[];
}

/** The weapon the actor shows against what the target carries. Anyone but the target judges by the weapons the target shows. */
function weaponPart(actor: CharacterRecord, target: CharacterRecord): Part[] {
  const shown = strongestWeapon(actor.inventory, ['shown']);
  if (shown === 'none') return [];
  const against = (answer: ReturnType<typeof strongestWeapon>): Modifier | null => {
    const value = WEAPON_THREAT[shown][answer];
    return value ? { value, reason: `${ITEM_INFO[shown].name} against ${answer === 'none' ? 'no weapon' : `a ${ITEM_INFO[answer].name.toLowerCase()}`}` } : null;
  };
  const truth = against(strongestWeapon(target.inventory, ['carried', 'shown']));
  const seen = against(strongestWeapon(target.inventory, ['shown']));
  return [{ truth, knownTo: (v) => (v === target.id ? truth : seen) }];
}

/** What the target knows of the actor's violence: +2 for having seen it, +1 for having been told or heard; only the best counts. */
function violencePart(data: CastRecord, actor: CharacterRecord, target: CharacterRecord): Part[] {
  let best: { modifier: Modifier; fact: Fact; version: Version } | undefined;
  for (const f of data.facts) {
    const v = target.knowledge[f.id];
    if (!v || !isViolent(f) || believedActor(f, v) !== actor.id) continue;
    const value = partOf(v, 'who')!.how === 'seen' ? 2 : 1;
    if (!best || value > best.modifier.value)
      best = { fact: f, version: v, modifier: { value, reason: `${target.name} ${value === 2 ? 'has seen' : 'has heard of'} ${actor.name} being violent` } };
  }
  if (!best) return [];
  const { modifier, fact, version } = best;
  const told = partOf(version, 'who')!.teller;
  return [{ truth: modifier, knownTo: (v) => (v === target.id || v === told || (modifier.value === 2 && sawWith(data, v, fact, target.id)) ? modifier : null) }];
}

/** Throws RangeError for a claim that is not a lie the liar can tell: about a fact they know, differing from what they believe. */
function assertClaim(data: CastRecord, liar: CharacterRecord, claim: Claim): void {
  if ('invented' in claim) {
    if (!FACT_KINDS.includes(claim.invented.kind)) throw new RangeError(`unknown kind of fact ${String(claim.invented.kind)}`);
    return;
  }
  const f = data.facts.find((x) => x.id === claim.about);
  const mine = liar.knowledge[claim.about];
  if (f === undefined || mine === undefined) throw new RangeError(`${liar.name} does not know ${claim.about}, so cannot lie about it`);
  if (mine.knownFalse) throw new RangeError(`${liar.name} invented ${claim.about}; a new lie invents a new fact`);
  if ('blame' in claim) {
    if (!data.characters.some((c) => c.id === claim.blame)) throw new RangeError(`${claim.blame} is not in the cast`);
    if (believedActor(f, mine) === claim.blame) throw new RangeError(`${liar.name} believes that already, so it is not a lie: tell it instead`);
  } else if ((mine.exaggerated === true) === claim.exaggerated) throw new RangeError(`${liar.name} believes that already, so it is not a lie: tell it instead`);
}

/**
 * What the target knows of the part of the fact the claim changes: impossible if they saw it themselves, −4 if a witness
 * told them, −2 if they heard it second-hand, nothing if they do not know it, and +2 if the lie matches what they believe.
 */
function claimPart(data: CastRecord, target: CharacterRecord, claim: Claim): Part[] {
  if ('invented' in claim) {
    const { actor, victim } = claim.invented;
    return actor === target.id || victim === target.id ? [everyone({ value: IMPOSSIBLE, reason: `${target.name} would know: it would have been them` })] : [];
  }
  const f = data.facts.find((x) => x.id === claim.about)!;
  return 'blame' in claim ? knowledgePart(data, target, f, 'who', claim.blame, 'The lie') : knowledgePart(data, target, f, 'size', claim.exaggerated, 'The lie');
}

/**
 * What a listener knows of one part of a fact, against what they are told of it: impossible if they saw it themselves, −4 if
 * a witness told them, −2 if they heard it second-hand, nothing if they do not know it or only guessed, and +2 if what they
 * are told matches what they believe. Known to the listener, to whoever told them that part, and, where they saw it, to anyone
 * who saw it with them.
 */
export function knowledgePart(data: CastRecord, listener: CharacterRecord, f: Fact, part: KnowledgePartName, claimed: Id | boolean, what: string): Part[] {
  const t = listener.name;
  const v = listener.knowledge[f.id];
  if (v === undefined) return [];
  const belief = part === 'who' ? believedActor(f, v) : v.exaggerated === true;
  if (belief === undefined) return [];
  const from = partOf(v, part)!;
  const about = part === 'who' ? 'who did it' : 'how big it was';
  const modifier: Modifier | null =
    belief === claimed
      ? { value: 2, reason: `${what} matches what ${t} believes` }
      : from.how === 'seen'
        ? { value: IMPOSSIBLE, reason: `${t} saw it themselves` }
        : from.how === 'told'
          ? { value: -4, reason: `A witness told ${t} ${about}` }
          : from.how === 'heard'
            ? { value: -2, reason: `${t} heard ${about}` }
            : null;
  if (modifier === null) return [];
  return [{ truth: modifier, knownTo: (viewer) => (viewer === listener.id || viewer === from.teller || (modifier.value === IMPOSSIBLE && sawWith(data, viewer, f, listener.id)) ? modifier : null) }];
}

/** Every part of the two rolls, with who can know each, and each roll's advantage from a plan. */
function partsOf(s: SocialSetup): { readonly active: readonly Part[]; readonly passive: readonly Part[]; readonly edges: readonly [PlanAdvantage, PlanAdvantage] } {
  const info = SOCIAL_ACTION_INFO[s.action];
  const { actor, target, data } = s;
  const feelings = (whose: 'actor' | 'target') =>
    feelingModifiers(s.action, { name: actor.name, ...(whose === 'actor' && actor.relationships[target.id] && { towards: actor.relationships[target.id] }) }, { name: target.name, ...(whose === 'target' && target.relationships[actor.id] && { towards: target.relationships[actor.id] }) }).map((m) =>
      knownBy([whose === 'actor' ? actor.id : target.id], m),
    );
  const own = rollParts(data, actor, info.skill, info.actorSituations);
  const resisting = rollParts(data, target, info.resist, info.targetSituations);
  return {
    edges: [own.advantage, resisting.advantage],
    active: [
      ...own.parts,
      ...(s.action === 'intimidate' ? [...weaponPart(actor, target), ...violencePart(data, actor, target)] : []),
      ...(s.claim ? claimPart(data, target, s.claim) : []),
      ...feelings('target'),
      ...feelings('actor'),
      ...s.extra.map(everyone),
    ],
    passive: resisting.parts,
  };
}

const edgeFor = (a: PlanAdvantage, viewer: Id | null) => ((viewer === null ? a.truth : a.knownTo(viewer)) ? 'advantage' : 'none');
const provokes = (s: SocialSetup) => s.action === 'intimidate' && leaning(currentTemperament(s.target).volatility) === 'high';

/** The modifiers a viewer knows of on each roll. */
export function explainFor(s: SocialSetup, viewer: Id): Explanation {
  const { active, passive } = partsOf(s);
  return { actor: seenBy(active, viewer), target: seenBy(passive, viewer) };
}

/** The chance of each ending as a viewer can judge it. Only the target knows whether they are volatile enough to be provoked. */
export function oddsFor(s: SocialSetup, viewer: Id | null): Readonly<Record<Ending, number>> {
  const { active, passive, edges } = partsOf(s);
  const pick = (parts: readonly Part[]) => (viewer === null ? truthOf(parts) : seenBy(parts, viewer));
  const odds = opposedOdds({ active: d20(pick(active), edgeFor(edges[0], viewer)), passive: d20(pick(passive), edgeFor(edges[1], viewer)) });
  const provoked = provokes(s) && (viewer === null || viewer === s.target.id);
  return { ...odds, 'critical-failure': provoked ? 0 : odds['critical-failure'], provoked: provoked ? odds['critical-failure'] : 0 };
}

/**
 * Throws RangeError for a social action that cannot be tried: on oneself, by or on someone unconscious, a lie with no valid
 * claim, or a lie the liar knows cannot work (an invented fact naming the target, or a fact the liar saw the target see).
 */
export function assertSetup(s: SocialSetup): void {
  if (s.actor.id === s.target.id) throw new RangeError(`${s.actor.name} cannot ${s.action} themselves`);
  for (const c of [s.actor, s.target]) if (s.data.characters.find((x) => x.id === c.id)!.condition.hitPoints === 0) throw new RangeError(`${c.name} is unconscious`);
  if (s.action === 'deceive') {
    if (s.claim === undefined) throw new RangeError('a lie needs a claim');
    assertClaim(s.data, s.actor, s.claim);
    // a lie the liar knows cannot work is not one they would tell; one that only the target knows cannot work is tried, and fails
    const known = claimPart(s.data, s.target, s.claim).map((p) => p.knownTo(s.actor.id)).find((m) => m?.value === IMPOSSIBLE);
    if (known) throw new RangeError(`${s.actor.name} would not tell that lie: ${known.reason}`);
  }
}

/** Rolls the check and returns what really happened, and the record after it: its fact, aftermath and any change of belief. */
export function rollSocial(s: SocialSetup, roller: Roller, when: { readonly now: number; readonly witnesses?: readonly Id[] }): { readonly truth: Omit<SocialTruth, 'facts'>; readonly next: (data: CastRecord) => { data: CastRecord; facts: Fact[] } } {
  const { active, passive, edges } = partsOf(s);
  const check = resolveOpposed({ active: d20(truthOf(active), edgeFor(edges[0], null)), passive: d20(truthOf(passive), edgeFor(edges[1], null)) }, roller);
  const ending: Ending = check.outcome === 'critical-failure' && provokes(s) ? 'provoked' : check.outcome;
  // (a plan's advantage, if either roll was its chosen check, is used up)
  const used = (d: CastRecord) => edges.reduce((x, a) => (a.truth && a.job ? { ...x, jobs: usingAdvantage(x.jobs, a.job) } : x), d);
  return { truth: { action: s.action, ending, check }, next: (data) => applySocial(used(data), s, ending, when) };
}

function applySocial(data: CastRecord, s: SocialSetup, ending: Ending, when: { readonly now: number; readonly witnesses?: readonly Id[] }): { data: CastRecord; facts: Fact[] } {
  const { actor, target, action } = s;
  const { now, witnesses = [] } = when;
  const facts: Fact[] = [];
  let d = data;
  let about: FactId | undefined;
  if (action === 'deceive' && s.claim && 'invented' in s.claim) {
    const self: Version = { learnedAt: now, source: 'self', how: 'seen', knowsActor: true, knownFalse: true };
    const made = recordFact(d, { ...s.claim.invented, invented: actor.id }, { now, learners: new Map([[actor.id, self]]), meets: new Map() });
    d = made.data;
    facts.push(made.fact);
    about = made.fact.id;
  } else if (s.claim && !('invented' in s.claim)) about = s.claim.about;
  const lie = action === 'deceive';
  const seenIt: Version = { learnedAt: now, source: 'witness', how: 'seen', knowsActor: true };
  const recorded = recordFact(
    d,
    { kind: SOCIAL_ACTION_INFO[action].fact, actor: actor.id, victim: target.id, ending, ...(about !== undefined && { cause: about }), ...(s.claim && { claim: claimOf(s.claim) }) },
    lie
      ? {
          now,
          learners: new Map([[actor.id, { learnedAt: now, source: 'self', how: 'seen', knowsActor: true }], ...(ending === 'critical-failure' ? [[target.id, seenIt] as const] : [])]),
          meets: allMeet([actor.id, target.id, ...witnesses]),
        }
      : { now, witnesses },
  );
  d = recorded.data;
  facts.push(recorded.fact);
  const why = recorded.fact.id;
  const trusted = (target.relationships[actor.id]?.trust ?? 0) >= HIGH;
  for (const [who, conduct] of conductOf(action, ending, trusted)) d = withCharacter(d, who === 'actor' ? actor.id : target.id, (c) => withConduct(c, conduct, now, { fact: why }));
  for (const a of AFTERMATH[action][ending] ?? []) {
    const [who, other] = a.whose === 'target' ? [target.id, actor.id] : [actor.id, target.id];
    // (actor and target have just met over the roll's fact, so each has a relationship with the other)
    d = withCharacter(d, who, (c) => ({ ...c, relationships: { ...c.relationships, [other]: feel(c.relationships[other]!, a.feeling, a.amount, { now, why }) } }));
  }
  if (action === 'intimidate' && ending !== 'provoked' && succeeded(ending)) d = withCharacter(d, target.id, (c) => ({ ...c, condition: { ...c.condition, effects: [...c.condition.effects, 'shaken'] } }));
  if (lie && ending !== 'provoked' && succeeded(ending)) d = believe(d, s, about!, now);
  return { data: d, facts };
}

/** The conduct a social roll is for each of the two: what the actor chose to do, and how the target reacted or what was done to them. */
function conductOf(action: SocialAction, ending: Ending, trusted: boolean): (readonly [whose: 'actor' | 'target', conduct: Conduct])[] {
  const gaveIn = ending !== 'provoked' && succeeded(ending);
  switch (action) {
    case 'intimidate':
      return [['actor', 'intimidating'], ['target', gaveIn ? 'giving-in-to-a-threat' : 'standing-up-to-a-threat'], ...(ending === 'provoked' ? [['target', 'losing-their-temper'] as const] : [])];
    case 'persuade':
      return [['actor', 'persuading']];
    case 'deceive':
      return [['actor', 'lying'], ...(trusted ? [['actor', 'lying-to-the-trusting'] as const] : []), ...(ending === 'critical-failure' ? [['target', 'lied-to'] as const] : [])];
  }
}

/** A lie believed: the target's version changes by re-belief, with the liar as its source; feelings follow whom they now believe did it. */
function believe(data: CastRecord, s: SocialSetup, about: FactId, now: number): CastRecord {
  const claim = s.claim!;
  const f = data.facts.find((x) => x.id === about)!;
  const liar = s.actor.id;
  const liars = data.characters.find((c) => c.id === liar)!.knowledge[about]!;
  // a lie is told as something the liar saw, so the part it changes comes from them as from a witness
  const from = { how: 'told' as const, teller: liar };
  return withCharacter(data, s.target.id, (c) => {
    // (toldVersion passes on what the liar says, never that they know it is false)
    if ('invented' in claim) return learnFact(c, f, toldVersion(liar, liars, now), now);
    const base = c.knowledge[about] ?? toldVersion(liar, liars, now);
    const after = rebelieve(base, 'blame' in claim ? { part: 'who', knowsActor: false, blame: claim.blame, from } : { part: 'size', exaggerated: claim.exaggerated, from });
    return learnFact(c, f, after, now);
  });
}

/** What a lie fact records of its claim. */
function claimOf(claim: Claim): LieClaim {
  return 'invented' in claim ? { invented: true } : 'blame' in claim ? { blame: claim.blame } : { exaggerated: claim.exaggerated };
}

/** A social check before it is rolled: given more modifiers, asked its odds and explanation for a viewer, then rolled. */
export interface SocialCheck<C extends CastLike = CastLike> {
  readonly action: SocialAction;
  /** The same check with a situational modifier on the actor's roll, which anyone present knows of. */
  with(modifier: Modifier): SocialCheck<C>;
  /** The chance of each ending, as the viewer can judge it. */
  odds(o: { readonly for: Viewer }): Readonly<Record<Ending, number>>;
  /** The modifiers the viewer knows of, with their reasons. */
  explain(o: { readonly for: Viewer }): Explanation;
  /** Rolls it at `now`: refused if the cast it came from has been replaced. */
  roll(roller: Roller, when: { readonly now: number; readonly witnesses?: readonly Id[] }): SocialOutcome<C>;
}

export interface SocialOutcome<C extends CastLike = CastLike> {
  /** The new cast, with the roll's facts, aftermath and any change of belief. */
  readonly cast: C;
  /** What really happened: for the simulation and tests, never shown to a character. */
  readonly truth: SocialTruth;
  /** The result as the viewer saw it. */
  result(o: { readonly for: Viewer }): SeenResult;
}

/** Just what a social check needs of a cast and a character handle, so this module does not depend on cast.ts at run time. */
export interface CastLike {
  readonly data: CastRecord;
}
export interface Viewer {
  readonly id: Id;
  readonly name: string;
  readonly cast: CastLike;
}

const setups = new WeakMap<SocialCheck<CastLike>, SocialSetup>();

/** The true chance of each ending: what the roll uses. For tests; never shown to a character. */
export function trueOdds(check: SocialCheck<CastLike>): Readonly<Record<Ending, number>> {
  return oddsFor(setups.get(check)!, null);
}

/** A social check over a setup, made from `owner`, whose changes go through `commit`. */
export function socialCheck<C extends CastLike>(setup: SocialSetup, owner: C, commit: (next: (data: CastRecord) => CastRecord) => C): SocialCheck<C> {
  assertSetup(setup);
  const viewerIn = (v: Viewer, ...casts: CastLike[]) => {
    if (!casts.includes(v.cast)) throw new RangeError(`${v.name} is from another cast`);
    return v.id;
  };
  const check: SocialCheck<C> = {
    action: setup.action,
    with: (modifier) => socialCheck({ ...setup, extra: [...setup.extra, modifier] }, owner, commit),
    odds: ({ for: v }) => oddsFor(setup, viewerIn(v, owner)),
    explain: ({ for: v }) => explainFor(setup, viewerIn(v, owner)),
    roll(roller, when) {
      // everyone in it must be there: the two of them and any witnesses, conscious and not resting
      const there = [setup.actor.id, setup.target.id, ...(when.witnesses ?? [])].map((id) => setup.data.characters.find((c) => c.id === id));
      for (const c of there) if (c) assertAvailable(c, when.now, 'be there');
      const { truth, next } = rollSocial(setup, roller, when);
      let facts: Fact[] = [];
      const cast = commit((d) => {
        const applied = next(d);
        facts = applied.facts;
        return applied.data;
      });
      const info = SOCIAL_ACTION_INFO[setup.action];
      return {
        cast,
        truth: { ...truth, facts },
        result: ({ for: v }) => {
          const id = viewerIn(v, owner, cast);
          if (!there.some((c) => c?.id === id)) return { action: setup.action, ending: null, explanation: null };
          return { action: setup.action, ending: id === setup.target.id ? truth.ending : info.appearance[truth.ending]!, explanation: explainFor(setup, id) };
        },
      };
    },
  };
  setups.set(check, setup);
  return check;
}
