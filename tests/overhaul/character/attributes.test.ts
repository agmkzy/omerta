import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { ATTRIBUTES, ATTRIBUTE_INFO, abilityModifier, assignScores, attributeScores, rollScores } from '../../../src/overhaul/character/attributes';
import { roller, seeded } from '../../../src/overhaul/character/random';
import { scripted } from './support';

describe('attributes', { tags: ['unit'] }, () => {
  test('are the six D&D attributes', () => {
    assert.deepEqual(ATTRIBUTES, ['str', 'agi', 'con', 'int', 'wis', 'cha']);
    assert.deepEqual(ATTRIBUTES.map((a) => ATTRIBUTE_INFO[a].name), ['Strength', 'Agility', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']);
  });
});

describe('abilityModifier', { tags: ['unit'] }, () => {
  test('is floor((score - 10) / 2)', () => {
    assert.deepEqual([1, 3, 8, 9, 10, 11, 12, 15, 18, 20].map(abilityModifier), [-5, -4, -1, -1, 0, 0, 1, 2, 4, 5]);
  });

  test('throws for scores outside 1–20 or non-integers', () => {
    for (const bad of [0, 21, 10.5, Number.NaN]) assert.throws(() => abilityModifier(bad), RangeError);
  });
});

describe('attributeScores', { tags: ['unit'] }, () => {
  test('defaults missing scores to 10', () => {
    assert.deepEqual(attributeScores({ str: 16, cha: 8 }), { str: 16, agi: 10, con: 10, int: 10, wis: 10, cha: 8 });
  });

  test('validates scores', () => {
    assert.throws(() => attributeScores({ wis: 25 }), RangeError);
  });
});

describe('rollScores and assignScores', { tags: ['unit'] }, () => {
  test('rollScores rolls 4d6 and drops the lowest, six times', () => {
    const faces = [6, 6, 6, 1, 1, 1, 1, 1, 3, 4, 5, 2, 2, 2, 2, 2, 6, 5, 4, 3, 4, 4, 4, 4];
    assert.deepEqual(rollScores(scripted(...faces)), [18, 3, 12, 6, 15, 12]);
  });

  test('assignScores gives the highest score to the first priority', () => {
    assert.deepEqual(assignScores([12, 18, 9, 14, 10, 7], ['str', 'con', 'cha', 'agi', 'wis', 'int']), {
      str: 18, con: 14, cha: 12, agi: 10, wis: 9, int: 7,
    });
  });

  test('assignScores requires six scores and each attribute exactly once', () => {
    assert.throws(() => assignScores([10, 10, 10, 10, 10, 10], ['str', 'str', 'cha', 'agi', 'wis', 'int']), RangeError);
    assert.throws(() => assignScores([10, 10, 10, 10, 10], ['str', 'con', 'cha', 'agi', 'wis', 'int']), RangeError);
  });
});

describe('attributes', { tags: ['property'] }, () => {
  test('rolled scores are between 3 and 18', () => {
    fc.assert(fc.property(fc.integer(), (seed) => rollScores(roller(seeded(seed))).every((s) => s >= 3 && s <= 18)));
  });

  test('abilityModifier is non-decreasing', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 19 }), (s) => abilityModifier(s + 1) >= abilityModifier(s)));
  });
});
