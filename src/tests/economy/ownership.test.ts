// Ownership: transfers, inheritance, managers, and shares in a business, all on the real record. From the V73 suite.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { DAY, WEEK } from '../../types';
import { handleDeath, ownerBiz } from '../../core';
import { addStake, bizMove, businessWeek, ledgerCheck, mgmtQuality, stakesOf, transferBusiness } from '../../econ';
import { newWorld, P } from '../helpers';
import { shop } from './fixtures';

describe('ownership', () => {
  ok('ownership transfer changes the real record and keeps the history, the books and the obligation', { tags: ['scenario'] }, () => {
    const w = newWorld(7); const b = shop(w); const old = w.chars[b.ownerId]; const col = b.protection!.collectorId;
    advance(w, w.now + 2 * WEEK);
    const heir = Object.values(w.chars).find((c) => c.rank === 'civilian' && c.alive && c.id !== old.id)!;
    const acct = JSON.stringify(b.acct);
    assert.ok(transferBusiness(w, b, heir.id, 'sale'));
    assert.equal(b.ownerId, heir.id); assert.equal(ownerBiz(w, heir.id)?.id, b.id);
    assert.notEqual(ownerBiz(w, old.id)?.id, b.id, 'the old owner no longer owns it');
    assert.equal(b.owners!.at(-1)!.id, old.id); assert.equal(b.protection!.collectorId, col, 'the protection arrangement stays');
    assert.equal(JSON.stringify(b.acct), acct, 'its accounts are untouched');
    assert.ok(Object.values(w.facts).some((f) => f.kind === 'ownership' && f.business === b.id));
    advance(w, w.now + 3 * WEEK);
    assert.deepEqual(ledgerCheck(w), []);
    assert.ok(b.acct!.at(-1)!.revenue > 0, 'it kept trading under its new owner');
  });
  ok('after a transfer the owner draws the profit, not the old one', { tags: ['scenario'] }, () => {
    const w = newWorld(7); const b = shop(w); const old = w.chars[b.ownerId];
    const heir = Object.values(w.chars).find((c) => c.rank === 'civilian' && c.alive && c.id !== old.id)!;
    transferBusiness(w, b, heir.id, 'sale'); b.income = 3000; b.expense = 100;
    const o0 = old.cash, h0 = heir.cash;
    businessWeek(w);
    assert.equal(old.cash, o0); assert.ok(heir.cash > h0);
    assert.ok(w.txns!.filter((t) => t.b === b.id && t.k === 'draw').every((t) => t.who === heir.id));
  });
  ok('a transfer to the collector ends the protection he would be paying himself', { tags: ['unit'] }, () => {
    const w = newWorld(7); const b = shop(w); const col = b.protection!.collectorId;
    transferBusiness(w, b, col, 'handed over'); assert.equal(b.protection, undefined);
  });
  ok('the man running the place keeps it when the owner dies; without one, it closes', { tags: ['unit'] }, () => {
    const w = newWorld(7); const a = shop(w); const m = Object.values(w.chars).find((c) => c.rank === 'civilian' && c.alive && c.id !== a.ownerId)!;
    a.managerId = m.id; const dead = a.ownerId; handleDeath(w, dead);
    assert.equal(a.open, true); assert.equal(a.ownerId, m.id); assert.equal(a.managerId, undefined); assert.equal(a.owners!.at(-1)!.how, 'inherited');
    const w2 = newWorld(7); const b = shop(w2); handleDeath(w2, b.ownerId); assert.equal(b.open, false);
  });
  ok('a manager is appointed when the owner is locked up, and runs it', { tags: ['scenario'] }, () => {
    const w = newWorld(7); const b = shop(w); const o = w.chars[b.ownerId]; o.jailedUntil = w.now + 60 * DAY;
    const q0 = mgmtQuality(w, b); businessWeek(w);
    assert.ok(b.managerId && w.chars[b.managerId].alive, 'someone is in charge'); assert.notEqual(b.managerId, b.ownerId);
    assert.ok(mgmtQuality(w, b) > 0 && q0 >= 0);
  });
  ok('the player\'s share in a business is on the business, and is paid once', { tags: ['scenario'] }, () => {
    const w = newWorld(7); const b = shop(w); const p = P(w); addStake(w, b, p.id, 0.25, 'bought in');
    b.income = 1000; b.expense = 0; bizMove(w, b, 2000, 'aid', 'x'); p.books.gross = {}; const c0 = p.cash;
    businessWeek(w);
    const pay = w.txns!.filter((t) => t.b === b.id && t.k === 'stake').reduce((a, t) => a - t.d, 0);
    assert.ok(pay > 0); assert.equal(p.cash - c0, pay, 'the player got exactly what the business paid'); assert.equal(p.books.gross.business, pay);
    assert.equal(stakesOf(w, p.id).length, 1);
  });
});
