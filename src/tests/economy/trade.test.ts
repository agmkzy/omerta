// Trade: a business's performance follows who runs it and its competition, and is centred on 1 across the economy.
// From the V73 suite.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { DAY } from '../../types';
import { perf } from '../../econ';
import { newWorld } from '../helpers';
import { shop } from './fixtures';

describe('trade', () => {
  ok('performance follows who runs it: a better operator earns more than a worse one in the same place', { tags: ['unit'] }, () => {
    const w = newWorld(7); const b = shop(w); const o = w.chars[b.ownerId];
    o.skills.brains = 1; o.traits.caution = 1; o.traits.vice = 0; const hi = perf(w, b).mult;
    o.skills.brains = 0; o.traits.caution = 0; o.traits.vice = 1; const lo = perf(w, b).mult;
    assert.ok(hi > lo + 0.08, `${hi} vs ${lo}`);
    o.jailedUntil = w.now + 30 * DAY; assert.ok(perf(w, b).mult < hi);
  });
  ok('a new competitor nearby costs a business customers; a closed one gives them back', { tags: ['unit'] }, () => {
    const w = newWorld(7); const b = shop(w); b.rivals0 = 0; const base = perf(w, b).rivals;
    const twin = Object.values(w.biz).find((x) => x.id !== b.id && x.kind !== 'casino')!;
    twin.kind = b.kind; twin.district = b.district; twin.open = true;
    assert.ok(perf(w, b).rivals < base); twin.open = false; assert.ok(perf(w, b).rivals >= base);
  });
  ok('economy-wide performance multiplier is centred on 1 (no inflation from the new factors)', { tags: ['scenario'] }, () => {
    const w = newWorld(7); advance(w, w.now + 2 * DAY);
    const ms = Object.values(w.biz).filter((b) => b.open).map((b) => perf(w, b).mult);
    const mean = ms.reduce((a, x) => a + x, 0) / ms.length; assert.ok(mean > 0.96 && mean < 1.04, String(mean));
  });
});
