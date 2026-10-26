// A score you play (Phase 1.5): a truck tipped by a man with a reason, prepared as the player chooses, taken one of the ways his
// preparation opened, sometimes gone sideways, and settled in the world's records: money conserved, a theft on record, his men paid,
// a protector told.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { createDebt } from '../../core';
import { moneyTotal } from '../../goals';
import { applyRank } from '../../rank';
import { makeScore, scoreChoose, scoreTip } from '../../score';
import { authorityWeek } from '../../authority';
import { type Enc } from '../../types';
import { P } from '../helpers';
import { familyMen, worldFor } from './play';

function tipped(seed: number) {
  const w = worldFor(seed), p = P(w);
  applyRank(w, p, 'soldier', { fact: false, career: false });
  p.standing = 45; p.cash = 3000;
  authorityWeek(w, p); // (a man of his own)
  const e = () => w.enc.find((x) => x.kind === 'score' && x.status === 'open') as Enc;
  return { w, p, e };
}
const codes = (e: Enc) => e.opts.map((o) => o.code);

describe('a truck, played', { tags: ['scenario'] }, () => {
  ok('the tip comes from a man with a reason: one who owes him, before one of his own', () => {
    const { w, p } = tipped(3);
    const debtor = familyMen(w, 'associate').find((c) => c.bossId !== p.id)!;
    createDebt(w, p.id, debtor.id, 400, 0.03, 'test');
    assert.equal(scoreTip(w, p)?.giver.id, debtor.id);
    assert.equal(scoreTip(w, p)?.src, 'owes');
  });
  ok('preparation opens ways in: casing it opens the diner; a man of his own opens the road', () => {
    const { w, p, e } = tipped(3);
    const t = scoreTip(w, p)!; makeScore(w, p, t.giver, t.src);
    scoreChoose(w, p, e(), 'plan');
    assert.ok(codes(e()).includes('case') && codes(e()).includes('whose'));
    scoreChoose(w, p, e(), 'case');
    assert.ok(!codes(e()).includes('case'), 'cased once');
    const man = codes(e()).find((c) => c.startsWith('man:'))!;
    scoreChoose(w, p, e(), man);
    scoreChoose(w, p, e(), 'go');
    assert.ok(codes(e()).includes('diner'), 'the diner, because he cased it');
    assert.ok(codes(e()).includes('road'), 'the road, because he has a man');
    assert.ok(!codes(e()).includes('giveup'), 'no driver in on it');
  });
  ok('taken, it is a theft on record, his man is paid, and money is conserved', () => {
    for (const seed of [3, 7, 11, 13, 17, 19]) {
      const { w, p, e } = tipped(seed);
      const t = scoreTip(w, p)!; makeScore(w, p, t.giver, t.src);
      scoreChoose(w, p, e(), 'plan'); scoreChoose(w, p, e(), 'case');
      const man = codes(e()).find((c) => c.startsWith('man:')); if (man) scoreChoose(w, p, e(), man);
      scoreChoose(w, p, e(), 'go');
      const m0 = moneyTotal(w), g0 = p.goods;
      scoreChoose(w, p, e(), 'diner');
      const open = e(); if (open) scoreChoose(w, p, open, 'abort'); // (it went sideways: walked away)
      if (p.goods === g0 && !Object.values(w.facts).some((f) => f.kind === 'theft' && f.actor === p.id)) continue;
      assert.equal(moneyTotal(w), m0, 'money conserved');
      assert.ok(Object.values(w.facts).some((f) => f.kind === 'theft' && f.actor === p.id && f.hiddenActor), 'the theft, its doers hidden');
      return;
    }
    assert.fail('the diner never came off in six worlds');
  });
  ok('knowing whose it is, he can sell the warning to the men who protect the place instead: paid, and a favour owed', () => {
    for (const seed of [3, 7, 11, 13, 17, 19, 23, 29]) {
      const { w, p, e } = tipped(seed);
      const t = scoreTip(w, p)!; makeScore(w, p, t.giver, t.src);
      scoreChoose(w, p, e(), 'plan'); scoreChoose(w, p, e(), 'whose');
      if (!codes(e()).includes('warn')) continue;
      const b = w.biz[String(e().data?.biz)], prot = w.chars[b.protection!.collectorId];
      const c0 = p.cash, m0 = moneyTotal(w);
      scoreChoose(w, p, e(), 'warn');
      assert.ok(p.cash > c0, 'paid');
      assert.equal(moneyTotal(w), m0);
      assert.ok(w.favours.some((f) => f.from === p.id && f.to === prot.id), 'he owes it');
      return;
    }
    assert.fail('no protected load in eight worlds');
  });
});

describe('muscle work, played', { tags: ['scenario'] }, () => {
  // (standing behind a man who is refused is a moment the player plays: the job waits on it, and what he does decides it)
  const refusedJob = async () => {
    const { mkJob, takeJob, resolve, approaches } = await import('../../jobs');
    const { newWorld } = await import('../helpers');
    for (let seed = 1; seed < 60; seed++) {
      const w = newWorld(seed), p = P(w);
      const civs = Object.values(w.chars).filter((c) => c.alive && c.rank === 'civilian' && !c.isPlayer).sort((a, b) => (a.id < b.id ? -1 : 1));
      const giver = civs[0], target = civs[1];
      target.cash = 2000;
      const j = mkJob(w, { kind: 'gig', title: 'Somebody to stand behind him', giver: giver.id, via: 'opportunity', assignee: p.id, target: target.id, pay: 150, days: 5, brief: 'x', extra: { gig: 'muscle', owed: 400 } });
      takeJob(w, j);
      const r = resolve(w, j, 'stand');
      if (r.moment) return { w, p, j, giver, target, resolve, approaches };
    }
    throw new Error('never refused in sixty worlds');
  };
  ok('refused to his face, the job waits on the moment, and the moment has three ways', async () => {
    const { w, j, approaches } = await refusedJob();
    assert.equal(j.status, 'active', 'nothing is settled yet');
    assert.deepEqual(approaches(w, j).map((a) => a.code), ['m_close', 'm_wall', 'm_walk']);
  });
  ok('walking away settles it: no pay, and the man who hired you thinks less of you', async () => {
    const { w, p, j, giver, resolve } = await refusedJob();
    (giver.rels[p.id] ??= { trust: 0.5, respect: 0.3, affection: 0.2, grudge: 0, lastMet: w.now }).trust = 0.5;
    const cash = p.cash, trust = giver.rels[p.id].trust;
    resolve(w, j, 'm_walk');
    assert.notEqual(j.status, 'active');
    assert.equal(p.cash, cash, 'not paid');
    assert.ok((giver.rels[p.id]?.trust ?? 0) < trust);
  });
  ok('stepping in settles it one way or the other, and the moment is over', async () => {
    const { w, j, resolve } = await refusedJob();
    resolve(w, j, 'm_wall');
    assert.notEqual(j.status, 'active');
    assert.equal(j.extra?.moment, undefined);
  });
});
