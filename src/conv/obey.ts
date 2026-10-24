// Keeping one's word at the moment it is tested (spec §4.4, §6.6). A man bound to leave someone alone (an order he accepted, a promise
// he made) is not decided once and for all: each time the chance comes (a shop he could lean on, a grudge he could settle, a plan he
// had already made) he weighs it again, from what he feels now: fear of the man he answers to, regard for him, his own caution, against
// his grudge, his need, his temper, and what breaking it costs. Breaking it is his explicit choice (`violate`), and the trace says so.
// Read by the NPC action scorer (actions.ts), planned revenge (disputes.intentDue) and the collector's next move (conv/deciders.ts).
import type { Character, Id, World } from '../types';
import { newSession, perceive } from './perception';
import { onOrder, type Reply } from './respond';
import { restraintsOn } from './social';

export const tested: { t: number; who: Id; target: Id; reply: Reply }[] = []; // (for traces; not saved)
// How much he wants to break it now (violate − obey); undefined if nothing binds him. Positive: he will.
export function breakWish(w: World, c: Character, target: Id, biz?: Id): number | undefined {
  const bound = restraintsOn(w, c.id, target, biz);
  if (!bound.length) return undefined;
  const ob = bound[0], over = w.chars[ob.beneficiary], forC = w.chars[target];
  if (!over || !forC) return undefined;
  const fee = biz ? Math.round((w.biz[biz]?.income ?? 0) * 0.08) : 0;
  const r = onOrder(perceive(w, newSession(), c), over, forC, fee);
  const v = (m: string) => r.decision.candidates.find((x) => x.move === m)?.value ?? 0;
  const wish = Math.round((v('violate') - v('obey')) * 100) / 100;
  if (tested.length > 200) tested.splice(0, 100);
  tested.push({ t: w.now, who: c.id, target, reply: r });
  ob.intends = wish > 0 ? 'break' : 'keep';
  return wish;
}
// For the scorers: false if he means to keep it (so the option is not considered); true if nothing binds him or he means to break it
export const free = (w: World, c: Character, target: Id, biz?: Id) => { const x = breakWish(w, c, target, biz); return x === undefined || x > 0; };
