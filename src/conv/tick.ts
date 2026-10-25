// The conversation layer in the world's day (spec §6.4): requests between NPCs answered, obligations an NPC has taken on carried out,
// asks the layer rides on watched for their answers, obligations settled by the time rules (daily, and at once when a hostile fact is
// recorded), and what follows from keeping or breaking them applied through the world's own doors. Nothing happens here for a world
// with no records of this layer (World.social absent), so existing play is untouched.
import { factHooks, ownerBiz } from '../core';
import { crewGround } from '../econ';
import { askBetween } from '../asks';
import { onClose } from '../situ';
import type { Character, Id, World } from '../types';
import { DAY } from '../types';
import { newSession, perceive } from './perception';
import { conflicts, HOSTILE, offender, settle, type Obligation, type Settlement } from './obligations';
// (pursuits listen here: a promise an NPC makes, or is made to, starts his own pursuit of it)
export const onPromise: ((w: World, ob: Obligation) => void)[] = [];
import { note, prune, sid, social, type Agreement, type Request } from './social';
import * as door from './doors';
import { captainOf, chairFor, may } from './authority';
import { onDisobedience, onOrderRequest, type Captaincy, type Reply } from './respond';
import { belief, judge } from './minds';
import { breakWish, tested } from './obey';
import { enter } from './annals';

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
  // two things he has undertaken that cannot both be kept: each records the other, and he will have to choose (spec §6.4)
  const cx = conflicts(s, x);
  if (cx.length) { x.conflicts = cx.map((c) => c.id); for (const c of cx) (c.conflicts ??= []).push(x.id); }
  for (const f of onPromise) f(w, x);
  return x;
}
export function request(w: World, r: Omit<Request, 'id' | 't' | 'status' | 'hist'>): Request {
  // (nobody is asked to act against himself, or on his own behalf against himself: such a request is never put, and is kept only as
  // the record that it was not, so a caller holding its id finds it closed)
  const self = !!r.against && (r.of === r.against || r.for === r.against || r.by === r.against);
  const s = social(w), x: Request = { ...r, id: sid(s, 'r'), t: w.now, status: self ? 'lapsed' : 'open', hist: self ? [{ t: w.now, event: 'not put: the man asked is the man it is against' }] : [] };
  s.requests.push(x);
  return x;
}

// What a captain makes of a matter brought to him, from what he knows (his perception) and what is plain to anyone (where his crew
// works, whose shop it is, who answers to whom).
export function captaincyOf(w: World, captain: Character, forC: Character, against: Character, asker?: Character): Captaincy {
  const p = perceive(w, newSession(), captain), ground = crewGround(w, captain), b = ownerBiz(w, forC.id);
  const men = new Set([against.id, ...Object.values(w.chars).filter((c) => c.bossId === against.id).map((c) => c.id)]);
  // (trouble by the man or his people on this captain's ground, as he knows it: a demand made there counts, as well as harm done)
  const trouble = p.knownFacts((f) => HOSTILE.has(f.kind) && !!offender(f) && men.has(offender(f)!) && ground.has(f.district) && w.now - f.t < 30 * DAY).sort((x, y) => y.t - x.t)[0];
  const asked = asker ? social(w).log.filter((a) => a.actor === asker.id && a.act === 'raise' && a.target === captain.id).length : 0;
  return {
    groundHasFor: !!b && ground.has(b.district), forProtected: !!b?.protection && b.protection.familyId === captain.familyId && captainOf(w, w.chars[b.protection.collectorId] ?? captain)?.id === captain.id,
    knowsTrouble: !!trouble, trouble: trouble ? { shop: trouble.business ? w.biz[trouble.business]?.name ?? 'a shop' : 'one of ours' } : undefined,
    theirCaptain: chairFor(w, against, forC) ?? against, asked: Math.max(0, asked - 1), agreed: false, done: false,
  };
}

// What follows from an obligation is what the men concerned BELIEVE of it (conv/minds.judge): each judges the man who promised by
// what he knows and has been told, and judges again if he learns otherwise. A liability falls when the man who laid it believes the
// matter turned ugly; a superior who believes his order was broken decides what to do about it.
function judgements(w: World) {
  const s = social(w);
  for (const ob of s.obs) {
    if (ob.status !== 'pending' && w.now - (ob.settled ?? w.now) > 60 * DAY) continue;
    const parties = new Set([ob.beneficiary, ob.promisee ?? ob.beneficiary, ...(ob.notify ?? [])]);
    for (const id of parties) { const c = w.chars[id]; if (c?.alive && !c.isPlayer && id !== ob.obligor) judge(w, c, ob); }
    for (const L of ob.liabilities ?? []) {
      const by = w.chars[L.by];
      if (!by?.alive || L.fell) continue;
      const bad = chainOf(s.obs, ob).find((x) => belief(w, by, 'ob:' + x.id).value === 'broken');
      if (bad) { door.regard(w, by, L.who, L.feeling, -L.amount, L.why); L.fell = w.now; enter({ t: w.now, who: by.id, with: L.who, what: `${by.name} holds ${w.chars[L.who]?.name} to it: it turned ugly (${bad.id})` }); }
    }
    if (ob.order && !(ob as Obligation & { handled?: number }).handled) {
      const boss = w.chars[ob.beneficiary], man = w.chars[ob.obligor];
      if (boss?.alive && man?.alive && belief(w, boss, 'ob:' + ob.id).value === 'broken') {
        (ob as Obligation & { handled?: number }).handled = w.now;
        const d = onDisobedience(perceive(w, newSession(), boss), man);
        enter({ t: w.now, who: boss.id, with: man.id, what: `${boss.name} believes ${man.name} went against his order: ${d.decision.chosen}`, reply: d });
        const why = Object.values(w.facts).filter((f) => HOSTILE.has(f.kind) && boss.known[f.id] && f.t >= ob.from && (offender(f) === man.id || w.chars[offender(f) ?? '']?.bossId === man.id)).sort((x, y) => y.t - x.t)[0];
        if (d.decision.chosen === 'discipline') { door.grudge(w, boss, man.id, 0.2, `${man.name} went against what he was told`); door.discipline(w, boss, man, why?.id ?? '', 100); }
        else if (d.decision.chosen === 'rebuke') { door.grudge(w, boss, man.id, 0.1, `${man.name} went against what he was told`); door.regard(w, man, boss.id, 'fear', 0.1, `${boss.name} took him to task`); }
      }
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
function check(w: World) { settle(w, social(w)); judgements(w); }

// A captain whose man has agreed to leave someone alone: the order is now the man's obligation (and, through him, his men's: he passes
// it down, and each of them is bound by it as he sees fit). Whether he means to keep it is his own judgement, made again whenever the
// chance to break it comes (conv/obey.ts); for now, meaning it, he lets his demand on the shop drop.
function ordered(w: World, r: Request) {
  // (the request was made of the captain, r.of; the order he gave is to his man, r.against)
  const boss = w.chars[r.of], man = w.chars[r.against ?? ''], forC = r.for ? w.chars[r.for] : undefined;
  if (!boss || !man || !forC) return;
  const a = agreement(w, [boss.id, man.id], `${man.name} leaves ${forC.name} alone`, [boss.id], r.id);
  const parent = r.parent ? social(w).obs.find((x) => x.id === r.parent) : undefined;
  const o3 = promise(w, { type: 'restraint', order: true, obligor: man.id, beneficiary: boss.id, promisee: boss.id, spec: { kind: 'noHostility', actor: man.id, target: forC.id, biz: r.biz, days: 30 }, from: w.now, by: w.now + 30 * DAY, parent: r.parent, notify: parent ? [parent.obligor] : [], matter: { for: forC.id, against: man.id, biz: r.biz }, words: `${boss.name} told ${man.name} to leave ${forC.name} alone` }, a);
  // down the chain: his own men are told
  for (const m of Object.values(w.chars).filter((x) => x.alive && x.bossId === man.id).sort((x, y) => (x.id < y.id ? -1 : 1)).slice(0, 6))
    promise(w, { type: 'restraint', order: true, obligor: m.id, beneficiary: man.id, promisee: man.id, spec: { kind: 'noHostility', actor: m.id, target: forC.id, biz: r.biz, days: 30 }, from: w.now, by: w.now + 30 * DAY, parent: o3.id, matter: { for: forC.id, against: m.id, biz: r.biz }, words: `${man.name} told ${m.name} to leave ${forC.name} alone` });
  // being reined in because the man went over his head to the captain is a thing a man resents, the prouder the more
  const t = perceive(w, newSession(), man).temper;
  door.grudge(w, man, forC.id, Math.round((0.1 + t.pride * 0.3 + t.volatility * 0.1) * 100) / 100, `${forC.name} went over his head to ${boss.name}`);
  const wish = breakWish(w, man, forC.id, r.biz) ?? 0;
  const dem = askBetween(w, 'protect', man.id, forC.id, r.biz);
  enter({ t: w.now, who: man.id, with: boss.id, what: `${man.name} tells ${boss.name} he'll leave ${forC.name} alone, and ${wish > 0 ? 'does not mean it' : 'means it'}`, reply: tested.at(-1)?.reply });
  offstage.push({ t: w.now, who: man.id, what: `${man.name} tells ${boss.name} he'll leave ${forC.name} alone, and ${wish > 0 ? 'does not mean it' : 'means it'}`, reply: tested.at(-1)?.reply });
  if (wish <= 0 && dem) door.withdraw(w, dem, r.about);
  r.status = 'done'; note(r, w.now, `${man.name} agreed`);
}

// an ask a request rides on has closed: the request learns how (and acts on it at once: the world clears settled asks between
// other men soon after)
function answered(w: World, r: Request) {
  if (r.status !== 'open' || !r.rode) return;
  if (r.rode.out === 'agreed' || r.rode.out === 'gave in') ordered(w, r);
  else { r.status = 'refused'; note(r, w.now, `${w.chars[r.against ?? '']?.name} would not have it (${r.rode.out})`); offstage.push({ t: w.now, who: r.against ?? r.of, what: `${w.chars[r.against ?? '']?.name} won’t leave ${w.chars[r.for ?? '']?.name} alone (${r.rode.out})` }); enter({ t: w.now, who: r.against ?? r.of, with: r.of, what: `${w.chars[r.against ?? '']?.name} won’t leave ${w.chars[r.for ?? '']?.name} alone (${r.rode.out})` }); }
}
onClose.push((w, sit) => { if (!w.social) return; for (const r of w.social.requests) if (r.status === 'open' && r.sit === sit.id) { r.rode = { ak: sit.ak, out: sit.out }; answered(w, r); } });

// pursuits (conv/pursuits.ts) hang their day, and their answer to a request for intervention, here
export const hooks: { day: ((w: World) => void)[]; intervene?: (w: World, r: Request) => void } = { day: [] };
export function socialDay(w: World) {
  const s = w.social;
  if (!s) return;
  // 1. asks this layer rides on, whose answer came while the request was waiting (see onClose below)
  for (const r of s.requests) if (r.status === 'open' && r.rode) answered(w, r);
  // 2. requests between NPCs, answered by the same decisions the player's are: a man who can order the one complained of decides
  //    whether to; a man who can't decides whether to take it further up himself
  for (const r of s.requests) {
    if (r.status !== 'open' || r.sit || r.by === r.of || (r.next ?? 0) > w.now) continue;
    const by = w.chars[r.by], of = w.chars[r.of], man = w.chars[r.against ?? ''], forC = w.chars[r.for ?? ''];
    if (!by || !of || by.isPlayer || of.isPlayer || !man || !forC) continue;
    if (r.wants === 'order') {
      const d = onOrderRequest(perceive(w, newSession(), of), by, man, forC);
      offstage.push({ t: w.now, who: of.id, what: `${of.name} ${d.decision.chosen === 'order' ? `tells ${man.name} to leave ${forC.name} alone` : `won’t rein in ${man.name}`}`, reply: d });
      enter({ t: w.now, who: of.id, with: by.id, what: `${by.name} asks ${of.name} to rein in ${man.name}: ${d.decision.chosen}`, reply: d, chain: r.id });
      if (d.decision.chosen === 'order') { const { sit } = door.order(w, of, man, forC, r.about, r.fact); r.sit = sit?.id; note(r, w.now, `${of.name} told ${man.name}`); if (!sit) { r.status = 'lapsed'; note(r, w.now, 'the word never reached him'); } }
      else { r.status = 'refused'; note(r, w.now, `${of.name} refused`); door.happened(w, { kind: 'rumour', minor: true, actor: of.id, victim: by.id, text: `${of.name} would not rein in ${man.name} for ${by.name}.` }, { witnesses: [by.id] }); }
    } else if (hooks.intervene) hooks.intervene(w, r);
    else { r.status = 'referred'; note(r, w.now, `${of.name} cannot order ${man.name}`); }
  }
  // 2b. news for the player: a man who took the player's matter further has heard back (he comes to tell him); requests of the player
  //     that he never came to answer lapse after a week
  for (const r of s.requests) {
    if (r.status === 'open' && w.chars[r.of]?.isPlayer && w.now - r.t > 7 * DAY) { r.status = 'lapsed'; note(r, w.now, 'he never came'); }
    // (only a request made of someone else to act is reported back: never the reports, follow-ups and confrontations themselves)
    if ((r.status === 'refused' || r.status === 'done') && r.parent && !r.reported && (r.wants === 'order' || r.wants === 'intervene') && !w.chars[r.of]?.isPlayer) {
      const ob = s.obs.find((o) => o.id === r.parent), h = ob ? w.chars[ob.beneficiary] : undefined;
      r.reported = true;
      if (ob && h?.isPlayer && ob.obligor === r.by) request(w, { by: r.by, of: h.id, wants: 'report', about: r.about, parent: ob.id });
    }
  }
  // 3. what people are pursuing, each by his own lights
  for (const f of hooks.day) f(w);
  check(w);
  prune(w);
}
// a hostile act is checked at once: a period promise is broken at the first violation, not at the next morning's tick
factHooks().push((w, f) => { if (w.social && HOSTILE.has(f.kind) && w.social.obs.some((o) => o.status === 'pending' && o.spec.kind === 'noHostility')) check(w); });
// (for a scene the player is in: settle now, after what was said and done)
export const settleNow = check;
