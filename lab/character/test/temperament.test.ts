import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { roller, seeded } from '../src/random';
import { SITUATIONS, TRAITS, TRAIT_INFO, leaning, notableTraits, rollTemperament, temperament, temperamentModifiers } from '../src/temperament';

describe('temperament', { tags: ['unit'] }, () => {
  test('is the game’s seven traits and five more', () => {
    assert.deepEqual(TRAITS, ['greed', 'violence', 'ambition', 'caution', 'sociability', 'vice', 'courage', 'loyalty', 'pride', 'temper', 'honesty', 'cruelty']);
    for (const t of TRAITS) assert.ok(TRAIT_INFO[t].low && TRAIT_INFO[t].high, t);
  });

  test('traits not given are middling', () => {
    const t = temperament({ greed: 0.9 });
    assert.equal(t.greed, 0.9);
    assert.equal(t.courage, 0.5);
  });

  test('a trait runs from 0 to 1', () => {
    for (const bad of [-0.1, 1.1, Number.NaN]) assert.throws(() => temperament({ pride: bad }), RangeError);
  });

  test('a trait leans low at 0.3 or under, high at 0.7 or over', () => {
    assert.deepEqual([0, 0.3, 0.31, 0.5, 0.69, 0.7, 1].map(leaning), ['low', 'low', 'middling', 'middling', 'middling', 'high', 'high']);
  });

  test('a man is described by his notable traits, the strongest first', () => {
    assert.deepEqual(notableTraits(temperament({ temper: 0.75, courage: 0.05, honesty: 0.5 })), ['timid', 'hot-headed']);
    assert.deepEqual(notableTraits(temperament({})), []);
  });
});

describe('temperament in a check', { tags: ['unit'] }, () => {
  test('a proud man resists being pushed around', () => {
    assert.deepEqual(temperamentModifiers(temperament({ pride: 0.8 }), ['resist-intimidation']), [{ value: 2, reason: 'Too proud to be pushed around' }]);
  });

  test('courage holds a man’s nerve, or loses it', () => {
    assert.deepEqual(temperamentModifiers(temperament({ courage: 0.9 }), ['hold-nerve']), [{ value: 2, reason: 'Brave' }]);
    assert.deepEqual(temperamentModifiers(temperament({ courage: 0.1 }), ['hold-nerve']), [{ value: -2, reason: 'Timid' }]);
  });

  test('an honest man is a poor liar', () => {
    assert.deepEqual(temperamentModifiers(temperament({ honesty: 0.9 }), ['deceive']), [{ value: -2, reason: 'A poor liar' }]);
  });

  test('several situations can apply at once', () => {
    const proudCoward = temperament({ pride: 0.9, courage: 0.2 });
    assert.deepEqual(temperamentModifiers(proudCoward, ['hold-nerve', 'resist-intimidation']).map((m) => m.value), [-2, 2]);
  });

  test('a middling man is neither helped nor hindered', () => {
    for (const s of SITUATIONS) assert.deepEqual(temperamentModifiers(temperament({}), [s]), [], s);
  });
});

describe('rolled temperaments', { tags: ['property'] }, () => {
  test('always lie between 0 and 1, to two places', () => {
    fc.assert(
      fc.property(fc.integer(), fc.double({ min: 0, max: 1, noNaN: true }), (seed, lean) => {
        const t = rollTemperament(roller(seeded(seed)), { greed: lean });
        return TRAITS.every((k) => t[k] >= 0 && t[k] <= 1 && Number(t[k].toFixed(2)) === t[k]);
      }),
    );
  });

  test('the same seed gives the same man', () => {
    assert.deepEqual(rollTemperament(roller(seeded(5))), rollTemperament(roller(seeded(5))));
  });

  test('cluster around their leanings', () => {
    const r = roller(seeded(9));
    const rolls = Array.from({ length: 2000 }, () => rollTemperament(r, { violence: 0.85, caution: 0.15 }));
    const avg = (k: 'violence' | 'caution' | 'greed') => rolls.reduce((s, t) => s + t[k], 0) / rolls.length;
    assert.ok(avg('violence') > 0.75, `violence averaged ${avg('violence')}`);
    assert.ok(avg('caution') < 0.25, `caution averaged ${avg('caution')}`);
    assert.ok(Math.abs(avg('greed') - 0.5) < 0.03, `greed averaged ${avg('greed')}`);
  });
});
