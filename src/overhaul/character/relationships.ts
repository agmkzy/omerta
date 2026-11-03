// Relationships: how one character feels about another, one-way, holding what the game's Rel holds (src/types.ts). Every
// change to a feeling goes through `feel`, modelled on the game's feelOn: a gain shrinks as the feeling nears 1, gains in
// trust and affection are smaller between people who barely know each other, and losses are not damped. Grudges and
// familiarity change through it too. See docs/overhaul/plans/character/README.md (Relationships).
import type { Modifier } from './check';
import type { FactId } from './facts';
import { leaning } from './temperament';
import { DAY } from './time';

export const FEELINGS = ['trust', 'respect', 'affection', 'grudge', 'fear', 'familiarity'] as const;
export type Feeling = (typeof FEELINGS)[number];

/** What a grudge, or a character's regard (their trust and affection), rests on: the fact that did most to raise it lately. */
export interface Reason {
  readonly fact: FactId;
  /** When it raised the feeling, in minutes. */
  readonly at: number;
  /** How much it raised it. */
  readonly amount: number;
}

export interface Relationship {
  readonly trust: number;
  readonly respect: number;
  readonly affection: number;
  readonly grudge: number;
  readonly fear: number;
  /** How well they know each other. */
  readonly familiarity: number;
  /** When they last met, in minutes; absent if they have only learned about each other. */
  readonly lastMet?: number;
  readonly grudgeReason?: Reason;
  readonly regardReason?: Reason;
}

export type Relationships = Readonly<Record<string, Relationship>>;

/** A new relationship: trust, respect and affection in the middle, no grudge, fear or familiarity. */
export const NEW_RELATIONSHIP: Relationship = { trust: 0.5, respect: 0.5, affection: 0.5, grudge: 0, fear: 0, familiarity: 0 };

/** How much familiarity grows each time two characters meet, before damping. */
export const MEETING = 0.02;

/** The least share of a gain that is kept, however near 1 the feeling is. */
const LEAST_GAIN = 0.15;
/** A grudge below this is gone, and so is its reason. */
const GRUDGE_GONE = 0.05;

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The relationship with `amount` added to a feeling (negative to lower it). A gain is damped: by how near 1 the feeling is,
 * and for trust and affection by how little they know each other. `why` is the fact behind it, kept as the grudge's or the
 * regard's reason where it did most lately.
 */
export function feel(r: Relationship, feeling: Feeling, amount: number, when: { readonly now: number; readonly why?: FactId }): Relationship {
  const v = r[feeling];
  let d = amount;
  if (amount > 0) {
    d = amount * Math.max(LEAST_GAIN, 1 - v);
    if (feeling === 'trust' || feeling === 'affection') d *= 0.4 + 0.6 * r.familiarity;
  }
  const next: Relationship = { ...r, [feeling]: clamp(v + d) };
  const raised = next[feeling] - v;
  const { why, now } = when;
  if (raised > 0 && why !== undefined) {
    if (feeling === 'grudge') return { ...next, grudgeReason: pick(r.grudgeReason, { fact: why, at: now, amount: raised }) };
    if (feeling === 'trust' || feeling === 'affection') return { ...next, regardReason: pick(r.regardReason, { fact: why, at: now, amount: raised }) };
  }
  if (feeling === 'grudge' && next.grudge < GRUDGE_GONE) {
    const { grudgeReason: _gone, ...rest } = next;
    return rest;
  }
  return next;
}

/** The reason kept is the one that did most lately: a small thing does not replace a big one, but a month-old one gives way. */
function pick(current: Reason | undefined, candidate: Reason): Reason {
  return current && candidate.amount < current.amount * 0.5 && candidate.at - current.at < 30 * DAY ? current : candidate;
}

/** Two characters meeting: they know each other a little better, and when they last met is now. */
export function meet(r: Relationship, now: number): Relationship {
  return { ...feel(r, 'familiarity', MEETING, { now }), lastMet: now };
}

export type SocialAction = 'persuade' | 'deceive' | 'intimidate';

interface FeelingRule {
  readonly action: SocialAction;
  /** Whose feelings: the target's about the actor, or the actor's about the target. */
  readonly whose: 'target' | 'actor';
  readonly feeling: Feeling;
  readonly when: 'high' | 'low';
  readonly value: number;
}

/** How feelings modify social checks, every modifier on the actor's roll, the target's feelings first. High and low are as for temperament. */
export const FEELING_RULES: readonly FeelingRule[] = [
  { action: 'persuade', whose: 'target', feeling: 'trust', when: 'high', value: 2 },
  { action: 'persuade', whose: 'target', feeling: 'trust', when: 'low', value: -2 },
  { action: 'persuade', whose: 'target', feeling: 'affection', when: 'high', value: 1 },
  { action: 'persuade', whose: 'target', feeling: 'grudge', when: 'high', value: -2 },
  { action: 'deceive', whose: 'target', feeling: 'trust', when: 'high', value: 2 },
  { action: 'deceive', whose: 'target', feeling: 'familiarity', when: 'high', value: -1 },
  { action: 'deceive', whose: 'target', feeling: 'grudge', when: 'high', value: -1 },
  { action: 'intimidate', whose: 'target', feeling: 'fear', when: 'high', value: 2 },
  { action: 'intimidate', whose: 'target', feeling: 'respect', when: 'high', value: 1 },
  { action: 'intimidate', whose: 'target', feeling: 'grudge', when: 'high', value: -1 },
  { action: 'persuade', whose: 'actor', feeling: 'familiarity', when: 'high', value: 1 },
  { action: 'deceive', whose: 'actor', feeling: 'affection', when: 'high', value: -1 },
  { action: 'intimidate', whose: 'actor', feeling: 'affection', when: 'high', value: -1 },
  { action: 'intimidate', whose: 'actor', feeling: 'grudge', when: 'high', value: 1 },
  { action: 'intimidate', whose: 'actor', feeling: 'fear', when: 'high', value: -2 },
];

/** How a feeling reads in an explanation, `{a}` feeling it about `{b}`: "Rico trusts Sam", "Rico knows Sam well". */
const PHRASES: { readonly [F in Feeling]: { readonly high: string; readonly low: string } } = {
  trust: { high: '{a} trusts {b}', low: '{a} distrusts {b}' },
  respect: { high: '{a} respects {b}', low: '{a} looks down on {b}' },
  affection: { high: '{a} is fond of {b}', low: '{a} dislikes {b}' },
  grudge: { high: '{a} bears a grudge against {b}', low: '{a} bears {b} no grudge' },
  fear: { high: '{a} fears {b}', low: '{a} does not fear {b}' },
  familiarity: { high: '{a} knows {b} well', low: '{a} barely knows {b}' },
};

export interface Side {
  readonly name: string;
  /** How they feel about the other; absent if they are strangers. */
  readonly towards?: Relationship;
}

/** The feelings' modifiers on a social check, the target's first, in FEELING_RULES order. Strangers give none. */
export function feelingModifiers(action: SocialAction, actor: Side, target: Side): Modifier[] {
  return FEELING_RULES.filter((r) => r.action === action).flatMap((r) => {
    const [who, other] = r.whose === 'target' ? [target, actor] : [actor, target];
    if (who.towards === undefined || leaning(who.towards[r.feeling]) !== r.when) return [];
    return [{ value: r.value, reason: PHRASES[r.feeling][r.when].replace('{a}', who.name).replace('{b}', other.name) }];
  });
}

/** Throws RangeError for a relationship whose feelings are not each from 0 to 1, or whose times are not whole minutes. */
export function assertRelationship(r: Relationship, what: string): void {
  for (const f of FEELINGS) if (!(r[f] >= 0 && r[f] <= 1)) throw new RangeError(`${what}: ${f} runs from 0 to 1, got ${r[f]}`);
  for (const t of [r.lastMet, r.grudgeReason?.at, r.regardReason?.at]) if (t !== undefined && !(Number.isInteger(t) && t >= 0)) throw new RangeError(`${what}: a time is a whole number of minutes from 0, got ${t}`);
}

