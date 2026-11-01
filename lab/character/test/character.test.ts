import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { attributeScores } from '../src/attributes';
import { bonusOf } from '../src/check';
import { createCharacter, skillModifiers } from '../src/character';
import { SKILLS } from '../src/skills';

const vinnie = createCharacter({
  name: 'Vinnie',
  attributes: attributeScores({ str: 16, cha: 12, agi: 13 }),
  training: { intimidation: 'trained', driving: 'expert' },
});

describe('a character’s skill', { tags: ['unit'] }, () => {
  test('is the attribute modifier plus training, each with its reason', () => {
    assert.deepEqual(skillModifiers(vinnie, 'driving'), [
      { value: 1, reason: 'Agility 13' },
      { value: 4, reason: 'Expert at Driving' },
    ]);
  });

  test('untrained, it is the attribute alone', () => {
    assert.deepEqual(skillModifiers(vinnie, 'firearms'), [{ value: 1, reason: 'Agility 13' }]);
  });

  test('uses the better of the attributes the skill allows', () => {
    assert.deepEqual(skillModifiers(vinnie, 'intimidation'), [
      { value: 3, reason: 'Strength 16' },
      { value: 2, reason: 'Trained in Intimidation' },
    ]);
  });

  test('can be made to use a particular allowed attribute', () => {
    assert.deepEqual(skillModifiers(vinnie, 'intimidation', 'cha')[0], { value: 1, reason: 'Presence 12' });
  });

  test('cannot use an attribute the skill does not allow', () => {
    assert.throws(() => skillModifiers(vinnie, 'bookkeeping', 'str'), RangeError);
  });

  test('training grows with the proficiency bonus', () => {
    const veteran = createCharacter({ ...vinnie, proficiencyBonus: 4 });
    assert.equal(bonusOf(skillModifiers(veteran, 'driving')), 1 + 8);
  });
});

describe('creating a character', { tags: ['unit'] }, () => {
  test('starts average and untrained, with a proficiency bonus of 2', () => {
    const nobody = createCharacter({ name: 'Nobody' });
    assert.deepEqual(nobody.attributes, attributeScores({}));
    assert.deepEqual(nobody.training, {});
    assert.equal(nobody.proficiencyBonus, 2);
  });

  test('refuses a proficiency bonus outside D&D’s 2 to 6', () => {
    assert.throws(() => createCharacter({ name: 'X', proficiencyBonus: 1 }), RangeError);
    assert.throws(() => createCharacter({ name: 'X', proficiencyBonus: 7 }), RangeError);
  });
});

describe('skill bonuses', { tags: ['property'] }, () => {
  const scores = fc.record({
    str: fc.integer({ min: 1, max: 20 }), agi: fc.integer({ min: 1, max: 20 }), con: fc.integer({ min: 1, max: 20 }),
    int: fc.integer({ min: 1, max: 20 }), wis: fc.integer({ min: 1, max: 20 }), cha: fc.integer({ min: 1, max: 20 }),
  });

  test('training never makes a man worse, and expertise beats training', () => {
    fc.assert(
      fc.property(scores, fc.constantFrom(...SKILLS), (attributes, skill) => {
        const at = (p: 'trained' | 'expert' | undefined) => bonusOf(skillModifiers(createCharacter({ name: 'T', attributes, training: p ? { [skill]: p } : {} }), skill));
        return at(undefined) < at('trained') && at('trained') < at('expert');
      }),
    );
  });
});
