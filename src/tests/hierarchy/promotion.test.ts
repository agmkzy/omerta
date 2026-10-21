// Promotion and the player's road up: a rank change is applied once, keeps the hierarchy valid, and the player's
// readiness is the one in path.ts. From the V72 suite.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { applyRank, hierarchyIssues, leaveCrew } from '../../rank';
import { promote, readiness, eligible } from '../../career';
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
    const w = newWorld(7); const p = P(w); p.cash = 5000;
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
});
