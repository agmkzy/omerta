import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { attributeScores } from '../src/attributes';
import { BACKGROUNDS, rollCharacter, type BackgroundName } from '../src/backgrounds';
import { bonusOf, totalOf } from '../src/check';
import { createCharacter, type Character } from '../src/character';
import { DICE, type Dice } from '../src/dice';
import { runFight, type FightRollReason, type FightSpec, type RollRequest } from '../src/fight';
import { facesForResult, resultOf, stepFight, withoutLastRoll, type FightStep } from '../src/fight-step';
import { NERVE_DC } from '../src/nerve';
import { replay, roller, seeded } from '../src/random';
import { temperament } from '../src/temperament';
import { facesFor } from './support';

const attacker = (name = 'A') => createCharacter({ name, training: { brawling: 'trained' } });
const defender = (name = 'D'): Character => createCharacter({ name, temperament: temperament({}) });
const duel = (over: Partial<FightSpec> = {}): FightSpec => ({ attackers: [attacker()], defenders: [defender()], maxRounds: 1, ...over });
const oneAgainstTwo: FightSpec = { attackers: [attacker()], defenders: [defender('C'), defender('D')], maxRounds: 1 };

/** A roll reason's fields that tests check: who, against whom, the bonus, the DC and the dice. */
function brief(r: FightRollReason) {
  const base = { kind: r.kind, by: r.by.id, die: r.die, of: r.of };
  switch (r.kind) {
    case 'initiative':
      return { ...base, bonus: bonusOf(r.modifiers) };
    case 'target':
      return { ...base, options: r.options.map((o) => o.id) };
    case 'attack':
      return { ...base, target: r.target.id, bonus: bonusOf(r.modifiers), defence: totalOf(r.defence), edge: r.edge };
    case 'damage':
      return { ...base, target: r.target.id, bonus: bonusOf(r.modifiers), critical: r.critical };
    case 'nerve':
      return { ...base, trigger: r.trigger, bonus: bonusOf(r.modifiers), dc: r.dc };
  }
}

function waiting(s: FightSpec, faces: number[]): Extract<FightStep, { done: false }> {
  const step = stepFight(s, faces);
  if (step.done) throw new assert.AssertionError({ message: 'expected the fight to be waiting for a roll' });
  return step;
}
const asks = (s: FightSpec, ...faces: number[]) => brief(waiting(s, faces).request.reason);

describe('stepFight', { tags: ['unit'] }, () => {
  test('with no rolls yet, asks for the first initiative roll and shows everyone at full health', () => {
    const step = waiting(duel(), []);
    assert.deepEqual([step.request.sides, step.request.dice, brief(step.request.reason)], [20, DICE.d20, { kind: 'initiative', by: 'A1', die: 1, of: 1, bonus: 0 }]);
    assert.deepEqual(step.events, []);
    assert.deepEqual(step.fighters.map((f) => [f.id, f.hp, f.status]), [['A1', 10, 'fighting'], ['B1', 10, 'fighting']]);
  });

  test('asks for each roll in turn, saying what it is for, with the names and modifiers', () => {
    assert.deepEqual(asks(duel(), 15), { kind: 'initiative', by: 'B1', die: 1, of: 1, bonus: 0 });
    assert.deepEqual(asks(duel(), 15, 10), { kind: 'attack', by: 'A1', die: 1, of: 1, target: 'B1', bonus: 2, defence: 10, edge: 'none' });
    assert.deepEqual(asks(duel(), 15, 10, 8), { kind: 'damage', by: 'A1', die: 1, of: 1, target: 'B1', bonus: 0, critical: false });
    assert.deepEqual(asks(duel(), 15, 10, 8, 3), { kind: 'attack', by: 'B1', die: 1, of: 1, target: 'A1', bonus: 0, defence: 10, edge: 'none' });
    const attack = waiting(duel(), [15, 10]).request.reason;
    assert.deepEqual(attack.kind === 'attack' && [attack.by.name, attack.target.name, attack.modifiers, attack.defence], [
      'A', 'D', [{ value: 0, reason: 'Strength 10' }, { value: 2, reason: 'Trained in Brawling' }], { base: 10, modifiers: [{ value: 0, reason: 'Agility 10' }] },
    ]);
  });

  test('says which round the fight is in, 0 while rolling initiative', () => {
    assert.deepEqual([waiting(duel({ maxRounds: 2 }), []).round, waiting(duel({ maxRounds: 2 }), [15, 10]).round, waiting(duel({ maxRounds: 2 }), [15, 10, 1, 1]).round], [0, 1, 2]);
  });

  test('shows the fight so far', () => {
    const step = waiting(duel(), [15, 10, 8, 3]);
    assert.deepEqual(step.events.map((e) => e.kind), ['initiative', 'attack']);
    assert.equal(step.fighters.find((f) => f.id === 'B1')?.hp, 7);
  });

  test('asks for both throws of an attack with advantage, and for a target only when there is a choice', () => {
    assert.deepEqual(asks(oneAgainstTwo, 15, 10, 10, 2, 1, 1), { kind: 'attack', by: 'B2', die: 1, of: 2, target: 'A1', bonus: 0, defence: 10, edge: 'advantage' });
    assert.deepEqual(asks(oneAgainstTwo, 15, 10, 10), { kind: 'target', by: 'A1', die: 1, of: 1, options: ['B1', 'B2'] });
  });

  test('asks for each damage die of a critical hit, and for nerve checks with their bonus and DC', () => {
    assert.deepEqual(asks(duel(), 15, 10, 20), { kind: 'damage', by: 'A1', die: 1, of: 2, target: 'B1', bonus: 0, critical: true });
    assert.deepEqual(asks(duel(), 15, 10, 20, 2), { kind: 'damage', by: 'A1', die: 2, of: 2, target: 'B1', bonus: 0, critical: true });
    assert.deepEqual(asks(duel(), 15, 10, 20, 2, 3), { kind: 'nerve', by: 'B1', die: 1, of: 1, trigger: 'hurt', bonus: 0, dc: NERVE_DC.hurt });
  });

  test('asks for each die of a multi-dice roll, on the fight’s dice', () => {
    const step = waiting(duel({ dice: DICE['3d6'] }), [4, 4]);
    assert.deepEqual([step.request.sides, step.request.dice, brief(step.request.reason)], [6, DICE['3d6'], { kind: 'initiative', by: 'A1', die: 3, of: 3, bonus: 0 }]);
  });

  test('reports where each whole roll starts', () => {
    // Initiative (15, 10), A1's critical hit (20) and its two damage dice (2, 3), then B1's nerve check.
    assert.deepEqual(waiting(duel(), [15, 10, 20, 2, 3]).rollStarts, [0, 1, 2, 3]);
    assert.deepEqual(waiting(duel({ dice: DICE['3d6'] }), [4, 4, 4, 3, 3]).rollStarts, [0, 3]);
  });

  test('rejects a face that is not on the die', () => {
    assert.throws(() => stepFight(duel(), [21]), RangeError);
    assert.throws(() => stepFight(duel(), [1.5]), RangeError);
  });

  test('a fight that ends on a knockout is done', () => {
    const frail = createCharacter({ name: 'F', attributes: attributeScores({ con: 1 }) });
    const step = stepFight(duel({ defenders: [frail] }), [15, 10, 20, 4, 4]);
    assert.deepEqual([step.done, step.done && step.result.winner], [true, 'attacker']);
  });

  test('rethrows anything other than running out of faces', () => {
    assert.throws(() => stepFight(duel({ maxRounds: 0 }), []), RangeError);
  });
});

describe('withoutLastRoll', { tags: ['unit'] }, () => {
  test('removes the last whole roll, all its dice together', () => {
    assert.deepEqual(withoutLastRoll(duel(), [15, 10, 20, 2, 3]), [15, 10, 20]);
    assert.deepEqual(withoutLastRoll(duel({ dice: DICE['3d6'] }), [4, 4, 4, 3, 3, 3]), [4, 4, 4]);
    assert.deepEqual(withoutLastRoll(duel(), []), []);
  });

  test('from a finished fight, removes its last roll', () => {
    const faces = facesFor(duel(), { initiative: [15, 10], attack: [1, 1] });
    assert.equal(stepFight(duel(), faces).done, true);
    assert.deepEqual(withoutLastRoll(duel(), faces), [15, 10, 1]);
  });
});

describe('resultOf and facesForResult', { tags: ['unit'] }, () => {
  const named = (id: string) => ({ id, name: id });
  const attackReq = (edge: 'none' | 'advantage', dice: Dice = DICE.d20): RollRequest => ({
    sides: dice.sides, dice,
    reason: { kind: 'attack', by: named('A1'), target: named('B1'), modifiers: [], defence: { base: 10, modifiers: [] }, edge, damage: [], die: 1, of: edge === 'advantage' ? dice.count * 2 : dice.count },
  });
  const damageReq: RollRequest = { sides: 4, dice: DICE.d20, reason: { kind: 'damage', by: named('A1'), target: named('B1'), modifiers: [], critical: true, die: 1, of: 2 } };

  test('the result that counts is the total of the dice, or with advantage the higher throw', () => {
    assert.equal(resultOf(attackReq('none'), [13]), 13);
    assert.equal(resultOf(attackReq('advantage'), [4, 17]), 17);
    assert.equal(resultOf(attackReq('none', DICE['3d6']), [4, 4, 4]), 12);
    assert.equal(resultOf(attackReq('advantage', DICE['3d6']), [1, 2, 3, 6, 6, 5]), 17);
    assert.equal(resultOf(damageReq, [3, 2]), 5);
  });

  test('faces for a chosen result: split into dice, and with advantage the other throw as low as possible', () => {
    assert.deepEqual(facesForResult(attackReq('none'), 13), [13]);
    assert.deepEqual(facesForResult(attackReq('advantage'), 17), [17, 1]);
    assert.deepEqual(facesForResult(attackReq('advantage', DICE['3d6']), 12), [4, 4, 4, 1, 1, 1]);
    assert.deepEqual(facesForResult(damageReq, 5), [3, 2]);
  });
});

describe('stepFight', { tags: ['property'] }, () => {
  const party = fc.array(fc.constantFrom(...BACKGROUNDS), { minLength: 1, maxLength: 3 });
  const fightOf = fc.record({ seed: fc.integer(), a: party, d: party, dice: fc.constantFrom(DICE.d20, DICE['3d6']), maxRounds: fc.integer({ min: 1, max: 6 }) });
  const build = (c: { seed: number; a: BackgroundName[]; d: BackgroundName[]; dice: Dice; maxRounds: number }) => {
    const r = roller(seeded(c.seed));
    const spec: FightSpec = { attackers: c.a.map((b, i) => rollCharacter(`A${i}`, b, r)), defenders: c.d.map((b, i) => rollCharacter(`D${i}`, b, r)), dice: c.dice, maxRounds: c.maxRounds };
    const dice = replay([], roller(seeded(c.seed)));
    return { spec, full: runFight(spec, dice), faces: dice.faces };
  };

  test('with every roll given, finishes with the same result as runFight', () => {
    fc.assert(
      fc.property(fightOf, (c) => {
        const { spec, full, faces } = build(c);
        const step = stepFight(spec, faces);
        assert.equal(step.done, true);
        assert.deepEqual(step.done && step.result, full);
      }),
      { numRuns: 50 },
    );
  });

  test('stopped at any roll, shows the start of the same fight and waits for the roll that was made next', () => {
    fc.assert(
      fc.property(fightOf, (c) => {
        const { spec, full, faces } = build(c);
        const starts = stepFight(spec, faces).rollStarts;
        for (const [i, start] of starts.entries()) {
          const step = waiting(spec, faces.slice(0, start));
          assert.deepEqual(step.events, full.events.slice(0, step.events.length));
          assert.deepEqual(step.rollStarts, starts.slice(0, i));
          assert.equal(step.request.reason.die, 1);
        }
      }),
      { numRuns: 30 },
    );
  });
});
