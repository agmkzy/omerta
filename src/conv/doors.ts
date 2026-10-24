// The action catalogue (spec §3.2): everything the conversation layer does to the world goes through here, and everything here goes
// through a door the world already has. Nothing in src/conv writes a world record directly (architecture test: conv/integration).
// Each action leaves an act record (social.log) that obligations are kept or broken by, and, where the world records it, a fact.
import { addFact, bear, compat, feel, knowMore, learn, rel, transfer } from '../core';
import { addFavour } from '../encounters';
import { discipline as booksDiscipline } from '../books';
import { agreeAsk, askBetween, layoffFor, move as askMove, openAsk } from '../asks';
import type { Character, Fact, Id, Situation, World } from '../types';
import type { Act } from './obligations';
import { social, sid } from './social';

function record(w: World, a: Omit<Act, 'id' | 't'>): Act {
  const s = social(w), x: Act = { ...a, id: sid(s, 'a'), t: w.now };
  s.log.push(x);
  return x;
}

// inform: he tells another what he knows of an event (core.learn: the listener now knows it, from him, as far as the teller did)
export function inform(w: World, teller: Character, listener: Character, f: Fact, about: string): Act {
  learn(w, listener.id, f, teller.id, teller.known[f.id]?.knowsActor ?? !f.hiddenActor);
  return record(w, { actor: teller.id, act: 'inform', target: listener.id, about, fact: f.id });
}
// raise: he takes a matter to a man (the request itself is the act; conv/requests records it)
export function raise(w: World, asker: Character, of: Character, about: string, predicted?: number, best?: boolean): Act {
  return record(w, { actor: asker.id, act: 'raise', target: of.id, about, predicted, best });
}
// order: a superior tells his man to leave someone alone (asks.layoffFor: the world's own "have a word"; its lifecycle decides
// whether the man agrees, and what agreeing does)
export function order(w: World, superior: Character, man: Character, forC: Character, about: string, fact?: Id): { act: Act; sit?: Situation } {
  const sit = layoffFor(w, superior, man, forC, fact);
  return { act: record(w, { actor: superior.id, act: 'order', target: man.id, about }), sit };
}
// demand: a collector asks a shop to pay (asks.openAsk 'protect' and the asker's first move)
export function demand(w: World, collector: Character, owner: Character, bizId: Id, fee: number, about: string): { act: Act; sit?: Situation; answer?: string } {
  const sit = askBetween(w, 'protect', collector.id, owner.id, bizId) ?? openAsk(w, 'protect', collector, owner, { biz: bizId, amt: fee, why: `${collector.name} wants ${owner.name} to pay him` });
  const out = sit ? askMove(w, sit, 'ask') : undefined;
  return { act: record(w, { actor: collector.id, act: 'demand', target: owner.id, about }), sit, answer: out?.answer };
}
// harm, by pressing a demand with force (the ask kind's own force: damage, a fact, the protector told)
export function force(w: World, sit: Situation, about: string): Act | undefined {
  const by = sit.terms?.by, of = sit.terms?.of;
  if (!by || !of) return undefined;
  askMove(w, sit, 'force');
  return record(w, { actor: by, act: 'harm', target: of, about });
}
// withdraw: he lets a demand drop (the asker's own move)
export function withdraw(w: World, sit: Situation, about: string): Act | undefined {
  const by = sit.terms?.by;
  if (!by) return undefined;
  askMove(w, sit, 'drop');
  return record(w, { actor: by, act: 'withdraw', target: sit.terms?.of, about });
}
// agree: a yes decided by the conversation layer, carried out by the ask kind's own effects (asks.agreeAsk)
export function agree(w: World, sit: Situation, about: string): Act | undefined {
  const by = sit.terms?.of;
  if (!by) return undefined;
  agreeAsk(w, sit);
  return record(w, { actor: by, act: 'agree', target: sit.terms?.by, about });
}
// pay: money from one man to another (core.transfer: the one door for it)
export function pay(w: World, from: Character, to: Character, amt: number, why: string, about = ''): Act | undefined {
  if (Math.round(amt) <= 0 || from.cash < Math.round(amt)) return undefined;
  const x = transfer(w, from, to, amt, 'gift', why);
  return record(w, { actor: from.id, act: 'pay', target: to.id, about, amt: x });
}
// favour: one man now owes another (encounters.addFavour)
export function favour(w: World, from: Character, to: Character, size: number, what: string, about = ''): Act {
  addFavour(w, from.id, to.id, size, what);
  return record(w, { actor: from.id, act: 'favour', target: to.id, about });
}
// what a man thinks of another moves (core.feel / core.bear): the one door for regard and grudges
export const regard = (w: World, who: Character, about: Id, f: 'trust' | 'respect' | 'affection' | 'fear', amt: number, why: string) => feel(w, who, about, f, amt, why);
export const grudge = (w: World, who: Character, against: Id, amt: number, why: string) => bear(w, who, against, amt, why);
// something that happened between men, on record for those who were there (core.addFact)
export const happened = addFact;
// discipline: a superior punishes a man for going against him (books.discipline: what the family does to a man who crosses it)
export function discipline(w: World, boss: Character, man: Character, cause: Id, amt: number, about = ''): Act {
  booksDiscipline(w, boss, man, cause, amt);
  return record(w, { actor: boss.id, act: 'discipline', target: man.id, about });
}
// spend time: an evening together (core.knowMore, and liking by how well they get on: core.compat)
export function spendTime(w: World, a: Character, b: Character, about = ''): Act {
  knowMore(a, b, 0.08);
  const c = compat(w, a, b);
  if (Math.abs(c) > 0.1) { feel(w, b, a.id, 'affection', c * 0.1, 'an evening together'); feel(w, a, b.id, 'affection', c * 0.1, 'an evening together'); }
  if (c > 0.15) feel(w, b, a.id, 'trust', 0.03, 'an evening together');
  return record(w, { actor: a.id, act: 'spendTime', target: b.id, about });
}
// met: two men have met (the world's record of it, Rel.lastMet, which the weekly fading of trust and liking reads, core.feelingsWeek)
export function met(w: World, a: Character, b: Character): void { rel(a, b.id).lastMet = rel(b, a.id).lastMet = w.now; }
// introduce: the player and a man now know each other by name (the player's record of who he has met; core.knowMore)
export function introduce(w: World, p: Character, t: Character): void {
  if (!p.intro?.[t.id]) (p.intro ??= {})[t.id] = w.now;
  if ((t.rels[p.id]?.known ?? 0) < 0.1) knowMore(p, t, 0.1);
}
