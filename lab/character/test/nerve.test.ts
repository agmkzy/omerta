import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { createCharacter } from '../src/character';
import { DICE } from '../src/dice';
import { NERVE_DC, NERVE_FAILURE, nerveCheck, otherSide } from '../src/nerve';
import { temperament } from '../src/temperament';
import { scripted } from './support';

// Nerve +0 and average temperament unless stated.
const average = createCharacter({ name: 'Average' });
const withTemperament = (t: Parameters<typeof temperament>[0]) => createCharacter({ name: 'T', temperament: temperament(t) });
const check = (c = average, face = 9, canFightBack = false) => nerveCheck(c, 'hurt', canFightBack, DICE.d20, scripted(face));

describe('nerveCheck', { tags: ['unit'] }, () => {
  test('passes when d20 + Nerve meets the DC for the trigger', () => {
    const r = check(average, 10);
    assert.equal(r.passed, true);
    assert.equal(r.response, null);
    assert.equal(r.result.dc, NERVE_DC.hurt);
    assert.equal(nerveCheck(average, 'weapon-drawn', false, DICE.d20, scripted(11)).result.dc, 12);
  });

  test('applies temperament modifiers for holding nerve', () => {
    assert.ok(check(withTemperament({ courage: 0.9 }), 8).passed); // 8 + 2
  });

  test('on a failure, an average character yields', () => {
    assert.equal(check(average, 9).response, 'yields');
  });

  test('on a failure, a timid or cautious character flees', () => {
    assert.equal(check(withTemperament({ courage: 0.1 }), 11).response, 'flees'); // 11 − 2
    assert.equal(check(withTemperament({ caution: 0.9 }), 9).response, 'flees');
  });

  test('on a failure, a hot-tempered character fights back, where that is possible', () => {
    assert.equal(check(withTemperament({ temper: 0.9 }), 9, true).response, 'fights');
    assert.equal(check(withTemperament({ temper: 0.9 }), 9, false).response, 'yields');
  });
});

describe('nerve helpers', { tags: ['unit'] }, () => {
  test('otherSide swaps attacker and defender', () => {
    assert.equal(otherSide('attacker'), 'defender');
    assert.equal(otherSide('defender'), 'attacker');
  });

  test('NERVE_FAILURE describes the traits that decide a failed nerve check', () => {
    assert.deepEqual(Object.keys(NERVE_FAILURE).sort(), ['caution', 'courage', 'temper']);
  });
});
