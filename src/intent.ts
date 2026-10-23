// Social intentions (Stage 5A). One place where a man decides to go and see someone, why, and what he means to do there.
//
// Every intention comes from something real in his world: a payment he can't make, trouble he can't get out of alone, news his
// superior ought to hear, a man he wronged and would rather not lose, a man of his who has been shaming him, an empty pocket and
// nothing to do. He chooses whom to see by who could help or who needs to know, by what is between them and by what it would cost
// him; and he acts through the doors the rest of the game uses: a negotiation (asks.ts), what a man is told (core.learn), work
// from his superior (work.ts), a grudge with its reason (core.bear). The player is one of the men he may go and see: what is put to
// the player reaches him the way any matter does (asks.putToPlayer), and he answers it in the conversation.
//
// Each man weighs his intentions once a week, on his own day: nothing here runs everyone every day, and nothing is made up.
import { temper } from './temper';
import { addFact, bear, feel, learn, ownerBiz, rel } from './core';
import { askBetween, move, openAsk } from './asks';
import { menOf, needsOf, giveWork, pickMan } from './work';
import { activityOf } from './jobs';
import { askToIntercede, makeLoan } from './encounters';
import { Character, DAY, Fact, World } from './types';

export type IntentKind = 'time' | 'intercede' | 'help' | 'report' | 'amends' | 'confront' | 'work';
export interface Intent { kind: IntentKind; to: Character; why: string; score: number; act: () => void }

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
const free = (w: World, c: Character) => c.alive && c.jailedUntil <= w.now && c.hurtUntil <= w.now && !activityOf(w, c);
const cool = (w: World, c: Character, k: string) => (c.cooldown['int:' + k] ?? 0) > w.now;
const LIVING: Record<string, number> = { civilian: 70, associate: 100, soldier: 170, capo: 330, underboss: 520, boss: 900 };
const HOSTILE = new Set(['beating', 'vandalism', 'robbery', 'poach', 'protection_refused', 'burglary', 'theft', 'scam']);

// Everything a man might go and do about the people around him this week, from what is true for him now.
export function intentsOf(w: World, c: Character): Intent[] {
  if (c.isPlayer || !free(w, c)) return [];
  const out: Intent[] = [];
  const tp = temper(c);

  // He can't make his payments: he goes to the man he owes and asks for easier terms, rather than let it go bad.
  for (const d of w.debts) {
    if (d.status !== 'active' || d.debtor !== c.id || d.missed < 1 || c.cash >= d.weeklyPayment || cool(w, c, 'time:' + d.id)) continue;
    const t = w.chars[d.creditor];
    if (!t?.alive || askBetween(w, 'time', c.id, t.id)) continue;
    const r = rel(c, t.id);
    out.push({ kind: 'time', to: t, why: `he can't make his payments to ${t.name}`, score: 0.5 + d.missed * 0.1 + tp.caution * 0.2 - tp.pride * 0.25 - (r.fear ?? 0) * 0.2 + r.trust * 0.1, act: () => {
      c.cooldown['int:time:' + d.id] = w.now + 21 * DAY;
      const s = openAsk(w, 'time', c, t, { what: d.id, about: d.id, amt: Math.max(5, Math.round(d.weeklyPayment / 2 / 5) * 5), why: `${c.name} can't make his payments to ${t.name}` });
      if (s && !t.isPlayer) move(w, s, 'ask');
    } });
  }

  // Behind with a man who won't listen to him: he asks someone that man listens to, to speak for him.
  for (const d of w.debts) {
    if (d.status !== 'active' || d.debtor !== c.id || d.missed < 2 || cool(w, c, 'intercede:' + d.id)) continue;
    const cr = w.chars[d.creditor];
    if (!cr?.alive || cr.isPlayer) continue;
    const by = Object.values(w.chars).filter((x) => x.alive && x.id !== c.id && x.id !== cr.id && (c.rels[x.id]?.trust ?? 0) >= 0.3 && (cr.rels[x.id]?.trust ?? 0) >= 0.4)
      .sort((p, q) => (cr.rels[q.id]?.trust ?? 0) - (cr.rels[p.id]?.trust ?? 0) || byId(p, q))[0];
    if (!by) continue;
    out.push({ kind: 'intercede', to: by, why: `${cr.name} listens to him`, score: 0.4 + d.missed * 0.05 + tp.caution * 0.15 - tp.pride * 0.2, act: () => {
      c.cooldown['int:intercede:' + d.id] = w.now + 28 * DAY;
      if (by.isPlayer) return askToIntercede(w, by, c, d);
      // the man asked speaks for him if he thinks well enough of him; the creditor gives a week to a man he trusts
      if (rel(by, c.id).trust < 0.3) return;
      d.nextDue += 7 * DAY; d.missed = Math.max(0, d.missed - 1);
      addFact(w, { kind: 'terms', actor: by.id, victim: c.id, cause: d.cause, text: `${by.name} spoke to ${cr.name} for ${c.name}, and ${cr.name} gave him another week.`, district: c.district }, { witnesses: [by.id, c.id, cr.id] });
      feel(w, c, by.id, 'trust', 0.05, `${by.name} spoke for him to ${cr.name}`);
    } });
  }

  // In real trouble, and too proud or too careful to ask until it bites: he goes to the man he trusts most who could help.
  const b = ownerBiz(w, c.id);
  const short = b && b.open ? b.distress >= 2 && b.cash < b.expense : c.cash < (LIVING[c.rank] ?? 100) * 0.5;
  if (short && !cool(w, c, 'help') && !w.debts.some((d) => d.status === 'active' && d.debtor === c.id && d.missed >= 2)) {
    const need = Math.max(200, Math.round((b ? b.expense * 2 - b.cash : (LIVING[c.rank] ?? 100) * 3) / 50) * 50);
    const helper = Object.values(w.chars).filter((x) => x.alive && x.id !== c.id && x.jailedUntil <= w.now && x.cash >= need * 1.5 && (c.rels[x.id]?.trust ?? 0) >= 0.3 && !w.debts.some((d) => d.status === 'active' && d.creditor === x.id && d.debtor === c.id))
      .map((x) => ({ x, s: (c.rels[x.id]?.trust ?? 0) + (c.rels[x.id]?.affection ?? 0) * 0.5 + (x.id === c.bossId ? 0.2 : 0) - (c.rels[x.id]?.grudge ?? 0) }))
      .sort((p, q) => q.s - p.s || byId(p.x, q.x))[0]?.x;
    if (helper) out.push({ kind: 'help', to: helper, why: b ? `${b.name} is going under` : 'his pockets are empty', score: 0.55 - tp.pride * 0.3 + tp.caution * 0.1, act: () => {
      c.cooldown['int:help'] = w.now + 28 * DAY;
      if (helper.isPlayer) { if (!w.enc.some((e) => e.kind === 'loan' && e.from === c.id && e.status === 'open')) makeLoan(w, helper, c, need); return; } // (the same request, put to him in person)
      const s = openAsk(w, 'borrow', c, helper, { amt: need, why: `${c.name} needs help: ${b ? `${b.name} is going under` : 'his pockets are empty'}` });
      if (s) move(w, s, 'ask');
    } });
  }

  // News his superior ought to hear and doesn't: something done to the family's shops or men, or a shop refusing the family, that
  // he saw or was told. He passes it up, and with it whatever he knows of who did it.
  const sup = c.bossId ? w.chars[c.bossId] : undefined;
  if (sup?.alive && c.familyId && !cool(w, c, 'report')) {
    const f = Object.entries(c.known).map(([id, k]) => ({ f: w.facts[id], k })).filter(({ f }) => f && HOSTILE.has(f.kind) && w.now - f.t < 10 * DAY && !sup.known[f.id] && concerns(w, f, c.familyId!)).sort((p, q) => q.f.t - p.f.t)[0];
    if (f) out.push({ kind: 'report', to: sup, why: 'his superior should hear it from him', score: 0.45 + rel(c, sup.id).trust * 0.3 + tp.caution * 0.1, act: () => {
      c.cooldown['int:report'] = w.now + 5 * DAY;
      learn(w, sup.id, f.f, c.id, f.k.knowsActor);
      feel(w, sup, c.id, 'trust', 0.01, `${c.name} brought him word`);
    } });
  }

  // He wronged a man he would rather not lose: he goes to put it right (asks 'amends').
  for (const [id, r] of Object.entries(c.rels)) {
    const x = w.chars[id];
    if (!x?.alive || x.isPlayer || cool(w, c, 'amends:' + id)) continue;
    const theirs = x.rels[c.id];
    if (!theirs || theirs.grudge < 0.2 || r.affection < 0.4 || askBetween(w, 'amends', c.id, x.id)) continue;
    out.push({ kind: 'amends', to: x, why: `he would rather not lose ${x.name}`, score: 0.2 + tp.empathy * 0.35 + tp.agreeable * 0.25 + r.affection * 0.2 - tp.pride * 0.35, act: () => {
      c.cooldown['int:amends:' + id] = w.now + 42 * DAY;
      const s = openAsk(w, 'amends', c, x, { why: `${c.name} wants to make it right with ${x.name}` });
      if (s) move(w, s, 'ask');
    } });
  }

  // One of his own men has done something that hurts the family's earnings (a shop under the family's protection beaten up or
  // robbed), and he has heard of it: he takes him to task.
  if (menOf(w, c).length && !cool(w, c, 'confront')) {
    const mine = new Set(menOf(w, c).map((m) => m.id));
    const f = Object.entries(c.known).map(([id, k]) => ({ f: w.facts[id], k })).find(({ f, k }) => f && k.knowsActor && ['beating', 'vandalism', 'robbery'].includes(f.kind) && w.now - f.t < 14 * DAY && !!f.actor && mine.has(f.actor) && concerns(w, f, c.familyId!) && !c.cooldown['conf:' + f.id]);
    const m = f ? w.chars[f.f.actor!] : undefined;
    if (f && m?.alive) out.push({ kind: 'confront', to: m, why: `${m.name} hurt the family's own earnings`, score: 0.5 + tp.pride * 0.2 + tp.volatility * 0.1, act: () => {
      c.cooldown['int:confront'] = w.now + 7 * DAY; c.cooldown['conf:' + f.f.id] = w.now + 60 * DAY;
      const e = addFact(w, { kind: 'discipline', actor: c.id, victim: m.id, cause: f.f.id, text: `${c.name} took ${m.name} to task over what happened: ${f.f.text}`, district: m.district }, { witnesses: [c.id, m.id] });
      feel(w, c, m.id, 'trust', -0.06, e);
      if (temper(m).pride > 0.6) bear(w, m, c.id, 0.08, e); // a proud man resents being dressed down
      else feel(w, m, c.id, 'respect', 0.02);
    } });
  }

  // Short of money and with nothing to do, a man in the life asks his superior for work. The superior gives him something only
  // if something needs doing (work.needsOf); otherwise the man has been told to wait.
  if (sup?.alive && !sup.isPlayer && c.rank !== 'civilian' && c.cash < (LIVING[c.rank] ?? 100) * 2 && !cool(w, c, 'work')) {
    out.push({ kind: 'work', to: sup, why: 'he needs the money', score: 0.35 + c.traits.ambition * 0.2 + c.traits.greed * 0.1, act: () => {
      c.cooldown['int:work'] = w.now + 14 * DAY;
      const n = needsOf(w, sup).find((x) => pickMan(w, sup, x, [c]) === c);
      if (n) giveWork(w, sup, c, n);
    } });
  }
  return out.sort((a, b) => b.score - a.score);
}

// Whether something touches the family: done to one of its men, or to a shop it protects.
function concerns(w: World, f: Fact, fid: string): boolean {
  const v = f.victim ? w.chars[f.victim] : undefined;
  if (v?.familyId === fid) return true;
  const b = f.business ? w.biz[f.business] : v ? ownerBiz(w, v.id) : undefined;
  return b?.protection?.familyId === fid;
}

// Each day, the men whose day it is weigh what they mean to do, and do the one that matters most to them, if any matters enough.
export const INTENT_AT = 0.4;
export function intentDay(w: World) {
  const day = Math.floor(w.now / DAY);
  const st = (w.intentStats ??= {});
  for (const c of Object.values(w.chars).sort(byId)) {
    if (!c.alive || c.isPlayer || (hashOf(c.id) + day) % 7 !== 0) continue;
    const best = intentsOf(w, c)[0];
    if (!best || best.score + w.rng.range(-0.05, 0.05) < INTENT_AT) continue;
    best.act();
    st[best.kind] = (st[best.kind] ?? 0) + 1;
    if (best.to.isPlayer) st['player'] = (st['player'] ?? 0) + 1;
  }
}
const hashOf = (id: string) => { let h = 7; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
