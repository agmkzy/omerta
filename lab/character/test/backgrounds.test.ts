import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { ATTRIBUTES } from '../src/attributes';
import { BACKGROUNDS, BACKGROUND_INFO, rollCharacter, trainingFor } from '../src/backgrounds';
import { roller, seeded } from '../src/random';
import { temperament } from '../src/temperament';

describe('backgrounds', { tags: ['unit'] }, () => {
  test('are the expected list', () => {
    assert.deepEqual(BACKGROUNDS, ['enforcer', 'driver', 'gunman', 'racketeer', 'con-artist', 'bookkeeper', 'shopkeeper', 'labourer']);
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
    assert.deepEqual(rollCharacter('A', 'gunman', roller(seeded(3))), rollCharacter('A', 'gunman', roller(seeded(3))));
  });

  test('sets the name, background, training and default proficiency bonus', () => {
    const c = rollCharacter('A', 'bookkeeper', roller(seeded(1)));
    assert.equal(c.name, 'A');
    assert.equal(c.background, 'bookkeeper');
    assert.deepEqual(c.training, trainingFor('bookkeeper'));
    assert.equal(c.proficiencyBonus, 2);
  });

  test('accepts a proficiency bonus', () => {
    assert.equal(rollCharacter('A', 'racketeer', roller(seeded(1)), { proficiencyBonus: 4 }).proficiencyBonus, 4);
  });
});

describe('rollCharacter', { tags: ['property'] }, () => {
  test('puts the highest score in the background’s first-priority attribute', () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom(...BACKGROUNDS), (seed, b) => {
        const c = rollCharacter('X', b, roller(seeded(seed)));
        const first = BACKGROUND_INFO[b].priorities[0]!;
        return ATTRIBUTES.every((a) => c.attributes[first] >= c.attributes[a]);
      }),
    );
  });

  test('centres temperament on the background’s values', () => {
    const r = roller(seeded(4));
    const meanViolence = (b: 'enforcer' | 'bookkeeper') => {
      const cs = Array.from({ length: 500 }, () => rollCharacter('X', b, r));
      return cs.reduce((s, c) => s + c.temperament.violence, 0) / cs.length;
    };
    assert.ok(meanViolence('enforcer') > meanViolence('bookkeeper') + 0.3);
  });
});
