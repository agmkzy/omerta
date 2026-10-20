// The ledger: one record of where money went, kept for everyone inside the player's circle (himself, his crew, his boss).
// Settlement writes to it, handing over an envelope writes to it, loans and gifts write to it, and everything that shows
// money (the Sunday page, a man's books, what he says about his envelope, your own money page) reads from it.
// Two screens cannot disagree about a number, because there is only one place the number lives.
import { Character, Id, WEEK, World } from './types';

export type Flow = 'earn' | 'owe' | 'expect' | 'kickup' | 'loan' | 'repay' | 'gift' | 'stake' | 'spend' | 'wager' | 'upkeep';
export interface LedgerEntry { t: number; wk: number; from: Id | 'world'; to: Id | 'world'; amt: number; flow: Flow; src?: string; note?: string }

export const wkOf = (t: number) => Math.floor(t / WEEK);
const KEEP_WEEKS = 8;

// The circle: the player, the men who answer to him, and the man he answers to. Money anywhere else is nobody's business here.
function inCircle(w: World, id: Id | 'world'): boolean {
  if (id === 'world') return false;
  const p = w.chars[w.playerId!];
  if (!p) return false;
  return id === p.id || w.chars[id]?.bossId === p.id || id === p.bossId;
}

export function post(w: World, e: { from: Id | 'world'; to: Id | 'world'; amt: number; flow: Flow; src?: string; note?: string; wk?: number }) {
  if (!(e.amt > 0) && e.flow !== 'owe' && e.flow !== 'expect') return;
  if (!inCircle(w, e.from) && !inCircle(w, e.to)) return;
  const l = (w.ledger ??= []);
  l.push({ t: w.now, wk: e.wk ?? wkOf(w.now), from: e.from, to: e.to, amt: Math.round(e.amt), flow: e.flow, src: e.src, note: e.note });
  const floor = wkOf(w.now) - KEEP_WEEKS;
  if (l.length > 400 && l[0].wk < floor) w.ledger = l.filter((x) => x.wk >= floor);
}

const sum = (l: LedgerEntry[]) => l.reduce((a, x) => a + x.amt, 0);

// What one man's week looked like, read straight from the ledger.
export interface Statement {
  has: boolean; // the ledger has this week; otherwise the figures come from his old books
  wk: number;
  own: number; // what he made himself
  crew: number; // what his men actually put in his hand
  crewMen: { id: Id; amt: number }[];
  weekDue: number; // this week's share
  carry: number; // what he still owed from before
  due: number; // the whole of it
  handed: number; // what he actually passed up
  short: number; // due and not handed
  expected: number; // what his superior could see for himself
  light: boolean;
}
export function lastWeek(w: World, id: Id): number | undefined {
  const l = w.ledger ?? [];
  for (let i = l.length - 1; i >= 0; i--) if (l[i].flow === 'owe' && l[i].from === id) return l[i].wk;
  return undefined;
}
export function statement(w: World, c: Character, wk?: number): Statement {
  const week = wk ?? lastWeek(w, c.id);
  const l = week === undefined ? [] : (w.ledger ?? []).filter((x) => x.wk === week);
  if (week === undefined || !l.some((x) => x.flow === 'owe' && x.from === c.id)) {
    const h = wk === undefined ? c.books.history.at(-1) : c.books.history.find((x) => x.week === wk);
    const own = h?.own ?? Math.max(0, (h?.gross ?? 0) - (h?.sources?.kickups ?? 0));
    const due = h?.due ?? 0, handed = h?.paid ?? 0;
    return { has: false, wk: h?.week ?? 0, own: Math.round(own), crew: Math.round(h?.crewGross ?? h?.sources?.kickups ?? 0), crewMen: [], weekDue: due, carry: 0, due, handed, short: Math.max(0, due - handed), expected: h?.expected ?? 0, light: !!h && due - handed > Math.max(25, due * 0.15) };
  }
  const earn = l.filter((x) => x.flow === 'earn' && x.to === c.id && x.src !== 'kickups');
  const ups = l.filter((x) => x.flow === 'kickup' && x.to === c.id);
  const men = new Map<Id, number>();
  for (const x of ups) if (x.from !== 'world') men.set(x.from, (men.get(x.from) ?? 0) + x.amt);
  const weekDue = sum(l.filter((x) => x.flow === 'owe' && x.from === c.id && x.src === 'week'));
  const carry = sum(l.filter((x) => x.flow === 'owe' && x.from === c.id && x.src === 'carry'));
  const handed = sum(l.filter((x) => x.flow === 'kickup' && x.from === c.id));
  const due = weekDue + carry;
  const short = Math.max(0, due - handed);
  return {
    has: true, wk: week, own: sum(earn), crew: sum(ups), crewMen: [...men].map(([id, amt]) => ({ id, amt })), weekDue, carry, due, handed, short,
    expected: sum(l.filter((x) => x.flow === 'expect' && x.from === c.id)), light: short > Math.max(25, due * 0.15),
  };
}

// The week before that one, for "against last week".
export function previous(w: World, c: Character): Statement | undefined {
  const cur = lastWeek(w, c.id);
  if (cur === undefined) { const h = c.books.history; return h.length > 1 ? statement(w, c, h[h.length - 2].week) : undefined; }
  const prev = (w.ledger ?? []).filter((x) => x.flow === 'owe' && x.from === c.id && x.wk < cur).map((x) => x.wk).sort((a, b) => b - a)[0];
  return prev === undefined ? undefined : statement(w, c, prev);
}

// Everything the player took in and paid out, by kind, over the last few weeks. This is his money page.
export function flowsOf(w: World, id: Id, weeks = 4) {
  const floor = wkOf(w.now) - weeks + 1;
  const out: Record<string, { in: number; out: number }> = {};
  for (const x of w.ledger ?? []) {
    if (x.wk < floor || x.flow === 'owe' || x.flow === 'expect') continue;
    const key = x.flow;
    if (x.to === id) (out[key] ??= { in: 0, out: 0 }).in += x.amt;
    if (x.from === id) (out[key] ??= { in: 0, out: 0 }).out += x.amt;
  }
  return out;
}
export const FLOW_WORD: Record<string, string> = { earn: 'What you earned', kickup: 'Envelopes', loan: 'Loans you made', repay: 'Loans paid back', gift: 'Favours and gifts', stake: 'Money put into others', spend: 'Spent', wager: 'Gambling', upkeep: 'Upkeep' };

// Between two men: what is owed either way, from the ledger of debts plus any open arrears.
export function balanceBetween(w: World, a: Id, b: Id): number {
  let net = 0;
  for (const d of w.debts ?? []) {
    if (d.status !== 'active' && d.status !== 'defaulted') continue;
    if (d.creditor === a && d.debtor === b) net += d.balance;
    if (d.creditor === b && d.debtor === a) net -= d.balance;
  }
  return Math.round(net);
}

// Keep a man's old-style history row in step with what the ledger says (it is only a cache of it).
export function refreshHistory(w: World, c: Character) {
  const h = c.books.history.at(-1);
  if (!h) return;
  const s = statement(w, c, h.week);
  if (!s.has) return;
  h.paid = s.handed;
  h.due = s.weekDue;
  if (c.isPlayer) { h.own = s.own; h.crewGross = s.crew; }
}
