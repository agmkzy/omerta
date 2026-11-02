import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { DICE, DICE_NAMES, EDGES, EDGE_INFO, extremeName, extremeOf, extremePhrase, facesForTotal, highestRoll, lowestRoll, rollDice } from '../src/dice';
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

describe('facesForTotal', { tags: ['unit'] }, () => {
  test('splits a total into dice as evenly as possible', () => {
    assert.deepEqual(facesForTotal(10, 3, 6), [4, 3, 3]);
    assert.deepEqual(facesForTotal(18, 3, 6), [6, 6, 6]);
    assert.deepEqual(facesForTotal(3, 3, 6), [1, 1, 1]);
    assert.deepEqual(facesForTotal(7, 1, 20), [7]);
  });

  test('throws for a total the dice cannot make', () => {
    assert.throws(() => facesForTotal(2, 3, 6), RangeError);
    assert.throws(() => facesForTotal(19, 3, 6), RangeError);
    assert.throws(() => facesForTotal(4.5, 1, 6), RangeError);
  });
});

describe('facesForTotal', { tags: ['property'] }, () => {
  test('gives faces on the die that add up to the total', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4 }), fc.integer({ min: 2, max: 20 }), fc.nat(), (count, sides, pick) => {
        const total = count + (pick % (count * (sides - 1) + 1));
        const faces = facesForTotal(total, count, sides);
        return faces.length === count && faces.every((f) => f >= 1 && f <= sides) && faces.reduce((a, b) => a + b, 0) === total;
      }),
    );
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

describe('highest and lowest rolls', { tags: ['unit'] }, () => {
  test('are named as natural 20 and 1 on a d20, and by their totals on other dice', () => {
    assert.deepEqual([highestRoll(DICE['3d6']), lowestRoll(DICE['3d6'])], [18, 3]);
    assert.deepEqual([extremeOf(20, DICE.d20), extremeOf(1, DICE.d20), extremeOf(10, DICE.d20)], ['highest', 'lowest', null]);
    assert.deepEqual([extremeName('highest', DICE.d20), extremePhrase('lowest', DICE.d20)], ['natural 20', 'a natural 1']);
    assert.deepEqual([extremeName('lowest', DICE['2d10']), extremePhrase('highest', DICE['2d10'])], ['lowest possible roll (2)', 'the highest possible roll (20)']);
  });
});
