import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import {
  OUTCOMES,
  OUTCOME_INFO,
  checkOdds,
  combineEdges,
  grade,
  opposedOdds,
  resolveCheck,
  resolveOpposed,
  succeeded,
  passes,
  successChance,
  outcomeMargins,
  describeMargins,
  type Bands,
  type Roll,
} from '../src/check';
import { DICE, DICE_NAMES, EDGES } from '../src/dice';
import { roller, seeded } from '../src/random';
import { scripted } from './support';

const close = (actual: number, expected: number, tolerance = 1e-12) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

const plain = (...values: number[]): Roll => ({ dice: DICE.d20, edge: 'none', modifiers: values.map((value, i) => ({ value, reason: `m${i}` })) });

describe('grade', { tags: ['unit'] }, () => {
  test('maps margins to outcomes using the default bands', () => {
    assert.deepEqual(
      [-9, -6, -5, -1, 0, 4, 5, 9, 10, 15].map((m) => grade(m)),
      ['critical-failure', 'critical-failure', 'failure', 'failure', 'partial', 'partial', 'success', 'success', 'critical-success', 'critical-success'],
    );
  });

  test('uses custom bands when given', () => {
    const bands: Bands = { criticalSuccess: 6, success: 2, partial: -1, failure: -8 };
    assert.deepEqual([-9, -8, -2, -1, 2, 6].map((m) => grade(m, bands)), ['critical-failure', 'failure', 'failure', 'partial', 'success', 'critical-success']);
  });

  test('throws if the bands are not in descending order', () => {
    assert.throws(() => grade(0, { criticalSuccess: 5, success: 5, partial: 0, failure: -5 }), RangeError);
    assert.throws(() => grade(0, { criticalSuccess: 10, success: 5, partial: 0, failure: 1 }), RangeError);
  });
});

describe('OUTCOME_INFO', { tags: ['unit'] }, () => {
  test('names every outcome and says what it means', () => {
    for (const o of OUTCOMES) {
      assert.notEqual(OUTCOME_INFO[o].name, '', o);
      assert.notEqual(OUTCOME_INFO[o].effect, '', o);
    }
  });
});

describe('outcomeMargins and describeMargins', { tags: ['unit'] }, () => {
  test('give the margins of each outcome from the bands', () => {
    assert.deepEqual(OUTCOMES.map((o) => outcomeMargins(o)), [
      { min: null, max: -6 }, { min: -5, max: -1 }, { min: 0, max: 4 }, { min: 5, max: 9 }, { min: 10, max: null },
    ]);
    assert.deepEqual(OUTCOMES.map((o) => describeMargins(o)), ['6 short or worse', '5 short to 1 short', 'exactly the DC to 4 over', '5 over to 9 over', '10 over or better']);
  });

  test('follow other bands, including a range of one margin', () => {
    const bands = { criticalSuccess: 3, success: 2, partial: 1, failure: -1 };
    assert.deepEqual(OUTCOMES.map((o) => describeMargins(o, bands)), ['2 short or worse', '1 short to exactly the DC', '1 over', '2 over', '3 over or better']);
    assert.throws(() => outcomeMargins('partial', { criticalSuccess: 1, success: 1, partial: 0, failure: -1 }), RangeError);
  });
});

describe('succeeded, passes and successChance', { tags: ['unit'] }, () => {
  test('succeeded is true for partial and better', () => {
    assert.deepEqual(OUTCOMES.map(succeeded), [false, false, true, true, true]);
  });

  test('passes is true from the partial band up, whatever the bands', () => {
    assert.deepEqual([-1, 0, 1].map((m) => passes(m)), [false, true, true]);
    assert.deepEqual([1, 2].map((m) => passes(m, { criticalSuccess: 4, success: 3, partial: 2, failure: 0 })), [false, true]);
  });

  test('successChance adds the chances of partial success and better', () => {
    const odds = { 'critical-failure': 0.1, failure: 0.2, partial: 0.3, success: 0.25, 'critical-success': 0.15 };
    assert.ok(Math.abs(successChance(odds) - 0.7) < 1e-12);
  });
});

describe('resolveCheck', { tags: ['unit'] }, () => {
  test('adds the modifiers to the dice and grades the margin against the DC', () => {
    const result = resolveCheck(
      {
        dice: DICE.d20,
        edge: 'none',
        modifiers: [
          { value: 3, reason: 'Charisma 16' },
          { value: 2, reason: 'Trained in Intimidation' },
        ],
        dc: 15,
      },
      scripted(12),
    );
    assert.equal(result.roll.bonus, 5);
    assert.equal(result.roll.total, 17);
    assert.equal(result.margin, 2);
    assert.equal(result.outcome, 'partial');
    assert.deepEqual(result.roll.modifiers.map((m) => m.reason), ['Charisma 16', 'Trained in Intimidation']);
  });

  test('applies advantage or disadvantage', () => {
    const result = resolveCheck({ ...plain(), edge: 'disadvantage', dc: 10 }, scripted(18, 3));
    assert.equal(result.roll.thrown.kept, 3);
    assert.equal(result.outcome, 'critical-failure');
  });

  test('uses the bands in the spec', () => {
    assert.equal(resolveCheck({ ...plain(), dc: 10, bands: { criticalSuccess: 1, success: 0, partial: -1, failure: -2 } }, scripted(11)).outcome, 'critical-success');
  });
});

describe('resolveOpposed', { tags: ['unit'] }, () => {
  test('requires the active side to beat the passive total; a tie fails', () => {
    const tie = resolveOpposed({ active: plain(2), passive: plain(4) }, scripted(12, 10));
    assert.equal(tie.active.total, 14);
    assert.equal(tie.passive.total, 14);
    assert.equal(tie.margin, -1);
    assert.equal(tie.outcome, 'failure');

    const win = resolveOpposed({ active: plain(2), passive: plain(4) }, scripted(13, 10));
    assert.equal(win.margin, 0);
    assert.equal(win.outcome, 'partial');
  });
});

describe('combineEdges', { tags: ['unit'] }, () => {
  test('does not stack, and advantage and disadvantage cancel', () => {
    assert.equal(combineEdges([]), 'none');
    assert.equal(combineEdges(['advantage', 'advantage']), 'advantage');
    assert.equal(combineEdges(['disadvantage', 'none']), 'disadvantage');
    assert.equal(combineEdges(['advantage', 'advantage', 'disadvantage']), 'none');
  });
});

describe('checkOdds and opposedOdds', { tags: ['unit'] }, () => {
  test('d20 +0 vs DC 11 succeeds 50% of the time', () => {
    close(successChance(checkOdds({ ...plain(), dc: 11 })), 0.5);
  });

  test('d20 +0 vs DC 11 gives 25% to each of the four reachable outcomes', () => {
    const odds = checkOdds({ ...plain(), dc: 11 });
    // margin = face - 11, from -10 to 9
    close(odds['critical-failure'], 5 / 20); // -10..-6
    close(odds.failure, 5 / 20); // -5..-1
    close(odds.partial, 5 / 20); // 0..4
    close(odds.success, 5 / 20); // 5..9
    close(odds['critical-success'], 0);
  });

  test('d20: +0 beats +11 in an opposed check 36/400 of the time', () => {
    // The +0 side needs its face minus the other face to be at least 12: 36 of the 400 face pairs.
    close(successChance(opposedOdds({ active: plain(0), passive: plain(11) })), 36 / 400);
  });

  test('3d6: +0 beats +11 in an opposed check less than 1% of the time', () => {
    const roll3d6 = (bonus: number): Roll => ({ ...plain(bonus), dice: DICE['3d6'] });
    assert.ok(successChance(opposedOdds({ active: roll3d6(0), passive: roll3d6(11) })) < 0.01);
  });
});

describe('checkOdds and opposedOdds', { tags: ['property'] }, () => {
  const roll = fc.record({
    dice: fc.constantFrom(...DICE_NAMES).map((n) => DICE[n]),
    edge: fc.constantFrom(...EDGES),
    modifiers: fc.array(fc.record({ value: fc.integer({ min: -5, max: 10 }), reason: fc.string() }), { maxLength: 4 }),
  });
  const dc = fc.integer({ min: -5, max: 35 });

  test('outcome probabilities sum to 1', () => {
    fc.assert(fc.property(roll, dc, (r, d) => Math.abs(OUTCOMES.reduce((s, o) => s + checkOdds({ ...r, dc: d })[o], 0) - 1) < 1e-9));
  });

  test('a higher bonus never lowers the success chance', () => {
    fc.assert(
      fc.property(roll, dc, (r, d) => {
        const better = { ...r, modifiers: [...r.modifiers, { value: 1, reason: 'better' }] };
        return successChance(checkOdds({ ...better, dc: d })) >= successChance(checkOdds({ ...r, dc: d })) - 1e-12;
      }),
    );
  });

  test('identical rolls give the active side less than 50%, because ties fail', () => {
    fc.assert(fc.property(roll, (r) => successChance(opposedOdds({ active: r, passive: r })) < 0.5));
  });
});

describe('checkOdds and opposedOdds', { tags: ['statistical'] }, () => {
  test('match sampled frequencies from resolveCheck and resolveOpposed', () => {
    const r = roller(seeded(3));
    for (const spec of [
      { ...plain(3), dc: 14 },
      { ...plain(-1), dice: DICE['3d6'], edge: 'advantage' as const, dc: 12 },
    ]) {
      const odds = checkOdds(spec);
      const seen = Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<string, number>;
      const n = 40_000;
      for (let i = 0; i < n; i++) seen[resolveCheck(spec, r).outcome]!++;
      for (const o of OUTCOMES) assert.ok(Math.abs(seen[o]! / n - odds[o]) < 0.01, `${o}: seen ${seen[o]! / n}, expected ${odds[o]}`);
    }
    const opposed = { active: plain(2), passive: { ...plain(1), edge: 'advantage' as const } };
    const odds = opposedOdds(opposed);
    let wins = 0;
    for (let i = 0; i < 40_000; i++) if (succeeded(resolveOpposed(opposed, r).outcome)) wins++;
    assert.ok(Math.abs(wins / 40_000 - successChance(odds)) < 0.01);
  });
});
