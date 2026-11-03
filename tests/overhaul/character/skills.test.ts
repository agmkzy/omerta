import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { ATTRIBUTES, attributeScores } from '../../../src/overhaul/character/attributes';
import { bonusOf } from '../../../src/overhaul/character/check';
import {
  EXPERT_MULTIPLE,
  SKILLS,
  SKILL_INFO,
  abilities,
  attributeUsed,
  attributesFor,
  describeSkillBonus,
  skillModifiers,
  skillsUsing,
  trainingModifier,
} from '../../../src/overhaul/character/skills';

describe('skills', { tags: ['unit'] }, () => {
  test('attributesFor lists the primary attribute, then any alternatives', () => {
    assert.equal(SKILL_INFO.reflexes.attribute, 'agi');
    assert.deepEqual(attributesFor('intimidation'), ['cha', 'str']);
    assert.deepEqual(attributesFor('firearms'), ['agi']);
  });

  test('Planning replaces Scheming, and uses Intelligence or Wisdom', () => {
    assert.ok(SKILLS.includes('planning'));
    assert.ok(!(SKILLS as readonly string[]).includes('scheming'));
    assert.deepEqual(attributesFor('planning'), ['int', 'wis']);
  });

  test('every skill has a name, a description and valid, distinct attributes', () => {
    assert.equal(SKILLS.length, 18);
    for (const s of SKILLS) {
      const info = SKILL_INFO[s];
      assert.ok(info.name && info.covers, s);
      for (const a of attributesFor(s)) assert.ok(ATTRIBUTES.includes(a), `${s} uses ${a}`);
      assert.equal(new Set(attributesFor(s)).size, attributesFor(s).length, `${s} lists an attribute twice`);
    }
  });

  test('skillsUsing lists skills using an attribute, primary uses first', () => {
    assert.deepEqual(skillsUsing('str'), [
      { skill: 'brawling', primary: true },
      { skill: 'intimidation', primary: false },
    ]);
    assert.deepEqual(skillsUsing('con').map((u) => [u.skill, u.primary]), [['toughness', true], ['carousing', true], ['nerve', false]]);
    assert.deepEqual(skillsUsing('wis').map((u) => [u.skill, u.primary]), [['streetwise', true], ['insight', true], ['notice', true], ['nerve', true], ['planning', false]]);
  });

  test('every attribute is the primary attribute of at least one skill', () => {
    for (const a of ATTRIBUTES) assert.ok(SKILLS.some((s) => SKILL_INFO[s].attribute === a), a);
  });
});

describe('describeSkillBonus', { tags: ['unit'] }, () => {
  test('names the attribute (or the better of several), the training and anything else added', () => {
    assert.equal(describeSkillBonus('brawling'), 'Brawling (the Strength modifier, plus any Brawling training)');
    assert.equal(describeSkillBonus('nerve', 'temperament'), 'Nerve (the higher of the Wisdom and Constitution modifiers, plus any Nerve training and temperament)');
  });
});

const subject = abilities({
  attributes: attributeScores({ str: 16, cha: 12, agi: 13 }),
  training: { intimidation: 'trained', driving: 'expert' },
});

describe('abilities', { tags: ['unit'] }, () => {
  test('defaults to average attributes, no training and proficiency bonus 2', () => {
    assert.deepEqual(abilities(), { attributes: attributeScores({}), training: {}, proficiencyBonus: 2 });
  });

  test('throws for a proficiency bonus outside 2–6', () => {
    assert.throws(() => abilities({ proficiencyBonus: 1 }), RangeError);
    assert.throws(() => abilities({ proficiencyBonus: 7 }), RangeError);
    assert.throws(() => abilities({ proficiencyBonus: 2.5 }), RangeError);
  });

  test('throws for training out of range', () => {
    assert.throws(() => abilities({ training: { juggling: 'trained' } as never }), RangeError);
    assert.throws(() => abilities({ training: { driving: 'master' } as never }), RangeError);
  });
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
    assert.deepEqual(skillModifiers(abilities({ attributes: attributeScores({ wis: 16, int: 12 }) }), 'planning'), [{ value: 3, reason: 'Wisdom 16' }]);
  });

  test('uses a specific attribute when given one', () => {
    assert.deepEqual(skillModifiers(subject, 'intimidation', 'cha')[0], { value: 1, reason: 'Charisma 12' });
  });

  test('throws for an attribute the skill does not allow', () => {
    assert.throws(() => skillModifiers(subject, 'bookkeeping', 'str'), RangeError);
  });

  test('scales proficiency with the proficiency bonus', () => {
    assert.equal(bonusOf(skillModifiers({ ...subject, proficiencyBonus: 4 }, 'driving')), 1 + 8);
  });
});

describe('attributeUsed', { tags: ['unit'] }, () => {
  test('returns the highest allowed attribute', () => {
    assert.equal(attributeUsed(subject, 'intimidation'), 'str');
    assert.equal(attributeUsed(subject, 'bookkeeping'), 'int');
  });

  test('prefers the primary attribute on a tie', () => {
    assert.equal(attributeUsed(abilities(), 'intimidation'), 'cha');
    assert.equal(attributeUsed(abilities(), 'planning'), 'int');
  });
});

describe('trainingModifier', { tags: ['unit'] }, () => {
  test('adds the proficiency bonus if trained, EXPERT_MULTIPLE times it if expert, and nothing if untrained', () => {
    const a = abilities({ training: { driving: 'trained', notice: 'expert' }, proficiencyBonus: 3 });
    assert.deepEqual([trainingModifier(a, 'driving'), trainingModifier(a, 'notice'), trainingModifier(a, 'stealth')], [
      { value: 3, reason: 'Trained in Driving' }, { value: EXPERT_MULTIPLE * 3, reason: 'Expert at Notice' }, null,
    ]);
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
        const at = (p: 'trained' | 'expert' | undefined) => bonusOf(skillModifiers(abilities({ attributes, training: p ? { [skill]: p } : {} }), skill));
        return at(undefined) < at('trained') && at('trained') < at('expert');
      }),
    );
  });
});
