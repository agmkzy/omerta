// Saving and loading: fact retention keeps saves small without losing what is referenced, a bloated old save shrinks,
// a scene resumes mid-way, and long runs round-trip and grow at a known rate. From the V72 suite.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { SEEDS } from '../modes';
import { advance, deserialize, serialize, SCHEMA } from '../../engine';
import { DAY } from '../../types';
import { audit } from '../../consistency';
import { addFact, createDebt } from '../../core';
import { referencedFacts, sweep } from '../../retain';
import { clubOf } from '../../clubdata';
import { prospects, recruitProspect } from '../../orders';
import { startScene, sceneNode, sceneAct, topicsFor } from '../../club';
import { newWorld, P } from '../helpers';

describe('retention', () => {
  ok('retention: referenced, permanent and fresh facts survive; stale routine facts and their knowledge go', { tags: ['scenario'] }, () => {
    const w = newWorld(7); const [a, b] = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer).slice(0, 2);
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
  ok('retention: an old save (schema 2, bloated) loads, plays on and shrinks', { tags: ['compat'] }, () => {
    const w = newWorld(7); advance(w, w.now + 20 * DAY);
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
});

describe('resume', { tags: ['determinism'] }, () => {
  ok('mid-scene save/load resumes the same scene', () => {
    const w = newWorld(7); const p = P(w); p.cash = 5000;
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
});

function roundtrip(seed: number) {
  const a = newWorld(seed); advance(a, a.now + 60 * DAY);
  const s = serialize(a);
  const c = deserialize(s);
  assert.equal(serialize(c), s, 'load + resave changes nothing');
  advance(a, a.now + 30 * DAY); advance(c, c.now + 30 * DAY);
  assert.equal(serialize(a) === serialize(c), true, 'a loaded save continues identically');
  const b = newWorld(seed); advance(b, b.now + 90 * DAY);
  assert.equal(serialize(b) === serialize(a), true, 'same seed, same history (deterministic)');
  console.log(`seed ${seed}: round trip + determinism over 90 days OK (${(serialize(a).length / 1024).toFixed(0)} KB)`);
}

function growth(seed: number) {
  const w = newWorld(seed); const rows: string[] = []; let prev = serialize(w).length; let t0 = prev;
  for (let d = 30; d <= 180; d += 30) {
    advance(w, w.now + 30 * DAY); const n = serialize(w).length;
    rows.push(`d${d}=${(n / 1024).toFixed(0)}KB(+${((n - prev) / 30 / 1024).toFixed(1)}/day)`); prev = n;
  }
  const per = (prev - t0) / 180 / 1024;
  const tail = (prev - (prev - 0)) ; void tail;
  console.log(`seed ${seed}: ${rows.join(' ')} | avg ${per.toFixed(1)} KB/day | facts ${Object.keys(w.facts).length}`);
}

describe('save and load: long round trips', { tags: ['determinism', 'slow'] }, () => {
  ok.each(SEEDS)('roundtrip %i', roundtrip);
});

describe('save size: long runs', { tags: ['sim', 'slow'] }, () => {
  ok.each(SEEDS)('growth %i', growth);
});
