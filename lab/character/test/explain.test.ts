import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { resolveCheck, resolveOpposed } from '../src/check';
import { DICE, type Dice } from '../src/dice';
import { compactRoll, describeCheck, describeOpposed, describeRoll, describeTotal, percent, signed } from '../src/explain';
import { scripted } from './support';

describe('explain', { tags: ['unit'] }, () => {
  test('signed prefixes + or −', () => {
    assert.deepEqual([3, 0, -2].map(signed), ['+3', '+0', '−2']);
  });

  test('percent shows <1% and >99% instead of rounding to 0% or 100%', () => {
    assert.deepEqual([0, 0.001, 0.25, 0.6249, 0.996, 1].map(percent), ['0%', '<1%', '25%', '62%', '>99%', '100%']);
  });

  test('describeTotal lists the base, then each modifier with its reason', () => {
    assert.equal(describeTotal({ base: 10, modifiers: [{ value: -1, reason: 'Agility 9' }, { value: 2, reason: 'Trained in Reflexes' }] }), '10 base, −1 Agility 9, +2 Trained in Reflexes');
    assert.equal(describeTotal({ base: 10, modifiers: [] }), '10 base');
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

  test('compactRoll shows the faces, the total bonus and the result', () => {
    const roll = (dice: Dice, edge: 'none' | 'advantage', bonus: number, ...faces: number[]) =>
      resolveCheck({ dice, edge, modifiers: bonus ? [{ value: bonus, reason: 'x' }] : [], dc: 10 }, scripted(...faces)).roll;
    assert.equal(compactRoll(roll(DICE.d20, 'none', 6, 6)), 'd20: 6 + 6 = 12');
    assert.equal(compactRoll(roll(DICE.d20, 'none', -1, 14)), 'd20: 14 − 1 = 13');
    assert.equal(compactRoll(roll(DICE.d20, 'none', 0, 9)), 'd20: 9');
    assert.equal(compactRoll(roll(DICE['3d6'], 'none', 2, 2, 5, 6)), '3d6: 2+5+6 + 2 = 15');
    assert.equal(compactRoll(roll(DICE.d20, 'advantage', 1, 4, 17)), 'd20 with advantage: 4 or 17 → 17 + 1 = 18');
    // With no bonus: several dice are added up; one die, or advantage (which already shows what is kept), is left as it is.
    assert.equal(compactRoll(roll(DICE['3d6'], 'none', 0, 4, 4, 4)), '3d6: 4+4+4 = 12');
    assert.equal(compactRoll(roll(DICE.d20, 'advantage', 0, 4, 17)), 'd20 with advantage: 4 or 17 → 17');
    assert.equal(compactRoll(roll(DICE.d20, 'advantage', -2, 4, 17)), 'd20 with advantage: 4 or 17 → 17 − 2 = 15');
  });

  test('describeCheck includes the DC, outcome and margin', () => {
    const result = resolveCheck({ dice: DICE.d20, edge: 'none', modifiers: [{ value: 5, reason: 'Skill' }], dc: 15 }, scripted(12));
    assert.equal(describeCheck(result), 'd20 [12] = 12, +5 Skill: 17 against 15: partial success (by 2)');
    const missed = resolveCheck({ dice: DICE.d20, edge: 'none', modifiers: [], dc: 15 }, scripted(12));
    assert.equal(describeCheck(missed), 'd20 [12] = 12: 12 against 15: failure (short by 3)');
  });

  test('describeOpposed includes both rolls, outcome and margin', () => {
    const result = resolveOpposed(
      { active: { dice: DICE.d20, edge: 'none', modifiers: [] }, passive: { dice: DICE.d20, edge: 'none', modifiers: [] } },
      scripted(8, 15),
    );
    assert.equal(describeOpposed(result), 'd20 [8] = 8: 8 against d20 [15] = 15: 15: critical failure (behind by 7)');
    const lead = (a: number, p: number) => describeOpposed(resolveOpposed({ active: { dice: DICE.d20, edge: 'none', modifiers: [] }, passive: { dice: DICE.d20, edge: 'none', modifiers: [] } }, scripted(a, p)));
    assert.match(lead(15, 14), /: partial success \(ahead by 1\)$/);
    assert.match(lead(14, 14), /: failure \(a tie\)$/);
  });
});
