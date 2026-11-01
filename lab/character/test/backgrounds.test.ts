import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { ATTRIBUTES } from '../src/attributes';
import { BACKGROUNDS, BACKGROUND_INFO, rollCharacter, trainingFor } from '../src/backgrounds';
import { roller, seeded } from '../src/random';
import { temperament } from '../src/temperament';

describe('backgrounds', { tags: ['unit'] }, () => {
  test('cover the trades of the life, and the people it preys on', () => {
    assert.deepEqual(BACKGROUNDS, ['legbreaker', 'wheelman', 'shooter', 'earner', 'hustler', 'bookkeeper', 'shopkeeper', 'labourer']);
  });

  test('each is whole: a name, three or more skills, each attribute ranked once, sensible leanings', () => {
    for (const b of BACKGROUNDS) {
      const info = BACKGROUND_INFO[b];
      assert.ok(info.name && info.blurb, b);
      assert.ok(info.trained.length + info.expert.length >= 3, `${b} teaches too little`);
      assert.ok(!info.expert.some((s) => info.trained.includes(s)), `${b} lists a skill twice`);
      assert.deepEqual([...info.priorities].sort(), [...ATTRIBUTES].sort(), b);
      assert.doesNotThrow(() => temperament(info.leanings), b);
    }
  });

  test('give their training', () => {
    assert.deepEqual(trainingFor('wheelman'), { driving: 'expert', reflexes: 'trained', notice: 'trained', mechanics: 'trained' });
  });
});

describe('a rolled character', { tags: ['unit'] }, () => {
  test('is the same man every time from the same seed', () => {
    assert.deepEqual(rollCharacter('Vinnie', 'shooter', roller(seeded(3))), rollCharacter('Vinnie', 'shooter', roller(seeded(3))));
  });

  test('has his background’s training and records it', () => {
    const c = rollCharacter('Sal', 'bookkeeper', roller(seeded(1)));
    assert.equal(c.name, 'Sal');
    assert.equal(c.background, 'bookkeeper');
    assert.deepEqual(c.training, trainingFor('bookkeeper'));
    assert.equal(c.proficiencyBonus, 2);
  });

  test('can be seasoned', () => {
    assert.equal(rollCharacter('Old Joe', 'earner', roller(seeded(1)), { proficiencyBonus: 4 }).proficiencyBonus, 4);
  });
});

describe('rolled characters', { tags: ['property'] }, () => {
  test('have their best score where their background puts it', () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom(...BACKGROUNDS), (seed, b) => {
        const c = rollCharacter('X', b, roller(seeded(seed)));
        const first = BACKGROUND_INFO[b].priorities[0]!;
        return ATTRIBUTES.every((a) => c.attributes[first] >= c.attributes[a]);
      }),
    );
  });

  test('lean the way their trade does', () => {
    const r = roller(seeded(4));
    const avg = (b: 'legbreaker' | 'bookkeeper') => {
      const men = Array.from({ length: 500 }, () => rollCharacter('X', b, r));
      return men.reduce((s, c) => s + c.temperament.violence, 0) / men.length;
    };
    assert.ok(avg('legbreaker') > avg('bookkeeper') + 0.3);
  });
});
