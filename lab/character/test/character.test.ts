import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { attributeScores } from '../src/attributes';
import { bonusOf } from '../src/check';
import { createCharacter, rollFor, skillModifiers } from '../src/character';
import { DICE } from '../src/dice';
import { SKILLS } from '../src/skills';
import { temperament } from '../src/temperament';

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
    assert.deepEqual(nobody.temperament, temperament({}));
  });

  test('refuses a proficiency bonus outside D&D’s 2 to 6', () => {
    assert.throws(() => createCharacter({ name: 'X', proficiencyBonus: 1 }), RangeError);
    assert.throws(() => createCharacter({ name: 'X', proficiencyBonus: 7 }), RangeError);
  });
});

describe('a character’s roll', { tags: ['unit'] }, () => {
  const sal = createCharacter({ name: 'Sal', attributes: attributeScores({ wis: 14 }), training: { nerve: 'trained' }, temperament: temperament({ pride: 0.9, courage: 0.1 }) });

  test('is his skill, then his temperament in the situation, then what the moment adds', () => {
    const roll = rollFor(sal, 'nerve', {
      situations: ['hold-nerve', 'resist-intimidation'],
      modifiers: [{ value: -2, reason: 'A gun in his face' }],
    });
    assert.deepEqual(roll.modifiers, [
      { value: 2, reason: 'Savvy 14' },
      { value: 2, reason: 'Trained in Nerve' },
      { value: -2, reason: 'Timid' },
      { value: 2, reason: 'Too proud to be pushed around' },
      { value: -2, reason: 'A gun in his face' },
    ]);
    assert.equal(roll.dice, DICE.d20);
    assert.equal(roll.edge, 'none');
  });

  test('combines the edges the moment gives, on the dice asked for', () => {
    const roll = rollFor(sal, 'reflexes', { edges: ['advantage', 'advantage'], dice: DICE['3d6'] });
    assert.equal(roll.edge, 'advantage');
    assert.equal(roll.dice, DICE['3d6']);
    assert.deepEqual(roll.modifiers, [{ value: 0, reason: 'Agility 10' }]);
  });

  test('can be made with a particular attribute', () => {
    assert.deepEqual(rollFor(sal, 'nerve', { using: 'con' }).modifiers[0], { value: 0, reason: 'Grit 10' });
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
