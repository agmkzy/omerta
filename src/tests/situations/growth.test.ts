// Bounded growth: the same dispute is never duplicated or resurrected, and a 400-day run stays within its bounds.
// From the V75 suite.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { createWorld } from '../../world';
import { DAY, WEEK } from '../../types';
import { audit } from '../../consistency';
import { closeSit, isOpen, sitIssues, spawn } from '../../situ';
import { situationWorld, pair } from './fixtures';

describe('bounded growth', { tags: ['sim'] }, () => {
  ok('7. the same dispute is not duplicated or resurrected, and mirrors never contradict their source', () => {
    const w = situationWorld(7, 20); const { boss, c } = pair(w);
    const mk = () => spawn(w, 'skim', `skim:${boss.id}:${c.id}`, c.id, { cause: 'x', parties: [{ id: boss.id, role: 'boss' }, { id: c.id, role: 'accused' }], sev: 0.3, phase: 'noticed', next: w.now + DAY });
    const s = mk()!; assert.equal(mk(), undefined, 'no second copy while open');
    closeSit(w, s, 'dropped', [], 6); assert.equal(mk(), undefined, 'not resurrected without a new cause: cooling off');
    w.now += 7 * WEEK; assert.ok(mk(), 'after a long time a genuinely new matter may start');
    const w2 = createWorld(5, 'Tony Marino'); for (let i = 0; i < 18; i++) { advance(w2, w2.now + 10 * DAY); assert.deepEqual(sitIssues(w2), [], 'day ' + i * 10); }
  });
  ok('9. growth is bounded in a long run', () => {
    const w = createWorld(6, 'Tony Marino'); let maxOpen = 0;
    for (let d = 1; d <= 400; d++) { advance(w, w.now + DAY); if (d % 20 === 0) maxOpen = Math.max(maxOpen, (w.situations ?? []).filter(isOpen).length); }
    const l = w.situations ?? [];
    assert.ok(l.filter((s) => !isOpen(s)).length <= 60, 'closed: ' + l.filter((s) => !isOpen(s)).length);
    assert.ok(l.every((s) => (s.hist?.length ?? 0) <= 8 && (s.claims?.length ?? 0) <= 3 && (s.cons?.length ?? 0) <= 5));
    assert.ok(maxOpen <= 60, 'open ' + maxOpen); assert.deepEqual(sitIssues(w), []); assert.deepEqual(audit(w), []);
  });
});
