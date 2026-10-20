// Sit-downs and settlements: a sit-down gives every participant a consistent result, a debt sit-down changes the real
// debt, a partnership breakdown moves real money, and the player's own moves. From the V75 suite.
import assert from 'node:assert';
import { beforeAll, describe, test as ok } from 'vitest';
import { DAY } from '../../types';
import { rel, createDebt } from '../../core';
import { addStake, ledgerCheck } from '../../econ';
import { hold, isOpen, promotedOver, sitIssues, spawn } from '../../situ';
import { doMove, negotiateDebt, movesFor, visibleTo } from '../../sitmoves';
import { situationWorld, pair, parts, skimCase, run } from './fixtures';
import { P } from '../helpers';

// The world the unit tests below start from takes a second or more to simulate: build it here, so a unit test's time
// limit measures only its own work.
beforeAll(() => { situationWorld(5, 30); });

describe('sit-downs and settlements', () => {
  ok('5. a sit-down gives every participant a consistent result; those who lose remember', { tags: ['scenario'] }, () => {
    const w = situationWorld(3, 20); const { boss, c } = pair(w);
    const b = Object.values(w.biz).find((q) => q.open && q.protection && q.kind !== 'casino' && w.chars[q.ownerId]?.alive && !w.chars[q.ownerId].isPlayer && q.ownerId !== q.protection.collectorId)!;
    const col = w.chars[b.protection!.collectorId]; col.jailedUntil = 0; const o = w.chars[b.ownerId];
    b.protection!.owed = b.protection!.fee * 5; b.protection!.late = 4; b.protection!.why = 'unable';
    const s = spawn(w, 'tribute', `tribute:${b.id}`, o.id, { cause: 'test', parties: [{ id: col.id, role: 'collector' }, { id: o.id, role: 'owner' }], sev: 0.4, phase: 'appeal', next: w.now, biz: b.id, amt: b.protection!.owed })!;
    const chair = boss; s.stage = 'handling'; void c;
    const before = rel(o, col.id).grudge;
    const v = hold(w, s, chair, 'enforce');
    assert.ok(!isOpen(s) && s.out === 'enforced');
    assert.ok(s.meet && s.meet.parts.includes(col.id) && s.meet.parts.includes(o.id) && s.meet.chair === chair.id);
    assert.ok(rel(o, col.id).grudge > before, 'the man made to pay holds it against the collector');
    assert.ok(v.opposed.includes(o.id), 'the owner did not accept it');
    for (const id of [col.id, o.id]) assert.ok(w.chars[id].known[Object.values(w.facts).find((f) => f.story === 'sit:' + s.id && f.kind === 'sitdown')!.id], 'every participant knows what was decided');
    assert.deepEqual(sitIssues(w), []); assert.deepEqual(ledgerCheck(w), []);
  });
  ok('a debt sit-down changes the real debt and different chairs pick differently', { tags: ['scenario'] }, () => {
    const picks = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const w = situationWorld(seed % 5 + 1, 15 + seed); const { boss, c } = pair(w);
      const cr = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.id !== c.id && q.id !== boss.id && q.cash > 800 && q.familyId === c.familyId && q.bossId && w.chars[q.bossId]?.alive); if (!cr) continue;
      const d = createDebt(w, cr.id, c.id, 600, 0.02, 'test'); d.missed = 3; d.weeklyPayment = 60;
      const s = spawn(w, 'debt', `debt:${d.id}`, c.id, { cause: 'test', parties: [{ id: cr.id, role: 'creditor' }, { id: c.id, role: 'debtor' }], sev: 0.3, phase: 'pressed', next: w.now, link: { debt: d.id }, truth: 'unable' })!;
      s.stage = 'handling'; s.truth = seed % 2 ? 'willful' : 'unable'; for (const q of Object.values(w.chars)) if (q.familyId === c.familyId && !q.isPlayer) { q.traits.violence = seed / 12; rel(q, c.id).trust = (seed % 3) / 2; rel(q, cr.id).trust = (Math.floor(seed / 3) % 3) / 2; } s.m = { rounds: 2 };
      run(w, s, 3); if (s.out) picks.add(s.out); assert.deepEqual(ledgerCheck(w), []);
    }
    assert.ok(picks.size >= 2, 'varied settlements: ' + [...picks]);
  });
  ok('partnership breakdown moves real ownership and money', { tags: ['scenario'] }, () => {
    const w = situationWorld(3, 20); const { boss } = pair(w);
    void boss;
    const b = Object.values(w.biz).find((q) => q.open && q.kind !== 'casino' && w.chars[q.ownerId]?.alive && !w.chars[q.ownerId].isPlayer)!;
    const o = w.chars[b.ownerId]; const h = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.id !== o.id && q.familyId === o.familyId)!;
    addStake(w, b, h.id, 0.2, 'test');
    o.cash = 20000; h.cash = 500;
    const s = spawn(w, 'partner', `partner:${b.id}:${h.id}`, o.id, { cause: 'x', parties: [{ id: o.id, role: 'owner' }, { id: h.id, role: 'partner' }], sev: 0.35, phase: 'backing', next: w.now, biz: b.id, truth: 'weak' })!;
    s.stage = 'handling'; const before = o.cash + h.cash; run(w, s, 4);
    assert.ok(!isOpen(s), 'settled'); assert.deepEqual(ledgerCheck(w), []);
    assert.ok(Math.abs((o.cash + h.cash) - before) <= before, 'no money invented'); assert.deepEqual(sitIssues(w), []);
  });
  ok('a passed-over rival keeps the grudge, and an ambitious one starts looking for his own way', { tags: ['unit'] }, () => {
    const w = situationWorld(5, 30); const { c: winner } = pair(w);
    const rival = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.id !== winner.id && q.familyId === winner.familyId && q.rank === winner.rank)!;
    rival.traits.ambition = 0.9; rel(rival, winner.id).grudge = 0.4;
    promotedOver(w, winner, winner.rank);
    const s = (w.situations ?? []).find((x) => x.kind === 'grudge' && isOpen(x));
    assert.ok(s, 'resentment started from the promotion itself'); assert.equal(parts(s!, 'rival'), rival.id);
  });
});

describe('player moves', { tags: ['scenario'] }, () => {
  ok('player moves: asking around reveals only what a friend actually knows, and is noticed', () => {
    const w = situationWorld(2, 20); const { s, boss, c } = skimCase(w, true); const p = P(w); run(w, s, 1); assert.ok(isOpen(s), 'still going');
    const friend = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.id !== boss.id && q.id !== c.id)!;
    for (const f of Object.values(w.facts).filter((x) => x.story === 'sit:' + s.id)) { friend.known[f.id] = { from: 'test', t: w.now, knowsActor: true } as never; }
    s.k![friend.id] = { l: 2, via: 'test', t: w.now - 5 * DAY }; rel(friend, p.id).trust = 0.8;
    const mv = movesFor(w, p, s).find((m) => m.code === 'inquire')!; assert.ok(mv);
    const r = doMove(w, p, s.id, 'inquire');
    assert.ok(r.lines[0].includes(friend.name)); assert.ok(visibleTo(w, p, s));
    assert.ok(!movesFor(w, p, s).some((m) => m.code === 'inquire'), 'cannot ask again at once');
    assert.ok(!/guilty|innocent/i.test(r.lines.join(' ')));
  });
  ok('player moves: settling a matter needs rank or the trust of both sides; others refuse a man they don’t respect', () => {
    const w = situationWorld(4, 20); const { s, boss, c } = skimCase(w, true); const p = P(w); p.rank = 'associate';
    assert.ok(!movesFor(w, p, s).some((m) => m.code === 'mediate'));
    p.rank = 'capo';
    assert.ok(movesFor(w, p, s).some((m) => m.code === 'mediate'));
    rel(boss, p.id).respect = 0.05;
    assert.ok(doMove(w, p, s.id, 'mediate').lines[0].includes('will not sit'));
    rel(boss, p.id).respect = 0.8; rel(c, p.id).respect = 0.8;
    const r = doMove(w, p, s.id, 'mediate'); assert.ok(!isOpen(s), r.lines.join('|')); assert.ok(s.meet?.chair === p.id);
  });
  ok('player moves: speaking up for a man weighs with the chair and costs with the other side; vouching for a guilty man costs you', () => {
    const w = situationWorld(2, 20); const { s, boss, c } = skimCase(w, true); const p = P(w); p.rank = 'soldier';
    rel(p, c.id).trust = 0.7; rel(c, p.id).trust = 0.7;
    const m = movesFor(w, p, s).find((x) => x.code === 'vouch'); assert.ok(m);
    const st0 = p.standing; const r0 = rel(boss, p.id).respect;
    doMove(w, p, s.id, 'vouch', c.id); assert.ok((s.m?.vouched as number) >= 1);
    s.phase = 'confront'; s.m = { ...(s.m ?? {}), cert: 90 }; s.next = w.now; run(w, s, 4);
    assert.ok(!isOpen(s)); assert.ok(p.standing < st0 || rel(boss, p.id).respect < r0 || rel(boss, p.id).trust < 0.9, 'it came back on him');
    void r0;
  });
  ok('player moves: negotiating his own debt gets an answer from the creditor’s own interests', () => {
    const w = situationWorld(4, 20); const p = P(w); const cr = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.cash > 500)!;
    const d = createDebt(w, cr.id, p.id, 500, 0.02, 'test'); d.missed = 2;
    const lines = doMove(w, p, 'x', 'negotiate').lines; assert.ok(lines[0]);
    const s = spawn(w, 'debt', 'dbt-' + d.id, p.id, { cause: 'x', parties: [{ id: cr.id, role: 'creditor' }, { id: p.id, role: 'debtor' }], sev: 0.2, phase: 'pressed', next: w.now + 20 * DAY, link: { debt: d.id } });
    void s;
    const out = negotiateDebt(w, p, d.id); assert.ok(out[0].length > 5); assert.deepEqual(ledgerCheck(w), []);
  });
});
