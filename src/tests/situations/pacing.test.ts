// Pacing: quiet periods happen, serious matters are spaced out, and the player is not asked about matters above his
// station. From the V75 suite.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { createWorld } from '../../world';
import { DAY } from '../../types';
import { spawn } from '../../situ';
import { situationWorld, pair } from './fixtures';
import { P } from '../helpers';

describe('pacing', () => {
  ok('10. quiet periods happen: most weeks the player hears of nothing serious', { tags: ['sim'] }, () => {
    const w = createWorld(8, 'Tony Marino'); advance(w, w.now + 200 * DAY);
    const sp = w.sitpace!; assert.ok((sp.weeks ?? 0) >= 25);
    assert.ok((sp.quiet ?? 0) / sp.weeks! >= 0.4, `quiet ${sp.quiet}/${sp.weeks}`);
    assert.ok((sp.busy ?? 0) / sp.weeks! <= 0.25, `busy ${sp.busy}/${sp.weeks}`);
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
