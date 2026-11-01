import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { DICE, DICE_NAMES, EDGES, rollDice } from '../src/dice';
import { roller, seeded } from '../src/random';
import { scripted } from './support';

describe('rolling dice', { tags: ['unit'] }, () => {
  test('a d20 keeps its one face', () => {
    assert.deepEqual(rollDice(DICE.d20, 'none', scripted(13)), { throws: [[13]], kept: 13 });
  });

  test('3d6 adds its faces', () => {
    assert.deepEqual(rollDice(DICE['3d6'], 'none', scripted(2, 5, 6)), { throws: [[2, 5, 6]], kept: 13 });
  });

  test('advantage throws twice and keeps the better total', () => {
    assert.deepEqual(rollDice(DICE.d20, 'advantage', scripted(4, 17)), { throws: [[4], [17]], kept: 17 });
    assert.deepEqual(rollDice(DICE['2d10'], 'advantage', scripted(9, 9, 1, 2)), { throws: [[9, 9], [1, 2]], kept: 18 });
  });

  test('disadvantage throws twice and keeps the worse total', () => {
    assert.deepEqual(rollDice(DICE.d20, 'disadvantage', scripted(4, 17)), { throws: [[4], [17]], kept: 4 });
  });

  test('each kind of dice has the range a d20 player expects', () => {
    assert.deepEqual(DICE_NAMES, ['d20', '2d10', '3d6']);
    assert.deepEqual(DICE_NAMES.map((n) => [DICE[n].count, DICE[n].sides]), [[1, 20], [2, 10], [3, 6]]);
  });
});

describe('rolled dice', { tags: ['property'] }, () => {
  test('keep a total within what the dice can show, from one of the throws', () => {
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
