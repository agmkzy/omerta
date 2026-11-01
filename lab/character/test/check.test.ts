import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import {
  OUTCOMES,
  checkOdds,
  combineEdges,
  grade,
  opposedOdds,
  resolveCheck,
  resolveOpposed,
  succeeded,
  type Bands,
  type Odds,
  type Roll,
} from '../src/check';
import { DICE, DICE_NAMES, EDGES } from '../src/dice';
import { roller, seeded } from '../src/random';
import { scripted } from './support';

const close = (actual: number, expected: number, tolerance = 1e-12) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
const chanceOfSuccess = (odds: Odds) => odds.partial + odds.success + odds.triumph;

const plain = (...values: number[]): Roll => ({ dice: DICE.d20, edge: 'none', modifiers: values.map((value, i) => ({ value, reason: `m${i}` })) });

describe('grading a margin', { tags: ['unit'] }, () => {
  test('meeting the target is a success with a cost; beating it well is clean; far past it is a triumph', () => {
    assert.deepEqual(
      [-9, -6, -5, -1, 0, 4, 5, 9, 10, 15].map((m) => grade(m)),
      ['botch', 'botch', 'failure', 'failure', 'partial', 'partial', 'success', 'success', 'triumph', 'triumph'],
    );
  });

  test('the bands can be moved', () => {
    const generous: Bands = { triumph: 6, success: 2, partial: -1, failure: -8 };
    assert.deepEqual([-9, -8, -2, -1, 2, 6].map((m) => grade(m, generous)), ['botch', 'failure', 'failure', 'partial', 'success', 'triumph']);
  });

  test('bands out of order are refused', () => {
    assert.throws(() => grade(0, { triumph: 5, success: 5, partial: 0, failure: -5 }), RangeError);
    assert.throws(() => grade(0, { triumph: 10, success: 5, partial: 0, failure: 1 }), RangeError);
  });

  test('a partial or better counts as getting it done', () => {
    assert.deepEqual(OUTCOMES.map(succeeded), [false, false, true, true, true]);
  });
});

describe('a check against a difficulty', { tags: ['unit'] }, () => {
  test('adds the modifiers to the dice and grades the margin', () => {
    const result = resolveCheck(
      {
        dice: DICE.d20,
        edge: 'none',
        modifiers: [
          { value: 3, reason: 'Presence 16' },
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
    assert.deepEqual(result.roll.modifiers.map((m) => m.reason), ['Presence 16', 'Trained in Intimidation']);
  });

  test('rolls with its edge', () => {
    const result = resolveCheck({ ...plain(), edge: 'disadvantage', dc: 10 }, scripted(18, 3));
    assert.equal(result.roll.thrown.kept, 3);
    assert.equal(result.outcome, 'botch');
  });

  test('uses the bands it is given', () => {
    assert.equal(resolveCheck({ ...plain(), dc: 10, bands: { triumph: 1, success: 0, partial: -1, failure: -2 } }, scripted(11)).outcome, 'triumph');
  });
});

describe('an opposed check', { tags: ['unit'] }, () => {
  test('the active side must beat the other’s total; a tie leaves things as they were', () => {
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

describe('edges from several sources', { tags: ['unit'] }, () => {
  test('do not stack, and advantage and disadvantage cancel, as in D&D', () => {
    assert.equal(combineEdges([]), 'none');
    assert.equal(combineEdges(['advantage', 'advantage']), 'advantage');
    assert.equal(combineEdges(['disadvantage', 'none']), 'disadvantage');
    assert.equal(combineEdges(['advantage', 'advantage', 'disadvantage']), 'none');
  });
});

describe('the odds of a check', { tags: ['unit'] }, () => {
  test('a d20 with no bonus against 11 is a coin toss', () => {
    close(chanceOfSuccess(checkOdds({ ...plain(), dc: 11 })), 0.5);
  });

  test('each outcome’s share on a d20 against 11', () => {
    const odds = checkOdds({ ...plain(), dc: 11 });
    // margin = face - 11, from -10 to 9
    close(odds.botch, 5 / 20); // -10..-6
    close(odds.failure, 5 / 20); // -5..-1
    close(odds.partial, 5 / 20); // 0..4
    close(odds.success, 5 / 20); // 5..9
    close(odds.triumph, 0);
  });

  test('on a flat d20, a novice beats a master (+11) about one time in eleven', () => {
    // The novice must beat the master's total: novice face − master face ≥ 12, which 36 of the 400 pairs of faces manage.
    close(chanceOfSuccess(opposedOdds({ active: plain(0), passive: plain(11) })), 36 / 400);
  });

  test('on 3d6 the same novice almost never does', () => {
    const roll3d6 = (bonus: number): Roll => ({ ...plain(bonus), dice: DICE['3d6'] });
    assert.ok(chanceOfSuccess(opposedOdds({ active: roll3d6(0), passive: roll3d6(11) })) < 0.01);
  });
});

describe('odds', { tags: ['property'] }, () => {
  const roll = fc.record({
    dice: fc.constantFrom(...DICE_NAMES).map((n) => DICE[n]),
    edge: fc.constantFrom(...EDGES),
    modifiers: fc.array(fc.record({ value: fc.integer({ min: -5, max: 10 }), reason: fc.string() }), { maxLength: 4 }),
  });
  const dc = fc.integer({ min: -5, max: 35 });

  test('cover every outcome exactly once', () => {
    fc.assert(fc.property(roll, dc, (r, d) => Math.abs(OUTCOMES.reduce((s, o) => s + checkOdds({ ...r, dc: d })[o], 0) - 1) < 1e-9));
  });

  test('a bigger bonus never lowers the chance of success', () => {
    fc.assert(
      fc.property(roll, dc, (r, d) => {
        const better = { ...r, modifiers: [...r.modifiers, { value: 1, reason: 'better' }] };
        return chanceOfSuccess(checkOdds({ ...better, dc: d })) >= chanceOfSuccess(checkOdds({ ...r, dc: d })) - 1e-12;
      }),
    );
  });

  test('an opposed check is fair between equals except for the tie', () => {
    fc.assert(
      fc.property(roll, (r) => {
        const odds = opposedOdds({ active: r, passive: r });
        return chanceOfSuccess(odds) < 0.5;
      }),
    );
  });

  test('agree with what the dice turn up', () => {
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
    assert.ok(Math.abs(wins / 40_000 - chanceOfSuccess(odds)) < 0.01);
  });
});
