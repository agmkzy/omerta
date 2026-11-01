import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { roller, seeded } from '../src/random';
import { SITUATIONS, SITUATION_INFO, TRAITS, TRAIT_INFO, effectsOf, leaning, notableTraits, rollTemperament, temperament, temperamentModifiers } from '../src/temperament';

describe('temperament', { tags: ['unit'] }, () => {
  test('has the game’s seven traits followed by five new ones', () => {
    assert.deepEqual(TRAITS, ['greed', 'violence', 'ambition', 'caution', 'sociability', 'vice', 'courage', 'loyalty', 'pride', 'temper', 'honesty', 'cruelty']);
    for (const t of TRAITS) assert.ok(TRAIT_INFO[t].low && TRAIT_INFO[t].high, t);
  });

  test('defaults missing traits to 0.5', () => {
    const t = temperament({ greed: 0.9 });
    assert.equal(t.greed, 0.9);
    assert.equal(t.courage, 0.5);
  });

  test('throws for values outside 0–1', () => {
    for (const bad of [-0.1, 1.1, Number.NaN]) assert.throws(() => temperament({ pride: bad }), RangeError);
  });
});

describe('descriptions', { tags: ['unit'] }, () => {
  test('every trait and situation has a description', () => {
    for (const t of TRAITS) assert.ok(TRAIT_INFO[t].description, t);
    for (const s of SITUATIONS) assert.ok(SITUATION_INFO[s].name && SITUATION_INFO[s].description, s);
  });
});

describe('effectsOf', { tags: ['unit'] }, () => {
  test('lists the roll modifiers a trait can give', () => {
    assert.deepEqual(effectsOf('courage').map((e) => [e.situation, e.when, e.value]), [['hold-nerve', 'high', 2], ['hold-nerve', 'low', -2]]);
  });

  test('is empty for a trait with no roll modifiers', () => {
    assert.deepEqual(effectsOf('greed'), []);
  });
});

describe('leaning', { tags: ['unit'] }, () => {
  test('is low at ≤ 0.3, high at ≥ 0.7, otherwise average', () => {
    assert.deepEqual([0, 0.3, 0.31, 0.5, 0.69, 0.7, 1].map(leaning), ['low', 'low', 'average', 'average', 'average', 'high', 'high']);
  });
});

describe('notableTraits', { tags: ['unit'] }, () => {
  test('lists adjectives for non-average traits, furthest from 0.5 first', () => {
    assert.deepEqual(notableTraits(temperament({ temper: 0.75, courage: 0.05, honesty: 0.5 })), ['timid', 'hot-tempered']);
    assert.deepEqual(notableTraits(temperament({})), []);
  });
});

describe('temperamentModifiers', { tags: ['unit'] }, () => {
  test('high pride gives +2 to resist intimidation', () => {
    assert.deepEqual(temperamentModifiers(temperament({ pride: 0.8 }), ['resist-intimidation']), [{ value: 2, reason: 'Proud' }]);
  });

  test('courage gives ±2 to hold nerve', () => {
    assert.deepEqual(temperamentModifiers(temperament({ courage: 0.9 }), ['hold-nerve']), [{ value: 2, reason: 'Brave' }]);
    assert.deepEqual(temperamentModifiers(temperament({ courage: 0.1 }), ['hold-nerve']), [{ value: -2, reason: 'Timid' }]);
  });

  test('high honesty gives −2 to deceive', () => {
    assert.deepEqual(temperamentModifiers(temperament({ honesty: 0.9 }), ['deceive']), [{ value: -2, reason: 'Honest' }]);
  });

  test('returns modifiers for several situations in the order given', () => {
    const t = temperament({ pride: 0.9, courage: 0.2 });
    assert.deepEqual(temperamentModifiers(t, ['hold-nerve', 'resist-intimidation']).map((m) => m.value), [-2, 2]);
  });

  test('returns nothing for an average temperament', () => {
    for (const s of SITUATIONS) assert.deepEqual(temperamentModifiers(temperament({}), [s]), [], s);
  });
});

describe('rollTemperament', { tags: ['property'] }, () => {
  test('values are in 0–1 with at most two decimal places', () => {
    fc.assert(
      fc.property(fc.integer(), fc.double({ min: 0, max: 1, noNaN: true }), (seed, centre) => {
        const t = rollTemperament(roller(seeded(seed)), { greed: centre });
        return TRAITS.every((k) => t[k] >= 0 && t[k] <= 1 && Number(t[k].toFixed(2)) === t[k]);
      }),
    );
  });

  test('is deterministic for a seed', () => {
    assert.deepEqual(rollTemperament(roller(seeded(5))), rollTemperament(roller(seeded(5))));
  });

  test('means are close to the given centres', () => {
    const r = roller(seeded(9));
    const rolls = Array.from({ length: 2000 }, () => rollTemperament(r, { violence: 0.85, caution: 0.15 }));
    const avg = (k: 'violence' | 'caution' | 'greed') => rolls.reduce((s, t) => s + t[k], 0) / rolls.length;
    assert.ok(avg('violence') > 0.75, `violence mean ${avg('violence')}`);
    assert.ok(avg('caution') < 0.25, `caution mean ${avg('caution')}`);
    assert.ok(Math.abs(avg('greed') - 0.5) < 0.03, `greed mean ${avg('greed')}`);
  });
});
