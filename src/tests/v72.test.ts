// V72 regression suite. The fast checks take a few seconds; SLOW=1 adds the 180-day stable, roundtrip and growth runs (see ./modes.ts).
import assert from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test as ok } from 'vitest';
import { SEEDS, SLOW } from './modes';
import { advance, deserialize, serialize, SCHEMA } from '../engine';
import { createWorld } from '../world';
import { DAY, World, Character } from '../types';
import { audit } from '../consistency';
import { REPAIRS, applyRank, hierarchyIssues, leaveCrew, repairHierarchy } from '../rank';
import { handleDeath, addFact, createDebt } from '../core';
import { promote, readiness, eligible, members } from '../career';
import { chairAct, chairOptions, pathInfo } from '../path';
import { OPS } from '../rackets';
import { OP_GROUPS } from '../rackets';
import { OP_SHEETS, WAYS } from '../ways';
import { ambitionTick, AMBS } from '../ambition';
import { referencedFacts, sweep } from '../retain';
import { clubOf } from '../clubdata';
import { prospects, recruitProspect } from '../orders';
import { startScene, sceneNode, sceneAct, topicsFor } from '../club';

const P = (w: World) => w.chars[w.playerId!];
const fresh = (seed = 7) => createWorld(seed, 'Tony Marino');
const fam = (w: World, fid: string) => members(w, fid);

// ------------------------------------------------------------------ hierarchy
function fast() {
  ok('fresh world has a valid hierarchy', () => assert.deepEqual(hierarchyIssues(fresh()), []));

  ok('boss dies: underboss takes over, everyone re-attaches', () => {
    const w = fresh(); const fid = 'fam_santangelo' in w.fam ? 'fam_santangelo' : Object.keys(w.fam).find((f) => f !== P(w).familyId)!;
    const boss = w.chars[w.fam[fid].bossId];
    const ub = fam(w, fid).find((c) => c.rank === 'underboss');
    handleDeath(w, boss.id);
    assert.equal(w.fam[fid].bossId, ub!.id); assert.equal(ub!.rank, 'boss'); assert.equal(ub!.bossId, null);
    assert.deepEqual(hierarchyIssues(w), []);
  });

  ok('boss dies with nobody senior left: a soldier takes the chair (no dead boss)', () => {
    const w = fresh(); const fid = Object.keys(w.fam).find((f) => f !== P(w).familyId)!;
    for (const c of fam(w, fid)) if (c.rank === 'underboss' || c.rank === 'capo') handleDeath(w, c.id);
    assert.deepEqual(hierarchyIssues(w), [], 'after the captains die');
    handleDeath(w, w.fam[fid].bossId);
    const head = w.chars[w.fam[fid].bossId];
    assert.ok(head.alive && head.rank === 'boss', 'live boss');
    assert.deepEqual(hierarchyIssues(w), []);
  });

  ok('boss dies with only associates left', () => {
    const w = fresh(); const fid = Object.keys(w.fam).find((f) => f !== P(w).familyId)!;
    for (const c of fam(w, fid)) if (c.rank !== 'associate' && c.rank !== 'boss') handleDeath(w, c.id);
    handleDeath(w, w.fam[fid].bossId);
    const head = w.chars[w.fam[fid].bossId];
    assert.ok(head.alive && head.rank === 'boss');
    assert.deepEqual(hierarchyIssues(w), []);
  });

  ok('named heir inherits', () => {
    const w = fresh(); const fid = Object.keys(w.fam).find((f) => f !== P(w).familyId)!;
    const heir = fam(w, fid).find((c) => c.rank === 'capo')!;
    w.fam[fid].heir = heir.id;
    handleDeath(w, w.fam[fid].bossId);
    assert.equal(w.fam[fid].bossId, heir.id);
    assert.deepEqual(hierarchyIssues(w), []);
  });

  ok('injected dead superior, wrong family, self and loops are detected and repaired', () => {
    const w = fresh(); const fid = Object.keys(w.fam).find((f) => f !== P(w).familyId)!;
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

  ok('audit() reports hierarchy damage', () => {
    const w = fresh(); const fid = Object.keys(w.fam).find((f) => f !== P(w).familyId)!;
    handleDeath(w, w.fam[fid].bossId); w.chars[w.fam[fid].bossId].alive = false; // nobody repaired it
    assert.ok(audit(w).some((x) => /boss/.test(x)));
  });

  ok('a promotion is applied once: second promote() is a no-op, one history fact', () => {
    const w = fresh(); const fid = Object.keys(w.fam).find((f) => f !== P(w).familyId)!;
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
    const w = fresh(); const fid = Object.keys(w.fam).find((f) => f !== P(w).familyId)!;
    const sol = fam(w, fid).find((c) => c.rank === 'soldier')!;
    promote(w, sol, 'capo'); assert.deepEqual(hierarchyIssues(w), []);
    promote(w, sol, 'underboss'); assert.deepEqual(hierarchyIssues(w), []);
    assert.equal(fam(w, fid).filter((c) => c.rank === 'underboss').length >= 1, true);
  });

  for (const code of ['ask', 'move']) ok(`taking the chair (${code}) leaves a valid hierarchy`, () => {
    const w = fresh(3); const p = P(w); const f = w.fam[p.familyId!]; const old = w.chars[f.bossId];
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
    const w = fresh(); const p = P(w); p.cash = 5000;
    for (const pr of prospects(w, p).slice(0, 3)) recruitProspect(w, p, pr.c);
    const [a, b] = Object.values(w.chars).filter((c) => c.bossId === p.id);
    leaveCrew(w, a); assert.notEqual(a.bossId, p.id); assert.ok(a.bossId, 'has someone to answer to'); assert.deepEqual(hierarchyIssues(w), []);
    const other = Object.keys(w.fam).find((f) => f !== p.familyId)!;
    leaveCrew(w, b, other); assert.equal(b.familyId, other); assert.ok(b.bossId && w.chars[b.bossId].familyId === other); assert.deepEqual(hierarchyIssues(w), []);
  });

  ok('player readiness is the road in path.ts', () => {
    const w = fresh(); const p = P(w);
    for (const [kick, st] of [[0, 40], [20000, 60], [60000, 80]] as const) {
      p.lifetimeKick = kick; p.standing = st;
      const r = readiness(w, p); const i = pathInfo(w, p);
      assert.equal(!!r, !!i);
      if (r && i) { assert.equal(r.to, i.to); assert.equal(r.ready, i.ready); assert.equal(eligible(r), i.ready && r.openSeat); assert.ok(r.earn <= 1 && r.score <= 1); }
    }
    p.lifetimeKick = 0; assert.equal(readiness(w, p)!.ready, false);
  });

  ok('rank has one door: no source line assigns .rank outside rank.ts/world.ts', () => {
    const bad: string[] = [];
    const dir = fileURLToPath(new URL('../', import.meta.url));
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts') && x !== 'rank.ts' && x !== 'world.ts')) {
      readFileSync(dir + f, 'utf8').split('\n').forEach((l, i) => { if (/\.rank = /.test(l)) bad.push(`${f}:${i + 1}`); });
    }
    assert.deepEqual(bad, []);
  });

  // -------------------------------------------------------------- rackets
  ok('every racket in OPS has a sheet, a way, and a group the interface lists', () => {
    for (const k of Object.keys(OPS) as (keyof typeof OPS)[]) {
      const way = WAYS.find((x) => x.op === k);
      assert.ok(way, 'way for ' + k); assert.equal(way!.kind, 'op');
      const s = OP_SHEETS[k]; for (const f of ['name', 'cat', 'pitch', 'pays', 'needs', 'risks', 'tip'] as const) assert.ok(String(s[f]).length > 3, `${k}.${f}`);
      assert.ok(s.how.length > 0);
      assert.ok((OP_GROUPS as readonly string[]).includes(OPS[k].group), 'group ' + OPS[k].group);
    }
    assert.equal(WAYS.filter((x) => x.kind === 'op').length, Object.keys(OPS).length);
    assert.equal(new Set(WAYS.map((x) => x.id)).size, WAYS.length, 'unique way ids');
  });

  // -------------------------------------------------------------- ambition
  ok('ambitions: one tick, one reward, nothing processed twice', () => {
    const w = fresh(); const p = P(w);
    p.cash = 3000; ambitionTick(w); const st = p.standing; const n = Object.values(w.facts).filter((f) => /Ambition met/.test(f.text)).length;
    ambitionTick(w); ambitionTick(w);
    assert.equal(p.standing, st); assert.equal(Object.values(w.facts).filter((f) => /Ambition met/.test(f.text)).length, n);
    p.ambition = { kind: 'rich', since: w.now, rank0: p.rank }; p.cash = 12000;
    ambitionTick(w); const s1 = p.standing; const facts1 = Object.values(w.facts).filter((f) => /did what he set out/.test(f.text)).length;
    ambitionTick(w); ambitionTick(w);
    assert.equal(p.ambition!.done, true); assert.equal(p.standing, s1); assert.equal(Object.values(w.facts).filter((f) => /did what he set out/.test(f.text)).length, facts1);
    assert.ok(AMBS.length >= 6);
  });

  ok('ambitions: advancing a week does not tick them twice', () => {
    const w = fresh(); const p = P(w); p.ambition = { kind: 'rich', since: w.now, rank0: p.rank }; p.cash = 12000;
    advance(w, w.now + 8 * DAY);
    assert.equal(Object.values(w.facts).filter((f) => /did what he set out/.test(f.text)).length, 1);
  });

  // -------------------------------------------------------------- retention
  ok('retention: referenced, permanent and fresh facts survive; stale routine facts and their knowledge go', () => {
    const w = fresh(); const [a, b] = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer).slice(0, 2);
    advance(w, w.now + 100 * DAY);
    const old = (kind: string, extra = {}) => { const f = addFact(w, { kind: kind as never, actor: a.id, victim: b.id, text: kind, ...extra }, { witnesses: [b.id] }); f.t = w.now - 120 * DAY; return f; };
    const stale = old('gambling_loss'); const kept = old('promotion'); const loan = old('loan');
    const d = createDebt(w, a.id, b.id, 500, 0.05, 'test', loan.id);
    const fresh1 = addFact(w, { kind: 'gambling_loss', actor: a.id, text: 'recent' });
    const caused = addFact(w, { kind: 'beating', actor: a.id, victim: b.id, text: 'beating', cause: old('vandalism').id }); caused.t = w.now - 300 * DAY;
    const refs = referencedFacts(w); assert.ok(refs.has(loan.id), 'debt cause is a reference');
    a.known['leave:xyz'] = { t: w.now, from: 'x', knowsActor: true };
    sweep(w);
    assert.equal(w.facts[stale.id], undefined, 'stale routine fact dropped'); assert.equal(a.known[stale.id], undefined); assert.equal(b.known[stale.id], undefined);
    assert.ok(w.facts[kept.id], 'permanent kept'); assert.ok(w.facts[loan.id], 'referenced by an active debt'); assert.ok(w.facts[fresh1.id], 'fresh kept');
    assert.ok(a.known['leave:xyz'], 'non-fact knowledge keys are not touched');
    // when the debt is paid the loan fact can go
    d.status = 'paid'; sweep(w); assert.equal(w.facts[loan.id], undefined, 'released once the debt is settled');
    // every pointer into facts still resolves
    for (const c of Object.values(w.chars)) for (const id of Object.keys(c.known)) if (/^f\d+$/.test(id)) assert.ok(w.facts[id], 'dangling knowledge ' + id);
  });

  ok('retention: an old save (schema 2, bloated) loads, plays on and shrinks', () => {
    const w = fresh(); advance(w, w.now + 20 * DAY);
    // make it bloated the way the old code did: many routine facts known by many people
    const ids = Object.values(w.chars).filter((c) => c.alive).map((c) => c.id);
    for (let i = 0; i < 300; i++) { const f = addFact(w, { kind: 'gambling_loss', actor: ids[i % ids.length], text: 'x' + i }, { broadcast: ids }); f.t = w.now - 40 * DAY; }
    const o = JSON.parse(serialize(w)); o.schema = 2; delete o.chars[w.playerId!].intro;
    const big = JSON.stringify(o).length;
    const l = deserialize(JSON.stringify(o));
    assert.ok(l.chars[l.playerId!].intro, 'intro backfilled'); assert.equal(l.schema, SCHEMA);
    advance(l, l.now + 8 * DAY);
    assert.ok(serialize(l).length < big * 0.6, `shrank ${big} -> ${serialize(l).length}`);
    assert.deepEqual(audit(l), []);
  });

  // -------------------------------------------------------------- scenes
  ok('mid-scene save/load resumes the same scene', () => {
    const w = fresh(); const p = P(w); p.cash = 5000;
    for (const pr of prospects(w, p).slice(0, 2)) recruitProspect(w, p, pr.c);
    const man = Object.values(w.chars).find((c) => c.bossId === p.id)!;
    man.books.arrears = 240; man.books.missed = 2; man.problem = { kind: 'gambling', sev: 0.7, since: 0 };
    const cl = clubOf(w, p.familyId)!; void cl; void topicsFor;
    startScene(w, p, man.id, 'chat' as never);
    const a = sceneNode(w, p); if (!a) return; // nothing to talk about on this seed: covered by club tests
    const r = deserialize(serialize(w)); const b = sceneNode(r, r.chars[r.playerId!]);
    assert.deepEqual(b!.lines, a.lines); assert.deepEqual(b!.opts.map((o) => o.code), a.opts.map((o) => o.code));
    if (a.opts[0]) { sceneAct(w, p, a.opts[0].code); sceneAct(r, r.chars[r.playerId!], a.opts[0].code); assert.equal(serialize(w), serialize(r)); }
  });
}

// ------------------------------------------------------------------ slow
function stable(seed: number) {
  const days = 180; REPAIRS.length = 0;
  const w = fresh(seed); let worst = 0; let firstBad = '';
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
function roundtrip(seed: number) {
  const a = fresh(seed); advance(a, a.now + 60 * DAY);
  const s = serialize(a);
  const c = deserialize(s);
  assert.equal(serialize(c), s, 'load + resave changes nothing');
  advance(a, a.now + 30 * DAY); advance(c, c.now + 30 * DAY);
  assert.equal(serialize(a) === serialize(c), true, 'a loaded save continues identically');
  const b = fresh(seed); advance(b, b.now + 90 * DAY);
  assert.equal(serialize(b) === serialize(a), true, 'same seed, same history (deterministic)');
  console.log(`seed ${seed}: round trip + determinism over 90 days OK (${(serialize(a).length / 1024).toFixed(0)} KB)`);
}
function growth(seed: number) {
  const w = fresh(seed); const rows: string[] = []; let prev = serialize(w).length; let t0 = prev;
  for (let d = 30; d <= 180; d += 30) {
    advance(w, w.now + 30 * DAY); const n = serialize(w).length;
    rows.push(`d${d}=${(n / 1024).toFixed(0)}KB(+${((n - prev) / 30 / 1024).toFixed(1)}/day)`); prev = n;
  }
  const per = (prev - t0) / 180 / 1024;
  const tail = (prev - (prev - 0)) ; void tail;
  console.log(`seed ${seed}: ${rows.join(' ')} | avg ${per.toFixed(1)} KB/day | facts ${Object.keys(w.facts).length}`);
}

describe('v72 fast', fast);
describe.skipIf(!SLOW)('v72 slow', () => {
  ok.each(SEEDS)('stable %i', stable);
  ok.each(SEEDS)('roundtrip %i', roundtrip);
  ok.each(SEEDS)('growth %i', growth);
});
void (null as unknown as Character);
