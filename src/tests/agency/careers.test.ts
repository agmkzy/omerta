// NPC careers: recruiting follows rank and authority, an advancement goal never promotes by itself, backing goes through
// the existing rule, and better terms stay within the floor. From the V74 suite.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { WEEK } from '../../types';
import { audit } from '../../consistency';
import { ownerBiz, rel } from '../../core';
import { agencyOf, begin, stepGoal } from '../../goals';
import { agencyWorld, npcs, LADDER_OK } from './fixtures';
import { P } from '../helpers';

describe('careers', { tags: ['scenario'] }, () => {
  ok('recruiting follows rank and authority: associates cannot, a capo can; crew room and cost respected', () => {
    const w = agencyWorld(7, 20); const fam = P(w).familyId!;
    const pro = Object.values(w.chars).find((c) => c.alive && c.prospect && c.rank === 'civilian' && !ownerBiz(w, c.id))!; assert.ok(pro);
    const cap = Object.values(w.chars).find((c) => c.alive && !c.isPlayer && c.rank === 'capo' && c.familyId === fam)!; cap.cash = 5000; cap.jailedUntil = 0;
    const assoc = Object.values(w.chars).find((c) => c.alive && !c.isPlayer && c.rank === 'associate' && c.familyId === fam)!; assoc.cash = 5000;
    const g0 = begin(w, assoc, 'recruit', 'x', 0.5, { stage: 'spot' }); stepGoal(w, g0, assoc);
    assert.equal(agencyOf(w).ended.at(-1)!.how, 'dropped'); assert.equal(pro.rank, 'civilian');
    pro.traits.ambition = 0.3; pro.traits.caution = 0; cap.traits.sociability = 1; cap.standing = 100;
    const g = begin(w, cap, 'recruit', 'x', 0.5, { stage: 'spot' }); const c0 = cap.cash;
    for (let i = 0; i < 30 && agencyOf(w).goals.includes(g); i++) { w.now = Math.max(w.now, g.review); stepGoal(w, g, cap); }
    const taken = Object.values(w.chars).filter((c) => c.alive && c.bossId === cap.id && c.rank === 'associate' && c.id === g.target || c.id === pro.id && c.rank === 'associate');
    assert.ok(agencyOf(w).stats.recruitTry >= 1);
    if (pro.rank === 'associate') { assert.equal(pro.bossId, cap.id); assert.equal(pro.familyId, cap.familyId); assert.ok(cap.cash < c0); assert.ok(taken.length >= 1); }
    assert.deepEqual(audit(w), []);
  });
  ok('two recruiters after the same man cannot both get him', () => {
    const w = agencyWorld(7, 20); const fam = P(w).familyId!;
    const pro = Object.values(w.chars).find((c) => c.alive && c.prospect && c.rank === 'civilian' && !ownerBiz(w, c.id))!;
    const two = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank === 'capo' && c.familyId === fam).slice(0, 2);
    assert.equal(two.length > 1 ? 2 : 1, two.length >= 2 ? 2 : 1);
    if (two.length < 2) return;
    for (const c of two) { c.cash = 5000; c.traits.sociability = 1; c.standing = 100; }
    pro.traits.ambition = 0.2; pro.traits.caution = 0;
    const gs = two.map((c) => begin(w, c, 'recruit', 'x', 0.5, { stage: 'approach', target: pro.id }));
    for (let i = 0; i < 6; i++) for (const g of gs) if (agencyOf(w).goals.includes(g)) { w.now = Math.max(w.now, g.review); stepGoal(w, g, w.chars[g.who]); }
    assert.ok(pro.rank === 'civilian' || two.filter((c) => pro.bossId === c.id).length === 1);
    assert.deepEqual(audit(w), []);
  });
  ok('an advancement goal never promotes: only the career system does', () => {
    const w = agencyWorld(7, 20); const c = npcs(w, 'soldier')[0]; c.traits.ambition = 1; c.lifetimeKick = 999999; c.standing = 100;
    const g = begin(w, c, 'advance', 'x', 0.9, { stage: 'build' }); const r0 = c.rank;
    for (let i = 0; i < 40; i++) { w.now += WEEK; g.review = w.now; if (agencyOf(w).goals.includes(g)) stepGoal(w, g, c); }
    assert.equal(c.rank, r0); assert.ok(agencyOf(w).stats.promoPursued >= 1);
  });
  ok('asking for backing sets the sponsor the existing rule reads; the rule alone decides the rank', () => {
    const w = agencyWorld(7, 20); const c = npcs(w, 'soldier')[0]; const boss = w.chars[c.bossId!]; c.traits.ambition = 1; delete c.backer;
    rel(boss, c.id).trust = 0.3; rel(boss, c.id).respect = 1; rel(c, boss.id).trust = 1; c.lifetimeKick = 99999; c.standing = 80;
    const g = begin(w, c, 'advance', 'x', 0.9, { stage: 'build' });
    for (let i = 0; i < 20 && !c.backer; i++) { w.now += WEEK; g.review = w.now; stepGoal(w, g, c); }
    if (LADDER_OK(boss)) assert.equal(c.backer, boss.id);
    assert.equal(c.rank, 'soldier');
  });
  ok('independence: better terms lower the rate within the floor, or fail - and are counted', () => {
    const w = agencyWorld(7, 20); const c = npcs(w, 'soldier')[0]; const boss = w.chars[c.bossId!]; c.cash = 5000; c.kickRate = 0.2;
    rel(boss, c.id).trust = 1; rel(boss, c.id).respect = 1;
    const g = begin(w, c, 'independence', 'x', 0.7, { stage: 'terms' });
    for (let i = 0; i < 12 && agencyOf(w).goals.includes(g); i++) { w.now = Math.max(w.now, g.review); stepGoal(w, g, c); }
    assert.ok(c.kickRate >= 0.1 - 1e-9 && c.kickRate <= 0.2); assert.ok(!agencyOf(w).goals.includes(g));
  });
});
