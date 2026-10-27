// What men do to each other's world when they talk, as world actions (Gate 4). The old conversation engine (dialogue.ts, flows.ts,
// talk.ts, threads.ts) did these inline, mixed with its decisions and words; here they are the world's own, with the rules they always
// had, and the conversation layer reaches them only through its doors (conv/doors.ts). Nothing here decides anything: whether a man
// agrees, pays or admits a thing is decided before one of these is called.
import { openChopShop } from './enterprise';
import { link, addFact, bearOn, clamp, createDebt, earn, feelOn, payDebt, rel, repute, restructure, transfer, writeDown } from './core';
import { post } from './ledger';
import { addFavour } from './encounters';
import { bizMove, clearArrears, giveTime, setCollector, takeFromBiz } from './econ';
import { r5 } from './negotiate';
import { DAY, type Business, type Character, type Debt, type Fact, type Grievance, type Id, type Job, type Memo, type World } from './types';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

// ---------------------------------------------------------------- money
// money spent on a man that goes to nobody in particular (a round, a drink): out of the world, on the ledger
// money given, no strings (a gift the player makes: posted, and nothing else)
export function gift(w: World, from: Character, to: Character, amt: number, why: string): number { return transfer(w, from, to, amt, 'gift', why); }
export function spend(w: World, c: Character, amt: number, note: string): number {
  const x = Math.max(0, Math.min(Math.round(amt), Math.floor(c.cash)));
  if (!x) return 0;
  c.cash -= x;
  post(w, { from: c.id, to: 'world', amt: x, flow: 'spend', note });
  return x;
}
// money handed to a man above as a gift, over and above what is owed: it is a gift to him, and he feels it (the caller's regard), but it
// is not money passed up to the family (path.ts counts the envelopes, kick-ups and what is handed over in person: earned, not bought)
// (posted as a gift, not as the week's kick-up: it is over and above what is owed, and the week's account must not count it as handed up)
export function tribute(w: World, p: Character, boss: Character, amt: number, why: string): number {
  return transfer(w, p, boss, amt, 'gift', why);
}

// ---------------------------------------------------------------- what is on record between two men
export function memo(w: World, holder: Character, other: Id, kind: Memo['kind'], text: string, o: { due?: number; ref?: Id; done?: boolean } = {}): Memo {
  const m: Memo = { id: 'm' + w.nextId++, t: w.now, other, kind, text, ...(o.due ? { due: o.due } : {}), ...(o.ref ? { ref: o.ref } : {}), ...(o.done !== undefined ? { done: o.done } : {}) };
  holder.memos.push(m);
  return m;
}
// the same memo is not written twice while it stands
export function memoOnce(w: World, holder: Character, other: Id, kind: Memo['kind'], text: string, due?: number): void {
  if (holder.memos.some((m) => m.other === other && !m.done && m.text === text)) return;
  memo(w, holder, other, kind, text, { due });
}
export function memoDone(m: Memo): void { m.done = true; }
// a man lies to the player about a thing he did: the lie is on record, so it can be put to him if the truth comes out (bounded)
export function denied(w: World, t: Character, fact: Id): void {
  const dn = (t.denied ??= {});
  dn[fact] = Math.floor(w.now / DAY);
  const ks = Object.keys(dn);
  if (ks.length > 10) delete dn[ks.sort((x, y) => dn[x] - dn[y])[0]];
}
export function undenied(t: Character, fact: Id): void { delete t.denied?.[fact]; }
// what the player has worked out about a man (his want, his ties, his trouble), and the notes he keeps on him (bounded: the latest few)
export function insight(p: Character, about: Id, tag: string): void { const l = ((p.insight ??= {})[about] ??= []); if (!l.includes(tag)) l.push(tag); }
export function noteOn(p: Character, t: Character, text: string): void {
  const l = ((p.insight ??= {})[t.id] ??= []);
  const k = 'n:' + text, at = l.indexOf(k);
  if (at >= 0) l.splice(at, 1);
  l.push(k);
  const ns = l.filter((x) => x.startsWith('n:'));
  if (ns.length > 6) l.splice(l.indexOf(ns[0]), 1);
}
export const notesOf = (p: Character, t: Character) => (p.insight?.[t.id] ?? []).filter((x) => x.startsWith('n:')).map((x) => x.slice(2));
// a man's own tags in the player's book ('ears': he passes on what he hears)
export function tagOn(p: Character, t: Id, tag: string): void { const n = ((p.notes ??= {})[t] ??= { tags: [] }); n.tags = [...new Set([...n.tags, tag])]; }
// a time before which something is not done again (the player's or a man's own clock)
export function cool(c: Character, key: string, until: number): void { c.cooldown[key] = until; }
// two men have met, and now know each other by name (the player's introductions, Rel.lastMet)
export function introduced(w: World, p: Character, t: Character): void { (p.intro ??= {})[t.id] = w.now; rel(p, t.id).lastMet = rel(t, p.id).lastMet = w.now; }
export function turnedAway(w: World, p: Character, t: Character): void { p.cooldown[`intro:${t.id}`] = w.now + DAY; rel(p, t.id).lastMet = w.now; }
// what a man wants, settled the first time anyone asks (crewlife.wantFor decides it from who he is)
export function settleWant(w: World, t: Character, kind: NonNullable<Character['want']>['kind']): NonNullable<Character['want']>['kind'] { return (t.want ??= { kind, since: w.now }).kind; }
// a trouble of his (gambling, debt, family…) is out: the player knows it, and so does whoever he tells
export function revealProblem(t: Character): void { if (t.problem) t.problem.revealed = true; }
// a man told to mind himself minds himself, for a while
export function restrain(w: World, t: Character): void { t.cooldown.restraint = Math.max(t.cooldown.restraint ?? 0, w.now); }

// ---------------------------------------------------------------- his work, his heat, his side income
export function keepLow(t: Character): void { t.heat = Math.max(0, t.heat - 0.2); }
export function sideIncome(w: World, t: Character): void { if (!t.books.side) t.books.side = w.rng.int(80, 220); t.books.sideKnown = true; t.heat = clamp(t.heat + 0.1, 0, 1.5); }
// a side operation of his comes out, to the player and to the record
export function sideRevealed(w: World, t: Character, p: Character): void {
  t.books.sideKnown = true;
  addFact(w, { kind: 'side_operation', actor: t.id, victim: t.bossId ?? undefined, amount: t.books.side, text: `${t.name} has been running something on the side.`, district: t.district }, { witnesses: [p.id] });
}

// ---------------------------------------------------------------- jobs
// finished work, told to the man who gave it: up to two at a time, and the player's name grows with each
export function reportJobs(w: World, p: Character, t: Character): number {
  const rep = w.jobs.filter((j) => j.status === 'done' && j.giver === t.id && j.assignee === p.id && !j.reported).slice(0, 2);
  for (const j of rep) j.reported = true;
  feelOn(w, rel(t, p.id), 'trust', 0.03 * rep.length); feelOn(w, rel(t, p.id), 'respect', 0.02 * rep.length);
  repute(w, p, rep.length, 'report');
  return rep.length;
}
// work refused to a man's face: it is off the books, and it costs the player with him and with everyone who hears
export function refuseJob(w: World, p: Character, j: Job): void { j.status = 'declined'; repute(w, p, -(j.via === 'boss' ? 5 : 2), 'refused work'); }
// a promise to see to a man for someone: the work, and the promise it is held to
export function promiseToHandle(w: World, p: Character, t: Character, target: Character, o: { title: string; brief: string; pay: number; cause?: Id; memo: string }, mkJob: (w: World, j: never) => Job): Job {
  const j = mkJob(w, { kind: 'handle', title: o.title, brief: o.brief, giver: t.id, via: 'tip', assignee: p.id, target: target.id, cause: o.cause, pay: o.pay, status: 'active', days: 14 } as never);
  memo(w, t, p.id, 'promise', o.memo, { ref: j.id, due: w.now + 10 * DAY });
  return j;
}

// ---------------------------------------------------------------- the player's standing in the family
export function setBacker(p: Character, t: Character): void { p.backer = t.id; }
export function settleFavour(w: World, from: Id, to: Id): boolean { const f = w.favours.find((q) => !q.settled && q.from === from && q.to === to); if (!f) return false; f.settled = true; return true; }
// a grievance on the books between two men (one per quarrel), for a sit-down to settle
export function grievance(w: World, g: Grievance): Grievance { w.grievances.push(g); return g; }
// a complaint written up, not yet on the books (a sit-down puts it there only if it takes place)
export function draftGrievance(w: World, g: Omit<Grievance, 'id' | 'status' | 'created' | 'postponed'>): Grievance { return { id: 'g' + w.nextId++, ...g, status: 'open', created: w.now, postponed: 0 }; }
export function dropGrievance(w: World, g: Grievance): void { const i = w.grievances.indexOf(g); if (i >= 0) w.grievances.splice(i, 1); }

// ---------------------------------------------------------------- a shop that pays the player
// the weekly fee changes, by agreement or by pressure, and it is on record (a memo with him, a fact for the street)
export function setFee(w: World, p: Character, t: Character, b: Business, fee: number, memoKind: Memo['kind'], memoText: string, factText?: string): void {
  b.protection = { ...b.protection!, fee };
  memo(w, t, p.id, memoKind, memoText);
  if (factText) addFact(w, { kind: 'terms', actor: p.id, victim: t.id, business: b.id, minor: true, text: factText, district: b.district }, { witnesses: [] });
}
// a quarter off his fee, once a month at most
export function cutFee(w: World, p: Character, t: Character, b: Business): { old: number; now: number } {
  p.cooldown['cut:' + b.id] = w.now + 30 * DAY;
  const old = b.protection!.fee, now = Math.max(5, r5(old * 0.75));
  setFee(w, p, t, b, now, 'agreement', `You cut his weekly fee from ${money(old)} to ${money(now)}.`, `${p.name} cut ${b.name}’s weekly fee from ${money(old)} to ${money(now)}.`);
  return { old, now };
}
// he would not pay more, and said so: on the record
export function refusedMore(w: World, t: Character, p: Character, b: Business): void {
  addFact(w, { kind: 'protection_refused', actor: t.id, victim: p.id, business: b.id, text: `${t.name} refused to pay ${p.name} more for ${b.name}.`, district: b.district }, { witnesses: [p.id] });
}
// this week's envelope handed back to a struggling shop
export function handBack(w: World, p: Character, b: Business): boolean {
  const fee = b.protection!.fee;
  if (p.cash < fee) return false;
  p.cash -= fee;
  bizMove(w, b, fee, 'aid', p.id);
  b.distress = Math.max(0, b.distress - 1);
  return true;
}
// a week's grace for a shop behind with its fee: his gratitude, and a little of the player's name
export function graceWeek(w: World, p: Character, b: Business): void { giveTime(b); repute(w, p, -0.5, 'gave way'); }
// made to pay what he owes, now, whatever it leaves him
export function leanOnShop(w: World, p: Character, b: Business): number {
  const fee = Math.max(b.protection!.fee, b.protection!.owed ?? 0);
  const pay = takeFromBiz(w, b, fee, p.id, true);
  if (pay > 0) earn(p, pay, 'protection');
  clearArrears(b);
  return pay;
}
// a shop that agrees, there and then, to be looked after (econ.setCollector), and the record of it
export function takeOnShop(w: World, p: Character, t: Character, b: Business, fee: number): void {
  b.lastApproach = w.now;
  setCollector(w, b, p.id, p.familyId!, { fee });
  addFact(w, { kind: 'protection_started', actor: p.id, victim: t.id, business: b.id, amount: fee, text: `${p.name} now collects ${money(fee)} a week from ${b.name}.`, district: b.district }, { witnesses: [] });
}

// ---------------------------------------------------------------- a chop-shop partnership in his garage
export function chopShop(w: World, p: Character, t: Character, b: Business): void {
  transfer(w, p, t, 2000, 'stake', `a chop shop at ${b.name}`);
  openChopShop(w, p, t, b, 0.3, 'a partnership, for 30% of what it makes');
  memo(w, t, p.id, 'agreement', `You agreed to run a chop shop out of ${b.name}; he takes 30%.`);
}

// ---------------------------------------------------------------- debts
export const owedBy = (w: World, creditor: Id, debtor: Id) => w.debts.find((d) => d.status === 'active' && d.creditor === creditor && d.debtor === debtor);
// another week: one missed payment forgiven
export function debtWeek(d: Debt): void { d.missed = Math.max(0, d.missed - 1); d.nextDue += 7 * DAY; }
export function debtHalved(d: Debt): void { restructure(d, { payment: Math.max(25, d.weeklyPayment / 2) }); }
export function debtForFavour(w: World, d: Debt): void { writeDown(w, d, 300); addFavour(w, d.creditor, d.debtor, 2, 'wiped $300 of his debt'); }
export function debtQuarterOff(w: World, p: Character, d: Debt): void { writeDown(w, d, d.balance * 0.25); repute(w, p, -0.5, 'gave way'); }
// money down for a week's grace on what the player owes
export function payForTime(w: World, d: Debt, amt: number): void { payDebt(w, d, amt); d.nextDue += 7 * DAY; }
export function moreTime(d: Debt): void { d.nextDue += 7 * DAY; }

// ---------------------------------------------------------------- between the families
export function tension(w: World, a: Character, b: Character, d: number, floor = false): void {
  if (!a.familyId || !b.familyId) return;
  const A = w.fam[a.familyId], B = w.fam[b.familyId];
  A.tension[b.familyId] = floor ? Math.max(0, (A.tension[b.familyId] ?? 0) + d) : (A.tension[b.familyId] ?? 0) + d;
  B.tension[a.familyId] = floor ? Math.max(0, (B.tension[a.familyId] ?? 0) + d) : (B.tension[a.familyId] ?? 0) + d;
}
export function heat(c: Character, d: number): void { c.heat = clamp(c.heat + d, 0, 1.5); }

// an encounter he has put to the player, given longer before it lapses (the player asked him to wait)
export function putOffEnc(e: import('./types').Enc, until: number): void { e.expires = Math.max(e.expires, until); }

// ---------------------------------------------------------------- money handed back by a man who wronged the player
export function giveBack(w: World, t: Character, p: Character, f: Fact): number {
  const amt = Math.min(f.amount ?? 0, Math.max(0, t.cash));
  return amt > 0 && f.victim === p.id ? transfer(w, t, p, amt, 'repay', 'what he took') : 0;
}
// a grudge eased, or raised (bearOn on the record between them)
export function softens(w: World, t: Character, p: Character, amt: number, why: string): void { bearOn(w, rel(t, p.id), -amt, why); }

// ---------------------------------------------------------------- a loan at a friend's rate, as the situations put it (situations.helpWith)
export function friendLoan(w: World, p: Character, t: Character, amt: number, rate: number, why: string): Debt | undefined {
  if (p.cash < amt) return undefined;
  p.cash -= amt; t.cash += amt; // (the loan itself is posted once, by createDebt)
  return createDebt(w, p.id, t.id, amt, rate, why);
}

// ---------------------------------------------------------------- what a man remembers of what was said with him (Character.talk)
// asked again: the count goes up; stamped: once, as of today
export function talkNote(w: World, t: Character, key: string, sig: string): void { const m = (t.talk ??= {}), o = m[key]; m[key] = { d: Math.floor(w.now / DAY), sig, n: (o?.n ?? 0) + 1 }; }
export function talkStamp(w: World, t: Character, key: string, sig = 'x'): void { (t.talk ??= {})[key] = { d: Math.floor(w.now / DAY), sig, n: 1 }; }
// ---------------------------------------------------------------- his troubles, his books
export function easeProblem(t: Character, d: number): void { if (t.problem) t.problem.sev = clamp(t.problem.sev + d); }
export function skimOwned(t: Character): void { delete t.books.skim; delete t.books.hide; }
// what a man of the player's owes up, made up there and then, from what he has on him (posted as money paid back)
export function madeUp(w: World, t: Character, p: Character, amt: number): number { const x = transfer(w, t, p, amt, 'repay', 'what he owed up'); t.books.arrears = Math.max(0, t.books.arrears - x); return x; }
// ---------------------------------------------------------------- what a man knows, told him directly (not through the rumour mill)
export function toldDirect(w: World, c: Character, f: Fact, from: Id): void { c.known[f.id] = { t: w.now, from, knowsActor: true }; }
export function knowsWho(p: Character, f: Fact): void { const k = p.known[f.id]; if (k) k.knowsActor = true; }
// introduced through a man: the player knows him now, and the two have a footing (core.link)
export function introducedThrough(w: World, p: Character, o: Character, trust: number): void { (p.intro ??= {})[o.id] = w.now; link(p, o, trust); }
