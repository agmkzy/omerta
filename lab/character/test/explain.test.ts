import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { resolveCheck, resolveOpposed } from '../src/check';
import { DICE } from '../src/dice';
import { describeCheck, describeOpposed, describeRoll, percent, signed } from '../src/explain';
import { scripted } from './support';

describe('explaining in words', { tags: ['unit'] }, () => {
  test('signed numbers', () => {
    assert.deepEqual([3, 0, -2].map(signed), ['+3', '+0', '−2']);
  });

  test('percentages never claim certainty that isn’t there', () => {
    assert.deepEqual([0, 0.001, 0.25, 0.6249, 0.996, 1].map(percent), ['0%', '<1%', '25%', '62%', '>99%', '100%']);
  });

  test('a roll shows its faces and each modifier with its reason', () => {
    const { roll } = resolveCheck(
      { dice: DICE['3d6'], edge: 'none', modifiers: [{ value: 3, reason: 'Presence 16' }, { value: -2, reason: 'He has friends here' }], dc: 12 },
      scripted(2, 5, 6),
    );
    assert.equal(describeRoll(roll), '3d6 [2 5 6] = 13, +3 Presence 16, −2 He has friends here: 14');
  });

  test('a roll with an edge shows both throws and which was kept', () => {
    const { roll } = resolveCheck({ dice: DICE.d20, edge: 'advantage', modifiers: [], dc: 10 }, scripted(4, 17));
    assert.equal(describeRoll(roll), 'd20 with advantage [4] [17] keeps 17: 17');
  });

  test('a check against a difficulty', () => {
    const result = resolveCheck({ dice: DICE.d20, edge: 'none', modifiers: [{ value: 5, reason: 'Skill' }], dc: 15 }, scripted(12));
    assert.equal(describeCheck(result), 'd20 [12] = 12, +5 Skill: 17 against 15: partial (by 2)');
  });

  test('an opposed check', () => {
    const result = resolveOpposed(
      { active: { dice: DICE.d20, edge: 'none', modifiers: [] }, passive: { dice: DICE.d20, edge: 'none', modifiers: [] } },
      scripted(8, 15),
    );
    assert.equal(describeOpposed(result), 'd20 [8] = 8: 8 against d20 [15] = 15: 15: botch (short by 8)');
  });
});
