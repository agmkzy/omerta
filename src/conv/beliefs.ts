// Claims and beliefs (spec §5.2–5.3), minimal for Gate 1. A claim is what a man said; whether it is true is the simulation's
// knowledge (`honest`), kept for consequences and tests and never used by a listener. A listener's belief is computed from his own
// perception: how far he trusts the man, and what else he holds about the same thing. Two claims he holds that disagree are a
// contradiction he can act on; the truth is never what tells him.
import type { Character, Id } from '../types';
import type { Perception } from './perception';
import type { BasisKind } from './types';

export interface Claim { id: string; by: Id; to: Id; subject: string; value: string | number; t: number; honest: boolean; words: string; basis?: BasisKind }
export class ClaimStore {
  claims: Claim[] = [];
  private n = 0;
  add(c: Omit<Claim, 'id'>): Claim { const x = { ...c, id: 'cl' + ++this.n }; this.claims.push(x); return x; }
  heardBy(listener: Id, subject: string) { return this.claims.filter((c) => c.to === listener && c.subject === subject); }
}
// How far he believes it, and why: trust in the teller, and how it sits with anything else he holds about it.
export function believe(p: Perception, store: ClaimStore, claim: Claim, teller: Character): { belief: number; basis: string[] } {
  const f = p.feelingFor(teller);
  const others = store.heardBy(p.self.id, claim.subject).filter((c) => c.id !== claim.id && c.value !== claim.value);
  let b = 0.35 + f.trust * 0.5 + f.known * 0.1 - p.temper.caution * 0.1;
  const basis = [`trust in ${teller.name} ${f.trust.toFixed(2)}`];
  // what he says it rests on: a man who saw it, or whose loss it was, counts for more than a man repeating what he heard
  if (claim.basis === 'seen' || claim.basis === 'own') { b += 0.1; basis.push(claim.basis === 'seen' ? 'he says he saw it' : 'it was done to him'); }
  else if (claim.basis === 'rumour' || claim.basis === 'told') { b -= 0.1; basis.push('he only heard it'); }
  if (others.length) { b -= 0.25; basis.push(`he has heard otherwise from ${others.length} other${others.length > 1 ? 's' : ''}`); }
  return { belief: Math.max(0, Math.min(1, Math.round(b * 100) / 100)), basis };
}
// Claims he holds about one thing that cannot both be true.
export function contradictions(p: Perception, store: ClaimStore): { subject: string; a: Claim; b: Claim }[] {
  const mine = store.claims.filter((c) => c.to === p.self.id);
  const out: { subject: string; a: Claim; b: Claim }[] = [];
  for (const a of mine) for (const b of mine) if (a.id < b.id && a.subject === b.subject && a.value !== b.value && a.by !== b.by) out.push({ subject: a.subject, a, b });
  return out;
}
