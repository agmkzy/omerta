import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { ATTRIBUTES } from '../src/attributes';
import { SKILLS, SKILL_INFO, attributesFor, describeSkillBonus, skillsUsing } from '../src/skills';

describe('skills', { tags: ['unit'] }, () => {
  test('attributesFor lists the primary attribute, then any alternatives', () => {
    assert.equal(SKILL_INFO.reflexes.attribute, 'agi');
    assert.deepEqual(attributesFor('intimidation'), ['cha', 'str']);
    assert.deepEqual(attributesFor('firearms'), ['agi']);
  });

  test('every skill has a name, a description and valid, distinct attributes', () => {
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
