// Legacy situations: the pre-V75 encounters, meetings and situations still run beside the new ones without
// interfering. From the V75 suite.
import assert from 'node:assert';
import { beforeAll, describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { createWorld } from '../../world';
import { DAY } from '../../types';
import { audit } from '../../consistency';
import { situationTick } from '../../situations';
import { isOpen } from '../../situ';
import { situationWorld, skimCase } from './fixtures';

// The world the unit tests below start from takes a second or more to simulate: build it here, so a unit test's time
// limit measures only its own work.
beforeAll(() => { situationWorld(7, 20); });

describe('legacy situations', () => {
  ok('8. existing encounters, meetings and legacy situations still work beside the new ones', { tags: ['sim'] }, () => {
    const w = createWorld(4, 'Tony Marino'); advance(w, w.now + 120 * DAY);
    assert.deepEqual(audit(w), []);
    const legacy = (w.situations ?? []).filter((s) => !s.key);
    assert.ok(legacy.length > 0, 'legacy situations still start');
    assert.ok((w.disputes?.length ?? 0) + w.grievances.length > 0, 'disputes and grievances still run');
  });
  ok('legacy kinds and V75 kinds do not interfere: the old loop leaves V75 situations alone', { tags: ['unit'] }, () => {
    const w = situationWorld(7, 20); const { s } = skimCase(w); const weeks = s.weeks;
    situationTick(w);
    assert.equal(s.weeks, weeks); assert.ok(isOpen(s));
  });
});
