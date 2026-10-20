// Ambitions: one tick, one reward, nothing processed twice. From the V72 suite.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { DAY } from '../../types';
import { ambitionTick, AMBS } from '../../ambition';
import { newWorld, P } from '../helpers';

describe('ambitions', () => {
  ok('ambitions: one tick, one reward, nothing processed twice', { tags: ['unit'] }, () => {
    const w = newWorld(7); const p = P(w);
    p.cash = 3000; ambitionTick(w); const st = p.standing; const n = Object.values(w.facts).filter((f) => /Ambition met/.test(f.text)).length;
    ambitionTick(w); ambitionTick(w);
    assert.equal(p.standing, st); assert.equal(Object.values(w.facts).filter((f) => /Ambition met/.test(f.text)).length, n);
    p.ambition = { kind: 'rich', since: w.now, rank0: p.rank }; p.cash = 12000;
    ambitionTick(w); const s1 = p.standing; const facts1 = Object.values(w.facts).filter((f) => /did what he set out/.test(f.text)).length;
    ambitionTick(w); ambitionTick(w);
    assert.equal(p.ambition!.done, true); assert.equal(p.standing, s1); assert.equal(Object.values(w.facts).filter((f) => /did what he set out/.test(f.text)).length, facts1);
    assert.ok(AMBS.length >= 6);
  });
  ok('ambitions: advancing a week does not tick them twice', { tags: ['scenario'] }, () => {
    const w = newWorld(7); const p = P(w); p.ambition = { kind: 'rich', since: w.now, rank0: p.rank }; p.cash = 12000;
    advance(w, w.now + 8 * DAY);
    assert.equal(Object.values(w.facts).filter((f) => /did what he set out/.test(f.text)).length, 1);
  });
});
