// Succession: who takes the chair when a boss dies, retires, goes inside or is removed, and that the chain of command
// stays valid. From the V72 (hierarchy repair) and V76 (scored succession) suites.
import assert from 'node:assert';
import { beforeAll, describe, test as ok } from 'vitest';
import { SEEDS } from '../modes';
import { advance } from '../../engine';
import { DAY } from '../../types';
import { audit } from '../../consistency';
import { REPAIRS, hierarchyIssues, repairHierarchy } from '../../rank';
import { handleDeath, rel } from '../../core';
import { clubOf } from '../../clubdata';
import { politicsCoup } from '../../politics';
import { candidates, leave, leaderOf, membersOf, orgList, orgWeek } from '../../orgs';
import { newWorld, P } from '../helpers';
import { fam } from './fixtures';
import { orgWorld, clean, other, rank } from '../organisations/fixtures';

// The world the unit tests below start from takes a second or more to simulate: build it here, so a unit test's time
// limit measures only its own work.
beforeAll(() => { orgWorld(3, 20, 5); });

describe('succession', () => {
  ok('fresh world has a valid hierarchy', { tags: ['unit'] }, () => assert.deepEqual(hierarchyIssues(newWorld(7)), []));
  ok('boss dies: underboss takes over, everyone re-attaches', { tags: ['unit'] }, () => {
    const w = newWorld(7); const fid = 'fam_santangelo' in w.fam ? 'fam_santangelo' : Object.keys(w.fam).find((f) => f !== P(w).familyId)!;
    const boss = w.chars[w.fam[fid].bossId];
    const ub = fam(w, fid).find((c) => c.rank === 'underboss');
    handleDeath(w, boss.id);
    assert.equal(w.fam[fid].bossId, ub!.id); assert.equal(ub!.rank, 'boss'); assert.equal(ub!.bossId, null);
    assert.deepEqual(hierarchyIssues(w), []);
  });
  ok('boss dies with nobody senior left: a soldier takes the chair (no dead boss)', { tags: ['unit'] }, () => {
    const w = newWorld(7); const fid = Object.keys(w.fam).find((f) => f !== P(w).familyId)!;
    for (const c of fam(w, fid)) if (c.rank === 'underboss' || c.rank === 'capo') handleDeath(w, c.id);
    assert.deepEqual(hierarchyIssues(w), [], 'after the captains die');
    handleDeath(w, w.fam[fid].bossId);
    const head = w.chars[w.fam[fid].bossId];
    assert.ok(head.alive && head.rank === 'boss', 'live boss');
    assert.deepEqual(hierarchyIssues(w), []);
  });
  ok('boss dies with only associates left', { tags: ['unit'] }, () => {
    const w = newWorld(7); const fid = Object.keys(w.fam).find((f) => f !== P(w).familyId)!;
    for (const c of fam(w, fid)) if (c.rank !== 'associate' && c.rank !== 'boss') handleDeath(w, c.id);
    handleDeath(w, w.fam[fid].bossId);
    const head = w.chars[w.fam[fid].bossId];
    assert.ok(head.alive && head.rank === 'boss');
    assert.deepEqual(hierarchyIssues(w), []);
  });
  ok('named heir inherits', { tags: ['unit'] }, () => {
    const w = newWorld(7); const fid = Object.keys(w.fam).find((f) => f !== P(w).familyId)!;
    const heir = fam(w, fid).find((c) => c.rank === 'capo')!;
    w.fam[fid].heir = heir.id;
    handleDeath(w, w.fam[fid].bossId);
    assert.equal(w.fam[fid].bossId, heir.id);
    assert.deepEqual(hierarchyIssues(w), []);
  });
  ok('injected dead superior, wrong family, self and loops are detected and repaired', { tags: ['unit'] }, () => {
    const w = newWorld(7); const fid = Object.keys(w.fam).find((f) => f !== P(w).familyId)!;
    const m = fam(w, fid);
    const sol = m.find((c) => c.rank === 'soldier')!; const cap = m.find((c) => c.rank === 'capo')!;
    cap.alive = false; sol.bossId = cap.id;
    assert.ok(hierarchyIssues(w).some((x) => x.includes('dead')), 'dead superior flagged');
    repairHierarchy(w, fid); assert.deepEqual(hierarchyIssues(w), []);
    const assoc = m.filter((c) => c.rank === 'associate' && c.alive);
    assoc[0].bossId = assoc[1].id; assoc[1].bossId = assoc[0].id;
    assert.ok(hierarchyIssues(w).some((x) => x.includes('loop')), 'loop flagged');
    repairHierarchy(w, fid); assert.deepEqual(hierarchyIssues(w), []);
    sol.bossId = null as never; assert.ok(hierarchyIssues(w).length > 0); repairHierarchy(w, fid); assert.deepEqual(hierarchyIssues(w), []);
    sol.bossId = Object.values(w.chars).find((c) => c.alive && c.familyId && c.familyId !== fid && c.rank === 'capo')!.id;
    assert.ok(hierarchyIssues(w).length > 0, 'other-family superior flagged'); repairHierarchy(w, fid); assert.deepEqual(hierarchyIssues(w), []);
    assert.ok(audit(w).every((x) => !/boss|answers/.test(x)), 'audit() agrees once repaired');
  });
  ok('audit() reports hierarchy damage', { tags: ['unit'] }, () => {
    const w = newWorld(7); const fid = Object.keys(w.fam).find((f) => f !== P(w).familyId)!;
    handleDeath(w, w.fam[fid].bossId); w.chars[w.fam[fid].bossId].alive = false; // nobody repaired it
    assert.ok(audit(w).some((x) => /boss/.test(x)));
  });
  ok('4a. succession is scored, not the oldest or richest: a trusted captain beats a resented, wealthy underboss', { tags: ['unit'] }, () => {
    const w = orgWorld(3, 20, 5); const f = other(w); const boss = leaderOf(w, f.id)!;
    const ub = rank(w, f.id, 'underboss')[0], cap = rank(w, f.id, 'capo')[0];
    ub.cash = 90000; ub.lifetimeKick = 90000;
    for (const v of membersOf(w, f.id)) { if (v.id === ub.id || v.id === cap.id || v.isPlayer) continue; rel(v, ub.id).trust = 0.05; rel(v, ub.id).grudge = 0.7; rel(v, cap.id).trust = 0.95; rel(v, cap.id).respect = 0.8; }
    cap.standing = 80; cap.bossId = ub.id;
    const cs = candidates(w, f.id, boss.id, { cause: 'death' });
    assert.equal(cs[0].c.id, cap.id, 'captain ranks first: ' + cs.slice(0, 3).map((x) => `${x.c.rank}:${x.score.toFixed(2)}`));
    handleDeath(w, boss.id);
    assert.equal(f.bossId, cap.id); assert.equal(cap.rank, 'boss'); clean(w, 'after');
  });
  ok('4b. a loved underboss still wins, and the choice leaves consequences behind', { tags: ['unit'] }, () => {
    const w = orgWorld(3, 20, 5); const f = other(w); const boss = leaderOf(w, f.id)!;
    const ub = rank(w, f.id, 'underboss')[0], cap = rank(w, f.id, 'capo')[0];
    for (const v of membersOf(w, f.id)) { if (v.isPlayer) continue; rel(v, ub.id).trust = 0.9; rel(v, cap.id).trust = 0.1; rel(v, cap.id).respect = 0.2; }
    cap.standing = 70; cap.traits.ambition = 0.9;
    const cs = candidates(w, f.id, boss.id, { cause: 'death' }); assert.equal(cs[0].c.id, ub.id);
    handleDeath(w, boss.id);
    assert.equal(f.bossId, ub.id); assert.equal(f.leaderSince, w.now); assert.ok(f.hist!.some((h) => h.kind === 'succession' && h.who === ub.id), 'history');
    assert.equal(clubOf(w, f.id)!.hostId, ub.id, 'the club is his seat now');
    clean(w, 'after');
  });
  ok('4c. a passed-over rival holds a grudge; a contested win leaves the house unsettled', { tags: ['unit'] }, () => {
    const w = orgWorld(3, 20, 5); const f = other(w); const boss = leaderOf(w, f.id)!;
    const ub = rank(w, f.id, 'underboss')[0], cap = rank(w, f.id, 'capo')[0];
    for (const v of membersOf(w, f.id)) { if (v.isPlayer) continue; rel(v, ub.id).trust = 0.6; rel(v, cap.id).trust = 0.6; rel(v, cap.id).respect = 0.5; rel(v, ub.id).respect = 0.5; }
    cap.standing = 90; cap.bossId = ub.id; const before = rel(cap, ub.id).grudge;
    handleDeath(w, boss.id);
    const win = leaderOf(w, f.id)!; const lose = [ub, cap].find((c) => c.id !== win.id)!;
    assert.ok(rel(lose, win.id).grudge > before || lose.rank === 'soldier', 'the loser remembers');
    assert.ok(f.unrest && f.unrest.until > w.now, 'unsettled');
    clean(w, 'after');
  });
  ok('4d. a boss inside is replaced by an acting boss, and a very long sentence ends his reign', { tags: ['scenario'] }, () => {
    const w = orgWorld(3, 20, 5); const f = other(w); const boss = leaderOf(w, f.id)!;
    boss.jailedUntil = w.now + 40 * DAY; orgWeek(w);
    assert.ok(f.acting && f.acting !== boss.id, 'acting boss named'); assert.equal(f.bossId, boss.id); clean(w, 'acting');
    boss.jailedUntil = w.now + 200 * DAY; orgWeek(w);
    assert.notEqual(f.bossId, boss.id, 'a new boss'); assert.equal(boss.rank, 'capo'); assert.equal(boss.bossId, f.bossId); assert.equal(f.acting, undefined); clean(w, 'removed');
    assert.ok(f.hist!.some((h) => /took the chair after/.test(h.text)));
  });
  ok('4e. retirement and a successful plot both change the chair for real', { tags: ['scenario'] }, () => {
    const w = orgWorld(3, 20, 5); const f = other(w); const boss = leaderOf(w, f.id)!;
    leave(w, boss, 'retire', 'he is tired'); assert.equal(boss.rank, 'civilian'); assert.notEqual(f.bossId, boss.id); clean(w, 'retire');
    const g = orgList(w).find((x) => x.id !== f.id && x.id !== P(w).familyId)!; const b2 = leaderOf(w, g.id)!; const u = rank(w, g.id, 'underboss')[0];
    w.coup = { fam: g.id, plotter: u.id, boss: b2.id, start: w.now - 40 * DAY, resolveAt: w.now - 1, back: { plotter: [], boss: [] } };
    const rc = w.rng.chance; w.rng.chance = () => true; politicsCoup(w); w.rng.chance = rc;
    assert.equal(g.bossId, u.id); assert.equal(b2.alive, false); assert.ok(g.hist!.some((h) => /was removed/.test(h.text))); clean(w, 'coup');
  });
});

// ------------------------------------------------------------------ slow
function stable(seed: number) {
  const days = 180; REPAIRS.length = 0;
  const w = newWorld(seed); let worst = 0; let firstBad = '';
  const promo = new Map<string, number>();
  for (let d = 1; d <= days; d++) {
    advance(w, w.now + DAY);
    const h = hierarchyIssues(w); if (h.length) { worst = Math.max(worst, h.length); firstBad ||= `d${d}: ${h[0]}`; }
  }
  for (const f of Object.values(w.facts)) if (f.kind === 'promotion' && / was made /.test(f.text)) promo.set(f.text, (promo.get(f.text) ?? 0) + 1);
  const dup = [...promo].filter(([, n]) => n > 1);
  const a = audit(w);
  console.log(`seed ${seed}: ${days}d  hierarchy issues(max/day)=${worst} ${firstBad}  repairs needed=${REPAIRS.length}  duplicate promotions=${dup.length}  audit issues=${a.length}`);
  if (REPAIRS.length) console.log('  repairs:', REPAIRS.slice(0, 5));
  if (a.length) console.log('  audit:', a.slice(0, 5));
  assert.equal(worst, 0, firstBad); assert.equal(dup.length, 0, JSON.stringify(dup.slice(0, 3))); assert.deepEqual(a, []);
}

describe('succession: long runs', { tags: ['sim', 'slow'] }, () => {
  ok.each(SEEDS)('stable %i', stable);
});
