import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { replay, roller, seeded } from '../src/random';

const draws = (seed: number, n: number) => {
  const rng = seeded(seed);
  return Array.from({ length: n }, () => rng.next());
};

describe('seeded', { tags: ['unit'] }, () => {
  test('returns the same sequence for the same seed', () => {
    assert.deepEqual(draws(42, 20), draws(42, 20));
  });

  test('returns different sequences for different seeds', () => {
    assert.notDeepEqual(draws(1, 20), draws(2, 20));
  });

  test('matches the game’s mulberry32 generator', () => {
    // First three values of src/rng.ts Rng(1), recorded here so the lab does not import the game.
    assert.deepEqual(draws(1, 3), [0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
  });
});

describe('roller', { tags: ['unit'] }, () => {
  test('maps a draw in [0, 1) to a face from 1 to sides', () => {
    assert.equal(roller({ next: () => 0 }).roll(20), 1);
    assert.equal(roller({ next: () => 0.999999 }).roll(20), 20);
    assert.equal(roller({ next: () => 0.5 }).roll(6), 4);
  });

  test('throws for a non-positive or non-integer number of sides', () => {
    assert.throws(() => roller(seeded(1)).roll(0), RangeError);
    assert.throws(() => roller(seeded(1)).roll(2.5), RangeError);
  });
});

describe('replay', { tags: ['unit'] }, () => {
  test('returns the given faces first, then rolls with the fallback, recording every face', () => {
    const r = replay([3, 5], roller({ next: () => 0.5 }));
    assert.deepEqual([r.roll(6), r.roll(6), r.roll(6)], [3, 5, 4]);
    assert.deepEqual(r.faces, [3, 5, 4]);
  });

  test('passes the reason for a roll on to the fallback', () => {
    const reasons: unknown[] = [];
    const r = replay([], { roll: (_sides, reason) => (reasons.push(reason), 1) });
    r.roll(20, { kind: 'attack' });
    assert.deepEqual(reasons, [{ kind: 'attack' }]);
  });

  test('rejects a given face that is not on the die', () => {
    assert.throws(() => replay([7], roller(seeded(1))).roll(6), RangeError);
  });
});

describe('random draws', { tags: ['property'] }, () => {
  test('are always in [0, 1)', () => {
    fc.assert(fc.property(fc.integer(), (seed) => draws(seed, 50).every((x) => x >= 0 && x < 1)));
  });

  test('always produce a valid face', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1, max: 100 }), (seed, sides) => {
        const r = roller(seeded(seed));
        return Array.from({ length: 50 }, () => r.roll(sides)).every((f) => Number.isInteger(f) && f >= 1 && f <= sides);
      }),
    );
  });

  test('produce each face of a d6 with roughly equal frequency', () => {
    const r = roller(seeded(7));
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 60_000; i++) counts[r.roll(6) - 1]!++;
    for (const c of counts) assert.ok(Math.abs(c - 10_000) < 400, `face count ${c} is far from 10000`);
  });
});
