// Restaurants, bars and garages, run (October 2026, the Economic World Expansion). A place already has an owner, a manager, other men's
// stakes, its accounts and its trade (econ.ts); here it also has the people who work there and the people who come in, and what
// arises among them: the till coming up short, a man in the life who drinks on the house, a cook in over his head asking for an
// advance, a man with money who wants to buy the place. Each comes from the people's own circumstances (motive), reaches a player who
// owns the place through the man concerned, and an NPC owner meets the same thing and deals with it himself. A place with honest
// staff and paying customers runs quietly for months; that is a good outcome, not a gap.
import { addFact, bear, createDebt, feel, money, ownerBiz, rel, transfer } from './core';
import { bizMove, priceOf, sellTo, setManager, trade } from './econ';
import { addEnc, addFavour } from './encounters';
import { PROBLEM_LABEL } from './people';
import { temper } from './temper';
import { arch } from './voice';
import { DAY, type Business, type Character, type Enc, type Id, type World } from './types';

const first = (c: Character) => c.name.split(' ')[0];
const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const ok = (w: World, c?: Character) => !!c?.alive && c.jailedUntil <= w.now;
const RANKS = ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'];

// Who works in each kind of place, and how many come in regularly enough to be known there.
export const PLACE_STAFF: Record<string, { jobs: string[]; regs: number }> = {
  restaurant: { jobs: ['the cook', 'a waiter', 'the dishwasher'], regs: 6 },
  bar: { jobs: ['the bartender', 'the barback'], regs: 6 },
  diner: { jobs: ['the cook', 'the waitress'], regs: 5 },
  cafe: { jobs: ['the man behind the counter'], regs: 4 },
  billiards: { jobs: ['the rack man'], regs: 5 },
  garage: { jobs: ['a mechanic', 'a mechanic'], regs: 3 },
};
export const isEstablishment = (b: Business) => !!PLACE_STAFF[b.kind];

// ------------------------------------------------------------------------------------------------ why a man does what he does
// What is pressing on a man, from the world's own record of him: what he owes and to whom, his trouble, what he wants, how short he is,
// what he holds against someone. `told` is how the player would put it, said only from what the player could know (`p` given).
export interface Motive { kind: 'debt' | 'problem' | 'want' | 'broke' | 'grudge' | 'greed' | 'ambition'; weight: number; told?: string }
export function motives(w: World, c: Character, toward?: Character, p?: Character): Motive[] {
  const out: Motive[] = [];
  const debts = w.debts.filter((d) => d.status === 'active' && d.debtor === c.id).sort((a, b) => b.balance - a.balance);
  const owed = debts.reduce((a, d) => a + d.balance, 0);
  if (owed > 150) { const cr = w.chars[debts[0].creditor]; const seen = !p || !!(debts[0].cause && p.known[debts[0].cause]) || cr?.id === p?.id; out.push({ kind: 'debt', weight: Math.min(1, owed / 1500), told: seen && cr ? `He owes ${cr.isPlayer ? 'you' : cr.name} ${money(Math.round(owed / 50) * 50)}.` : undefined }); }
  if (c.problem && c.problem.sev > 0.3) out.push({ kind: 'problem', weight: c.problem.sev, told: !p || c.problem.revealed ? `He has ${PROBLEM_LABEL[c.problem.kind]}.` : undefined });
  if (c.want && ['rich', 'independent', 'made', 'gamble'].includes(c.want.kind)) out.push({ kind: 'want', weight: 0.5, told: undefined });
  if (c.cash < 120) out.push({ kind: 'broke', weight: 0.4, told: undefined });
  if (toward) { const r = c.rels[toward.id]; if (r && r.grudge > 0.25) out.push({ kind: 'grudge', weight: r.grudge, told: r.why?.text && (!p || toward.id === p.id) ? `He hasn’t forgotten: ${r.why.text.replace(/[.!?]?$/, '')}.` : undefined }); }
  // (a man's nature is the one reason anyone can see for himself)
  if (c.traits.greed > 0.72) out.push({ kind: 'greed', weight: c.traits.greed - 0.5, told: `${c.name.split(' ')[0]} has always counted what other men make.` });
  if (c.traits.ambition > 0.72) out.push({ kind: 'ambition', weight: c.traits.ambition - 0.5, told: `${c.name.split(' ')[0]} wants to be more than the man who runs it.` });
  return out.sort((a, b) => b.weight - a.weight);
}
export const pressed = (ms: Motive[]) => ms.reduce((a, m) => a + (m.kind === 'greed' || m.kind === 'ambition' ? m.weight * 0.6 : m.weight), 0);
export const toldOf = (ms: Motive[]) => ms.find((m) => m.told)?.told;

// ------------------------------------------------------------------------------------------------ the people of a place
const note = (w: World, b: Business, text: string, who?: Id) => { (b.hist ??= []).push({ t: w.now, text, who }); if (b.hist.length > 24) b.hist.splice(0, b.hist.length - 24); };
const employed = (w: World) => new Set(Object.values(w.biz).flatMap((b) => (b.staff ?? []).map((s) => s.id)));
function keepStaff(w: World, b: Business, taken: Set<Id>) {
  const spec = PLACE_STAFF[b.kind];
  b.staff = (b.staff ?? []).filter((s) => { const c = w.chars[s.id]; if (!c?.alive || c.jailedUntil > w.now + 21 * DAY || ownerBiz(w, c.id)) { if (c) note(w, b, `${c.name} doesn’t work here any more.`, c.id); return false; } return true; });
  for (const job of spec.jobs.slice(b.staff.length)) {
    const cs = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank === 'civilian' && !taken.has(c.id) && !ownerBiz(w, c.id) && c.id !== b.ownerId && c.id !== b.managerId && c.district === b.district).sort(byId);
    if (!cs.length) break;
    const c = cs[w.rng.int(0, Math.min(cs.length, 5) - 1)];
    b.staff.push({ id: c.id, job, since: w.now }); taken.add(c.id);
    if (b.staff.length > 1 || w.now > 7 * DAY) note(w, b, `${c.name} started as ${job}.`, c.id);
  }
}
function keepRegulars(w: World, b: Business) {
  const n = PLACE_STAFF[b.kind].regs;
  b.regs = (b.regs ?? []).filter((id) => ok(w, w.chars[id]) && w.chars[id].district === b.district);
  if (b.regs.length >= n) return;
  // (who comes in: the neighbourhood, and men in the life who drink near home; a bar takes the drinkers, a restaurant those with money)
  const fit = (c: Character) => b.kind === 'bar' || b.kind === 'billiards' ? c.traits.vice + c.traits.sociability : b.kind === 'restaurant' ? Math.min(1, c.cash / 800) + c.traits.sociability * 0.5 : c.traits.sociability;
  const cs = Object.values(w.chars).filter((c) => ok(w, c) && !c.isPlayer && c.district === b.district && c.id !== b.ownerId && !(b.regs ?? []).includes(c.id) && !(b.staff ?? []).some((s) => s.id === c.id)).sort((a, x) => fit(x) - fit(a) || byId(a, x));
  for (const c of cs.slice(0, n - b.regs.length)) b.regs.push(c.id);
}

// ------------------------------------------------------------------------------------------------ the week of every place
export function establishmentsWeek(w: World) {
  const taken = employed(w);
  for (const b of Object.values(w.biz).filter((x) => x.open && isEstablishment(x)).sort(byId)) {
    const o = w.chars[b.ownerId];
    if (!o?.alive) continue;
    keepStaff(w, b, taken);
    keepRegulars(w, b);
    // a man who comes in week after week knows the owner, and the owner him
    for (const id of (b.regs ?? []).slice(0, 3)) { const c = w.chars[id]; if (c && !o.isPlayer) feel(w, c, o.id, 'trust', 0.002); }
    tillWeek(w, b, o);
    tabWeek(w, b, o);
    advanceAsk(w, b, o);
    offerFor(w, b, o);
  }
}

const coolOk = (w: World, b: Business, k: string) => (b.cool?.[k] ?? 0) <= w.now;
const cool = (w: World, b: Business, k: string, days: number) => { (b.cool ??= {})[k] = w.now + days * DAY; };
const openFor = (w: World, b: Business, k: string) => w.enc.some((e) => e.status === 'open' && e.kind === 'place' && e.data?.k === k && e.data?.biz === b.id);

// The till comes up short: the manager, or a man behind the counter, under some pressure of his own and not much held by the owner.
function tillWeek(w: World, b: Business, o: Character) {
  const hands = [...(b.managerId && w.chars[b.managerId] && !w.chars[b.managerId].isPlayer ? [{ id: b.managerId, job: 'the manager' }] : []), ...(b.staff ?? []).filter((s) => s.job !== 'the dishwasher')];
  for (const h of hands) {
    const c = w.chars[h.id];
    if (!ok(w, c)) continue;
    const ms = motives(w, c, o);
    const held = rel(c, o.id).trust;
    const tempted = pressed(ms) + (['schemer', 'bitter'].includes(arch(c)) ? 0.4 : 0) - held * 0.8 - temper(c).caution * 0.3;
    if (tempted < 0.35 || !w.rng.chance(0.3)) continue;
    // (a little out of the week's takings, never so much that the till is empty)
    const amt = Math.round(Math.min(Math.max(0, b.cash) * 0.5, b.income * (0.03 + tempted * 0.05)));
    if (amt < 15) continue;
    bizMove(w, b, -amt, 'theft', c.id); c.cash += amt;
    (b.skim ??= {})[c.id] = (b.skim[c.id] ?? 0) + amt;
  }
  // it shows in the takings, sooner or later
  for (const [id, amt] of Object.entries(b.skim ?? {})) {
    const c = w.chars[id];
    if (!c?.alive) { delete b.skim![id]; continue; }
    if (amt < 250 || !coolOk(w, b, 'till') || openFor(w, b, 'till')) continue;
    cool(w, b, 'till', 45);
    const job = id === b.managerId ? 'the manager' : (b.staff ?? []).find((s) => s.id === id)?.job ?? 'one of them';
    if (!o.isPlayer) {
      // an NPC owner who sees it: lets him go, and the man takes it the way he takes it
      if (w.rng.chance(0.5 + temper(o).volatility * 0.3)) {
        if (id === b.managerId) setManager(w, b, o, null); else b.staff = (b.staff ?? []).filter((s) => s.id !== id);
        bear(w, c, o.id, 0.2, `${o.name} let him go from ${b.name}`);
        note(w, b, `${c.name} was let go: the till was short.`, c.id);
        addFact(w, { kind: 'report', actor: o.id, victim: c.id, minor: true, text: `${o.name} let ${c.name} go from ${b.name}. The till had been short.`, district: b.district }, { witnesses: [o.id, c.id, ...(b.regs ?? []).slice(0, 2)] });
        delete b.skim![id];
      }
      continue;
    }
    const why = toldOf(motives(w, c, o, o));
    addEnc(w, {
      kind: 'place', from: c.id, title: `The till at ${b.name}`, days: 6, data: { k: 'till', biz: b.id, who: c.id, amt },
      lines: [`The takings at ${b.name} have been coming up short for weeks: about ${money(Math.round(amt / 50) * 50)} that can’t be accounted for. ${c.name}, ${job}, handles the money.`, why ?? 'Nobody has said a word about it. Nobody would.'],
      opts: [
        { code: 'count', label: `Count the till with ${first(c)} standing there`, hint: 'You’ll know. So will he.' },
        { code: 'fire', label: `Let ${first(c)} go`, hint: 'The money stops going missing. He’ll say you accused him.' },
        { code: 'let', label: 'Let it go', hint: 'It’s a few dollars. A man who gets away with it once does it again.' },
      ],
    });
  }
}

// A man in the life who drinks on the house: his rank is above the owner's, or his family is, and he knows it.
function tabWeek(w: World, b: Business, o: Character) {
  if (!['bar', 'restaurant', 'billiards', 'diner', 'cafe'].includes(b.kind)) return;
  // (one such man to a place: the first who takes it as his due; and only where he drinks near home)
  const already = Object.keys(b.tab ?? {})[0];
  for (const id of already ? [already] : b.regs ?? []) {
    const c = w.chars[id];
    if (!ok(w, c) || !c.familyId || c.district !== b.district) continue;
    if (!already && Object.values(w.biz).some((x) => x !== b && x.tab?.[id])) continue;
    const above = RANKS.indexOf(c.rank) >= RANKS.indexOf(o.rank) + 2 || (!o.familyId && RANKS.indexOf(c.rank) >= 2);
    if (!above || c.traits.greed + temper(c).pride < 1.1 || rel(c, o.id).respect > 0.6) continue;
    const t = (b.tab ??= {});
    t[id] = (t[id] ?? 0) + Math.round(w.rng.range(20, 60));
    bizMove(w, b, -Math.round(t[id] * 0.02), 'expense', c.id); // (what he drinks, in the cost of the week)
    if (t[id] < 300 || !coolOk(w, b, 'tab:' + id) || openFor(w, b, 'tab')) continue;
    cool(w, b, 'tab:' + id, 365);
    if (!o.isPlayer) { note(w, b, `${c.name} drinks on the house. Nobody asks him to pay.`, c.id); bear(w, o, c.id, 0.05, `${c.name} drinks at ${b.name} and never pays`); continue; }
    const cap = c.bossId ? w.chars[c.bossId] : undefined;
    addEnc(w, {
      kind: 'place', from: c.id, title: `${first(c)} never pays at ${b.name}`, days: 8, data: { k: 'tab', biz: b.id, who: c.id, amt: t[id] },
      lines: [`${c.name}${c.familyId !== o.familyId ? ` of the ${w.fam[c.familyId].name} family` : ''} drinks at ${b.name} most nights, and has since the spring. He has never once put his hand in his pocket.`, `The tab nobody writes down comes to about ${money(Math.round(t[id] / 10) * 10)}. ${b.managerId && w.chars[b.managerId] ? `${first(w.chars[b.managerId])} asks what you want done.` : 'The bartender asks what you want done.'}`],
      opts: [
        { code: 'ride', label: 'Let it ride', hint: `${first(c)} owes you for it, whether he says so or not.` },
        { code: 'ask', label: `Ask ${first(c)} to settle up`, hint: RANKS.indexOf(c.rank) > RANKS.indexOf(o.rank) ? 'He outranks you. Men like him don’t like being asked.' : 'Politely. He may take it well.' },
        ...(cap?.alive && cap.id !== o.id ? [{ code: 'cap', label: `Have a word with ${first(cap)} about it`, hint: `${first(c)}’s captain can make him pay. ${first(c)} will know who went to him.` }] : []),
      ],
    });
  }
}

// One of the staff, in trouble of his own, asks for an advance on his wages.
function advanceAsk(w: World, b: Business, o: Character) {
  for (const s of b.staff ?? []) {
    const c = w.chars[s.id];
    if (!ok(w, c) || w.now - s.since < 21 * DAY || !coolOk(w, b, 'adv:' + c.id)) continue;
    const ms = motives(w, c, o).filter((m) => m.kind === 'debt' || m.kind === 'problem' || m.kind === 'broke');
    if (pressed(ms) < 0.6 || !w.rng.chance(0.25)) continue;
    cool(w, b, 'adv:' + c.id, 90);
    const amt = 200;
    if (!o.isPlayer) {
      if (temper(o).empathy + rel(o, c.id).trust > 0.9 && o.cash > 600) { transfer(w, o, c, amt, 'loan', 'an advance'); createDebt(w, o.id, c.id, amt, 0, 'an advance on his wages'); feel(w, c, o.id, 'trust', 0.08); }
      else { (b.cool ??= {})['tempt:' + c.id] = w.now + 60 * DAY; bear(w, c, o.id, 0.05, `${o.name} wouldn’t help him`); }
      continue;
    }
    const why = toldOf(motives(w, c, o, o)) ?? 'He doesn’t say what for. He doesn’t look like a man asking for the fun of it.';
    addEnc(w, {
      kind: 'place', from: c.id, title: `${first(c)} asks for an advance`, days: 5, data: { k: 'advance', biz: b.id, who: c.id, amt },
      lines: [`${c.name}, ${s.job} at ${b.name}, waits until the place is empty. He wants ${money(amt)} against his wages.`, why],
      opts: [
        { code: 'give', label: `Give him the ${money(amt)}`, hint: 'He pays it back out of his wages. He won’t forget who helped him.' },
        { code: 'no', label: 'Tell him you can’t', hint: 'A man in trouble with no help finds help somewhere else.' },
      ],
    });
  }
}

// A man with money wants the place: to own something, to clean money through it, or for his family to have a foot on this street.
function offerFor(w: World, b: Business, o: Character) {
  if (!coolOk(w, b, 'offer') || openFor(w, b, 'offer') || w.now < 30 * DAY) return;
  const price = priceOf(w, b);
  const rivalFoot = (c: Character) => !!c.familyId && !!o.familyId && c.familyId !== o.familyId && !w.fam[c.familyId]?.districts.includes(b.district);
  const want = Object.values(w.chars).filter((c) => ok(w, c) && !c.isPlayer && c.id !== o.id && c.cash > price * 1.15 && !ownerBiz(w, c.id) && (c.traits.ambition > 0.6 || rivalFoot(c)) && (c.district === b.district || rivalFoot(c))).sort(byId);
  if (!want.length || !w.rng.chance(0.04 + (b.distress > 0 ? 0.06 : 0))) { if (want.length) cool(w, b, 'offer', 21); return; }
  const c = want[w.rng.int(0, want.length - 1)];
  cool(w, b, 'offer', 120);
  const offer = Math.round(price * w.rng.range(1.0, 1.3) / 50) * 50;
  const foot = rivalFoot(c);
  if (!o.isPlayer) {
    // an NPC owner sells when the place is struggling or the money is very good, and to another family only if he's afraid not to
    if ((b.distress >= 2 || offer > price * 1.25) && (!foot || temper(o).caution > 0.6) && sellTo(w, c, b, offer)) note(w, b, `${o.name} sold it to ${c.name} for ${money(offer)}.`, c.id);
    return;
  }
  addEnc(w, {
    kind: 'place', from: c.id, title: `${first(c)} wants to buy ${b.name}`, days: 7, data: { k: 'offer', biz: b.id, who: c.id, amt: offer },
    lines: [`${c.name}${c.familyId ? ` of the ${w.fam[c.familyId].name} family` : ''} has been in ${b.name} three times this week, looking at the walls the way a man looks at what he means to own.`, `He offers ${money(offer)} for it, cash.${foot ? ` His family has nothing on this street. Yet.` : ''}`],
    opts: [
      { code: 'sell', label: `Sell it to him for ${money(offer)}`, hint: 'It’s a fair price. It’s also your place.' },
      { code: 'no', label: 'Tell him it isn’t for sale', hint: foot ? 'His family may not like being told no.' : 'He’ll find somewhere else.' },
    ],
  });
}

// ------------------------------------------------------------------------------------------------ the player answers
export function placeChoose(w: World, p: Character, e: Enc, code: string): { lines: string[]; minutes: number } {
  e.status = 'done';
  const b = w.biz[String(e.data?.biz ?? '')], c = w.chars[String(e.data?.who ?? '')], amt = Number(e.data?.amt ?? 0);
  if (!b || !c) return { lines: ['It doesn’t matter now.'], minutes: 5 };
  const k = String(e.data?.k);
  if (k === 'till') {
    if (code === 'let') return { lines: ['You let it go. The till stays a little light.'], minutes: 5 };
    const took = b.skim?.[c.id] ?? 0;
    if (code === 'count') {
      if (took < 100) { feel(w, c, p.id, 'trust', -0.05); return { lines: [`You count it with ${first(c)} at your shoulder. It adds up, near enough. He says nothing, and you can feel him say it.`], minutes: 60 }; }
      const back = transfer(w, c, p, Math.min(took, c.cash), 'repay', 'what he took from the till');
      delete b.skim![c.id];
      bear(w, c, p.id, 0.12, `${p.name} caught him with his hand in the till`);
      note(w, b, `${c.name} was caught short at the till. He paid back ${money(back)}.`, c.id);
      return { lines: [`It doesn’t add up, and you both know it. ${first(c)} puts ${money(back)} on the counter without being told. Whether he stays is up to you.`], minutes: 60 };
    }
    if (c.id === b.managerId) setManager(w, b, p, null); else b.staff = (b.staff ?? []).filter((s) => s.id !== c.id);
    delete b.skim?.[c.id];
    bear(w, c, p.id, 0.25, `${p.name} let him go from ${b.name}`);
    note(w, b, `You let ${c.name} go.`, c.id);
    addFact(w, { kind: 'report', actor: p.id, victim: c.id, minor: true, text: `${p.name} let ${c.name} go from ${b.name}. The till had been short.`, district: b.district }, { witnesses: [p.id, c.id, ...(b.regs ?? []).slice(0, 3)] });
    return { lines: [`You tell ${first(c)} he’s finished at ${b.name}. He takes his coat and tells everyone on the way out that he was accused.`], minutes: 20 };
  }
  if (k === 'tab') {
    const cap = c.bossId ? w.chars[c.bossId] : undefined;
    if (code === 'ride') { addFavour(w, p.id, c.id, 1, `drinks on the house at ${b.name}`); return { lines: [`You let it ride. ${first(c)} keeps drinking, and you keep the count in your head. One day it will be worth something.`], minutes: 5 }; }
    if (code === 'cap' && cap?.alive) {
      const paid = transfer(w, c, p, Math.min(amt, c.cash), 'repay', 'his tab');
      bear(w, c, p.id, 0.2, `${p.name} went to his captain about a bar tab`); feel(w, cap, p.id, 'respect', 0.02);
      delete b.tab?.[c.id];
      return { lines: [`${first(cap)} hears you out and sends ${first(c)} round. He pays ${money(paid)}, and looks at you while he does it.`], minutes: 40 };
    }
    // asked to his face
    if (RANKS.indexOf(c.rank) > RANKS.indexOf(p.rank) && temper(c).pride > 0.5) {
      bear(w, c, p.id, 0.25, `${p.name} asked him to pay for his drinks`);
      addFact(w, { kind: 'threat', actor: c.id, victim: p.id, text: `${p.name} asked ${c.name} to settle his tab at ${b.name}. ${c.name} didn’t take it well.`, district: b.district }, { witnesses: [p.id, c.id, ...(b.regs ?? []).slice(0, 3)] });
      return { lines: [`${first(c)} looks at you like a man who has been asked for his papers. “Put it on my tab.” Everyone in the place heard it.`], minutes: 15 };
    }
    const paid = transfer(w, c, p, Math.min(amt, c.cash), 'repay', 'his tab'); delete b.tab?.[c.id];
    feel(w, c, p.id, 'respect', 0.03);
    return { lines: [`${first(c)} laughs, and pays ${money(paid)}. “You’re all right. Most guys wouldn’t ask.”`], minutes: 15 };
  }
  if (k === 'advance') {
    if (code === 'give') { const x = transfer(w, p, c, amt, 'loan', 'an advance'); if (x) createDebt(w, p.id, c.id, x, 0, 'an advance on his wages'); feel(w, c, p.id, 'trust', 0.1); feel(w, c, p.id, 'affection', 0.05); return { lines: [`${first(c)} takes it and says thank you twice. He means both.`], minutes: 10 }; }
    (b.cool ??= {})['tempt:' + c.id] = w.now + 60 * DAY; bear(w, c, p.id, 0.06, `${p.name} wouldn’t help him`);
    return { lines: [`${first(c)} nods. “Sure. I understand.” He goes back to work.`], minutes: 5 };
  }
  if (k === 'offer') {
    if (code === 'sell' && sellTo(w, c, b, amt)) { note(w, b, `You sold it to ${c.name} for ${money(amt)}.`, c.id); return { lines: [`${first(c)} counts out ${money(amt)} on the bar. ${b.name} is his. The regulars will take a week to stop calling it yours.`], minutes: 40 }; }
    if (c.familyId && p.familyId && c.familyId !== p.familyId) { const A = w.fam[p.familyId], B = w.fam[c.familyId]; A.tension[c.familyId] = (A.tension[c.familyId] ?? 0) + 0.15; B.tension[p.familyId] = (B.tension[p.familyId] ?? 0) + 0.15; bear(w, c, p.id, 0.08, `${p.name} wouldn’t sell him ${b.name}`); }
    return { lines: [`${first(c)} shrugs. “Everything’s for sale. You’ll see.”`], minutes: 10 };
  }
  return { lines: [], minutes: 5 };
}
// how the place is doing, in a word (its takings against what it used to make)
export function placeWord(w: World, b: Business): string {
  const t = trade(w, b, 4), before = trade(w, b, 8);
  if (t.weeks < 2) return 'too early to say';
  const r = t.revenue / Math.max(1, before.revenue);
  return b.distress >= 2 || t.profit < 0 ? 'losing money' : t.profit < 60 ? 'just about paying its way' : r > 1.08 ? 'picking up' : r < 0.92 ? 'slipping' : 'steady';
}
