import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { resolveCheck, resolveOpposed } from '../src/check';
import { DICE } from '../src/dice';
import { describeCheck, describeOpposed, describeRoll, percent, signed } from '../src/explain';
import { scripted } from './support';

describe('explain', { tags: ['unit'] }, () => {
  test('signed prefixes + or −', () => {
    assert.deepEqual([3, 0, -2].map(signed), ['+3', '+0', '−2']);
  });

  test('percent shows <1% and >99% instead of rounding to 0% or 100%', () => {
    assert.deepEqual([0, 0.001, 0.25, 0.6249, 0.996, 1].map(percent), ['0%', '<1%', '25%', '62%', '>99%', '100%']);
  });

  test('describeRoll lists the faces and each modifier with its reason', () => {
    const { roll } = resolveCheck(
      { dice: DICE['3d6'], edge: 'none', modifiers: [{ value: 3, reason: 'Charisma 16' }, { value: -2, reason: 'Outnumbered' }], dc: 12 },
      scripted(2, 5, 6),
    );
    assert.equal(describeRoll(roll), '3d6 [2 5 6] = 13, +3 Charisma 16, −2 Outnumbered: 14');
  });

  test('describeRoll shows both throws and the kept total with advantage', () => {
    const { roll } = resolveCheck({ dice: DICE.d20, edge: 'advantage', modifiers: [], dc: 10 }, scripted(4, 17));
    assert.equal(describeRoll(roll), 'd20 with advantage [4] [17] keeps 17: 17');
  });

  test('describeCheck includes the DC, outcome and margin', () => {
    const result = resolveCheck({ dice: DICE.d20, edge: 'none', modifiers: [{ value: 5, reason: 'Skill' }], dc: 15 }, scripted(12));
    assert.equal(describeCheck(result), 'd20 [12] = 12, +5 Skill: 17 against 15: partial (by 2)');
  });

  test('describeOpposed includes both rolls, outcome and margin', () => {
    const result = resolveOpposed(
      { active: { dice: DICE.d20, edge: 'none', modifiers: [] }, passive: { dice: DICE.d20, edge: 'none', modifiers: [] } },
      scripted(8, 15),
    );
    assert.equal(describeOpposed(result), 'd20 [8] = 8: 8 against d20 [15] = 15: 15: critical-failure (short by 8)');
  });
});
