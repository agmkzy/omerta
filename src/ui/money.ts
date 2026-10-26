// Where the player's money comes from and where it goes, in one place, so every screen that mentions it agrees (Business, the World
// side column, Rackets). Money moves on the weekly tick, so "this week so far" is often nothing mid-week; what matters is what comes in
// each week, what goes out, and what last week came to. Everything here is the player's own books: nothing another man keeps private.
import { money } from '../core';
import { envelopeSum, SOURCE_LABEL } from '../books';
import { owedOf, stakesOf } from '../econ';
import { LIVING } from '../engine';
import { DUES_FLOOR } from '../orgs';
import { OPS, type OpKey } from '../rackets';
import type { Character, World } from '../types';

export interface Flow { label: string; amt: number; note?: string; a?: string }
export interface Week {
  comingIn: Flow[];     // what arrives each week, as things stand
  goingOut: Flow[];     // what leaves each week
  inTotal: number;
  outTotal: number;
  soFar: number;        // earned since the week turned
  soFarBy: Flow[];
  last?: { earned: number; handed: number; due: number; received: number };
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export function week(w: World, p: Character): Week {
  const comingIn: Flow[] = [], goingOut: Flow[] = [];
  // protection: the fee each shop pays you, and what it is behind
  const shops = Object.values(w.biz).filter((b) => b.open && b.protection?.collectorId === p.id);
  if (shops.length) {
    const behind = shops.reduce((a, b) => a + owedOf(b), 0);
    comingIn.push({ label: 'Protection', amt: shops.reduce((a, b) => a + (b.protection?.fee ?? 0), 0), note: `${plural(shops.length, 'shop')}${behind ? `, ${money(behind)} behind` : ''}`, a: 'sub:business.run' });
  }
  // rackets you own: what each took last week
  for (const o of w.ops.filter((x) => x.owner === p.id && (x.state === 'running' || x.state === 'out'))) {
    const def = OPS[o.kind as OpKey];
    comingIn.push({ label: def?.label ?? 'A racket', amt: Math.max(0, Math.round(o.last)), note: o.runner && w.chars[o.runner] ? `run by ${w.chars[o.runner].name}` : `${o.district}, last week`, a: `op:${o.id}` });
  }
  // money lent: the weekly payments coming back
  const lent = w.debts.filter((d) => d.status === 'active' && d.creditor === p.id);
  if (lent.length) comingIn.push({ label: 'Loans', amt: lent.reduce((a, d) => a + d.weeklyPayment, 0), note: `${plural(lent.length, 'man', 'men')} paying back`, a: 'sub:business.money' });
  // what your men brought last Sunday
  const recv = p.books.history.at(-1)?.received ?? 0;
  if (recv > 0) comingIn.push({ label: 'Your men’s envelopes', amt: Math.round(recv), note: 'last Sunday', a: 'sub:people.men' });
  if (p.books.side) comingIn.push({ label: 'Side deal', amt: Math.round(p.books.side), note: 'off the books' });
  // a share in another man's trade: what it pays out of his till each week (econ.payStake), as things stand
  const stakes = stakesOf(w, p.id).filter(({ b }) => b.open);
  if (stakes.length) comingIn.push({ label: 'Your share in a business', amt: stakes.reduce((a, { b, s }) => a + Math.max(0, Math.round(b.income * s.share * 0.8)), 0), note: stakes.map(({ b, s }) => `${Math.round(s.share * 100)}% of ${b.name}`).join(', ') });
  if (p.wage > 0) comingIn.push({ label: 'Wages', amt: Math.round(p.wage), note: p.job ? 'your day job' : 'a regular wage' });
  // going out: your envelope, and what you are paying back
  const boss = p.bossId ? w.chars[p.bossId] : undefined;
  if (boss?.alive) {
    const e = envelopeSum(w, p);
    goingOut.push({ label: `Your envelope to ${boss.name}`, amt: Math.round(e.weekDue), note: `${Math.round(e.rate * 100)}% of what you declare${e.overdue ? `, ${money(e.overdue)} owed from before` : ''}`, a: 'sub:business.money' });
  }
  const owe = w.debts.filter((d) => d.status === 'active' && d.debtor === p.id);
  if (owe.length) goingOut.push({ label: 'Paying back', amt: owe.reduce((a, d) => a + d.weeklyPayment, 0), note: plural(owe.length, 'debt') });
  // living: rent, food, the barber and the bar, every week (engine.weekly), and the dues a made man pays the family fund (orgs.treasuryWeek)
  goingOut.push({ label: 'Living', amt: LIVING[p.rank] ?? 100, note: 'rent, food, clothes, a round now and then' });
  const floor = DUES_FLOOR[p.rank];
  if (floor && p.cash > floor) { const due = Math.round(Math.min(p.cash - floor, 3000) * 0.03); if (due >= 10) goingOut.push({ label: 'Dues to the family fund', amt: due, note: 'a made man’s share of what the family keeps' }); }

  const soFarBy = Object.entries(p.books.gross).filter(([, v]) => v > 0).map(([s, v]) => ({ label: SOURCE_LABEL[s] ?? s, amt: Math.round(v) }));
  const h = p.books.history.at(-1);
  return {
    comingIn, goingOut,
    inTotal: comingIn.reduce((a, f) => a + f.amt, 0),
    outTotal: goingOut.reduce((a, f) => a + f.amt, 0),
    soFar: soFarBy.reduce((a, f) => a + f.amt, 0), soFarBy,
    last: h ? { earned: Math.round(h.gross), handed: Math.round(h.paid), due: Math.round(h.due), received: Math.round(h.received ?? 0) } : undefined,
  };
}

// The week in one line, for the side of World and the top of Rackets: what comes in, and how far into it you are.
export function weekLine(wk: Week): string {
  if (!wk.inTotal && !wk.soFar) return 'Nothing coming in yet.';
  return `About ${money(wk.inTotal)} a week coming in${wk.soFar ? `; ${money(wk.soFar)} so far this week` : '; it comes in on Sunday evening'}.`;
}
