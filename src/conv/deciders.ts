// Gate 2b, priority 1: one model of decision. In a world running the conversation layer, the world's asks (asks.ts) carry out what
// people decide, and what they decide is the conversation layer's: the same respond functions, on the man's own perception, whether
// the player asks him or another man does. Registered on asks.DECIDERS for the kinds this layer covers; the others keep their own
// weighing for now (docs/gate2b/REPORT.md lists them).
import { askStance, askTried, DECIDERS, type Decided } from '../asks';
import { ownerBiz } from '../core';
import type { Character, Situation, World } from '../types';
import { newSession, perceive } from './perception';
import { EncounterMemory } from './encounter';
import { onHelp, onLayoff, onLoanRequest, onPressDemand, onProtectionDemand, type Reply } from './respond';
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
  const d: Decided = m === 'accept' ? { move: 'yes' } : m === 'counter' ? { move: 'counter', amt: r.counterAmt, why: r.meaning.grounds ?? 'that’s what the place can carry' } : m === 'refer' ? { move: 'help' } : { move: 'no' };
  return d;
};
DECIDERS.move.protect = (w, s, a, t) => {
  const S = askStance(w, s, t.id), A = askStance(w, s, a.id);
  if (S.last === 'counter') {
    const offer = Number(s.m?.offer ?? 0), first = s.terms?.first ?? s.terms?.amt ?? 1;
    return offer / first >= 0.6 || a.traits.caution > 0.5 ? 'take' : 'pressure';
  }
  const wish = breakWish(w, a, t.id, s.biz);
  const r = onPressDemand(perceive(w, newSession(), a), t, askTried(S, 'no'), Object.values(A.tried ?? {}).reduce((x, y) => x + y, 0), wish === undefined || wish > 0 ? 0 : 1);
  note(w, a, t, `${a.name}'s next move on ${t.name}: ${r.decision.chosen}`, r);
  return r.decision.chosen as 'ask' | 'pressure' | 'force' | 'wait' | 'drop';
};
DECIDERS.answer.layoff = (w, s, a, t) => {
  const forC = w.chars[String(s.m?.for ?? '')], f = s.m?.fact ? w.facts[String(s.m.fact)] : undefined;
  if (!forC) return undefined;
  const r = onLayoff(perceive(w, newSession(), t), a, forC, superiors(w, t).some((x) => x.id === a.id), f ? f.actor === t.id : true);
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
export const DECIDED = Object.keys(DECIDERS.answer);
