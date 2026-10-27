// The economy's consequences reach the rest of the world (October 2026): a stolen car, a refused raise, a short till, a bank that can't
// pay. Each test follows one chain from the business circumstance to what other men then hold, know and do.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { addFact, createDebt, rel } from '../../core';
import { bizMove, transferBusiness } from '../../econ';
import { bigHit, carFound, developments, entChoose, stealCar } from '../../enterprise';
import { establishmentsWeek, motives } from '../../establishments';
import { startOp } from '../../rackets';
import { applyRank } from '../../rank';
import { DAY, type Character, type Enc, type Op, type World } from '../../types';
import { newWorld, P } from '../helpers';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
function soldierWith(w: World, kind: 'chop' | 'numbers' | 'fencing' | 'bookie', runner?: Character): Op {
  const p = P(w);
  applyRank(w, p, 'soldier', { fact: false, career: false });
  p.cash = 5000;
  startOp(w, p, kind, p.district, runner?.id ?? null);
  return w.ops.find((o) => o.owner === p.id && o.kind === kind)!;
}
const encOf = (w: World, k: string) => w.enc.find((e) => e.status === 'open' && e.data?.k === k);

describe('the economy reaches the rest of the world', { tags: ['scenario'] }, () => {
  ok('a made man’s car through the shop, found out, is his grudge, his captain’s knowledge and tension between the families', () => {
    const w = newWorld(7), p = P(w), op = soldierWith(w, 'chop');
    const victim = Object.values(w.chars).filter((c) => c.alive && c.familyId && c.familyId !== p.familyId && c.rank === 'soldier' && c.bossId).sort(byId)[0];
    const thief = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank === 'civilian').sort(byId)[0];
    const car = stealCar(w, op, thief); car.owner = victim.id; car.hot = 'made';
    const t0 = w.fam[p.familyId!].tension[victim.familyId!] ?? 0;
    carFound(w, op, p, car, thief);
    assert.ok(rel(victim, p.id).grudge > 0.2, 'he holds it against the shop’s owner');
    assert.match(victim.rels[p.id].why?.text ?? '', /chop shop/);
    assert.ok((w.fam[p.familyId!].tension[victim.familyId!] ?? 0) > t0, 'and it is between the families now');
    const f = Object.values(w.facts).find((x) => x.victim === victim.id && /chop shop/.test(x.text))!;
    assert.ok(w.chars[victim.bossId!].known[f.id], 'his captain knows where it went');
  });
  ok('a raise refused is a grudge with its reason; pressed enough, the man walks out, takes people with him, and says why', () => {
    const w = newWorld(7), p = P(w);
    const r = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId === p.familyId && c.rank === 'associate').sort(byId)[0];
    r.bossId = p.id; r.traits.ambition = 0.95; r.traits.greed = 0.9;
    // (and something pressing on him: he owes a book; a contented man doesn't ask, however greedy)
    const lender = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId && c.id !== r.id).sort(byId)[0];
    createDebt(w, lender.id, r.id, 900, 0.05, 'a marker on the book');
    const op = soldierWith(w, 'numbers', r);
    op.weeks = 20; op.total = 9000; op.last = 600;
    developments(w, op);
    const more = encOf(w, 'more');
    assert.ok(more, 'a man pressed by greed and ambition asks for more');
    entChoose(w, p, more!, 'no');
    assert.match(r.rels[p.id].why?.text ?? '', /cut/);
    rel(r, p.id).trust = 0; rel(r, p.id).grudge = 0.6;
    for (let i = 0; i < 40 && !encOf(w, 'own'); i++) { op.cool = {}; w.now += 7 * DAY; developments(w, op); }
    const own = encOf(w, 'own');
    assert.ok(own, 'he went his own way');
    assert.ok(w.ops.some((o) => o.owner === r.id && o.kind === 'numbers'), 'with a bank of his own');
    assert.match(own!.lines.join(' '), /cut|wouldn’t/, 'and the reason is the one he holds');
  });
  ok('a bank one of his men can’t cover comes to the player as his captain, and what he does is remembered', () => {
    const w = newWorld(7), p = P(w);
    applyRank(w, p, 'capo', { fact: false, career: false }); p.cash = 9000;
    const m = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId === p.familyId && c.rank === 'associate').sort(byId)[0];
    m.bossId = p.id; m.cash = 3000;
    startOp(w, m, 'numbers', m.district, null);
    const op = w.ops.find((o) => o.owner === m.id)!;
    m.cash = 0;
    bigHit(w, op, m, 2000);
    const e = encOf(w, 'cover');
    assert.ok(e, 'he came to his captain');
    entChoose(w, p, e!, 'no');
    assert.ok(rel(m, p.id).grudge > 0.05, 'and holds it against him');
    assert.ok(Object.values(w.facts).some((f) => /didn’t cover it/.test(f.text) && f.actor === m.id), 'and the street hears his bank welshed');
  });
  ok('a manager in debt to a book skims the till, and the owner hears of it with the reason he could know', () => {
    const w = newWorld(7), p = P(w);
    const b = Object.values(w.biz).filter((x) => x.open && x.kind === 'restaurant').sort(byId)[0];
    transferBusiness(w, b, p.id, 'bought it');
    const mgr = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank === 'civilian' && c.district === b.district).sort(byId)[1];
    b.managerId = mgr.id; mgr.traits.greed = 0.8; mgr.traits.caution = 0.1; rel(mgr, p.id).trust = 0;
    const lender = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.familyId).sort(byId)[0];
    const f = addFact(w, { kind: 'loan', actor: lender.id, victim: mgr.id, amount: 1200, text: `${mgr.name} ran up a marker with ${lender.name}.`, district: b.district }, { witnesses: [lender.id, p.id] });
    createDebt(w, lender.id, mgr.id, 1200, 0.05, 'a marker on the book', f.id);
    const ms = motives(w, mgr, p);
    assert.ok(ms.some((m) => m.kind === 'debt'), 'what presses on him is the debt');
    for (let i = 0; i < 60 && !encOf(w, 'till'); i++) { w.now += 7 * DAY; b.cool = {}; bizMove(w, b, 400, 'revenue'); establishmentsWeek(w); }
    const e = encOf(w, 'till');
    assert.ok(e, 'the till came up short, and it reached him');
    assert.match(e!.lines.join(' '), /owes/, 'and he hears what is pressing on the man, because he knows of the debt');
  });
  ok('a captain asked for his piece and ignored holds it against the man, with the reason', () => {
    const w = newWorld(7), p = P(w), op = soldierWith(w, 'bookie');
    const cap = w.chars[p.bossId!];
    const e: Enc = { id: 'e1', kind: 'ent', from: cap.id, t: w.now, expires: w.now - 1, title: '', lines: [], opts: [], status: 'open', data: { k: 'tribute', op: op.id, share: 0.1 } };
    w.enc.push(e);
    entChoose(w, p, e, 'no');
    assert.ok(rel(cap, p.id).grudge > 0.1);
    assert.match(cap.rels[p.id].why?.text ?? '', /piece/);
  });
});
