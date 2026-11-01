import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { ATTRIBUTES } from '../src/attributes';
import { SKILLS, SKILL_INFO, attributesFor } from '../src/skills';

describe('skills', { tags: ['unit'] }, () => {
  test('each rests on one attribute, and some can be done another way', () => {
    assert.equal(SKILL_INFO.reflexes.attribute, 'agi');
    assert.deepEqual(attributesFor('intimidation'), ['cha', 'str']);
    assert.deepEqual(attributesFor('firearms'), ['agi']);
  });

  test('every skill has a name and a description, and rests on a real attribute', () => {
    for (const s of SKILLS) {
      const info = SKILL_INFO[s];
      assert.ok(info.name && info.covers, s);
      for (const a of attributesFor(s)) assert.ok(ATTRIBUTES.includes(a), `${s} rests on ${a}`);
      assert.equal(new Set(attributesFor(s)).size, attributesFor(s).length, `${s} names an attribute twice`);
    }
  });

  test('every attribute has at least one skill', () => {
    for (const a of ATTRIBUTES) assert.ok(SKILLS.some((s) => SKILL_INFO[s].attribute === a), a);
  });
});
