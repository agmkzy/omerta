import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { ATTRIBUTES } from '../../../src/overhaul/character/attributes';
import { BACKGROUNDS, BACKGROUND_INFO, rollCharacter, trainingFor } from '../../../src/overhaul/character/backgrounds';
import { roller, seeded } from '../../../src/overhaul/character/random';
import { temperament } from '../../../src/overhaul/character/temperament';

describe('backgrounds', { tags: ['unit'] }, () => {
  test('are the expected list', () => {
    assert.deepEqual(BACKGROUNDS, ['fighter', 'driver', 'marksman', 'negotiator', 'trickster', 'accountant', 'shopkeeper', 'labourer']);
  });

  test('are each valid: name, at least three skills, no duplicates, all six priorities, valid temperament', () => {
    for (const b of BACKGROUNDS) {
      const info = BACKGROUND_INFO[b];
      assert.ok(info.name && info.description, b);
      assert.ok(info.trained.length + info.expert.length >= 3, `${b} has fewer than three skills`);
      assert.ok(!info.expert.some((s) => info.trained.includes(s)), `${b} lists a skill twice`);
      assert.deepEqual([...info.priorities].sort(), [...ATTRIBUTES].sort(), b);
      assert.doesNotThrow(() => temperament(info.temperament), b);
    }
  });

  test('trainingFor returns trained and expert skills', () => {
    assert.deepEqual(trainingFor('driver'), { driving: 'expert', reflexes: 'trained', notice: 'trained', mechanics: 'trained' });
  });
});

describe('rollCharacter', { tags: ['unit'] }, () => {
  test('is deterministic for a seed', () => {
    assert.deepEqual(rollCharacter('a', 'A', 'marksman', roller(seeded(3))), rollCharacter('a', 'A', 'marksman', roller(seeded(3))));
  });

  test('sets the id, name, background, training and default proficiency bonus', () => {
    const c = rollCharacter('a', 'A', 'accountant', roller(seeded(1)));
    assert.equal(c.id, 'a');
    assert.equal(c.name, 'A');
    assert.equal(c.background, 'accountant');
    assert.deepEqual(c.training, trainingFor('accountant'));
    assert.equal(c.proficiencyBonus, 2);
  });

  test('accepts a proficiency bonus', () => {
    assert.equal(rollCharacter('a', 'A', 'negotiator', roller(seeded(1)), { proficiencyBonus: 4 }).proficiencyBonus, 4);
  });
});

describe('rollCharacter', { tags: ['property'] }, () => {
  test('puts the highest score in the background’s first-priority attribute', () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom(...BACKGROUNDS), (seed, b) => {
        const c = rollCharacter('x', 'X', b, roller(seeded(seed)));
        const first = BACKGROUND_INFO[b].priorities[0]!;
        return ATTRIBUTES.every((a) => c.attributes[first] >= c.attributes[a]);
      }),
    );
  });

  test('centres temperament on the background’s values', () => {
    const r = roller(seeded(4));
    const meanViolence = (b: 'fighter' | 'accountant') => {
      const cs = Array.from({ length: 500 }, () => rollCharacter('x', 'X', b, r));
      return cs.reduce((s, c) => s + c.startingTemperament.violence, 0) / cs.length;
    };
    assert.ok(meanViolence('fighter') > meanViolence('accountant') + 0.3);
  });
});
