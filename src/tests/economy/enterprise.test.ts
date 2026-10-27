// The economy's people (October 2026, enterprise.ts): the four pilot rackets are made of men and places and, for the chop shop, cars
// with a history; ownership passes for reasons the world understands; what arises comes from circumstances, and the answers do things.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { audit } from '../../consistency';
import { carName, deliverCars, entChoose, foldVentures, gameYear, heirOf, linksOf, opsChangeHands, pilotWeek, staff, stealCar } from '../../enterprise';
import { enterpriseWeek, startOp } from '../../rackets';
import { applyRank } from '../../rank';
import { DAY, type Op, type World } from '../../types';
import { newWorld, P } from '../helpers';

function opFor(w: World, kind: 'chop' | 'numbers' | 'fencing' | 'bookie'): Op {
  const p = P(w);
  applyRank(w, p, 'soldier', { fact: false, career: false });
  p.cash = 5000;
  startOp(w, p, kind, p.district, null);
  return w.ops.find((o) => o.owner === p.id && o.kind === kind)!;
}

describe('enterprises and their people', { tags: ['scenario'] }, () => {
  ok('a stolen car is a car of the period: a make, a model, a year no later than the year it is', () => {
    const w = newWorld(7), op = opFor(w, 'chop');
    for (let i = 0; i < 60; i++) {
      const c = stealCar(w, op, undefined);
      assert.ok(c.year <= gameYear(w.now), `${carName(c)} is from the future`);
      assert.ok(c.make && c.model && c.value > 0);
      assert.ok(c.owner || c.whose, 'every car was somebody’s');
    }
  });
  ok('a racket takes on the people its trade needs, and only those', () => {
    const w = newWorld(7);
    for (const kind of ['chop', 'numbers', 'fencing', 'bookie'] as const) {
      const op = opFor(w, kind); op.weeks = 1;
      staff(w, op);
      const roles = new Set((op.links ?? []).map((l) => l.role));
      const want = { chop: ['thief', 'buyer'], numbers: ['runner', 'spot'], fencing: ['thief', 'buyer'], bookie: ['regular'] }[kind];
      for (const r of roles) assert.ok(want.includes(r), `${kind} took on a ${r}`);
      assert.ok(roles.size > 0, `${kind} took on nobody`);
    }
  });
  ok('the chop shop’s week is its cars: brought in by its thieves, stripped, and sold to its buyers', () => {
    const w = newWorld(7), op = opFor(w, 'chop'), p = P(w);
    op.weeks = 1; staff(w, op);
    deliverCars(w, op, 3, p);
    const r = pilotWeek(w, op, p, p, 1)!;
    const sold = (w.cars ?? []).filter((c) => c.op === op.id && c.status === 'sold');
    assert.ok(sold.length > 0, 'nothing was sold');
    assert.ok(r.take !== 0 && /stripped|brought/.test(r.cause));
    for (const c of sold) assert.ok((c.price ?? 0) > 0 && c.out !== undefined);
  });
  ok('weeks of every enterprise in the world keep the money straight', () => {
    const w = newWorld(11);
    opFor(w, 'chop'); opFor(w, 'numbers'); opFor(w, 'fencing'); opFor(w, 'bookie');
    for (let i = 0; i < 6; i++) { w.now += 7 * DAY; enterpriseWeek(w); }
    assert.deepEqual(audit(w).filter((x) => /cash|money|ledger/i.test(x)), []);
  });
  ok('when the owner dies, the racket goes to the man who would keep it going, and its history says so', () => {
    const w = newWorld(7), op = opFor(w, 'numbers'), p = P(w);
    const man = Object.values(w.chars).find((c) => c.alive && !c.isPlayer && c.familyId === p.familyId && c.rank === 'soldier')!;
    op.owner = man.id;
    const heir = heirOf(w, op, man);
    man.alive = false;
    opsChangeHands(w);
    assert.equal(op.owner, heir!.id);
    assert.equal(op.owners?.[0]?.id, man.id);
    assert.ok((op.hist ?? []).some((x) => x.text.includes(man.name)));
  });
  ok('an open chop-shop venture in an older save becomes a chop shop housed in that garage, the host’s share a stake', () => {
    const w = newWorld(7), p = P(w);
    const g = Object.values(w.biz).find((b) => b.kind === 'garage')!;
    w.ventures.push({ id: 'v1', ownerId: p.id, bizId: g.id, hostId: g.ownerId, hostShare: 0.3, stock: 2, since: 0, weeks: 4, takings: 900, open: true });
    foldVentures(w);
    const op = w.ops.find((o) => o.kind === 'chop' && o.owner === p.id)!;
    assert.equal(op.base, g.id);
    assert.equal(op.stakes?.[0].holder, g.ownerId);
    assert.equal((w.cars ?? []).filter((c) => c.op === op.id && c.status === 'stock').length, 2);
    assert.equal(w.ventures[0].open, false);
  });
  ok('the captain’s piece, given, is a stake he is paid out of the take every week', () => {
    const w = newWorld(7), op = opFor(w, 'bookie'), p = P(w);
    const cap = w.chars[p.bossId!];
    const e = { id: 'e1', kind: 'ent', from: cap.id, t: w.now, expires: w.now + DAY, title: '', lines: [], opts: [], status: 'open' as const, data: { k: 'tribute', op: op.id, share: 0.1 } };
    w.enc.push(e);
    entChoose(w, p, e, 'yes');
    assert.equal(op.stakes?.[0].holder, cap.id);
    assert.equal(linksOf(op, 'buyer').length, 0);
  });
});
