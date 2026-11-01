import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { ATTRIBUTES, ATTRIBUTE_INFO, abilityModifier, assignScores, attributeScores, rollScores } from '../src/attributes';
import { roller, seeded } from '../src/random';
import { scripted } from './support';

describe('attributes', { tags: ['unit'] }, () => {
  test('are the six, named for the setting', () => {
    assert.deepEqual(ATTRIBUTES, ['str', 'agi', 'con', 'int', 'wis', 'cha']);
    assert.deepEqual(ATTRIBUTES.map((a) => ATTRIBUTE_INFO[a].name), ['Strength', 'Agility', 'Grit', 'Wits', 'Savvy', 'Presence']);
  });

  test('a score gives D&D’s modifier: (score − 10) / 2, rounded down', () => {
    assert.deepEqual([1, 3, 8, 9, 10, 11, 12, 15, 18, 20].map(abilityModifier), [-5, -4, -1, -1, 0, 0, 1, 2, 4, 5]);
  });

  test('a score outside 1 to 20, or not whole, is refused', () => {
    for (const bad of [0, 21, 10.5, Number.NaN]) assert.throws(() => abilityModifier(bad), RangeError);
  });

  test('scores not given are average', () => {
    assert.deepEqual(attributeScores({ str: 16, cha: 8 }), { str: 16, agi: 10, con: 10, int: 10, wis: 10, cha: 8 });
  });

  test('a set of scores is checked', () => {
    assert.throws(() => attributeScores({ wis: 25 }), RangeError);
  });

  test('rolling scores is 4d6, dropping the lowest, six times', () => {
    const faces = [6, 6, 6, 1, 1, 1, 1, 1, 3, 4, 5, 2, 2, 2, 2, 2, 6, 5, 4, 3, 4, 4, 4, 4];
    assert.deepEqual(rollScores(scripted(...faces)), [18, 3, 12, 6, 15, 12]);
  });

  test('rolled scores go to attributes in order of priority, the best first', () => {
    assert.deepEqual(assignScores([12, 18, 9, 14, 10, 7], ['str', 'con', 'cha', 'agi', 'wis', 'int']), {
      str: 18, con: 14, cha: 12, agi: 10, wis: 9, int: 7,
    });
  });

  test('priorities must name each attribute once, and there must be six scores', () => {
    assert.throws(() => assignScores([10, 10, 10, 10, 10, 10], ['str', 'str', 'cha', 'agi', 'wis', 'int']), RangeError);
    assert.throws(() => assignScores([10, 10, 10, 10, 10], ['str', 'con', 'cha', 'agi', 'wis', 'int']), RangeError);
  });
});

describe('rolled attributes', { tags: ['property'] }, () => {
  test('always lie between 3 and 18', () => {
    fc.assert(fc.property(fc.integer(), (seed) => rollScores(roller(seeded(seed))).every((s) => s >= 3 && s <= 18)));
  });

  test('a higher score never has a lower modifier', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 19 }), (s) => abilityModifier(s + 1) >= abilityModifier(s)));
  });
});
