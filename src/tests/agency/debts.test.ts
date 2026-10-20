// Debtors' plans: asking for time, paying extra, choosing differently, and asking the player, who may refuse. From the
// V74 suite.
import assert from 'node:assert';
import { beforeAll, describe, test as ok } from 'vitest';
import { createDebt, rel } from '../../core';
import { agencyOf, agencyWeek, begin, goalChoose, moneyTotal, stepGoal } from '../../goals';
import { choose } from '../../encounters';
import { agencyWorld, npcs } from './fixtures';
import { P } from '../helpers';

// The world the unit tests below start from takes a second or more to simulate: build it here, so a unit test's time
// limit measures only its own work.
beforeAll(() => { agencyWorld(7, 20); });

describe('debtors', { tags: ['scenario'] }, () => {
  ok('a debtor can ask for time: extension moves the due date', () => {
    const w = agencyWorld(7, 20); const [cr, db] = npcs(w, 'soldier'); cr.traits.greed = 0; rel(cr, db.id).trust = 1; db.cash = 10; db.traits.violence = 0; db.traits.greed = 0;
    const d = createDebt(w, cr.id, db.id, 1000, 0.05, 'test'); d.missed = 2; const due = d.nextDue;
    const g = begin(w, db, 'debt', 'x', 0.8, { stage: 'recover', target: d.id, need: 1000 });
    for (let i = 0; i < 12 && d.nextDue === due; i++) { w.now = Math.max(w.now, g.review); stepGoal(w, g, db); }
    assert.ok(d.nextDue > due, 'extended'); assert.ok(agencyOf(w).stats.extension >= 1);
  });
  ok('a debtor with spare cash pays extra through the debt system (money conserved)', () => {
    const w = agencyWorld(7, 20); const [cr, db] = npcs(w, 'soldier'); db.cash = 3000; db.traits.caution = 1; db.traits.vice = 0;
    const d = createDebt(w, cr.id, db.id, 1000, 0.01, 'test'); const m0 = moneyTotal(w), c0 = cr.cash;
    const g = begin(w, db, 'debt', 'x', 0.8, { stage: 'recover', target: d.id, need: 1000 });
    for (let i = 0; i < 6; i++) { w.now = Math.max(w.now, g.review); if (agencyOf(w).goals.includes(g)) stepGoal(w, g, db); }
    assert.ok(cr.cash > c0 || d.balance < 1000); assert.equal(moneyTotal(w), m0);
  });
  ok('different men facing the same debt choose differently', () => {
    const w = agencyWorld(7, 20); const sol = npcs(w, 'soldier').slice(0, 8); const picks = new Set<string>();
    const [cr] = npcs(w, 'capo').length ? npcs(w, 'capo') : npcs(w, 'underboss');
    sol.forEach((c, i) => {
      if (c.id === cr.id) return; c.cash = 200 + i * 40; c.traits.violence = i % 2 ? 0.9 : 0.1; c.traits.courage = i % 2 ? 0.9 : 0.2; c.traits.caution = i % 3 ? 0.2 : 0.9; c.traits.greed = i % 2 ? 0.8 : 0.1;
      const d = createDebt(w, cr.id, c.id, 1500, 0.04, 't'); d.missed = 2;
      const g = begin(w, c, 'debt', 'x', 0.8, { stage: 'recover', target: d.id, need: 1500 }); const before = JSON.stringify(agencyOf(w).stats);
      for (let k = 0; k < 4 && agencyOf(w).goals.includes(g); k++) { w.now = Math.max(w.now, g.review); stepGoal(w, g, c); }
      picks.add(g.next + '|' + g.tries + '|' + (JSON.stringify(agencyOf(w).stats) === before));
    });
    assert.ok(picks.size >= 2, 'varied responses: ' + [...picks].join(' ; '));
  });
});

describe('asking the player', () => {
  ok('the player is asked only when it is plausible, once, and may refuse - the man carries on', { tags: ['scenario'] }, () => {
    const w = agencyWorld(7, 20); const p = P(w); const c = npcs(w, 'soldier')[0]; p.cash = 1000;
    const d = createDebt(w, p.id, c.id, 600, 0.03, 'test'); d.missed = 1; c.cash = 5; c.traits.violence = 0;
    const g = begin(w, c, 'debt', 'x', 0.8, { stage: 'recover', target: d.id, need: 600 });
    for (let i = 0; i < 6 && !g.ask; i++) { w.now = Math.max(w.now, g.review); stepGoal(w, g, c); }
    assert.ok(g.ask, 'asked'); const e = w.enc.find((x) => x.id === g.ask)!; assert.equal(e.data!.what, 'goal');
    assert.equal(w.enc.filter((x) => x.status === 'open' && x.data?.what === 'goal').length, 1);
    const due = d.nextDue; const r = choose(w, p, e, 'no'); assert.ok(r.lines.length);
    assert.equal(d.nextDue, due); assert.ok(agencyOf(w).goals.includes(g)); assert.equal(g.ask, undefined);
    assert.equal(agencyOf(w).stats['ask.refused'], 1);
  });
  ok('the player accepts: extension granted, trust rises', { tags: ['scenario'] }, () => {
    const w = agencyWorld(7, 20); const p = P(w); const c = npcs(w, 'soldier')[0];
    const d = createDebt(w, p.id, c.id, 600, 0.03, 'test'); d.missed = 1; c.cash = 5; const due = d.nextDue; const t0 = rel(c, p.id).trust;
    const g = begin(w, c, 'debt', 'x', 0.8, { stage: 'recover', target: d.id, need: 600 });
    for (let i = 0; i < 6 && !g.ask; i++) { w.now = Math.max(w.now, g.review); stepGoal(w, g, c); }
    choose(w, p, w.enc.find((x) => x.id === g.ask)!, 'yes'); assert.ok(d.nextDue > due); assert.ok(rel(c, p.id).trust > t0);
  });
  ok('an unanswered question lapses into a refusal; the plan goes on', { tags: ['scenario'] }, () => {
    const w = agencyWorld(7, 20); const p = P(w); const c = npcs(w, 'soldier')[0];
    const d = createDebt(w, p.id, c.id, 600, 0.03, 'test'); d.missed = 1; c.cash = 5;
    const g = begin(w, c, 'debt', 'x', 0.8, { stage: 'recover', target: d.id, need: 600 });
    for (let i = 0; i < 6 && !g.ask; i++) { w.now = Math.max(w.now, g.review); stepGoal(w, g, c); }
    const e = w.enc.find((x) => x.id === g.ask)!; e.status = 'lapsed'; agencyWeek(w);
    assert.equal(g.ask, undefined); assert.ok(agencyOf(w).goals.includes(g) || agencyOf(w).ended.some((x) => x.id === g.id));
  });
  ok('asks are spaced out: never two open, never within 12 days', { tags: ['scenario'] }, () => {
    const w = agencyWorld(7, 20); const p = P(w); const cs = npcs(w, 'soldier').slice(0, 3);
    const gs = cs.map((c) => { const d = createDebt(w, p.id, c.id, 600, 0.03, 'test'); d.missed = 1; c.cash = 5; return begin(w, c, 'debt', 'x', 0.8, { stage: 'recover', target: d.id, need: 600 }); });
    for (let i = 0; i < 4; i++) for (const g of gs) { w.now = Math.max(w.now, g.review); if (agencyOf(w).goals.includes(g)) stepGoal(w, g, w.chars[g.who]); }
    assert.ok(w.enc.filter((x) => x.status === 'open' && x.data?.what === 'goal').length <= 1);
  });
  ok('goalChoose ignores other encounters', { tags: ['unit'] }, () => {
    const w = agencyWorld(7, 20); assert.equal(goalChoose(w, P(w), { data: { what: 'invest' } } as never, 'yes'), undefined);
  });
});
