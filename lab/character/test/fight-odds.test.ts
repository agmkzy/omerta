import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { attributeScores } from '../src/attributes';
import { BACKGROUNDS, rollCharacter, type BackgroundName } from '../src/backgrounds';
import { createCharacter, type Character } from '../src/character';
import { DICE, type Dice } from '../src/dice';
import { runFight, type FightSpec, type RollRequest } from '../src/fight';
import { attackHitChance, attackOdds, averageDamage, lowestHit, resultNeeded, rollOdds } from '../src/fight-odds';
import { stepFight, type FightStep } from '../src/fight-step';
import { replay, roller, seeded } from '../src/random';
import { temperament } from '../src/temperament';

const attacker = (name = 'A') => createCharacter({ name, training: { brawling: 'trained' } });
const defender = (name = 'D'): Character => createCharacter({ name, temperament: temperament({}) });
const duel = (over: Partial<FightSpec> = {}): FightSpec => ({ attackers: [attacker()], defenders: [defender()], maxRounds: 1, ...over });
const oneAgainstTwo: FightSpec = { attackers: [attacker()], defenders: [defender('C'), defender('E')], maxRounds: 1 };
const close = (actual: number | null | undefined, expected: number) => assert.ok(actual !== null && actual !== undefined && Math.abs(actual - expected) < 1e-9, `${actual} vs ${expected}`);

function requestAt(s: FightSpec, ...faces: number[]) {
  const step: FightStep = stepFight(s, faces);
  if (step.done) throw new assert.AssertionError({ message: 'expected the fight to be waiting for a roll' });
  return step.request;
}
const oddsAt = (s: FightSpec, ...faces: number[]) => rollOdds(requestAt(s, ...faces));
/** A nerve check no roll can pass. No character in a fight can be this bad, but the odds must still say so. */
const hopelessNerve: RollRequest = {
  sides: 20, dice: DICE.d20, reason: { kind: 'nerve', by: { id: 'B1', name: 'D' }, trigger: 'hurt', modifiers: [{ value: -30, reason: 'Test' }], dc: 10, die: 1, of: 1 },
};

describe('rollOdds', { tags: ['unit'] }, () => {
  test('for an attack: every result, which ones hit, the chances, the average roll and the expected damage', () => {
    const o = oddsAt(duel(), 15, 10); // A attacks at +2 against Defence 10, for 1d4
    assert.equal(o.bars.length, 20);
    assert.deepEqual([1, 7, 8, 20].map((f) => [o.bars[f - 1]?.result, o.bars[f - 1]?.total, o.bars[f - 1]?.success]), [[1, 3, false], [7, 9, false], [8, 10, true], [20, 22, true]]);
    close(o.bars[0]?.probability, 1 / 20);
    close(o.average, 12.5);
    assert.equal(o.success?.label, 'to hit');
    close(o.success?.chance, 0.65);
    close(o.critical, 0.05);
    close(o.damage?.average, 2.5);
    close(o.damage?.criticalAverage, 5);
    close(o.damage?.expected, 0.6 * 2.5 + 0.05 * 5);
  });

  test('for damage: the totals, with the minimum of 1, and their average', () => {
    const o = oddsAt(duel(), 15, 10, 8);
    assert.deepEqual(o.bars.map((b) => b.total), [1, 2, 3, 4]);
    close(o.average, 2.5);
    assert.equal(o.success, null);
    const weak = createCharacter({ name: 'W', attributes: attributeScores({ str: 3 }), training: { brawling: 'trained' } }); // −4
    const w = oddsAt(duel({ attackers: [weak] }), 15, 10, 15); // 15 − 2 = 13 hits
    assert.deepEqual(w.bars.map((b) => b.total), [1, 1, 1, 1]);
    close(w.average, 1);
  });

  test('for critical damage: the whole two-dice roll', () => {
    const o = oddsAt(duel(), 15, 10, 20);
    assert.equal(o.bars.length, 7); // 2 to 8
    close(o.average, 5);
  });

  test('for a nerve check: the chance to hold', () => {
    const o = oddsAt(duel(), 15, 10, 20, 2, 3);
    assert.deepEqual([o.success?.label, o.critical, o.damage], ['to hold', null, null]);
    close(o.success?.chance, 0.55);
  });

  test('for initiative and choosing a target: the average, and equal chances', () => {
    close(oddsAt(duel()).average, 10.5);
    assert.deepEqual(oddsAt(oneAgainstTwo, 15, 10, 10).bars.map((b) => [b.result, b.probability, b.success]), [[1, 0.5, null], [2, 0.5, null]]);
  });

  test('for an attack with advantage: the results of the higher throw', () => {
    const o = oddsAt(oneAgainstTwo, 15, 10, 10, 2, 1, 1);
    assert.equal(o.bars.length, 20);
    close(o.success?.chance, 1 - (9 / 20) ** 2);
    close(o.critical, 1 - (19 / 20) ** 2);
  });

  test('on other dice, for the whole roll', () => {
    const o = oddsAt(duel({ dice: DICE['3d6'] }), 4, 4, 4, 3, 3, 3);
    assert.equal(o.bars.length, 16); // 3 to 18
    close(o.bars.reduce((sum, b) => sum + b.probability, 0), 1);
    close(o.success?.chance, attackHitChance(DICE['3d6'], 2, 10));
  });
});

describe('resultNeeded', { tags: ['unit'] }, () => {
  test('the lowest result that succeeds, for an attack or a nerve check', () => {
    assert.equal(resultNeeded(requestAt(duel(), 15, 10)), 8);
    assert.equal(resultNeeded(requestAt(duel(), 15, 10, 20, 2, 3)), 10);
  });

  test('says when a nerve check always or never holds, and gives nothing for other rolls', () => {
    const steady = createCharacter({ name: 'Steady', attributes: attributeScores({ wis: 20 }), training: { nerve: 'expert' }, temperament: temperament({ courage: 0.9 }) }); // +11
    assert.equal(resultNeeded(requestAt(duel({ defenders: [steady] }), 15, 10, 20, 4, 4)), 'always');
    assert.equal(resultNeeded(hopelessNerve), 'never');
    assert.equal(resultNeeded(requestAt(duel())), null);
  });
});

describe('attackOdds, attackHitChance and lowestHit', { tags: ['unit'] }, () => {
  test('count the d20 faces that hit, with a natural 20 always a critical hit and a natural 1 always a miss', () => {
    close(attackHitChance(DICE.d20, 2, 10), 13 / 20); // 8 to 20
    close(attackHitChance(DICE.d20, 30, 10), 19 / 20);
    close(attackHitChance(DICE.d20, -30, 10), 1 / 20);
    const odds = attackOdds(DICE.d20, 2, 10);
    close(odds.critical, 1 / 20);
    close(odds.hit, 12 / 20);
    close(odds.miss, 7 / 20);
  });

  test('with advantage, either throw can hit', () => {
    close(attackHitChance(DICE.d20, 2, 10, 'advantage'), 1 - (7 / 20) ** 2);
  });

  test('work on other dice, using the highest and lowest possible rolls', () => {
    close(attackHitChance(DICE['3d6'], 0, 30), 1 / 216);
    close(attackHitChance(DICE['3d6'], 30, 0), 215 / 216);
  });

  test('lowestHit is the lowest result that hits: never the lowest possible roll, at most the highest', () => {
    assert.deepEqual([lowestHit(DICE.d20, 2, 10), lowestHit(DICE.d20, 30, 10), lowestHit(DICE.d20, -30, 10), lowestHit(DICE['3d6'], 0, 30)], [8, 2, 20, 18]);
  });
});

describe('averageDamage', { tags: ['unit'] }, () => {
  test('averages 1d4 (2d4 on a critical hit) plus the modifier, with the minimum of 1', () => {
    close(averageDamage(0), 2.5);
    close(averageDamage(3, true), 8);
    close(averageDamage(-2), (1 + 1 + 1 + 2) / 4);
  });
});

describe('rollOdds', { tags: ['property'] }, () => {
  const party = fc.array(fc.constantFrom(...BACKGROUNDS), { minLength: 1, maxLength: 3 });
  const fightOf = fc.record({ seed: fc.integer(), a: party, d: party, dice: fc.constantFrom(DICE.d20, DICE['2d10'], DICE['3d6']), maxRounds: fc.integer({ min: 1, max: 6 }) });

  test('agree with what the fight does with each attack and nerve check', () => {
    fc.assert(
      fc.property(fightOf, (c: { seed: number; a: BackgroundName[]; d: BackgroundName[]; dice: Dice; maxRounds: number }) => {
        const r = roller(seeded(c.seed));
        const spec: FightSpec = { attackers: c.a.map((b, i) => rollCharacter(`A${i}`, b, r)), defenders: c.d.map((b, i) => rollCharacter(`D${i}`, b, r)), dice: c.dice, maxRounds: c.maxRounds };
        const dice = replay([], roller(seeded(c.seed)));
        const full = runFight(spec, dice);
        const whole = stepFight(spec, dice.faces);
        for (const start of whole.rollStarts) {
          const step = stepFight(spec, dice.faces.slice(0, start));
          if (step.done || (step.request.reason.kind !== 'attack' && step.request.reason.kind !== 'nerve')) continue;
          // The event this roll leads to is the next one of its kind.
          const kind = step.request.reason.kind;
          const event = full.events.slice(step.events.length).find((e) => e.kind === kind);
          if (event?.kind !== 'attack' && event?.kind !== 'nerve') throw new assert.AssertionError({ message: `no ${kind} event after roll ${start}` });
          const roll = event.kind === 'attack' ? event.result.roll : event.check.result.roll;
          const bar = rollOdds(step.request).bars.find((b) => b.result === roll.thrown.kept);
          assert.equal(bar?.total, roll.total, 'the odds add the same bonus as the roll');
          assert.equal(bar?.success, event.kind === 'attack' ? event.outcome !== 'miss' : event.check.passed);
        }
      }),
      { numRuns: 40 },
    );
  });
});
