// Situations: what a situation carries, how it persists, moves through stages, ends in different ways, is settled by
// NPCs, and how the player's choice changes it. From the V75 suite.
import assert from 'node:assert';
import { beforeAll, describe, test as ok } from 'vitest';
import { DAYS, SEEDS } from '../modes';
import { SCHEMA, advance, deserialize, serialize } from '../../engine';
import { createWorld } from '../../world';
import { DAY, Situation } from '../../types';
import { audit } from '../../consistency';
import { rel } from '../../core';
import { ledgerCheck } from '../../econ';
import { crewChoose } from '../../crewlife';
import { isOpen, sitDay, sitIssues, spawn } from '../../situ';
import { situationWorld, canon, trio, skimCase, run } from './fixtures';
import { clone } from '../helpers';

// The world the unit tests below start from takes a second or more to simulate: build it here, so a unit test's time
// limit measures only its own work.
beforeAll(() => { situationWorld(7, 20); });

describe('situation lifecycle', () => {
  ok('a situation carries cause, parties, phase, history, knowledge and consequences', { tags: ['unit'] }, () => {
    const w = situationWorld(7, 20); const { s } = skimCase(w);
    for (const k of ['id', 'kind', 'cause', 'parties', 'phase', 'sev', 'next', 'key', 'hist', 'k', 'claims', 'cons', 'stage', 'since']) assert.ok(k in s, k);
    assert.ok((s.parties ?? []).length >= 2);
  });
  ok('1. situations persist across save/load and continue identically', { tags: ['determinism'] }, () => {
    const w = situationWorld(7, 20); const { s } = skimCase(w); run(w, s, 2);
    assert.ok(isOpen(s) || s.out);
    const l = clone(w); assert.equal(serialize(l), serialize(w));
    advance(w, w.now + 60 * DAY); advance(l, l.now + 60 * DAY);
    assert.equal(canon(l), canon(w));
    assert.ok((l.situations ?? []).some((x) => x.id === s.id));
  });
  ok('2. a skimming matter moves through several stages and can end in different ways', { tags: ['scenario'] }, () => {
    const seen = new Set<string>(), outs = new Set<string>();
    for (let seed = 1; seed <= 16; seed++) {
      const w = situationWorld(seed % 6 + 1, 15 + seed); const { s } = skimCase(w, seed % 4 !== 0);
      seen.add(s.phase!);
      for (let i = 0; i < 40 && isOpen(s); i++) { w.now = Math.max(w.now, s.next ?? w.now); sitDay(w); if (s.phase) seen.add(s.phase); }
      if (s.out) outs.add(s.out);
    }
    for (const ph of ['noticed', 'explain', 'doubt', 'inquiry', 'confront']) assert.ok(seen.has(ph), 'phase ' + ph + ' reached; saw ' + [...seen]);
    assert.ok(outs.size >= 3, 'different endings: ' + [...outs]);
  });
  ok('some situations end quietly after one stage (not every one reaches the top)', { tags: ['scenario'] }, () => {
    const quick: string[] = [];
    for (let seed = 1; seed <= 16; seed++) { const w = situationWorld(seed % 6 + 1, 15 + seed); const { s } = skimCase(w, false); run(w, s); if (s.out === 'understood' || s.out === 'dropped') quick.push(s.out); }
    assert.ok(quick.length >= 2, 'quiet endings: ' + quick.length);
  });
  ok('3. NPCs settle matters without the player, and an unanswered request to the player lapses and is settled', { tags: ['scenario'] }, () => {
    const w = situationWorld(7, 20); const { p, c, x } = trio(w);
    const s = spawn(w, 'grudge', `grudge:${c.id}:${x.id}`, c.id, { cause: 'test', parties: [{ id: p.id, role: 'boss' }, { id: c.id, role: 'rival' }, { id: x.id, role: 'winner' }], sev: 0.35, phase: 'airing', next: w.now, orgs: [] })!;
    s.stage = 'handling';
    run(w, s, 3);
    assert.equal(s.stage, 'asking', 'the player is asked because he is the one who decides');
    const e = w.enc.find((q) => q.id === s.ask)!; assert.equal(e.status, 'open');
    w.now = (s.next ?? w.now) + DAY; sitDay(w);
    assert.ok(!isOpen(s) && s.out, 'settled by someone else once he did not answer'); assert.equal(e.status, 'lapsed');
  });
  ok('4. the player’s choice changes the outcome and what follows from it', { tags: ['scenario'] }, () => {
    const mk = () => { const w = situationWorld(11, 20); const { p, c, x } = trio(w); p.cash = 2000;
      const s = spawn(w, 'grudge', `grudge:${c.id}:${x.id}`, c.id, { cause: 'test', parties: [{ id: p.id, role: 'boss' }, { id: c.id, role: 'rival' }, { id: x.id, role: 'winner' }], sev: 0.35, phase: 'airing', next: w.now })!;
      s.stage = 'handling'; run(w, s, 2); return { w, s, c, p, e: w.enc.find((q) => q.id === s.ask)! }; };
    const a = mk(), b = mk();
    crewChoose(a.w, a.p, a.e, 'p:placate'); crewChoose(b.w, b.p, b.e, 'p:reprimand');
    assert.equal(a.s.out, 'placated'); assert.equal(b.s.out, 'reprimanded');
    assert.ok(a.c.backer === a.p.id && a.c.cash > b.c.cash, 'buying him off paid him and made the player his backer');
    assert.ok(rel(b.c, b.p.id).trust < rel(a.c, a.p.id).trust, 'putting him in his place cost trust');
    assert.notEqual(serialize(a.w), serialize(b.w));
  });
  ok('"hear them out" keeps the question open and shows only what each person would say', { tags: ['scenario'] }, () => {
    const w = situationWorld(7, 20); const { p, c, x } = trio(w);
    const s = spawn(w, 'grudge', `g:${c.id}`, c.id, { cause: 'test', parties: [{ id: p.id, role: 'boss' }, { id: c.id, role: 'rival' }, { id: x.id, role: 'winner' }], sev: 0.35, phase: 'airing', next: w.now })!;
    s.stage = 'handling'; run(w, s, 2);
    const e = w.enc.find((q) => q.id === s.ask)!; const lines = crewChoose(w, p, e, 'listen');
    assert.equal(e.status, 'open'); assert.ok(lines.some((l) => /would choose/.test(l)));
    assert.ok(isOpen(s) && (s.stage as string) === 'asking');
  });
  ok('SCHEMA is at least 6 (7 since V76)', { tags: ['unit'] }, () => assert.ok(SCHEMA >= 6));
});

describe('situation lifecycle: compat', { tags: ['compat'] }, () => {
  ok('a V74 save (schema 5) loads, situations start forming, and nothing breaks', () => {
    const w = createWorld(9, 'Tony Marino'); advance(w, w.now + 40 * DAY);
    const o = JSON.parse(serialize(w)); o.schema = 5; delete o.sitpace; delete o.sitcool;
    o.situations = (o.situations ?? []).filter((s: Situation) => !s.key);
    const l = deserialize(JSON.stringify(o)); assert.equal(l.schema, SCHEMA);
    advance(l, l.now + 90 * DAY); assert.deepEqual(audit(l), []); assert.deepEqual(sitIssues(l), []);
    assert.equal(serialize(deserialize(serialize(l))), serialize(l));
    assert.ok((l.situations ?? []).some((s) => !!s.key));
  });
});

function sim(seed: number, days: number) {
  const w = createWorld(seed, 'Tony Marino'); let maxOpen = 0;
  for (let d = 1; d <= days; d++) { advance(w, w.now + DAY); maxOpen = Math.max(maxOpen, (w.situations ?? []).filter(isOpen).length); if (d % 30 === 0) { assert.deepEqual(sitIssues(w), [], 'day ' + d); assert.deepEqual(ledgerCheck(w), []); } }
  assert.deepEqual(audit(w), []);
  const sp = w.sitpace!; console.log(`seed ${seed} ${days}d: maxOpen ${maxOpen}, quiet ${sp.quiet}/${sp.weeks}, busy ${sp.busy}, saveKB ${(serialize(w).length / 1024).toFixed(0)}`);
  console.log(JSON.stringify(sp.stats));
}

function roundtrip(seed: number) {
  const w = createWorld(seed, 'Tony Marino'); advance(w, w.now + 120 * DAY);
  const open = (w.situations ?? []).filter((s) => isOpen(s) && s.key).length;
  const s = serialize(w); const l = deserialize(s); assert.equal(serialize(l), s);
  advance(w, w.now + 90 * DAY); advance(l, l.now + 90 * DAY); assert.equal(canon(l), canon(w));
  console.log(`seed ${seed}: round trip OK with ${open} open situations at the cut`);
}

describe('situation lifecycle: long runs', { tags: ['sim', 'slow'] }, () => {
  ok.each(SEEDS)(`sim %i, ${DAYS} days`, (seed) => sim(seed, DAYS));
});

describe('situation lifecycle: long round trips', { tags: ['determinism', 'slow'] }, () => {
  ok.each(SEEDS)('roundtrip %i', roundtrip);
});
