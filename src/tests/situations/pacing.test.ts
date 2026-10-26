// Pacing: quiet periods happen, serious matters are spaced out, and the player is not asked about matters above his
// station. From the V75 suite.
import assert from 'node:assert';
import { beforeAll, describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { createWorld } from '../../world';
import { DAY } from '../../types';
import { spawn } from '../../situ';
import { situationWorld, pair } from './fixtures';
import { P } from '../helpers';

// The world the unit tests below start from takes a second or more to simulate: build it here, so a unit test's time
// limit measures only its own work.
beforeAll(() => { situationWorld(7, 20); });

describe('pacing', () => {
  ok('10. quiet periods happen: most weeks the player hears of nothing serious', { tags: ['sim'] }, () => {
    // (measured over worlds, not one: Oct 2026, seeds 8, 9, 10, 12 gave 9, 9, 9 and 11 quiet weeks in 28. A floor on one world moved
    // with every change to what can happen; the property is that every world has its quiet stretches, and on average about a third
    // of weeks are quiet. docs/rpg/LOG.md)
    const share: number[] = [];
    for (const seed of [8, 12]) {
      const w = createWorld(seed, 'Tony Marino'); advance(w, w.now + 200 * DAY);
      const sp = w.sitpace!; assert.ok((sp.weeks ?? 0) >= 25);
      share.push((sp.quiet ?? 0) / sp.weeks!);
      assert.ok((sp.quiet ?? 0) / sp.weeks! >= 0.2, `seed ${seed}: quiet ${sp.quiet}/${sp.weeks}`);
      assert.ok((sp.busy ?? 0) / sp.weeks! <= 0.25, `seed ${seed}: busy ${sp.busy}/${sp.weeks}`);
    }
    assert.ok(share.reduce((a, b) => a + b, 0) / share.length >= 0.3, `quiet on average ${share.map((x) => x.toFixed(2)).join(', ')}`);
  });
  ok('serious matters are paced: not two within three days, and not a pile at once', { tags: ['unit'] }, () => {
    const w = situationWorld(7, 20); const { boss, c } = pair(w);
    const a = spawn(w, 'skim', 'k1', c.id, { cause: 'a', parties: [{ id: boss.id, role: 'boss' }, { id: c.id, role: 'accused' }], sev: 0.7, phase: 'noticed', next: w.now + DAY });
    const b = spawn(w, 'skim', 'k2', c.id, { cause: 'b', parties: [{ id: boss.id, role: 'boss' }, { id: c.id, role: 'accused' }], sev: 0.7, phase: 'noticed', next: w.now + DAY });
    assert.ok(a && !b);
  });
  ok('a rank-appropriate experience: the player is not asked about matters above his station', { tags: ['sim'] }, () => {
    const w = createWorld(9, 'Tony Marino'); let asks = 0;
    for (let d = 1; d <= 240; d++) { advance(w, w.now + DAY); for (const e of w.enc) if (e.status === 'open' && e.data?.what === 'sit75') asks++; }
    assert.equal(asks, 0, 'an associate with no one under him is never asked to decide others’ disputes'); assert.equal(P(w).rank, 'associate');
  });
});
