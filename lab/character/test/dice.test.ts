import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { DICE, DICE_NAMES, EDGES, EDGE_INFO, rollDice } from '../src/dice';
import { roller, seeded } from '../src/random';
import { scripted } from './support';

describe('rollDice', { tags: ['unit'] }, () => {
  test('keeps the single face of a d20', () => {
    assert.deepEqual(rollDice(DICE.d20, 'none', scripted(13)), { throws: [[13]], kept: 13 });
  });

  test('sums the faces of 3d6', () => {
    assert.deepEqual(rollDice(DICE['3d6'], 'none', scripted(2, 5, 6)), { throws: [[2, 5, 6]], kept: 13 });
  });

  test('with advantage, rolls twice and keeps the higher total', () => {
    assert.deepEqual(rollDice(DICE.d20, 'advantage', scripted(4, 17)), { throws: [[4], [17]], kept: 17 });
    assert.deepEqual(rollDice(DICE['2d10'], 'advantage', scripted(9, 9, 1, 2)), { throws: [[9, 9], [1, 2]], kept: 18 });
  });

  test('with disadvantage, rolls twice and keeps the lower total', () => {
    assert.deepEqual(rollDice(DICE.d20, 'disadvantage', scripted(4, 17)), { throws: [[4], [17]], kept: 4 });
  });

  test('supports d20, 2d10 and 3d6', () => {
    assert.deepEqual(DICE_NAMES, ['d20', '2d10', '3d6']);
    assert.deepEqual(DICE_NAMES.map((n) => [DICE[n].count, DICE[n].sides]), [[1, 20], [2, 10], [3, 6]]);
  });
});

describe('descriptions', { tags: ['unit'] }, () => {
  test('describe every dice option and advantage setting', () => {
    for (const n of DICE_NAMES) assert.ok(DICE[n].description, n);
    for (const e of EDGES) assert.ok(EDGE_INFO[e].name && EDGE_INFO[e].description, e);
  });
});

describe('rollDice', { tags: ['property'] }, () => {
  test('keeps one of the throw totals, within the possible range', () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom(...DICE_NAMES), fc.constantFrom(...EDGES), (seed, name, edge) => {
        const dice = DICE[name];
        const { throws, kept } = rollDice(dice, edge, roller(seeded(seed)));
        const totals = throws.map((t) => t.reduce((a, b) => a + b, 0));
        return (
          throws.length === (edge === 'none' ? 1 : 2) &&
          throws.every((t) => t.length === dice.count) &&
          totals.includes(kept) &&
          kept >= dice.count &&
          kept <= dice.count * dice.sides
        );
      }),
    );
  });
});
