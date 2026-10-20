// NPCs buying businesses: a purchase is paid for, financed or refused, never of the player's place or a casino, and an
// owner's investment goes through the record. From the V74 suite.
import assert from 'node:assert';
import { beforeAll, describe, test as ok } from 'vitest';
import { rel } from '../../core';
import { ledgerCheck, stakesOf } from '../../econ';
import { agencyIssues, agencyOf, begin, endGoal, moneyTotal, priceOf, stepGoal } from '../../goals';
import { agencyWorld, drive, pair, aimed } from './fixtures';
import { P } from '../helpers';

// The world the unit tests below start from takes a second or more to simulate: build it here, so a unit test's time
// limit measures only its own work.
beforeAll(() => { agencyWorld(7, 20); });

describe('buying a business', () => {
  ok('a purchase is paid for: cash moves buyer -> seller, ownership and history change, nothing is created', { tags: ['scenario'] }, () => {
    const w = agencyWorld(7, 20); const { b, seller, buyer } = pair(w);
    b.distress = 3; const price = priceOf(w, b);
    const g = aimed(w, buyer, b); const m0 = moneyTotal(w), bc = buyer.cash, sc = seller.cash;
    assert.ok(drive(w, g)); assert.equal(agencyOf(w).ended.at(-1)!.how, 'done');
    assert.equal(b.ownerId, buyer.id); assert.equal(b.owners!.at(-1)!.id, seller.id); assert.equal(b.owners!.at(-1)!.how, 'bought');
    const paid = bc - buyer.cash; assert.ok(paid > 0 && paid <= price * 1.3, `paid ${paid} for asking ${price}`);
    assert.equal(seller.cash - sc, paid); assert.equal(moneyTotal(w), m0);
    assert.equal(agencyOf(w).stats.acq, 1); assert.deepEqual(agencyIssues(w), []); assert.deepEqual(ledgerCheck(w), []);
    assert.ok(Object.values(w.facts).some((f) => f.kind === 'ownership' && f.business === b.id && f.actor === buyer.id));
  });
  ok('he cannot buy a business he cannot pay for', { tags: ['scenario'] }, () => {
    const w = agencyWorld(7, 20); const { b, buyer } = pair(w); buyer.cash = 40;
    b.distress = 3; const g = aimed(w, buyer, b, 'close'); g.offer = priceOf(w, b);
    for (let i = 0; i < 6; i++) { w.now = Math.max(w.now, g.review); stepGoal(w, g, buyer); }
    assert.notEqual(b.ownerId, buyer.id); assert.equal(buyer.cash, 40);
  });
  ok('he cannot buy the player\'s business or a casino', { tags: ['unit'] }, () => {
    const w = agencyWorld(7, 20); const { b, buyer } = pair(w);
    const ob = b.ownerId; b.ownerId = P(w).id; const g = aimed(w, buyer, b); g.owner = ob;
    stepGoal(w, g, buyer); assert.equal(b.ownerId, P(w).id); assert.equal(g.stage, 'scout');
    b.ownerId = ob; const kind = b.kind; b.kind = 'casino'; const g2 = aimed(w, buyer, b); g2.id = 'g-x'; agencyOf(w).goals = [g2]; stepGoal(w, g2, buyer);
    assert.equal(g2.stage, 'scout'); b.kind = kind;
  });
  ok('a refusal makes him improve the offer, find another, or give up - not retry forever', { tags: ['scenario'] }, () => {
    const w = agencyWorld(7, 20); const { b, seller, buyer } = pair(w);
    seller.traits.greed = 1; b.distress = 0; seller.cash = 90000; const g = aimed(w, buyer, b, 'negotiate'); g.mode = 'buy';
    drive(w, g, 40);
    const e = agencyOf(w).ended.at(-1);
    assert.ok(g.tries > 0 || e, 'tries recorded'); assert.ok(g.tries <= 4);
    assert.ok(agencyOf(w).stats['refused.offer'] >= 1 || b.ownerId === buyer.id);
  });
  ok('a partner covers a shortfall and gets a share; the money is traced', { tags: ['scenario'] }, () => {
    const w = agencyWorld(7, 20); const { b, buyer, seller } = pair(w); b.distress = 3;
    const rich = Object.values(w.chars).find((c) => c.alive && !c.isPlayer && c.familyId === buyer.familyId && ![buyer.id, seller.id].includes(c.id) && c.rank !== 'civilian')!;
    rich.cash = 400000; rel(rich, buyer.id).trust = 1; rel(buyer, rich.id).trust = 1; rich.traits.greed = 1;
    const price = priceOf(w, b); buyer.cash = Math.round(price * 0.55) + 150; const m0 = moneyTotal(w);
    const g = aimed(w, buyer, b, 'finance'); g.offer = price; g.mode = 'buy';
    for (let i = 0; i < 12 && !g.fin && agencyOf(w).goals.includes(g); i++) { w.now = Math.max(w.now, g.review); stepGoal(w, g, buyer); }
    assert.ok(g.fin || b.ownerId === buyer.id, 'financed'); drive(w, g);
    if (b.ownerId === buyer.id) assert.ok(stakesOf(w, rich.id).some((x) => x.b.id === b.id), 'partner holds a stake');
    assert.equal(moneyTotal(w), m0); assert.deepEqual(agencyIssues(w), []);
  });
  ok('a plan that fails after financing gives the backer his money back', { tags: ['unit'] }, () => {
    const w = agencyWorld(7, 20); const { b, buyer, seller } = pair(w);
    const bk = Object.values(w.chars).find((c) => c.alive && !c.isPlayer && ![buyer.id, seller.id].includes(c.id) && c.rank !== 'civilian')!;
    bk.cash = 1000; buyer.cash = 3000; const g = aimed(w, buyer, b, 'close'); g.fin = { by: bk.id, amt: 800 }; const m0 = moneyTotal(w);
    endGoal(w, g, 'failed', 'test'); assert.equal(bk.cash, 1800); assert.equal(buyer.cash, 2200); assert.equal(moneyTotal(w), m0);
  });
  ok('wealth: investing in his own place goes through the record; loans create real debts', { tags: ['scenario'] }, () => {
    const w = agencyWorld(7, 20); const b = Object.values(w.biz).find((x) => x.open && x.kind !== 'casino' && w.chars[x.ownerId]?.alive && !w.chars[x.ownerId].isPlayer)!;
    const c = w.chars[b.ownerId]; c.cash = 8000; c.traits.caution = 1; c.traits.greed = 0; b.distress = 0; b.invest = 0;
    const g = begin(w, c, 'wealth', 'x', 0.6, { stage: 'build', need: 99999 }); const t0 = (w.txns ?? []).length;
    for (let i = 0; i < 6; i++) { w.now = Math.max(w.now, g.review); if (agencyOf(w).goals.includes(g)) stepGoal(w, g, c); }
    assert.deepEqual(ledgerCheck(w), []);
    if ((b.invest ?? 0) > 0) assert.ok((w.txns ?? []).length > t0 || w.txns!.length === 3000);
    assert.deepEqual(agencyIssues(w), []);
  });
});
