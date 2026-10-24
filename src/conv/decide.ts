// How a man decides, in the conversation layer's own record (Decision: the moves he had, what each was worth to him, term by term,
// and which he took). Two kinds of decision, as the world's rules have them:
//  - weighed: the move worth most to him wins (respond.ts's way);
//  - chance: the world's rules give odds rather than a certainty (whether a man opens up, admits a thing, pays when reminded). The
//    odds are built term by term and the world's dice are rolled once, exactly as the rule always did, so the same seed and the same
//    choices give the same history; the roll is kept with the decision, so the developer view can say why it went the way it did.
import { clamp } from '../core';
import type { Id, World } from '../types';
import type { Candidate, Decision, Term } from './types';

const r2 = (x: number) => Math.round(x * 100) / 100;
export const term = (name: string, value: number): Term => ({ name, value: r2(value) });
export const cand = (move: string, terms: Term[]): Candidate => ({ move, terms: terms.map((t) => ({ ...t, value: r2(t.value) })), crosses: [], value: r2(terms.reduce((a, t) => a + t.value, 0)) });

// the move worth most to him (ties go to the first listed)
export function weigh(by: Id, cs: Candidate[], aim?: string): Decision {
  const best = cs.filter((c) => c.value > -9).reduce((a, c) => (c.value > a.value ? c : a), cs[0]);
  return { by, constraints: [], candidates: cs, chosen: best.move, aim };
}
// a yes-or-no the world's rules leave to chance: the odds (the sum of the terms, held between lo and hi), one roll of the world's dice
export function chance(w: World, by: Id, yes: string, no: string, terms: Term[], lo = 0, hi = 1, aim?: string): Decision & { yes: boolean; odds: number } {
  const raw = terms.reduce((a, t) => a + t.value, 0), odds = clamp(raw, lo, hi);
  const roll = w.rng.next(), ok = roll < odds;
  const held = raw !== odds ? [term(raw > odds ? `no better than ${r2(hi)}` : `no worse than ${r2(lo)}`, odds - raw)] : [];
  return { by, constraints: [], candidates: [{ move: yes, value: r2(odds), terms: [...terms, ...held].map((t) => ({ ...t, value: r2(t.value) })), crosses: [] }, { move: no, value: r2(1 - odds), terms: [term('the rest of the odds', 1 - odds)], crosses: [] }, { move: `(the roll: ${r2(roll)})`, value: -10, terms: [], crosses: [] }], chosen: ok ? yes : no, aim, yes: ok, odds };
}
// a decision with only one honest move (he does what the rules say he does), kept so every line has a reason in the record
export const settled = (by: Id, move: string, why: string, value = 1): Decision => ({ by, constraints: [], candidates: [cand(move, [term(why, value)])], chosen: move });
