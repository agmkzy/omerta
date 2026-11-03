import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import type { Roll } from '../../../src/overhaul/character/check';
import { DICE } from '../../../src/overhaul/character/dice';
import { FLEES_WHEN, NERVE_FAILURE, NERVE_ROLL, nerveCheck, nerveResponse } from '../../../src/overhaul/character/nerve';
import { temperament } from '../../../src/overhaul/character/temperament';
import { scripted } from './support';

// A Nerve roll of +0 and an average temperament unless stated.
const nerve = (...values: number[]): Roll => ({ dice: DICE.d20, edge: 'none', modifiers: values.map((value) => ({ value, reason: 'x' })) });
const check = (face: number, t = temperament({}), roll = nerve()) => nerveCheck(roll, 10, t, scripted(face));

describe('nerveCheck', { tags: ['unit'] }, () => {
  test('passes when the roll meets the DC', () => {
    const r = check(10);
    assert.equal(r.passed, true);
    assert.equal(r.response, null);
    assert.equal(r.result.dc, 10);
    assert.equal(nerveCheck(nerve(), 15, temperament({}), scripted(14)).passed, false);
  });

  test('adds the roll’s modifiers', () => {
    assert.ok(check(8, temperament({}), nerve(2)).passed);
  });

  test('on a failure, an average character yields', () => {
    assert.equal(check(9).response, 'yields');
  });

  test('on a failure, a timid or cautious character flees', () => {
    assert.equal(check(9, temperament({ courage: 0.1 })).response, 'flees');
    assert.equal(check(9, temperament({ caution: 0.9 })).response, 'flees');
  });

  test('on a failure, a volatile character yields like anyone else', () => {
    // (the lab's volatile characters fought back when threatened with a weapon; weapons now modify intimidation instead)
    assert.equal(check(9, temperament({ volatility: 0.9 })).response, 'yields');
  });
});

describe('nerve rules', { tags: ['unit'] }, () => {
  test('a nerve check rolls Nerve, with the modifiers for holding nerve', () => {
    assert.deepEqual(NERVE_ROLL, { skill: 'nerve', situations: ['hold-nerve'] });
  });

  test('the response is known from temperament alone', () => {
    assert.equal(nerveResponse(temperament({ courage: 0.2, caution: 0.2 })), 'flees');
    assert.equal(nerveResponse(temperament({ courage: 0.8, caution: 0.8 })), 'flees');
    assert.equal(nerveResponse(temperament({ courage: 0.8, caution: 0.2 })), 'yields');
  });

  test('NERVE_FAILURE and FLEES_WHEN describe the rules that decide a failed nerve check', () => {
    assert.deepEqual(NERVE_FAILURE, {
      courage: 'If low: flees on a failed nerve check.',
      caution: 'If high: flees on a failed nerve check.',
    });
    assert.equal(FLEES_WHEN, 'low courage or high caution');
  });
});
