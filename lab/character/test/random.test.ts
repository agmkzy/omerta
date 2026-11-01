import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { roller, seeded } from '../src/random';

const draws = (seed: number, n: number) => {
  const rng = seeded(seed);
  return Array.from({ length: n }, () => rng.next());
};

describe('a seeded random source', { tags: ['unit'] }, () => {
  test('the same seed gives the same sequence', () => {
    assert.deepEqual(draws(42, 20), draws(42, 20));
  });

  test('different seeds give different sequences', () => {
    assert.notDeepEqual(draws(1, 20), draws(2, 20));
  });

  test('matches the game’s generator (mulberry32), so a seed means the same thing in both', () => {
    // First draws of the game's src/rng.ts Rng(1), recorded here so the lab need not import the game.
    assert.deepEqual(draws(1, 3), [0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
  });
});

describe('a roller', { tags: ['unit'] }, () => {
  test('turns a draw into a face of the die', () => {
    assert.equal(roller({ next: () => 0 }).roll(20), 1);
    assert.equal(roller({ next: () => 0.999999 }).roll(20), 20);
    assert.equal(roller({ next: () => 0.5 }).roll(6), 4);
  });

  test('refuses a die with no faces', () => {
    assert.throws(() => roller(seeded(1)).roll(0), RangeError);
    assert.throws(() => roller(seeded(1)).roll(2.5), RangeError);
  });
});

describe('random draws', { tags: ['property'] }, () => {
  test('always lie in [0, 1)', () => {
    fc.assert(fc.property(fc.integer(), (seed) => draws(seed, 50).every((x) => x >= 0 && x < 1)));
  });

  test('every face rolled is on the die', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1, max: 100 }), (seed, sides) => {
        const r = roller(seeded(seed));
        return Array.from({ length: 50 }, () => r.roll(sides)).every((f) => Number.isInteger(f) && f >= 1 && f <= sides);
      }),
    );
  });

  test('every face of a d6 turns up about as often as the others', () => {
    const r = roller(seeded(7));
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 60_000; i++) counts[r.roll(6) - 1]!++;
    for (const c of counts) assert.ok(Math.abs(c - 10_000) < 400, `face count ${c} is far from 10000`);
  });
});
