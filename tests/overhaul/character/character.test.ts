import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { attributeScores } from '../../../src/overhaul/character/attributes';
import { createCharacter } from '../../../src/overhaul/character/character';
import { temperament } from '../../../src/overhaul/character/temperament';

describe('createCharacter', { tags: ['unit'] }, () => {
  test('defaults to average attributes and temperament, no training, proficiency bonus 2 and full health', () => {
    assert.deepEqual(createCharacter({ id: 'sam', name: 'Sam' }), {
      id: 'sam',
      name: 'Sam',
      attributes: attributeScores({}),
      training: {},
      proficiencyBonus: 2,
      startingTemperament: temperament({}),
      condition: { hitPoints: 10, effects: [] },
      inventory: { cash: 0, items: [] },
      knowledge: {},
      relationships: {},
    });
  });

  test('keeps what it is given, filling in any traits not given', () => {
    const c = createCharacter({
      id: 'rico', name: 'Rico', background: 'fighter', attributes: attributeScores({ str: 16 }),
      training: { brawling: 'expert' }, proficiencyBonus: 3, startingTemperament: { volatility: 0.8 },
    });
    assert.equal(c.background, 'fighter');
    assert.equal(c.attributes.str, 16);
    assert.deepEqual(c.training, { brawling: 'expert' });
    assert.equal(c.proficiencyBonus, 3);
    assert.deepEqual(c.startingTemperament, temperament({ volatility: 0.8 }));
  });

  test('has no background field when given none', () => {
    assert.equal('background' in createCharacter({ id: 'x', name: 'X' }), false);
  });

  test('throws for a missing id, and for anything out of range', () => {
    assert.throws(() => createCharacter({ id: '', name: 'X' }), TypeError);
    assert.throws(() => createCharacter({ id: 7 as never, name: 'X' }), TypeError);
    assert.throws(() => createCharacter({ id: 'x', name: 'X', proficiencyBonus: 7 }), RangeError);
    assert.throws(() => createCharacter({ id: 'x', name: 'X', training: { driving: 'master' } as never }), RangeError);
    assert.throws(() => createCharacter({ id: 'x', name: 'X', startingTemperament: { greed: 2 } }), RangeError);
    assert.throws(() => createCharacter({ id: 'x', name: 'X', condition: { hitPoints: 11 } }), RangeError);
  });
});
