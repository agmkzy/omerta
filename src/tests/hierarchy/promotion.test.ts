// Promotion and the player's road up: a rank change is applied once, keeps the hierarchy valid, and the player's
// readiness is the one in path.ts. From the V72 suite.
import { successionWeek } from '../../succession';
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { applyRank, hierarchyIssues, leaveCrew } from '../../rank';
import { careerTick, eligible, isRunner, promote, readiness, vacancy } from '../../career';
import { rel } from '../../core';
import { noteWork } from '../../work';
import type { Job } from '../../types';
import { chairAct, chairOptions, pathInfo } from '../../path';
import { prospects, recruitProspect } from '../../orders';
import { newWorld, P } from '../helpers';
import { fam } from './fixtures';

describe('promotion', { tags: ['unit'] }, () => {
  ok('a promotion is applied once: second promote() is a no-op, one history fact', () => {
    const w = newWorld(7); const fid = Object.keys(w.fam).find((f) => f !== P(w).familyId)!;
    const a = fam(w, fid).find((c) => c.rank === 'associate' && !c.prospect)!;
    const before = Object.values(w.facts).filter((f) => f.kind === 'promotion' && f.actor === a.id).length;
    promote(w, a, 'soldier'); promote(w, a, 'soldier');
    const after = Object.values(w.facts).filter((f) => f.kind === 'promotion' && f.actor === a.id).length;
    assert.equal(after - before, 1); assert.equal(a.rank, 'soldier');
    assert.equal(applyRank(w, a, 'soldier'), false);
    assert.ok(a.career!.log.some((l) => /soldier/.test(l.text)), 'career record');
    assert.deepEqual(hierarchyIssues(w), []);
  });
  ok('promotion to capo / underboss keeps the hierarchy valid and reattaches crews', () => {
    const w = newWorld(7); const fid = Object.keys(w.fam).find((f) => f !== P(w).familyId)!;
    const sol = fam(w, fid).find((c) => c.rank === 'soldier')!;
    promote(w, sol, 'capo'); assert.deepEqual(hierarchyIssues(w), []);
    promote(w, sol, 'underboss'); assert.deepEqual(hierarchyIssues(w), []);
    assert.equal(fam(w, fid).filter((c) => c.rank === 'underboss').length >= 1, true);
  });
  for (const code of ['ask', 'move']) ok(`taking the chair (${code}) leaves a valid hierarchy`, () => {
    const w = newWorld(3); const p = P(w); const f = w.fam[p.familyId!]; const old = w.chars[f.bossId];
    const ub = fam(w, f.id).find((c) => c.rank === 'underboss' && !c.isPlayer);
    if (ub) applyRank(w, ub, 'capo', { fact: false });
    applyRank(w, p, 'underboss', { fact: false, place: (x) => { x.bossId = old.id; } });
    for (const c of fam(w, f.id)) if (c.rank === 'capo') c.bossId = p.id;
    assert.deepEqual(hierarchyIssues(w), [], 'before');
    w.rng.chance = () => true; p.cooldown = {};
    const opt = chairOptions(w, p).find((o) => o.code === code);
    if (!opt) throw new Error('no ' + code + ' option: ' + chairOptions(w, p).map((o) => o.code));
    opt.chance = 1;
    chairAct(w, p, code);
    assert.equal(w.fam[p.familyId!].bossId, p.id); assert.equal(p.rank, 'boss'); assert.equal(p.bossId, null);
    assert.deepEqual(hierarchyIssues(w), []);
    if (code === 'ask') { assert.equal(old.rank, 'capo'); assert.equal(old.bossId, p.id); } else assert.equal(old.alive, false);
  });
  ok('cut loose / defecting keeps the hierarchy valid', () => {
    // (a made man's recruits are associates of the family; an associate's are his crewmen, civilians who answer to nobody when let go)
    const w = newWorld(7); const p = P(w); p.cash = 5000; applyRank(w, p, 'soldier', { fact: false, career: false });
    for (const pr of prospects(w, p).slice(0, 3)) recruitProspect(w, p, pr.c);
    const [a, b] = Object.values(w.chars).filter((c) => c.bossId === p.id);
    leaveCrew(w, a); assert.notEqual(a.bossId, p.id); assert.ok(a.bossId, 'has someone to answer to'); assert.deepEqual(hierarchyIssues(w), []);
    const other = Object.keys(w.fam).find((f) => f !== p.familyId)!;
    leaveCrew(w, b, other); assert.equal(b.familyId, other); assert.ok(b.bossId && w.chars[b.bossId].familyId === other); assert.deepEqual(hierarchyIssues(w), []);
  });
  ok('player readiness is the road in path.ts', () => {
    const w = newWorld(7); const p = P(w);
    for (const [kick, st] of [[0, 40], [20000, 60], [60000, 80]] as const) {
      p.lifetimeKick = kick; p.standing = st;
      const r = readiness(w, p); const i = pathInfo(w, p);
      assert.equal(!!r, !!i);
      if (r && i) { assert.equal(r.to, i.to); assert.equal(r.ready, i.ready); assert.equal(eligible(r), i.ready && r.openSeat); assert.ok(r.earn <= 1 && r.score <= 1); }
    }
    p.lifetimeKick = 0; assert.equal(readiness(w, p)!.ready, false);
  });
  // Stage 4, increment 5: one rulebook for every man
  ok('the road is the same for every man: the player and an NPC associate are measured on the same things', () => {
    const w = newWorld(7), p = P(w);
    const a = fam(w, p.familyId!).find((c) => c.rank === 'associate' && !c.isPlayer && !c.prospect)!;
    const keys = (c: typeof p) => pathInfo(w, c)!.goals.map((g) => g.key).sort();
    assert.deepEqual(keys(a), keys(p));
    assert.ok(readiness(w, a)!.blockers.every((b) => !/\byou\b/.test(b)), 'his blockers speak of him, not you');
  });
  ok('an NPC is not made because time has passed: a seat open and his road undone, he stays where he is', () => {
    const w = newWorld(7), p = P(w);
    const a = fam(w, p.familyId!).find((c) => c.rank === 'associate' && !c.isPlayer && !c.prospect)!;
    for (const c of fam(w, p.familyId!)) if (c.rank === 'associate' && c.id !== a.id) c.lifetimeKick = 0; // nobody else is ready either
    a.lifetimeKick = 0; a.career = { done: 0, failed: 0, log: [] };
    for (let i = 0; i < 20; i++) { w.now += 7 * 24 * 60; w.fam[p.familyId!].lastPromo = 0; careerTick(w); }
    assert.equal(a.rank, 'associate');
  });
  ok('an NPC whose road is done is made when there is a seat: money passed up, work done, backing, a name, and the test passed', () => {
    const w = newWorld(7), p = P(w), fid = p.familyId!;
    const a = fam(w, fid).find((c) => c.rank === 'associate' && !c.isPlayer && !c.prospect && !isRunner(w, c))!;
    a.lifetimeKick = 5000; a.standing = 60; a.jailedUntil = 0; a.career = { done: 4, failed: 0, log: [], proved: 'soldier' };
    for (const c of fam(w, fid)) if (c.id !== a.id) rel(c, a.id).trust = 0.8;
    assert.ok(readiness(w, a)!.ready, 'his road is done: ' + readiness(w, a)!.blockers.join('; '));
    delete a.career.proved;
    assert.ok(!readiness(w, a)!.ready, 'until he has passed the test the family sets him, he is not ready to be made');
    a.career.proved = 'soldier';
    while (!vacancy(w, fid, 'soldier')) { const s = fam(w, fid).find((c) => c.rank === 'soldier' && !c.isPlayer)!; s.alive = false; }
    // (The Family: the seat opens the books, the family's line puts him first, and he is made from it, the appointment on record)
    for (let i = 0; i < 12 && a.rank === 'associate'; i++) { w.now += 7 * 24 * 60; w.fam[fid].lastPromo = 0; for (const c of fam(w, fid)) if (c.rank === 'associate' && c.id !== a.id) { c.lifetimeKick = 0; c.standing = 0; } successionWeek(w); careerTick(w); }
    assert.equal(a.rank, 'soldier');
    assert.ok((w.fam[fid].appts ?? []).some((x) => x.office === 'Made' && x.who === a.id && /books opened/.test(x.why)), 'and the record says why');
  });
  ok('work a man finishes is on his record, and on his superior\'s when he sent him', () => {
    const w = newWorld(7), p = P(w);
    const cap = Object.values(w.chars).find((c) => c.alive && !c.isPlayer && c.rank === 'capo')!;
    const m = Object.values(w.chars).find((c) => c.alive && c.bossId === cap.id && !c.isPlayer)!;
    const j = { id: 'jx', kind: 'collect', title: 'Collect', brief: '', giver: cap.id, via: 'order', assignee: m.id, pay: 0, created: w.now, expires: w.now, status: 'done' } as Job;
    const d0 = m.career?.done ?? 0, l0 = cap.career?.led ?? 0;
    noteWork(w, j, true);
    assert.equal(m.career!.done, d0 + 1); assert.equal(m.career!.rough, 1); assert.equal(cap.career!.led, l0 + 1);
    noteWork(w, { ...j, kind: 'handle' }, true);
    assert.equal(m.career!.hard, 1, 'dealing with a man who hurt one of ours is the family\'s hard work');
    void p;
  });
});
