// The conversation layer in the world's day (spec §6.4): requests between NPCs answered, obligations an NPC has taken on carried out,
// asks the layer rides on watched for their answers, obligations settled by the time rules (daily, and at once when a hostile fact is
// recorded), and what follows from keeping or breaking them applied through the world's own doors. Nothing happens here for a world
// with no records of this layer (World.social absent), so existing play is untouched.
import { factHooks, ownerBiz } from '../core';
import { crewGround } from '../econ';
import { askBetween } from '../asks';
import { hash } from '../voice';
import type { Character, Id, World } from '../types';
import { DAY } from '../types';
import { newSession, perceive } from './perception';
import { HOSTILE, settle, type Obligation, type Settlement } from './obligations';
import { note, prune, sid, social, type Agreement, type Request } from './social';
import * as door from './doors';
import { captainOf, chairFor, may } from './authority';
import { onOrder, onOrderRequest, type Captaincy, type Reply } from './respond';

// What happened between NPCs, for a transcript to show as a trace (not saved, not shown to the player)
export const offstage: { t: number; who: Id; what: string; reply?: Reply }[] = [];

export function agreement(w: World, parties: Id[], terms: string, witnesses: Id[], madeIn?: Id): Agreement {
  const s = social(w), a: Agreement = { id: sid(s, 'g'), t: w.now, parties, terms, madeIn, witnesses, obligations: [] };
  s.agreements.push(a);
  return a;
}
export function promise(w: World, o: Omit<Obligation, 'id' | 'status'>, a?: Agreement): Obligation {
  const s = social(w), x: Obligation = { ...o, id: sid(s, 'o'), status: 'pending', agreement: a?.id };
  s.obs.push(x); a?.obligations.push(x.id);
  return x;
}
export function request(w: World, r: Omit<Request, 'id' | 't' | 'status' | 'hist'>): Request {
  const s = social(w), x: Request = { ...r, id: sid(s, 'r'), t: w.now, status: 'open', hist: [] };
  s.requests.push(x);
  return x;
}

// What a captain makes of a matter brought to him, from what he knows (his perception) and what is plain to anyone (where his crew
// works, whose shop it is, who answers to whom).
export function captaincyOf(w: World, captain: Character, forC: Character, against: Character, asker?: Character): Captaincy {
  const p = perceive(w, newSession(), captain), ground = crewGround(w, captain), b = ownerBiz(w, forC.id);
  const men = new Set([against.id, ...Object.values(w.chars).filter((c) => c.bossId === against.id).map((c) => c.id)]);
  const trouble = p.knownFacts((f) => HOSTILE.has(f.kind) && !!f.actor && men.has(f.actor) && ground.has(f.district) && w.now - f.t < 30 * DAY).sort((x, y) => y.t - x.t)[0];
  const asked = asker ? social(w).log.filter((a) => a.actor === asker.id && a.act === 'raise' && a.target === captain.id).length : 0;
  return {
    groundHasFor: !!b && ground.has(b.district), forProtected: !!b?.protection && b.protection.familyId === captain.familyId && captainOf(w, w.chars[b.protection.collectorId] ?? captain)?.id === captain.id,
    knowsTrouble: !!trouble, trouble: trouble ? { shop: trouble.business ? w.biz[trouble.business]?.name ?? 'a shop' : 'one of ours' } : undefined,
    theirCaptain: chairFor(w, against, forC) ?? against, asked: Math.max(0, asked - 1), agreed: false, done: false,
  };
}

// What breaking or keeping does, through the world's doors. Regard moves for the men it was promised to (by the credit, for a result);
// a broken word is on record for them; a liability falls where it was laid; a broken order is held against the man who broke it.
function effects(w: World, st: Settlement[]) {
  const s = social(w);
  for (const { ob, to } of st) {
    const obligor = w.chars[ob.obligor], ben = w.chars[ob.beneficiary];
    if (!obligor || !ben) continue;
    const owed = [...new Set([ob.beneficiary, ob.promisee ?? ob.beneficiary])].map((id) => w.chars[id]).filter((c): c is Character => !!c?.alive && c.id !== ob.obligor);
    if (to === 'kept') {
      const k = ob.type === 'result' ? { self: 1, delegate: 0.7, other: 0.3, none: 0.2 }[ob.credit ?? 'none'] : 1;
      for (const c of owed) door.regard(w, c, ob.obligor, 'trust', 0.08 * k, `${obligor.name} kept his word`);
      if (ob.notify?.length) door.happened(w, { kind: 'rumour', minor: true, actor: ob.obligor, victim: ob.beneficiary, text: `${obligor.name} kept his word to ${ben.name}.` }, { witnesses: ob.notify });
    } else if (to === 'broken') {
      for (const c of owed) { door.regard(w, c, ob.obligor, 'trust', -0.15, `${obligor.name} broke his word`); door.regard(w, c, ob.obligor, 'respect', -0.06, `${obligor.name} broke his word`); }
      door.happened(w, { kind: 'rumour', actor: ob.obligor, victim: ob.beneficiary, text: `${obligor.name} broke his word to ${ben.name}.` }, { witnesses: [...owed.map((c) => c.id), ...(ob.notify ?? [])] });
      if (ob.order) door.grudge(w, ben, ob.obligor, 0.15, `${obligor.name} went against what he was told`);
      // a liability laid on anyone along the chain of this matter (the obligations it served, and those taken on to serve it) falls
      // now: "if this turns ugly, it's on you"
      for (const x of chainOf(s.obs, ob)) for (const L of x.liabilities ?? []) if (w.chars[L.by] && !L.fell) { door.regard(w, w.chars[L.by], L.who, L.feeling, -L.amount, L.why); L.fell = w.now; }
    }
  }
}
// every obligation in the same chain as this one: up through what it served, and down through what was taken on to serve those
function chainOf(obs: Obligation[], ob: Obligation): Obligation[] {
  let root = ob;
  for (let i = 0; i < 6 && root.parent; i++) { const up = obs.find((x) => x.id === root.parent); if (!up) break; root = up; }
  const out: Obligation[] = [], walk = (o: Obligation, d: number) => { out.push(o); if (d < 6) for (const c of obs.filter((x) => x.parent === o.id)) walk(c, d + 1); };
  walk(root, 0);
  return out;
}
function check(w: World) { effects(w, settle(w, social(w))); }

// A captain who has agreed to his man's leaving someone alone: the order is now an obligation of the man's, and the man decides
// whether he means it. Keeping it, he lets his demand on the shop drop; breaking it, he presses it.
function ordered(w: World, r: Request) {
  // (the request was made of the captain, r.of; the order he gave is to his man, r.against)
  const boss = w.chars[r.of], man = w.chars[r.against ?? ''], forC = r.for ? w.chars[r.for] : undefined;
  if (!boss || !man || !forC) return;
  const a = agreement(w, [boss.id, man.id], `${man.name} leaves ${forC.name} alone`, [boss.id], r.id);
  const parent = r.parent ? social(w).obs.find((x) => x.id === r.parent) : undefined;
  const o3 = promise(w, { type: 'restraint', order: true, obligor: man.id, beneficiary: boss.id, promisee: boss.id, spec: { kind: 'noHostility', actor: man.id, target: forC.id, biz: r.biz, days: 30 }, from: w.now, by: w.now + 30 * DAY, parent: r.parent, notify: parent ? [parent.obligor] : [], matter: { for: forC.id, against: man.id, biz: r.biz }, words: `${boss.name} told ${man.name} to leave ${forC.name} alone` }, a);
  const dem = askBetween(w, 'protect', man.id, forC.id, r.biz);
  const d = onOrder(perceive(w, newSession(), man), boss, forC, dem?.terms?.amt ?? 0);
  o3.intends = d.decision.chosen === 'obey' ? 'keep' : 'break';
  offstage.push({ t: w.now, who: man.id, what: `${man.name} tells ${boss.name} he'll leave ${forC.name} alone, and ${o3.intends === 'keep' ? 'means it' : 'does not mean it'}`, reply: d });
  if (o3.intends === 'keep' && dem) door.withdraw(w, dem, r.about);
  r.status = 'done'; note(r, w.now, `${man.name} agreed`);
}

export function socialDay(w: World) {
  const s = w.social;
  if (!s) return;
  // 1. asks this layer rides on: the man ordered has answered
  for (const r of s.requests) {
    if (r.status !== 'open' || !r.sit) continue;
    const sit = (w.situations ?? []).find((x) => x.id === r.sit);
    if (!sit || sit.stage !== 'resolved') continue;
    r.rode = { ak: sit.ak, out: sit.out };
    if (sit.out === 'agreed' || sit.out === 'gave in') ordered(w, r);
    else { r.status = 'refused'; note(r, w.now, `${w.chars[r.against ?? '']?.name} would not have it (${sit.out})`); offstage.push({ t: w.now, who: r.against ?? r.of, what: `${w.chars[r.against ?? '']?.name} won’t leave ${w.chars[r.for ?? '']?.name} alone (${sit.out})` }); }
  }
  // 2. what an NPC has promised to do, he does when he gets to it (a day or three; his own pursuits are Gate 2b)
  for (const ob of s.obs) {
    if (ob.status !== 'pending' || ob.spec.kind !== 'actionDone' || ob.spec.act !== 'raise' || w.chars[ob.obligor]?.isPlayer) continue;
    if (w.now < ob.from + (1 + (hash(ob.id) % 3)) * DAY) continue;
    const me = w.chars[ob.obligor], to = ob.spec.target ? w.chars[ob.spec.target] : undefined, m = ob.matter;
    if (!me?.alive || !to?.alive || !m?.for || !m.against) continue;
    door.raise(w, me, to, ob.spec.about);
    const r = request(w, { by: me.id, of: to.id, wants: may(w, to, 'order', w.chars[m.against]) ? 'order' : 'intervene', about: ob.spec.about, for: m.for, against: m.against, biz: m.biz, fact: m.fact, parent: ob.id, next: w.now + DAY });
    note(r, w.now, `${me.name} took it to ${to.name}`);
    offstage.push({ t: w.now, who: me.id, what: `${me.name} takes it to ${to.name}, as he said he would` });
  }
  // 3. requests between NPCs, answered: a man who can order the one complained of decides whether to
  for (const r of s.requests) {
    if (r.status !== 'open' || r.sit || (r.next ?? 0) > w.now) continue;
    const by = w.chars[r.by], of = w.chars[r.of], man = w.chars[r.against ?? ''], forC = w.chars[r.for ?? ''];
    if (!by || !of || by.isPlayer || of.isPlayer || !man || !forC) continue;
    if (r.wants === 'order') {
      const d = onOrderRequest(perceive(w, newSession(), of), by, man, forC);
      offstage.push({ t: w.now, who: of.id, what: `${of.name} ${d.decision.chosen === 'order' ? `tells ${man.name} to leave ${forC.name} alone` : `won’t rein in ${man.name}`}`, reply: d });
      if (d.decision.chosen === 'order') { const { sit } = door.order(w, of, man, forC, r.about, r.fact); r.sit = sit?.id; note(r, w.now, `${of.name} told ${man.name}`); if (!sit) { r.status = 'lapsed'; note(r, w.now, 'the word never reached him'); } }
      else { r.status = 'refused'; note(r, w.now, `${of.name} refused`); door.happened(w, { kind: 'rumour', minor: true, actor: of.id, victim: by.id, text: `${of.name} would not rein in ${man.name} for ${by.name}.` }, { witnesses: [by.id] }); }
    } else { r.status = 'referred'; note(r, w.now, `${of.name} cannot order ${man.name}`); }
  }
  // 4. a man who has decided to break an order acts on it: he presses his demand (the ask kind's own force)
  for (const ob of s.obs) {
    if (ob.status !== 'pending' || !ob.order || ob.intends !== 'break' || ob.spec.kind !== 'noHostility' || w.now < ob.from + 2 * DAY) continue;
    if (s.log.some((a) => a.actor === ob.obligor && a.act === 'harm' && a.t >= ob.from)) continue;
    const dem = askBetween(w, 'protect', ob.obligor, ob.spec.target, ob.spec.biz);
    if (dem) { door.force(w, dem, 'order:' + ob.id); offstage.push({ t: w.now, who: ob.obligor, what: `${w.chars[ob.obligor].name} goes back to the shop anyway` }); }
  }
  check(w);
  prune(w);
}
// a hostile act is checked at once: a period promise is broken at the first violation, not at the next morning's tick
factHooks().push((w, f) => { if (w.social && HOSTILE.has(f.kind) && w.social.obs.some((o) => o.status === 'pending' && o.spec.kind === 'noHostility')) check(w); });
// (for a scene the player is in: settle now, after what was said and done)
export const settleNow = check;
