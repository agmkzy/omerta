// Social intentions (Stage 5A): men go and see each other for reasons that are true in their world, choose whom by what is between
// them, and act through the same doors as everything else. Each test builds the circumstance, lets the man weigh it, and follows
// what he did into the world.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { addFact, createDebt, rel } from '../../core';
import { intentsOf } from '../../intent';
import { openAsks } from '../../asks';
import { bizMove } from '../../econ';
import { menOf } from '../../work';
import { ownerBiz } from '../../core';
import { DAY, type Character, type World } from '../../types';
import { newWorld, P } from '../helpers';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
const civ = (w: World, n = 0) => Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.familyId).sort(byId)[n];
const act = (w: World, c: Character, kind: string) => { const i = intentsOf(w, c).find((x) => x.kind === kind); if (i) i.act(); return i; };

describe('social intentions', () => {
  ok('a man who can\'t make his payments goes to the man he owes and asks for easier terms', { tags: ['scenario'] }, () => {
    const w = newWorld(7), c = civ(w, 0), t = civ(w, 1);
    t.cash = 2000; c.cash = 0;
    const d = createDebt(w, t.id, c.id, 1000, 0.05, 'a private loan'); d.missed = 2;
    const i = act(w, c, 'time');
    assert.ok(i && i.to.id === t.id, 'he means to see the man he owes');
    const s = openAsks(w).find((x) => x.ak === 'time' && x.terms?.by === c.id) ?? (w.situations ?? []).find((x) => x.ak === 'time');
    assert.ok(s, 'it is a negotiation between them');
    assert.ok(d.weeklyPayment < 120 ? d.missed === 0 : true, 'if the lender agreed, the payment is lower and he is no longer behind');
  });

  ok('a man in trouble goes to the man he trusts most who can help, and when that is the player, the player is asked', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w);
    const c = Object.values(w.chars).filter((x) => x.alive && x.rank === 'civilian' && ownerBiz(w, x.id)?.open).sort(byId)[0], b = ownerBiz(w, c.id)!;
    bizMove(w, b, -b.cash, 'expense'); b.distress = 3; c.cash = 0;
    for (const x of Object.values(w.chars)) if (x.id !== c.id) delete c.rels[x.id];
    rel(c, p.id).trust = 0.8; p.cash = 10000;
    const i = act(w, c, 'help');
    assert.ok(i && i.to.isPlayer, 'he comes to the player');
    assert.ok(w.enc.some((e) => e.kind === 'loan' && e.from === c.id && e.status === 'open'), 'and the player is asked, in person');
  });

  ok('a man in trouble whose most trusted friend is another man asks him, through the same negotiation', { tags: ['scenario'] }, () => {
    const w = newWorld(7), p = P(w);
    const c = Object.values(w.chars).filter((x) => x.alive && x.rank === 'civilian' && ownerBiz(w, x.id)?.open).sort(byId)[0], b = ownerBiz(w, c.id)!;
    const f = civ(w, 3);
    bizMove(w, b, -b.cash, 'expense'); b.distress = 3; c.cash = 0;
    for (const x of Object.values(w.chars)) if (x.id !== c.id) delete c.rels[x.id];
    rel(c, f.id).trust = 0.8; f.cash = 10000; void p;
    const i = act(w, c, 'help');
    assert.ok(i && i.to.id === f.id);
    assert.ok((w.situations ?? []).some((s) => s.ak === 'borrow' && s.terms?.by === c.id && s.terms?.of === f.id), 'he asked his friend for the money');
  });

  ok('news his superior ought to hear goes up the hierarchy: the superior learns it from his man, with his man\'s knowledge of who did it', { tags: ['scenario'] }, () => {
    const w = newWorld(7);
    const cap = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank === 'capo' && menOf(w, c).some((m) => !m.isPlayer)).sort(byId)[0];
    const m = menOf(w, cap).find((x) => !x.isPlayer)!;
    const v = Object.values(w.chars).filter((x) => x.alive && x.familyId === cap.familyId && x.id !== m.id && x.id !== cap.id).sort(byId)[0];
    const other = Object.values(w.chars).filter((x) => x.alive && x.familyId && x.familyId !== cap.familyId).sort(byId)[0];
    const f = addFact(w, { kind: 'beating', actor: other.id, victim: v.id, text: `${other.name} beat up ${v.name}.`, district: v.district }, { witnesses: [m.id] });
    delete cap.known[f.id];
    m.cooldown = {}; m.jailedUntil = 0; m.hurtUntil = 0;
    const i = act(w, m, 'report');
    assert.ok(i && i.to.id === cap.id);
    assert.equal(cap.known[f.id]?.from, m.id, 'his captain heard it from him');
    assert.equal(cap.known[f.id]?.knowsActor, m.known[f.id].knowsActor);
  });

  ok('a superior takes one of his men to task for hurting the family\'s own earnings', { tags: ['scenario'] }, () => {
    const w = newWorld(7);
    const cap = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank === 'capo' && menOf(w, c).some((m) => !m.isPlayer)).sort(byId)[0];
    const m = menOf(w, cap).find((x) => !x.isPlayer)!;
    const b = Object.values(w.biz).find((x) => x.open && x.protection?.familyId === cap.familyId)!;
    const o = w.chars[b.ownerId];
    addFact(w, { kind: 'vandalism', actor: m.id, victim: o.id, business: b.id, text: `${m.name} smashed up ${b.name}.`, district: b.district }, { witnesses: [cap.id] });
    cap.cooldown = {};
    const t0 = rel(cap, m.id).trust;
    const i = act(w, cap, 'confront');
    assert.ok(i && i.to.id === m.id);
    assert.ok(rel(cap, m.id).trust < t0, 'he thinks less of him');
    assert.ok(Object.values(w.facts).some((f) => f.kind === 'discipline' && f.actor === cap.id && f.victim === m.id), 'and it happened: others know');
  });

  ok('a man short of money asks his superior for work, and gets it only if something needs doing', { tags: ['scenario'] }, () => {
    const w = newWorld(7);
    const cap = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank === 'capo' && menOf(w, c).some((m) => !m.isPlayer)).sort(byId)[0];
    const m = menOf(w, cap).find((x) => !x.isPlayer)!;
    m.cash = 0; m.cooldown = {}; m.jailedUntil = 0; m.hurtUntil = 0; rel(m, cap.id).grudge = 0;
    w.debts = w.debts.filter((d) => d.creditor !== cap.id);
    for (const b of Object.values(w.biz)) if (b.protection?.collectorId === cap.id) b.protection.late = 0;
    act(w, m, 'work');
    assert.ok(!w.jobs.some((j) => j.assignee === m.id && j.giver === cap.id && j.kind === 'collect'), 'nothing owed him: no collection');
    for (const j of w.jobs) if (j.assignee === m.id) j.status = 'done'; // (whatever else he was given, he has finished it)
    const d = createDebt(w, cap.id, civ(w, 2).id, 500, 0.05, 'a private loan'); d.missed = 1; w.chars[d.debtor].cash = 0;
    m.cooldown = {};
    act(w, m, 'work');
    assert.ok(w.jobs.some((j) => j.assignee === m.id && j.giver === cap.id && j.debt === d.id), 'something needs doing, and he is given it');
  });

  ok('behind with a man who won\'t listen to him, he asks a man the creditor trusts to speak for him', { tags: ['scenario'] }, () => {
    const w = newWorld(7), c = civ(w, 0), cr = civ(w, 1), by = civ(w, 2);
    c.cash = 0; cr.cash = 5000;
    const d = createDebt(w, cr.id, c.id, 1000, 0.05, 'a private loan'); d.missed = 3;
    for (const x of Object.values(w.chars)) { if (x.id !== c.id) delete c.rels[x.id]; if (x.id !== cr.id) delete cr.rels[x.id]; }
    rel(c, by.id).trust = 0.6; rel(cr, by.id).trust = 0.7; rel(by, c.id).trust = 0.5;
    const due = d.nextDue;
    const i = act(w, c, 'intercede');
    assert.ok(i && i.to.id === by.id);
    assert.ok(d.nextDue > due && d.missed < 3, 'the creditor gave him a week');
    void DAY;
  });
});
