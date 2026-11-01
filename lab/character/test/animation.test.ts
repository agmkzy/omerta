import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { slowingDelays, sweepSequence } from '../playground/animation';

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

describe('sweepSequence', { tags: ['unit'] }, () => {
  test('moves one face to the right each step, wrapping round, and ends on the result', () => {
    assert.deepEqual(sweepSequence(6, 5, 2, 4), [6, 1, 2, 3, 4, 5, 6, 1, 2]);
  });

  test('goes round at least the minimum number of steps, then stops at the first pass over the result', () => {
    assert.equal(sweepSequence(20, 1, 1, 18).length, 20);
    assert.equal(sweepSequence(20, 1, 20, 18).length, 19);
    assert.equal(sweepSequence(2, 1, 2, 18).length, 19);
  });
});

describe('sweepSequence', { tags: ['property'] }, () => {
  test('steps right one face at a time from the start, ending on the result, in at least the minimum steps', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), fc.integer({ min: 1, max: 20 }), fc.integer({ min: 1, max: 20 }), fc.integer({ min: 1, max: 30 }), (sides, a, b, min) => {
        const start = ((a - 1) % sides) + 1;
        const result = ((b - 1) % sides) + 1;
        const seq = sweepSequence(sides, start, result, min);
        const next = (f: number) => (f % sides) + 1;
        return (
          seq.at(-1) === result && seq.length >= min && seq.length < min + sides && seq[0] === next(start) && seq.every((f, i) => i === 0 || f === next(seq[i - 1]!))
        );
      }),
    );
  });
});
