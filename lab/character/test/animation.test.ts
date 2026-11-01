import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { flickerSequence, slowingDelays } from '../playground/animation';
import { roller, seeded } from '../src/random';

describe('slowingDelays', { tags: ['unit'] }, () => {
  test('gives the requested number of delays, each longer than the last, adding up to the total', () => {
    const delays = slowingDelays(12, 1000);
    assert.equal(delays.length, 12);
    assert.ok(delays.every((d, i) => i === 0 || d > delays[i - 1]!), delays.join(','));
    assert.ok(Math.abs(delays.reduce((a, b) => a + b, 0) - 1000) < 1e-9);
  });

  test('a single step takes the whole time', () => {
    assert.deepEqual(slowingDelays(1, 500), [500]);
  });
});

describe('flickerSequence', { tags: ['unit'] }, () => {
  test('ends on the result', () => {
    assert.equal(flickerSequence(20, 12, 7, roller(seeded(1))).at(-1), 7);
  });

  test('on a two-sided die it alternates', () => {
    assert.deepEqual(flickerSequence(2, 4, 1, roller(seeded(1))), [2, 1, 2, 1]);
  });

  test('on a one-sided die it can only show the result', () => {
    assert.deepEqual(flickerSequence(1, 3, 1, roller(seeded(1))), [1, 1, 1]);
  });
});

describe('flickerSequence', { tags: ['property'] }, () => {
  test('shows only faces on the die, never the same face twice in a row, and ends on the result', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 2, max: 20 }), fc.integer({ min: 1, max: 30 }), fc.integer({ min: 1, max: 20 }), (seed, sides, count, pick) => {
        const result = ((pick - 1) % sides) + 1;
        const seq = flickerSequence(sides, count, result, roller(seeded(seed)));
        return seq.length === count && seq.at(-1) === result && seq.every((f, i) => f >= 1 && f <= sides && (i === 0 || f !== seq[i - 1]));
      }),
    );
  });
});
