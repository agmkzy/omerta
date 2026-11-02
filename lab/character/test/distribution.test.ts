import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { DICE, DICE_NAMES, EDGES, rollDice } from '../src/dice';
import { atLeast, diceDistribution, mean, minus, pointAt, probabilityOf, shift, total } from '../src/distribution';
import { roller, seeded } from '../src/random';

const close = (actual: number, expected: number, tolerance = 1e-12) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

describe('diceDistribution and helpers', { tags: ['unit'] }, () => {
  test('d20: each face has probability 1/20', () => {
    const d = diceDistribution(DICE.d20, 'none');
    for (let face = 1; face <= 20; face++) close(probabilityOf(d, face), 1 / 20);
    assert.equal(probabilityOf(d, 0), 0);
    assert.equal(probabilityOf(d, 21), 0);
  });

  test('3d6: P(10) = 27/216, P(3) = P(18) = 1/216', () => {
    const d = diceDistribution(DICE['3d6'], 'none');
    close(probabilityOf(d, 10), 27 / 216);
    close(probabilityOf(d, 3), 1 / 216);
    close(probabilityOf(d, 18), 1 / 216);
  });

  test('d20 with advantage: P(20) = 39/400, P(1) = 1/400', () => {
    const d = diceDistribution(DICE.d20, 'advantage');
    close(probabilityOf(d, 20), 39 / 400);
    close(probabilityOf(d, 1), 1 / 400);
  });

  test('disadvantage is the mirror image of advantage', () => {
    const adv = diceDistribution(DICE.d20, 'advantage');
    const dis = diceDistribution(DICE.d20, 'disadvantage');
    for (let face = 1; face <= 20; face++) close(probabilityOf(dis, face), probabilityOf(adv, 21 - face));
  });

  test('pointAt has a single value with probability 1', () => {
    assert.deepEqual(pointAt(5), { min: 5, probabilities: [1] });
  });

  test('shift adds a constant to every value', () => {
    const d = shift(diceDistribution(DICE.d20, 'none'), 3);
    assert.equal(d.min, 4);
    close(probabilityOf(d, 23), 1 / 20);
  });

  test('minus of two d20s ranges from -19 to 19 with mode 0', () => {
    const d20 = diceDistribution(DICE.d20, 'none');
    const d = minus(d20, d20);
    assert.equal(d.min, -19);
    assert.equal(d.probabilities.length, 39);
    close(probabilityOf(d, 0), 20 / 400);
    close(probabilityOf(d, 19), 1 / 400);
  });

  test('atLeast returns P(X ≥ k)', () => {
    const d20 = diceDistribution(DICE.d20, 'none');
    close(atLeast(d20, 11), 0.5);
    close(atLeast(d20, 1), 1);
    close(atLeast(d20, -5), 1);
    close(atLeast(d20, 21), 0);
  });

  test('mean of d20 is 10.5 and of 2d10 is 11', () => {
    close(mean(diceDistribution(DICE.d20, 'none')), 10.5);
    close(mean(diceDistribution(DICE['2d10'], 'none')), 11);
  });
});

describe('diceDistribution', { tags: ['property'] }, () => {
  const kinds = fc.tuple(fc.constantFrom(...DICE_NAMES), fc.constantFrom(...EDGES));

  test('sums to 1', () => {
    fc.assert(fc.property(kinds, ([name, edge]) => Math.abs(total(diceDistribution(DICE[name], edge)) - 1) < 1e-12));
  });

  test('mean is ordered disadvantage < none < advantage', () => {
    fc.assert(
      fc.property(fc.constantFrom(...DICE_NAMES), (name) => {
        const [dis, none, adv] = (['disadvantage', 'none', 'advantage'] as const).map((e) => mean(diceDistribution(DICE[name], e)));
        return dis! < none! && none! < adv!;
      }),
    );
  });

  test('atLeast is non-increasing in k', () => {
    fc.assert(
      fc.property(kinds, fc.integer({ min: -5, max: 40 }), ([name, edge], k) => {
        const d = diceDistribution(DICE[name], edge);
        return atLeast(d, k + 1) <= atLeast(d, k) + 1e-12;
      }),
    );
  });
});

describe('diceDistribution', { tags: ['statistical'] }, () => {
  test('matches sampled frequencies from rollDice', () => {
    for (const name of DICE_NAMES)
      for (const edge of EDGES) {
        const d = diceDistribution(DICE[name], edge);
        const r = roller(seeded(11));
        const n = 40_000;
        const counts = new Map<number, number>();
        for (let i = 0; i < n; i++) {
          const { kept } = rollDice(DICE[name], edge, r);
          counts.set(kept, (counts.get(kept) ?? 0) + 1);
        }
        d.probabilities.forEach((p, i) => {
          const seen = (counts.get(d.min + i) ?? 0) / n;
          assert.ok(Math.abs(seen - p) < 0.01, `${name} ${edge}: ${d.min + i} seen ${seen}, expected ${p}`);
        });
      }
  });
});
