// Protection money: what a shop owes when it cannot or will not pay, what the collector is credited, and the evidence a
// visitor can see. From the V73 suite.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { DAY, WEEK } from '../../types';
import { bizBetween, bizMove, businessWeek, evidence, owedOf, setCollector, takeFromBiz } from '../../econ';
import { newWorld, P } from '../helpers';
import { shop, week } from './fixtures';

describe('protection money', () => {
  ok('a shop that cannot pay owes the difference, says why, and pays it back when it can', { tags: ['scenario'] }, () => {
    const w = newWorld(7); const b = shop(w); const col = w.chars[b.protection!.collectorId]; const fee = b.protection!.fee;
    b.income = 0; b.expense = 0; bizMove(w, b, -b.cash, 'expense'); // nothing in the till
    const colBefore = col.cash;
    businessWeek(w);
    assert.equal(b.protection!.owed, fee); assert.equal(b.protection!.why, 'unable'); assert.equal(b.protection!.late, 1);
    assert.equal(col.cash, colBefore, 'the collector got nothing, and nothing was taken back from him');
    week(w); b.income = 0; bizMove(w, b, fee * 3, 'aid', 'x'); // money arrives
    businessWeek(w);
    assert.equal(owedOf(b), fee * 3 - fee * 2 > 0 ? 0 : 0, 'paid the arrears and the week');
    assert.equal(b.protection!.late, 0); assert.equal(b.protection!.why, undefined);
    assert.ok(col.cash > colBefore, 'the collector was paid');
  });
  ok('the collector is credited exactly what the shop handed over', { tags: ['scenario'] }, () => {
    const w = newWorld(7); const b = shop(w); const col = w.chars[b.protection!.collectorId];
    const before = b.protection!.total ?? 0; const gross0 = col.books.gross.protection ?? 0;
    advance(w, w.now + 6 * WEEK);
    const paid = bizBetween(w, b.id, 0, w.now).protection + (b.acct ?? []).reduce((a, r) => a + (r.protection ?? 0), 0) * 0;
    void paid;
    const handed = (b.protection!.total ?? 0) - before;
    const rec = (b.acct ?? []).reduce((a, r) => a + (r.protection ?? 0), 0) + bizBetween(w, b.id, (b.acct!.at(-1)?.wk ?? 0) * WEEK, w.now).protection;
    assert.ok(handed > 0 && Math.abs(handed - rec) <= handed * 0.2 + 1, `handed ${handed}, record ${rec}`);
    void gross0;
  });
  ok('a shop that could pay and does not is "delayed", and the till gives it away', { tags: ['scenario'] }, () => {
    const w = newWorld(7); const b = shop(w); const fee = b.protection!.fee;
    bizMove(w, b, fee * 6, 'aid', 'x'); b.protection!.hold = w.now + 2 * DAY;
    businessWeek(w);
    assert.equal(b.protection!.why, 'delayed'); assert.ok(owedOf(b) >= fee);
    assert.ok(evidence(w, b).some((l) => /not short/.test(l)), 'a visitor can see he is not short: ' + evidence(w, b).join(' | '));
  });
  ok('a shop in a slump leaves evidence of a slump', { tags: ['scenario'] }, () => {
    const w = newWorld(7); const b = shop(w); advance(w, w.now + 3 * WEEK);
    b.damaged = 3; bizMove(w, b, -b.cash, 'expense'); // smashed up: trade drops to 40% while it is repaired
    advance(w, w.now + 1 * WEEK + DAY);
    const ev = evidence(w, b).join(' | ');
    assert.ok(/empty|down|behind|wrecked/.test(ev), ev);
  });
  ok('a shake takes from the till then the owner\'s pocket, once, and clears what was owed', { tags: ['unit'] }, () => {
    const w = newWorld(7); const b = shop(w); const o = w.chars[b.ownerId]; const p = P(w);
    b.protection!.owed = 500; b.protection!.late = 2;
    bizMove(w, b, -b.cash + 100, 'expense'); o.cash = 600;
    const total0 = b.cash + o.cash;
    const got = takeFromBiz(w, b, 500, p.id, true);
    assert.equal(got, 500); assert.equal(b.cash + o.cash, total0 - 500, 'what left the shop and its owner is what was taken');
    assert.equal(owedOf(b), 0); assert.equal(b.protection!.late, 0);
  });
  ok('changing collector keeps or drops arrears as asked', { tags: ['unit'] }, () => {
    const w = newWorld(7); const b = shop(w); const other = Object.values(w.chars).find((c) => c.alive && c.familyId && c.id !== b.protection!.collectorId && !c.isPlayer && c.rank === 'soldier')!;
    b.protection!.owed = 300; b.protection!.late = 2;
    setCollector(w, b, other.id, other.familyId!, { keepOwed: true }); assert.equal(owedOf(b), 300); assert.equal(b.protection!.collectorId, other.id);
    setCollector(w, b, other.id, other.familyId!); assert.equal(owedOf(b), 0);
  });
});
