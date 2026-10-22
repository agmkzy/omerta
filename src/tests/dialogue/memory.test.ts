// Memory: a man recalls only what the record holds (favours, grudges he knows were you, a broken word), at most once a
// day. From the V77 and V78 suites.
import assert from 'node:assert';
import { beforeAll, describe, test as ok } from 'vitest';
import { DAY } from '../../types';
import { recall } from '../../memory';
import { addFavour } from '../../encounters';
import { addFact, learn } from '../../core';
import { world60, men } from './fixtures';
import { P } from '../helpers';

// The 60-day world takes seconds to simulate; build it once, before the checks that time themselves.
beforeAll(() => { world60(); });

describe('memory', { tags: ['scenario'] }, () => {
  ok('memory never invents: with no record behind it, nothing is recalled', () => {
    const w = world60(), p = P(w);
    w.favours.length = 0;
    p.cooldown = Object.fromEntries(Object.entries(p.cooldown).filter(([k]) => !k.startsWith('recall:')));
    const kinds = new Set<string>();
    for (const t of men(w, 80)) { for (let d = 0; d < 6; d++) { w.now += DAY; const m = recall(w, p, t); if (m) kinds.add(m.kind); } }
    assert.ok(!kinds.has('favour') && !kinds.has('owe') && !kinds.has('harm'), [...kinds].join());
  });
  ok('a favour you did him is remembered, a favour he did you is not claimed by him as yours, and only when it exists', () => {
    const w = world60(), p = P(w), t = men(w).find((x) => x.rank !== 'civilian' && x.id !== p.bossId)!;
    addFavour(w, p.id, t.id, 2, 'covering $300 of his envelope');
    let hit = '';
    for (let d = 0; d < 12 && !hit; d++) { w.now += DAY; const m = recall(w, p, t); if (m?.kind === 'favour') hit = m.line; }
    assert.ok(hit, 'he should bring up the favour on some day');
    assert.match(hit, /covering \$300 of my envelope|Covering \$300 of my envelope/i);
    assert.ok(!/his envelope/.test(hit));
  });
  ok('a grudge is only remembered if he knows it was you', () => {
    const w = world60(), p = P(w), t = men(w).find((x) => x.rank !== 'civilian' && x.id !== p.bossId)!;
    const f = addFact(w, { kind: 'beating', actor: p.id, victim: t.id, text: `${p.name} beat up ${t.name}.`, district: t.district }, { witnesses: [] });
    const days = (n: number) => { let k = ''; for (let d = 0; d < n; d++) { w.now += DAY; const m = recall(w, p, t); if (m?.kind === 'harm') k = m.line; } return k; };
    delete t.known[f.id];
    assert.equal(days(10), '', 'he does not know who did it');
    learn(w, t.id, f, 'witness', true);
    assert.ok(days(14).length > 0, 'once he knows, he brings it up');
  });
  ok('at most one memory per man per day', () => {
    const w = world60(), p = P(w), t = men(w).find((x) => x.rank !== 'civilian' && x.id !== p.bossId)!;
    addFavour(w, p.id, t.id, 2, 'a good turn');
    let n = 0;
    for (let d = 0; d < 20; d++) { for (let i = 0; i < 5; i++) if (recall(w, p, t)) n++; w.now += DAY; }
    assert.ok(n <= 20, 'not more than once a day');
    // (each kind of memory comes up at most once a fortnight with the same man: with one favour on record that is two in twenty days
    // for certain; anything else he remembers depends on the man)
    assert.ok(n >= 2 && n < 20, `memories should be occasional, got ${n} in 20 days`);
  });
  ok('a word broken is remembered only if the game wrote it down', () => {
    const w = world60(), p = P(w);
    const t = men(w).find((x) => x.rank !== 'civilian' && x.id !== p.bossId)!;
    const kinds = new Set<string>();
    for (let d = 0; d < 8; d++) { w.now += 1440; const m = recall(w, p, t); if (m) kinds.add(m.kind); }
    assert.ok(!kinds.has('broken'));
    addFact(w, { kind: 'ruling', actor: p.id, victim: t.id, minor: true, text: `${p.name} didn’t keep his word to ${t.name}.`, district: t.district }, { witnesses: [t.id] });
    let got = '';
    for (let d = 0; d < 12 && !got; d++) { w.now += 1440; const m = recall(w, p, t); if (m?.kind === 'broken') got = m.line; }
    assert.ok(got.length > 0);
  });
});
