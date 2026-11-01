import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { createCharacter } from '../src/character';
import { runContest, type ContestSpec } from '../src/contest';
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
      'D loses: failed a nerve check and gave up.',
    ]);
  });

  test('describes a tied round and the defender gaining', () => {
    assert.equal(log(spec(), 8, 10)[0], 'Round 1 (Intimidation): A rolled 10, D rolled 10. No change; level.');
    assert.equal(log(spec({ winningLead: 8 }), 1, 15)[0], 'Round 1 (Intimidation): A rolled 3, D rolled 15. D gains 3; D leads by 3.');
  });

  test('describes weapon-drawn checks and escalation', () => {
    assert.equal(log(spec({ approach: 'armed-threat' }), 5)[0], 'D makes a nerve check (weapon drawn on them): needed 12, rolled 5, failed.');
    assert.equal(log(spec({ maxRounds: 2, defender: defender({ temper: 0.9 }) }), 15, 10, 9, 10, 10, 1, 20)[2], 'D escalates. The contest becomes a fight.');
  });

  test('describes fight rounds: hits, critical hits, misses and the nerve check after damage', () => {
    assert.deepEqual(log(spec({ approach: 'fight' }), 15, 10, 3, 10).slice(0, 2), [
      'Round 1 (Fight): A rolled 17, D rolled 10. A hits for 3 damage (D: 5 HP left).',
      'D makes a nerve check (took damage): needed 10, rolled 10, passed.',
    ]);
    assert.equal(log(spec({ approach: 'fight' }), 20, 5, 2, 3, 20)[0], 'Round 1 (Fight): A rolled 22, D rolled 5. A lands a critical hit for 5 damage (D: 3 HP left).');
    assert.equal(log(spec({ approach: 'fight' }), 8, 10)[0], 'Round 1 (Fight): A rolled 10, D rolled 10. No hit.');
    assert.equal(log(spec({ approach: 'fight' }), 5, 15, 2, 20)[0], 'Round 1 (Fight): A rolled 7, D rolled 15. D hits for 2 damage (A: 6 HP left).');
  });
});

describe('describeEnding', { tags: ['unit'] }, () => {
  test('describes every kind of ending', () => {
    assert.equal(describeEnding({ how: 'outscored', loser: 'defender' }, spec()), 'D loses: A reached the winning lead.');
    assert.equal(describeEnding({ how: 'knocked-out', loser: 'defender' }, spec()), 'D loses: knocked out (0 HP).');
    assert.equal(describeEnding({ how: 'gives-up', loser: 'attacker' }, spec()), 'A loses: failed a nerve check and gave up.');
    assert.equal(describeEnding({ how: 'flees', loser: 'defender' }, spec()), 'D loses: failed a nerve check and fled.');
    assert.equal(describeEnding({ how: 'withdraws', loser: 'attacker' }, spec()), 'A loses: withdrew after falling too far behind.');
    assert.equal(describeEnding({ how: 'stalemate', loser: null }, spec()), 'Stalemate: the round limit was reached with no winner.');
  });
});
