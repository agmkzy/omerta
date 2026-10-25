// Gate 2b, priority 1: one model of decision. In a world running the conversation layer, the world's asks (asks.ts) carry out what
// people decide, and what they decide is the conversation layer's: the same respond functions, on the man's own perception, whether
// the player asks him or another man does. Registered on asks.DECIDERS for the kinds this layer covers; the others keep their own
// weighing for now (docs/gate2b/REPORT.md lists them).
import { askStance, askTried, DECIDERS, kindOf, leverageOf, type Decided } from '../asks';
import { ASKS } from '../askkinds';
import { ownerBiz } from '../core';
import { classOf } from '../exchange';
import type { Character, Situation, World } from '../types';
import { newSession, perceive } from './perception';
import { EncounterMemory } from './encounter';
import { onAsk, onHelp, onLayoff, onLoanRequest, onPress, onProtectionDemand, type Reply } from './respond';
import { offender } from './obligations';
import { superiors } from './authority';
import { breakWish } from './obey';
import { enter } from './annals';

const famName = (w: World, c: Character) => (c.familyId ? w.fam[c.familyId]?.name : undefined);
const asked = (w: World, s: Situation, a: Character, t: Character) => {
  // a man who comes asking for a shop's money says who he is with (the ask itself is that claim)
  const sess = newSession(), fam = famName(w, a);
  if (fam) sess.told[t.id] = { [a.id]: { family: fam, name: a.name, basis: { kind: 'claimed', ref: 'he said who he was with' } } };
  return perceive(w, sess, t);
};
const note = (w: World, who: Character, other: Character, what: string, reply: Reply) => enter({ t: w.now, who: who.id, with: other.id, what, reply });

DECIDERS.answer.protect = (w, s, a, t) => {
  const A = askStance(w, s, a.id), pressed = askTried(A, 'pressure') + askTried(A, 'force') > 0;
  const r = onProtectionDemand(asked(w, s, a, t), a, s.terms?.amt ?? 0, pressed ? 'lean' : 'plain');
  note(w, t, a, `${t.name} answers ${a.name}'s demand: ${r.decision.chosen}`, r);
  const m = r.decision.chosen;
  // (a man who refuses because another man already looks after him, and is leaned on for it, or asked once too often, goes to that
  // man: the world's rule for a demand, asks.seekHelp, kept in the one decision model. Gate 4: in every world, not only those that had
  // switched the layer on)
  const T = askStance(w, s, t.id), protectedBy = (r.meaning.grounds ?? '').startsWith('hasArrangement');
  const goes = m === 'refuse' && ((protectedBy && pressed) || askTried(T, 'no') >= 2);
  const d: Decided = m === 'accept' ? { move: 'yes' } : m === 'counter' ? { move: 'counter', amt: r.counterAmt, why: r.meaning.grounds ?? 'that’s what the place can carry' } : m === 'refer' || goes ? { move: 'help' } : { move: 'no' };
  return d;
};
DECIDERS.answer.layoff = (w, s, a, t) => {
  const forC = w.chars[String(s.m?.for ?? '')], f = s.m?.fact ? w.facts[String(s.m.fact)] : undefined;
  if (!forC) return undefined;
  const r = onLayoff(perceive(w, newSession(), t), a, forC, superiors(w, t).some((x) => x.id === a.id), f ? offender(f) === t.id : true);
  note(w, t, a, `${t.name}, told by ${a.name} to leave ${forC.name} alone: ${r.decision.chosen}`, r);
  return { move: r.decision.chosen === 'agree' ? 'yes' : 'no' };
};
DECIDERS.answer.warn = (w, s, a, t) => {
  const o = (w.situations ?? []).find((x) => x.id === String(s.m?.about)), forC = o?.terms?.of ? w.chars[o.terms.of] : undefined;
  if (!forC) return undefined;
  const r = onLayoff(perceive(w, newSession(), t), a, forC, superiors(w, t).some((x) => x.id === a.id), true);
  note(w, t, a, `${t.name}, warned off ${forC.name} by ${a.name}: ${r.decision.chosen}`, r);
  return { move: r.decision.chosen === 'agree' ? 'yes' : 'no' };
};
DECIDERS.answer.help = (w, s, a, t) => {
  const o = (w.situations ?? []).find((x) => x.id === String(s.m?.about)), trouble = o?.terms?.by ? w.chars[o.terms.by] : undefined;
  if (!trouble) return undefined;
  const r = onHelp(perceive(w, newSession(), t), a, trouble, ownerBiz(w, a.id)?.protection?.collectorId === t.id);
  note(w, t, a, `${t.name}, asked by ${a.name} to deal with ${trouble.name}: ${r.decision.chosen}`, r);
  return { move: r.decision.chosen === 'yes' ? 'yes' : 'no' };
};
DECIDERS.answer.borrow = (w, s, a, t) => {
  const r = onLoanRequest(perceive(w, newSession(), t), a, s.terms?.amt ?? 0, new EncounterMemory(2));
  note(w, t, a, `${t.name}, asked by ${a.name} for $${s.terms?.amt ?? 0}: ${r.decision.chosen}`, r);
  return r.decision.chosen === 'accept' ? { move: 'yes' } : r.counter ? { move: 'counter', amt: r.counter.amt, why: 'that’s what I can spare' } : { move: 'no' };
};
// Every other kind: the general decision, with the kind's own valuation of what is asked as one of its terms (deliberately kept on the
// kind: what a loan, a start, a cut or a shop is worth to a man is the kind's domain knowledge, from his real state; deciding is ours)
const general = (w: World, s: Situation, a: Character, t: Character): Decided | undefined => {
  const K = kindOf(s);
  if (!K) return undefined;
  const S = askStance(w, s, t.id), worth = K.lean(w, s, a, t), c = K.counter?.(w, s, a, t);
  const r = onAsk(perceive(w, newSession(), t), a, worth, { fear: S.fear, good: S.good, anger: S.anger, resolve: S.resolve, canCounter: !!c && S.last !== 'counter', asked: askTried(S, 'stalled') });
  note(w, t, a, `${t.name}, asked by ${a.name} (${s.ak}): ${r.decision.chosen}`, r);
  // (a demand refused for the third time: he goes to someone, the world's rule for a demand, asks.seekHelp)
  if (r.decision.chosen === 'no' && classOf(s) === 'demand' && askTried(S, 'no') >= 2) return { move: 'help' };
  return { move: r.decision.chosen as Decided['move'], ...(r.decision.chosen === 'counter' && c ? { amt: c.amt, why: c.why } : {}) };
};
// The asker's next move, for every kind: the same general decision (onPress), the kind saying only which moves make sense in it
const press = (w: World, s: Situation, a: Character, t: Character) => {
  const K = kindOf(s);
  if (!K) return undefined;
  const S = askStance(w, s, t.id), A = askStance(w, s, a.id), wish = s.ak === 'protect' ? breakWish(w, a, t.id, s.biz) : undefined;
  const offer = Number(s.m?.offer ?? 0), first0 = s.terms?.first ?? s.terms?.amt ?? 0;
  const r = onPress(perceive(w, newSession(), a), t, { last: S.last, rounds: Object.values(A.tried ?? {}).reduce((x, y) => x + y, 0), refusals: askTried(S, 'no'), offerFair: first0 && offer ? (K.low ? first0 / offer : offer / first0) : 1, canSweeten: K.better?.(w, s) !== undefined, canForce: !!K.force && (a.cooldown.restraint ?? 0) <= w.now, canLeverage: !!leverageOf(w, a, t), bound: wish === undefined || wish > 0 ? 0 : 1, tried: A.tried ?? {} });
  const allowed = (m: string) => !K.moves || K.moves.includes(m as never) || m === 'drop' || m === 'wait';
  const ranked = [...r.decision.candidates].filter((x) => x.value > -9 && allowed(x.move)).sort((x, y) => y.value - x.value);
  if (s.ak === 'protect') note(w, a, t, `${a.name}'s next move on ${t.name}: ${ranked[0]?.move}`, r);
  return ranked[0]?.move as 'ask' | undefined;
};
DECIDERS.answer['*'] = general; DECIDERS.move['*'] = press;
export const SPECIFIC = Object.keys(DECIDERS.answer).filter((k) => k !== '*');
void ASKS;
