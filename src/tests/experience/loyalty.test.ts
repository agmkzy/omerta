// Loyalty, tested (the compelling-RPG stage): a captain with no love for the player's own captain asks him to tell him how things go in
// his crew. Each answer is remembered by the men it touches, and selling his captain can come out weeks later.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { rel } from '../../core';
import { answerCourting, courter, makeCourting } from '../../loyalty';
import { answerDeal, dealer, makeDeal } from '../../crossdeal';
import { resolve } from '../../jobs';
import { DAY } from '../../types';
import { P } from '../helpers';
import { captain, familyMen, worldFor } from './play';

function setUp(seed: number) {
  const w = worldFor(seed), p = P(w), cap = captain(w);
  const x = familyMen(w, 'capo').find((c) => c.id !== cap.id)!;
  rel(x, cap.id).grudge = 0.4; p.standing = 45; p.career = { done: 3, failed: 0, log: [] };
  return { w, p, cap, x };
}

describe('a rival captain courts the player', { tags: ['scenario'] }, () => {
  ok('he comes only with a reason (bad blood with the player’s captain) and to a man worth having', () => {
    const { w, p, cap, x } = setUp(3);
    assert.equal(courter(w, p)?.x.id, x.id);
    rel(x, cap.id).grudge = 0; assert.equal(courter(w, p), undefined, 'no bad blood, no approach');
  });
  ok('going to the captain with it is remembered by both men', () => {
    const { w, p, cap, x } = setUp(3);
    makeCourting(w, p, x, cap);
    const e = w.enc.find((q) => q.kind === 'courting')!;
    const t0 = rel(cap, p.id).trust, g0 = rel(cap, x.id).grudge;
    answerCourting(w, p, e, 'tell');
    assert.ok(rel(cap, p.id).trust > t0, 'his captain trusts him more');
    assert.ok(rel(cap, x.id).grudge > g0, 'and holds it against the man who tried');
  });
  ok('selling the captain pays, and can come out weeks later, told to the player by the captain himself', () => {
    let caught = false;
    for (const seed of [3, 7, 11, 13]) {
      const { w, p, cap, x } = setUp(seed);
      makeCourting(w, p, x, cap);
      const cash0 = p.cash;
      answerCourting(w, p, w.enc.find((q) => q.kind === 'courting')!, 'deal');
      assert.ok(p.cash > cash0, 'paid');
      advance(w, w.now + 43 * DAY);
      if (w.enc.some((e) => e.kind === 'imposed' && e.from === cap.id && /knows/.test(e.title))) { caught = true; assert.ok(rel(cap, p.id).trust < 0.2); break; }
    }
    assert.ok(caught, 'it never came out in four worlds');
  });
});

describe('a man of another family puts a job to the player', { tags: ['scenario'] }, () => {
  const deal = (seed: number) => {
    const w = worldFor(seed), p = P(w); p.standing = 40;
    const d = dealer(w, p);
    if (!d) return undefined;
    makeDeal(w, p, d.x, d.cap, d.b);
    return { w, p, ...d, e: w.enc.find((q) => q.kind === 'crossdeal')! };
  };
  ok('he comes from another family, with a place neither family looks after', () => {
    const got = [3, 7, 11, 13].map(deal).filter(Boolean);
    assert.ok(got.length, 'nobody in four worlds');
    for (const g of got) {
      assert.notEqual(g!.x.familyId, g!.p.familyId);
      assert.ok(![g!.p.familyId, g!.x.familyId].includes(g!.b.protection?.familyId ?? null));
    }
  });
  ok('taking it to his captain is remembered by his captain either way', () => {
    const g = [3, 7, 11, 13].map(deal).find(Boolean)!;
    const t0 = rel(g.cap, g.p.id).trust;
    answerDeal(g.w, g.p, g.e, 'cap');
    assert.ok(rel(g.cap, g.p.id).trust > t0);
  });
  ok('done quietly, it is the world’s own burglary, and it can come out weeks later, told by his captain himself', () => {
    let caught = false;
    for (const seed of [3, 7, 11, 13, 17, 19, 23]) {
      const g = deal(seed);
      if (!g) continue;
      answerDeal(g.w, g.p, g.e, 'quiet');
      const j = g.w.jobs.find((q) => q.kind === 'burgle' && q.assignee === g.p.id && q.giver === g.x.id && q.status === 'active');
      assert.ok(j, 'the job is in his work');
      resolve(g.w, j!, 'quiet');
      if (j!.status !== 'done') continue;
      advance(g.w, g.w.now + 36 * DAY);
      if (g.w.enc.some((e) => e.kind === 'imposed' && e.from === g.cap.id && /heard about/.test(e.title))) { caught = true; break; }
    }
    assert.ok(caught, 'it never came out');
  });
});
