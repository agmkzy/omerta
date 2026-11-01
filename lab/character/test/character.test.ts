import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { attributeScores } from '../src/attributes';
import { bonusOf } from '../src/check';
import { BASE_HIT_POINTS, attributeUsed, createCharacter, hitPointModifiers, maxHitPoints, rollFor, skillModifiers } from '../src/character';
import { DICE } from '../src/dice';
import { SKILLS } from '../src/skills';
import { temperament } from '../src/temperament';

const subject = createCharacter({
  name: 'Subject',
  attributes: attributeScores({ str: 16, cha: 12, agi: 13 }),
  training: { intimidation: 'trained', driving: 'expert' },
});

describe('skillModifiers', { tags: ['unit'] }, () => {
  test('returns the attribute modifier and proficiency bonus with reasons', () => {
    assert.deepEqual(skillModifiers(subject, 'driving'), [
      { value: 1, reason: 'Agility 13' },
      { value: 4, reason: 'Expert at Driving' },
    ]);
  });

  test('returns only the attribute modifier for an untrained skill', () => {
    assert.deepEqual(skillModifiers(subject, 'firearms'), [{ value: 1, reason: 'Agility 13' }]);
  });

  test('uses the higher of the allowed attributes', () => {
    assert.deepEqual(skillModifiers(subject, 'intimidation'), [
      { value: 3, reason: 'Strength 16' },
      { value: 2, reason: 'Trained in Intimidation' },
    ]);
  });

  test('uses a specific attribute when given one', () => {
    assert.deepEqual(skillModifiers(subject, 'intimidation', 'cha')[0], { value: 1, reason: 'Charisma 12' });
  });

  test('throws for an attribute the skill does not allow', () => {
    assert.throws(() => skillModifiers(subject, 'bookkeeping', 'str'), RangeError);
  });

  test('scales proficiency with the proficiency bonus', () => {
    const experienced = createCharacter({ ...subject, proficiencyBonus: 4 });
    assert.equal(bonusOf(skillModifiers(experienced, 'driving')), 1 + 8);
  });
});

describe('attributeUsed', { tags: ['unit'] }, () => {
  test('returns the highest allowed attribute', () => {
    assert.equal(attributeUsed(subject, 'intimidation'), 'str');
    assert.equal(attributeUsed(subject, 'bookkeeping'), 'int');
  });

  test('prefers the primary attribute on a tie', () => {
    assert.equal(attributeUsed(createCharacter({ name: 'Average' }), 'intimidation'), 'cha');
  });
});

describe('createCharacter', { tags: ['unit'] }, () => {
  test('defaults to average attributes and temperament, no training and proficiency bonus 2', () => {
    const c = createCharacter({ name: 'Default' });
    assert.deepEqual(c.attributes, attributeScores({}));
    assert.deepEqual(c.training, {});
    assert.equal(c.proficiencyBonus, 2);
    assert.deepEqual(c.temperament, temperament({}));
  });

  test('throws for a proficiency bonus outside 2–6', () => {
    assert.throws(() => createCharacter({ name: 'X', proficiencyBonus: 1 }), RangeError);
    assert.throws(() => createCharacter({ name: 'X', proficiencyBonus: 7 }), RangeError);
  });
});

describe('rollFor', { tags: ['unit'] }, () => {
  const c = createCharacter({ name: 'Subject', attributes: attributeScores({ wis: 14 }), training: { nerve: 'trained' }, temperament: temperament({ pride: 0.9, courage: 0.1 }) });

  test('orders modifiers as skill, then temperament, then situational', () => {
    const roll = rollFor(c, 'nerve', {
      situations: ['hold-nerve', 'resist-intimidation'],
      modifiers: [{ value: -2, reason: 'Threatened with a gun' }],
    });
    assert.deepEqual(roll.modifiers, [
      { value: 2, reason: 'Wisdom 14' },
      { value: 2, reason: 'Trained in Nerve' },
      { value: -2, reason: 'Timid' },
      { value: 2, reason: 'Proud' },
      { value: -2, reason: 'Threatened with a gun' },
    ]);
    assert.equal(roll.dice, DICE.d20);
    assert.equal(roll.edge, 'none');
  });

  test('combines edges and uses the given dice', () => {
    const roll = rollFor(c, 'reflexes', { edges: ['advantage', 'advantage'], dice: DICE['3d6'] });
    assert.equal(roll.edge, 'advantage');
    assert.equal(roll.dice, DICE['3d6']);
    assert.deepEqual(roll.modifiers, [{ value: 0, reason: 'Agility 10' }]);
  });

  test('passes a specific attribute through', () => {
    assert.deepEqual(rollFor(c, 'nerve', { using: 'con' }).modifiers[0], { value: 0, reason: 'Constitution 10' });
  });
});

describe('hit points', { tags: ['unit'] }, () => {
  test('are 10 plus the Constitution modifier', () => {
    assert.equal(BASE_HIT_POINTS, 10);
    assert.equal(maxHitPoints(createCharacter({ name: 'Average' })), 10);
    assert.equal(maxHitPoints(createCharacter({ name: 'Hardy', attributes: attributeScores({ con: 16 }) })), 13);
    assert.equal(maxHitPoints(createCharacter({ name: 'Frail', attributes: attributeScores({ con: 6 }) })), 8);
  });

  test('add the proficiency bonus for Toughness training, twice for expertise', () => {
    assert.equal(maxHitPoints(createCharacter({ name: 'T', training: { toughness: 'trained' } })), 12);
    assert.equal(maxHitPoints(createCharacter({ name: 'E', training: { toughness: 'expert' }, proficiencyBonus: 3 })), 16);
  });

  test('are listed with reasons', () => {
    const c = createCharacter({ name: 'T', attributes: attributeScores({ con: 14 }), training: { toughness: 'trained' } });
    assert.deepEqual(hitPointModifiers(c), [
      { value: 10, reason: 'Base' },
      { value: 2, reason: 'Constitution 14' },
      { value: 2, reason: 'Trained in Toughness' },
    ]);
  });

  test('are 5 at the lowest Constitution score', () => {
    assert.equal(maxHitPoints(createCharacter({ name: 'X', attributes: attributeScores({ con: 1 }) })), 5);
  });
});

describe('skillModifiers', { tags: ['property'] }, () => {
  const scores = fc.record({
    str: fc.integer({ min: 1, max: 20 }), agi: fc.integer({ min: 1, max: 20 }), con: fc.integer({ min: 1, max: 20 }),
    int: fc.integer({ min: 1, max: 20 }), wis: fc.integer({ min: 1, max: 20 }), cha: fc.integer({ min: 1, max: 20 }),
  });

  test('untrained < trained < expert for every skill', () => {
    fc.assert(
      fc.property(scores, fc.constantFrom(...SKILLS), (attributes, skill) => {
        const at = (p: 'trained' | 'expert' | undefined) => bonusOf(skillModifiers(createCharacter({ name: 'T', attributes, training: p ? { [skill]: p } : {} }), skill));
        return at(undefined) < at('trained') && at('trained') < at('expert');
      }),
    );
  });
});
