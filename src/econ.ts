// The business economy (V73).
//
// What was true before this file: a business's cash was changed from thirty places by hand, "late" protection was a dice roll
// that reached back and took the money from the collector, a business could not change hands, and nothing tied how well a place
// did to who ran it, what it cost or who was competing with it. Now:
//
//   bizMove()          the ONLY door a business's cash goes through. It changes the cash and writes the transaction, together.
//   w.txns             the record. Every figure about a business's money (revenue, profit, what the collector got, what the owner
//                      drew) is derived from it by the functions below. ledgerCheck() replays it against the real cash.
//   payProtection()    the weekly fee. Pays what the business can, remembers what it could not (`owed`) and why (`why`).
//   perf()             one understandable multiplier on revenue: who runs it, the neighbourhood, competition, investment, trouble.
//   transferBusiness() ownership is a real record that changes hands, with the history kept.
//
// Nothing here knows about the screen. Only the simulation knows why a payment was short (`protection.why`); everyone else works
// it out from evidence() - what a visitor could actually see.
import { addFact, clamp, earn, money, ownersChanged, rel } from './core';
import { spawnCivilian } from './world';
import { Business, Character, Id, Stake, TxKind, Txn, WeekAcct, WEEK, DAY, World } from './types';

export const ACCT_WEEKS = 8;
export const INVEST_CAP = 0.08;
const TXN_CAP = 3000;

export const wkOf = (t: number) => Math.floor(t / WEEK);

// ------------------------------------------------------------------ the record

const tailCache = new WeakMap<World, Map<Id, Txn>>();
export function bizMove(w: World, b: Business, delta: number, kind: TxKind, who?: Id): number {
  const d = Math.round(delta);
  if (!d) return 0;
  (b as { cash: number }).cash += d;
  // A run of the same kind of movement with the same person on the same day is one entry (a casino table takes hundreds of bets).
  // Only the latest entry of this business is merged into, so the balances still chain.
  let tails = tailCache.get(w);
  if (!tails) { // first use in this process (a loaded save): rebuild it from the record, so loading changes nothing
    tailCache.set(w, (tails = new Map()));
    for (const x of w.txns ?? []) tails.set(x.b, x);
  }
  const tail = tails.get(b.id);
  if (tail && tail.k === kind && tail.who === who && Math.floor(tail.t / DAY) === Math.floor(w.now / DAY) && tail.bal + d === b.cash) { tail.d += d; tail.bal = b.cash; tail.t = w.now; return d; }
  const t: Txn = { t: w.now, k: kind, b: b.id, d, bal: b.cash };
  if (who) t.who = who;
  tails.set(b.id, t);
  const l = (w.txns ??= []);
  l.push(t);
  if (l.length > TXN_CAP) pruneTxns(w);
  return d;
}

// Safety valve only: the weekly strike keeps the list short; this stops a runaway week from growing it without limit.
export function pruneTxns(w: World) {
  const l = w.txns;
  if (l && l.length > TXN_CAP) l.splice(0, l.length - TXN_CAP);
}

const inRange = (x: Txn, from: number, to: number) => x.t > from && x.t <= to;

// Everything a business took in and paid out between two moments, by kind. All derived from the record.
export interface BizWeek { revenue: number; expenses: number; protection: number; stakes: number; drawn: number; injected: number; invested: number; lost: number; net: number }
const blank = (): BizWeek => ({ revenue: 0, expenses: 0, protection: 0, stakes: 0, drawn: 0, injected: 0, invested: 0, lost: 0, net: 0 });
export function bizBetween(w: World, id: Id, from: number, to: number): BizWeek {
  const o = blank();
  for (const x of w.txns ?? []) {
    if (x.b !== id || !inRange(x, from, to)) continue;
    o.net += x.d;
    switch (x.k) {
      case 'revenue': o.revenue += x.d; break;
      case 'expense': o.expenses -= x.d; break;
      case 'protection': case 'extort': o.protection -= x.d; break;
      case 'stake': o.stakes -= x.d; break;
      case 'draw': o.drawn -= x.d; break;
      case 'inject': o.injected += x.d; break;
      case 'invest': o.invested -= x.d; break;
      default: if (x.d < 0) o.lost -= x.d; else o.revenue += x.d;
    }
  }
  return o;
}
// Once a week the accounts are struck: the week's transactions are summed into the business's own record, and the transactions
// that are now summarised are dropped. The summary is only ever made from the transactions, never kept by hand.
export function strikeAccounts(w: World) {
  const to = w.now, from = w.now - WEEK;
  const wk = Math.round(w.now / WEEK); // the weekly run comes a few hours either side of the boundary
  for (const b of Object.values(w.biz)) {
    const x = bizBetween(w, b.id, from, to);
    const row: WeekAcct = { wk, t: to, revenue: x.revenue, expenses: x.expenses, net: x.net, close: b.cash };
    for (const k of ['protection', 'stakes', 'drawn', 'injected', 'invested', 'lost'] as const) if (x[k]) row[k] = x[k];
    const a = (b.acct ??= []);
    a.push(row);
    while (a.length > ACCT_WEEKS) a.shift();
  }
  // Keep the transactions of the week just struck (for replay and for the curious), nothing older.
  const l = w.txns;
  if (l) { let i = 0; while (i < l.length && l[i].t <= from) i++; if (i) l.splice(0, i); }
}
// The week that was struck at the start of week `wk`.
export function bizWeek(w: World, b: Business, wk: number): BizWeek {
  const row = b.acct?.find((r) => r.wk === wk);
  if (!row) return bizBetween(w, b.id, (wk - 1) * WEEK, wk * WEEK);
  return { revenue: row.revenue, expenses: row.expenses, protection: row.protection ?? 0, stakes: row.stakes ?? 0, drawn: row.drawn ?? 0, injected: row.injected ?? 0, invested: row.invested ?? 0, lost: row.lost ?? 0, net: row.net };
}
// What a business takes in and keeps, averaged over its last `n` struck weeks.
export function trade(w: World, b: Business, n = 4): { revenue: number; profit: number; weeks: number } {
  const rows = (b.acct ?? []).slice(-n).filter((r) => r.revenue || r.expenses);
  if (!rows.length) return { revenue: 0, profit: 0, weeks: 0 };
  const rev = rows.reduce((a, r) => a + r.revenue, 0), cost = rows.reduce((a, r) => a + r.expenses + (r.protection ?? 0) + (r.stakes ?? 0), 0);
  void w;
  return { revenue: rev / rows.length, profit: (rev - cost) / rows.length, weeks: rows.length };
}
// How the last struck week compares with what the place normally does (1 = normal).
export function slump(w: World, b: Business): number {
  const last = b.acct?.at(-1);
  void w;
  return last && last.revenue > 0 && b.income > 0 ? last.revenue / b.income : 1;
}

// Replay the record against the real cash. Every business's transactions must chain: each balance is the one before plus the
// movement, and the last is the cash now. Anything that changed a business's cash without going through bizMove shows here.
export function ledgerCheck(w: World): string[] {
  const bad: string[] = [];
  const last = new Map<Id, number>();
  for (const x of w.txns ?? []) {
    const prev = last.get(x.b);
    if (prev !== undefined && prev + x.d !== x.bal) bad.push(`${w.biz[x.b]?.name ?? x.b}: ${x.k} of ${x.d} at t=${x.t} leaves ${x.bal}, expected ${prev + x.d}`);
    last.set(x.b, x.bal);
  }
  for (const [id, bal] of last) if (w.biz[id] && w.biz[id].cash !== bal) bad.push(`${w.biz[id].name}: record ends at ${bal}, cash is ${w.biz[id].cash}`);
  return bad.slice(0, 20);
}

// ------------------------------------------------------------------ who runs it, and how well

export function operatorOf(w: World, b: Business): Character | undefined {
  const m = b.managerId ? w.chars[b.managerId] : undefined;
  if (m?.alive) return m;
  return w.chars[b.ownerId];
}
// 0..1. Brains and caution make a good manager; a man who is away is not running anything.
export function mgmtQuality(w: World, b: Business): number {
  const o = operatorOf(w, b);
  if (!o?.alive) return 0.3;
  let q = o.skills.brains * 0.5 + o.traits.caution * 0.25 + (1 - o.traits.vice) * 0.25;
  if (o.jailedUntil > w.now) q *= 0.5;
  else if (o.hurtUntil > w.now) q *= 0.75;
  return clamp(q, 0, 1);
}

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const TROUBLE = new Set(['robbery', 'vandalism', 'beating', 'murder', 'raid']);
const troubleCache = new WeakMap<World, { wk: number; by: Map<string, number> }>();
// Violence and robbery in a district keep customers away for a while. Read from the facts (the shared history), once a week.
function districtTrouble(w: World, district: string): number {
  let c = troubleCache.get(w);
  const wk = wkOf(w.now);
  if (!c || c.wk !== wk) {
    const by = new Map<string, number>();
    for (const f of Object.values(w.facts)) if (TROUBLE.has(f.kind) && w.now - f.t < 28 * DAY) by.set(f.district, (by.get(f.district) ?? 0) + 1);
    c = { wk, by }; troubleCache.set(w, c);
  }
  return c.by.get(district) ?? 0;
}
export function rivalsOf(w: World, b: Business): number {
  let n = 0;
  for (const x of Object.values(w.biz)) if (x.open && x.id !== b.id && x.kind === b.kind && x.district === b.district) n++;
  return n;
}

export interface Perf { mult: number; mgmt: number; demand: number; rivals: number; invest: number; trouble: number; notes: string[] }
// One multiplier on a week's trade. Each part is centred on 1 so the economy's overall level does not move; what moves is who does
// better or worse than the others, and why.
export function perf(w: World, b: Business): Perf {
  const notes: string[] = [];
  const mgmt = 0.94 + mgmtQuality(w, b) * 0.12; // 0.94 .. 1.06
  if (mgmt < 0.97) notes.push('badly run'); else if (mgmt > 1.03) notes.push('well run');
  const demand = 0.97 + (hash(b.district) % 7) * 0.01; // the neighbourhood's habit of spending: 0.97 .. 1.03, fixed
  const rv = rivalsOf(w, b);
  const rivals = clamp(1 - 0.04 * (rv - (b.rivals0 ?? rv)), 0.9, 1.06);
  if (rivals < 0.97) notes.push('new competition nearby'); else if (rivals > 1.02) notes.push('a rival has gone');
  const invest = 1 + (b.invest ?? 0);
  if ((b.invest ?? 0) > 0.03) notes.push('recently done up');
  const tr = districtTrouble(w, b.district);
  const trouble = clamp(1 - 0.012 * Math.max(0, tr - 3), 0.93, 1);
  if (trouble < 0.97) notes.push('trouble keeps customers away');
  const contested = (w.disputes ?? []).some((d) => (d.status === 'open' || d.status === 'violated') && d.biz === b.id);
  const mult = mgmt * demand * rivals * invest * trouble * (contested ? 0.95 : 1);
  if (contested) notes.push('two crews are fighting over it');
  return { mult, mgmt, demand, rivals, invest, trouble, notes };
}

// ------------------------------------------------------------------ the weekly accounts

export const owedOf = (b: Business) => b.protection?.owed ?? 0;
export function feeDue(b: Business): number { return b.protection ? b.protection.fee + owedOf(b) : 0; }

// The collector is paid for what the business actually handed over. Looking after a shop costs a little (a cop, a boy on the route).
export function creditCollector(w: World, b: Business, col: Character, pay: number) {
  const p = b.protection;
  if (!p || pay <= 0) return;
  p.total = (p.total ?? 0) + pay;
  p.since ??= w.now;
  earn(col, pay, 'protection');
  const upkeep = Math.round(pay * 0.22);
  const deal = (w.disputes ?? []).find((x) => x.status === 'settled' && x.terms?.cut && x.terms.biz === b.id && (x.terms.by ?? 0) > w.now);
  if (deal?.terms?.to && w.chars[deal.terms.to]?.alive) { const sh = Math.round(pay * deal.terms.cut!); col.cash -= sh; w.chars[deal.terms.to].cash += sh; col.books.expenses += sh; }
  col.cash -= upkeep;
  col.books.expenses += upkeep;
}

// Money taken out of a business on somebody's behalf outside the weekly run (a visit, a lean, a shakedown that worked). It comes out
// of the till first and, if `pocket` is set, then out of the owner's own pocket. What was owed comes down by what was taken; the
// caller credits whoever receives it. Returns what actually moved.
export function takeFromBiz(w: World, b: Business, want: number, who?: Id, pocket = false): number {
  want = Math.max(0, Math.round(want));
  const fromTill = Math.min(want, Math.max(0, b.cash));
  if (fromTill > 0) bizMove(w, b, -fromTill, 'protection', who);
  let extra = 0;
  if (pocket) {
    const o = w.chars[b.ownerId];
    if (o) { extra = Math.min(want - fromTill, Math.max(0, Math.round(o.cash))); o.cash -= extra; }
  }
  const amt = fromTill + extra;
  const p = b.protection;
  if (p && amt > 0) {
    p.owed = Math.max(0, (p.owed ?? 0) - amt);
    if (!p.owed) { p.late = 0; delete p.why; delete p.owed; }
  }
  return amt;
}
// He is given time: what he owes still stands, but he is no longer counted as late.
export function giveTime(b: Business) {
  const p = b.protection;
  if (!p) return;
  p.late = 0; delete p.why;
}
// The owner is told he has more time, or it is forgiven: the arrangement is square again.
export function clearArrears(b: Business) {
  const p = b.protection;
  if (!p) return;
  p.late = 0; delete p.owed; delete p.why;
}

// Why a protected business paid less than it owes this week. `unable` is the cash; `delayed` is a decision (it could have paid).
function payProtection(w: World, b: Business, o: Character, col: Character) {
  const rng = w.rng;
  const p = b.protection!;
  const due = p.fee + (p.owed ?? 0);
  const able = Math.max(0, b.cash);
  const fear = col.traits.violence * 0.5 + (w.chars[col.bossId ?? '']?.rank === 'boss' ? 0.1 : 0);
  const contested = (w.disputes ?? []).some((d) => (d.status === 'open' || d.status === 'violated') && d.biz === b.id);
  const grudge = Math.max(0, rel(o, col.id).grudge);
  // The owner CAN pay and does not: nerves, a quarrel over who to pay, a grudge, greed. Never because the till is empty.
  const pDelay = clamp(0.02 + o.traits.greed * 0.05 + grudge * 0.1 + (contested ? 0.08 : 0) + (b.damaged > 0 ? 0.04 : 0) - fear * 0.08, 0.005, 0.25);
  const held = (p.hold ?? 0) > w.now; // an open quarrel over who is owed: the owner is sitting on it
  const delayed = able >= p.fee && (held || rng.chance(pDelay));
  const pay = delayed ? 0 : Math.min(due, able);
  if (pay > 0) { bizMove(w, b, -pay, 'protection', col.id); creditCollector(w, b, col, pay); }
  const unpaid = due - pay;
  const missedWeek = pay < p.fee;
  if (unpaid > 0) p.owed = Math.min(Math.round(unpaid), p.fee * 8); else delete p.owed;
  if (missedWeek) {
    p.late = (p.late ?? 0) + 1;
    p.why = delayed ? 'delayed' : 'unable';
    addFact(w, { kind: 'protection_late', actor: o.id, victim: col.id, business: b.id, amount: p.owed ?? unpaid, minor: false, text: `${o.name} is late with the ${money(p.fee)} he owes ${col.name} for ${b.name}.`, district: b.district }, { witnesses: [col.id] });
  } else if (!p.owed) { p.late = 0; delete p.why; }
}

function appointManager(w: World, b: Business, o: Character, why: string) {
  const last = o.name.split(' ').slice(-1)[0];
  const first = w.rng.pick(['Sal', 'Gino', 'Paulie', 'Dom', 'Lou', 'Vinnie', 'Angie', 'Rosa', 'Nick', 'Carmine']);
  const m = spawnCivilian(w, `${first} ${last}`, b.district, 90);
  m.skills.brains = clamp(m.skills.brains + w.rng.range(-0.1, 0.25), 0, 1);
  b.managerId = m.id;
  addFact(w, { kind: 'ownership', actor: o.id, victim: m.id, business: b.id, minor: true, text: `${o.name} put ${m.name} in charge of the day-to-day at ${b.name} ${why}.`, district: b.district }, { witnesses: [] });
}

export function businessWeek(w: World) {
  const rng = w.rng;
  for (const b of Object.values(w.biz)) {
    if (!b.open) continue;
    const o = w.chars[b.ownerId];
    if (!o || !o.alive) { b.open = false; continue; }
    b.rivals0 ??= rivalsOf(w, b);
    // An owner who is locked up, or who has more cash than he can use, hands the running of it to somebody.
    if (!b.managerId && b.kind !== 'casino') {
      const managed = Object.values(w.biz).filter((x) => x.managerId).length;
      if (o.jailedUntil > w.now + 14 * DAY) appointManager(w, b, o, 'while he is away');
      else if (b.cash > 900 && b.distress === 0 && managed < Object.keys(w.biz).length / 4 && rng.chance(0.01)) appointManager(w, b, o, 'so he can step back');
    }
    const m = b.managerId ? w.chars[b.managerId] : undefined;
    if (b.managerId && !m?.alive) delete b.managerId;

    const P = perf(w, b);
    const dmg = b.damaged > 0 ? 0.4 : 1;
    if (b.damaged > 0) b.damaged--;
    bizMove(w, b, Math.round(b.income * rng.range(0.82, 1.2) * dmg * P.mult), 'revenue');
    bizMove(w, b, -b.expense, 'expense');

    const p = b.protection;
    if (p && p.fee > 0) {
      const col = w.chars[p.collectorId];
      if (col && col.alive) payProtection(w, b, o, col);
      else delete b.protection;
    }
    // Other people's shares come out of trade, before the owner sees any of it.
    for (const s of b.stakes ?? []) payStake(w, b, s);
    if (b.cash < 0) {
      const inj = Math.min(Math.max(0, o.cash - 100), -b.cash);
      if (inj > 0) { o.cash -= inj; bizMove(w, b, inj, 'inject', o.id); }
    }
    if (b.cash < 0) b.distress++;
    else b.distress = Math.max(0, b.distress - 1);
    // A man with ambitions puts money back into the place; one without takes it home.
    if (b.cash > 600 && b.distress === 0 && o.traits.ambition > 0.45 && (b.invest ?? 0) < INVEST_CAP * 0.7) {
      const spend = Math.min(120, Math.round((b.cash - 450) * 0.4));
      if (spend >= 40) { bizMove(w, b, -spend, 'invest', o.id); b.invest = Math.min(INVEST_CAP, (b.invest ?? 0) + spend / Math.max(200, b.income * 6)); }
    }
    if ((b.invest ?? 0) > 0) b.invest = Math.max(0, Math.round(((b.invest ?? 0) - 0.003) * 10000) / 10000);
    if (!b.invest) delete b.invest;
    const draw = b.cash - 300;
    if (draw > 0) { bizMove(w, b, -draw, 'draw', o.id); o.cash += draw; }
    if (b.distress >= 5) {
      b.open = false;
      o.wage = Math.max(o.wage, 90);
      addFact(w, { kind: 'business_failed', business: b.id, victim: o.id, text: `${b.name} closed its doors. ${o.name} went under.`, district: b.district });
    }
  }
  strikeAccounts(w);
}

// A share in the trade, paid out of the till. If the share was bought with a debt, the debt comes down by what it pays.
function payStake(w: World, b: Business, s: Stake) {
  const h = w.chars[s.holder];
  if (!h?.alive) return;
  const pay = Math.min(Math.max(0, b.cash), Math.round(b.income * s.share * 0.8));
  if (pay <= 0) return;
  bizMove(w, b, -pay, 'stake', h.id);
  earn(h, pay, 'business');
  if (s.how.startsWith('debt:')) {
    const d = w.debts.find((x) => x.id === s.how.slice(5));
    if (d && (d.status === 'active' || d.status === 'defaulted')) {
      d.balance = Math.max(0, d.balance - pay);
      if (d.balance <= 0) { d.status = 'paid'; b.stakes = (b.stakes ?? []).filter((x) => x !== s); if (!b.stakes.length) delete b.stakes; }
    }
  }
}

// ------------------------------------------------------------------ ownership

export function stakesOf(w: World, holder: Id): { b: Business; s: Stake }[] {
  const out: { b: Business; s: Stake }[] = [];
  for (const b of Object.values(w.biz)) for (const s of b.stakes ?? []) if (s.holder === holder) out.push({ b, s });
  return out;
}
export function addStake(w: World, b: Business, holder: Id, share: number, how: string): Stake {
  const list = (b.stakes ??= []);
  const mine = list.find((x) => x.holder === holder);
  if (mine) { mine.share = Math.min(0.6, mine.share + share); return mine; }
  const s: Stake = { holder, share, since: w.now, how };
  list.push(s);
  return s;
}

// Change who owns a business. The business keeps its identity, its books and its history; the obligations travel with it.
// Returns false if it cannot be done (the new owner does not exist or is the old one).
export function transferBusiness(w: World, b: Business, to: Id, how: string, text?: string): boolean {
  const old = w.chars[b.ownerId];
  const heir = w.chars[to];
  if (!heir?.alive || to === b.ownerId) return false;
  (b.owners ??= []).push({ id: b.ownerId, from: b.owners?.length ? b.owners[b.owners.length - 1].to : 0, to: w.now, how });
  b.ownerId = to;
  if (b.managerId === to) delete b.managerId;
  if (b.stakes) { b.stakes = b.stakes.filter((s) => s.holder !== to); if (!b.stakes.length) delete b.stakes; }
  if (b.protection?.collectorId === to) delete b.protection; // he would be paying himself
  b.distress = 0;
  ownersChanged(w);
  addFact(w, { kind: 'ownership', actor: to, victim: old?.id, business: b.id, text: text ?? `${heir.name} took over ${b.name}${old ? ` from ${old.name}` : ''}.`, district: b.district }, { witnesses: [] });
  return true;
}

// The owner has died. The man who was running it for him keeps it going; otherwise it closes.
export function succeedOwner(w: World, b: Business, dead: Character): boolean {
  const m = b.managerId ? w.chars[b.managerId] : undefined;
  if (m?.alive && !m.isPlayer && m.jailedUntil <= w.now && transferBusiness(w, b, m.id, 'inherited', `${m.name} kept ${b.name} going after ${dead.name}'s death.`)) return true;
  return false;
}

// A debt that has gone bad can be settled out of the debtor's business: the lender takes a share of its trade until it is cleared.
export function seizeShare(w: World, d: { id: Id; debtor: Id; creditor: Id; balance: number }) {
  const b = Object.values(w.biz).find((x) => x.open && x.ownerId === d.debtor);
  const cred = w.chars[d.creditor];
  if (!b || !cred?.alive || b.stakes?.some((s) => s.holder === cred.id)) return;
  addStake(w, b, cred.id, 0.15, 'debt:' + d.id);
  addFact(w, { kind: 'ownership', actor: cred.id, victim: d.debtor, business: b.id, text: `${cred.name} took a share of ${b.name} against what ${w.chars[d.debtor].name} owes.`, district: b.district }, { witnesses: [] });
}

// Move the right to collect from one man (and family) to another. What was owed under the arrangement goes with it.
export function setCollector(w: World, b: Business, collectorId: Id, familyId: Id, o: { fee?: number; keepOwed?: boolean } = {}) {
  if (collectorId === b.ownerId) return; // a man cannot collect from himself; callers that pick a taker exclude the owner, this is the last line
  const old = b.protection;
  b.protection = { collectorId, familyId, fee: o.fee ?? old?.fee ?? 0, since: w.now, ...(o.keepOwed && old?.owed ? { owed: old.owed, late: old.late, why: old.why } : {}) };
}

// ------------------------------------------------------------------ what a visitor can see

// Evidence about why a business is behind, as someone walking in would see it. It does not say what the owner is thinking.
export function evidence(w: World, b: Business): string[] {
  const out: string[] = [];
  const s = slump(w, b);
  if (b.damaged > 0) out.push('The place is still half wrecked from the last time.');
  if (s < 0.75) out.push('It is nearly empty. Takings are well down.');
  else if (s > 1.05) out.push('It is busy. People are queueing.');
  if (b.cash < 0 || b.distress >= 2) out.push('He is behind with his own suppliers.');
  const fee = b.protection?.fee ?? 0;
  if (fee && b.cash > fee * 3 && s >= 0.9) out.push('There is money in the till. He is not short.');
  if ((b.invest ?? 0) > 0.03) out.push('The place has just been done up.');
  const P = perf(w, b);
  if (P.trouble < 0.97) out.push('The street has been quiet since the trouble.');
  return out;
}

export function describeOwnership(w: World, b: Business): string[] {
  const o = w.chars[b.ownerId];
  const out: string[] = [`Owned by ${o?.name ?? 'nobody'}${b.owners?.length ? ` (before him: ${b.owners.map((x) => w.chars[x.id]?.name ?? x.id).join(', ')})` : ''}.`];
  const m = b.managerId ? w.chars[b.managerId] : undefined;
  if (m) out.push(`${m.name} runs it day to day.`);
  for (const s of b.stakes ?? []) out.push(`${w.chars[s.holder]?.name ?? s.holder} has ${Math.round(s.share * 100)}% of the trade.`);
  return out;
}

// Invariants of the business economy, read-only (used by audit() and the tests).
export function economyIssues(w: World): string[] {
  const bad: string[] = [...ledgerCheck(w)];
  for (const b of Object.values(w.biz)) {
    const o = w.chars[b.ownerId];
    if (b.open && !o?.alive) bad.push(`${b.name} is open but its owner is dead or missing`);
    if (b.open && b.kind !== 'casino' && b.ownerId === b.protection?.collectorId) bad.push(`${b.name}'s owner is also its protector`);
    if (b.managerId && b.managerId === b.ownerId) bad.push(`${b.name}'s manager is its owner`);
    let share = 0;
    for (const s of b.stakes ?? []) {
      share += s.share;
      if (!w.chars[s.holder]) bad.push(`${b.name} has a stake held by someone who does not exist`);
      if (s.holder === b.ownerId) bad.push(`${b.name}'s owner also holds a stake in it`);
    }
    if (share > 0.9) bad.push(`${b.name}: other people's shares add up to ${Math.round(share * 100)}%`);
    const p = b.protection;
    if (p && b.open && !w.chars[p.collectorId]?.alive) bad.push(`${b.name} is protected by a dead man`);
    if (p && (p.owed ?? 0) < 0) bad.push(`${b.name} owes a negative amount`);
    if (p && (p.late ?? 0) > 0 && !(p.owed ?? 0)) bad.push(`${b.name} is counted late but owes nothing`);
  }
  return bad;
}
