import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { createCharacter } from '../src/character';
import { DICE } from '../src/dice';
import { NERVE_DC, runContest, type ContestSpec } from '../src/contest';
import { describeEnding, describeEvent, describeLead } from '../src/contest-log';
import { temperament } from '../src/temperament';
import { scripted } from './support';

const attacker = createCharacter({ name: 'A', training: { intimidation: 'trained', brawling: 'trained' } });
const defender = (t: Parameters<typeof temperament>[0] = {}) => createCharacter({ name: 'D', temperament: temperament(t) });
const spec = (over: Partial<ContestSpec> = {}): ContestSpec => ({ attacker, defender: defender(), approach: 'intimidation', winningLead: 4, maxRounds: 1, ...over });
const log = (s: ContestSpec, ...faces: number[]) => runContest(s, scripted(...faces)).events.map((e) => describeEvent(e, s));

describe('describeLead', { tags: ['unit'] }, () => {
  test('names the side ahead, or says level', () => {
    assert.equal(describeLead(2, spec()), 'A leads by 2');
    assert.equal(describeLead(-3, spec()), 'D leads by 3');
    assert.equal(describeLead(0, spec()), 'level');
  });
});

describe('describeEvent', { tags: ['unit'] }, () => {
  test('describes rounds, nerve checks and the ending', () => {
    assert.deepEqual(log(spec(), 15, 10, 9), [
      'Round 1 (Intimidation): A rolled 17, D rolled 10. A gains 2; A leads by 2.',
      'D makes a nerve check (fell behind by half the winning lead): needed 10, rolled 9, failed.',
      'D loses: failed a nerve check and complied.',
    ]);
  });

  test('describes a tied round and the defender gaining', () => {
    assert.equal(log(spec(), 8, 10)[0], 'Round 1 (Intimidation): A rolled 10, D rolled 10. No change; level.');
    assert.equal(log(spec({ winningLead: 8 }), 1, 15)[0], 'Round 1 (Intimidation): A rolled 3, D rolled 15. D gains 3; D leads by 3.');
  });

  test('describes weapon-drawn checks and escalation', () => {
    assert.equal(log(spec({ approach: 'armed-threat' }), 5)[0], 'D makes a nerve check (weapon drawn on them): needed 12, rolled 5, failed.');
    assert.equal(log(spec({ maxRounds: 2, defender: defender({ temper: 0.9 }) }), 15, 10, 9, 10, 10, 1, 1)[2], 'D escalates. The contest becomes a fight.');
  });

  test('describes initiative, hits and misses in a fight', () => {
    assert.deepEqual(log(spec({ approach: 'fight' }), 15, 10, 8, 3, 9), [
      'A acts first (Reflexes: A rolled 15, D rolled 10).',
      'Round 1: A attacks D: rolled 10 against Defence 10. Hit for 3 damage (D: 7 HP left).',
      'Round 1: D attacks A: rolled 9 against Defence 10. Miss.',
      'Stalemate: the round limit was reached with no winner.',
    ]);
  });

  test('describes the highest and lowest possible rolls on other dice', () => {
    assert.deepEqual(log(spec({ approach: 'fight', dice: DICE['3d6'] }), 4, 4, 4, 3, 3, 3, 6, 6, 6, 1, 1, 1, 1, 1).slice(1, 3), [
      'Round 1: A attacks D: rolled 20 against Defence 10 (highest possible roll). Critical hit for 2 damage (D: 8 HP left).',
      'Round 1: D attacks A: rolled 3 against Defence 10 (lowest possible roll). Miss.',
    ]);
  });

  test('describes natural 20s, natural 1s and the nerve check at half hit points', () => {
    assert.deepEqual(log(spec({ approach: 'fight' }), 15, 10, 20, 2, 3, 20, 1).slice(1, 4), [
      'Round 1: A attacks D: rolled 22 against Defence 10 (natural 20). Critical hit for 5 damage (D: 5 HP left).',
      `D makes a nerve check (dropped to half hit points): needed ${NERVE_DC.hurt}, rolled 20, passed.`,
      'Round 1: D attacks A: rolled 1 against Defence 10 (natural 1). Miss.',
    ]);
  });
});

describe('describeEnding', { tags: ['unit'] }, () => {
  test('describes every kind of ending', () => {
    assert.equal(describeEnding({ how: 'outscored', loser: 'defender' }, spec()), 'D loses: A reached the winning lead.');
    assert.equal(describeEnding({ how: 'knocked-out', loser: 'defender' }, spec()), 'D loses: knocked out (0 HP).');
    assert.equal(describeEnding({ how: 'surrenders', loser: 'defender' }, spec()), 'D loses: failed a nerve check and surrendered.');
    assert.equal(describeEnding({ how: 'backs-off', loser: 'attacker' }, spec()), 'A loses: failed a nerve check and backed off.');
    assert.equal(describeEnding({ how: 'complies', loser: 'defender' }, spec()), 'D loses: failed a nerve check and complied.');
    assert.equal(describeEnding({ how: 'backs-down', loser: 'attacker' }, spec()), 'A loses: failed a nerve check and backed down.');
    assert.equal(describeEnding({ how: 'flees', loser: 'defender' }, spec()), 'D loses: failed a nerve check and fled.');
    assert.equal(describeEnding({ how: 'withdraws', loser: 'attacker' }, spec()), 'A loses: withdrew after falling too far behind.');
    assert.equal(describeEnding({ how: 'stalemate', loser: null }, spec()), 'Stalemate: the round limit was reached with no winner.');
  });
});
