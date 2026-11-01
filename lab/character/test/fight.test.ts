import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { attributeScores } from '../src/attributes';
import { BACKGROUNDS, rollCharacter, type BackgroundName } from '../src/backgrounds';
import { createCharacter, type Character } from '../src/character';
import { DICE } from '../src/dice';
import { FIGHT_ENDING_INFO, fightEndingKey, rollDamage, runFight, tallyFights, type FightEvent, type FightSpec } from '../src/fight';
import { describeFightEnding, describeFightEvent } from '../src/fight-log';
import { NERVE_DC } from '../src/nerve';
import { roller, seeded } from '../src/random';
import { temperament } from '../src/temperament';
import { scripted } from './support';

// The attacker attacks at +2 (trained Brawling); the defender at +0. Both have Defence 10 and 10 HP (half is 5), Reflexes +0
// and average temperament unless stated. Dice order: initiative (attacker, then defender), then each attack in turn:
// attack roll, damage, any nerve check.
const attacker = createCharacter({ name: 'A', training: { brawling: 'trained' } });
const defender = (t: Parameters<typeof temperament>[0] = {}): Character => createCharacter({ name: 'D', temperament: temperament(t) });
const fight = (over: Partial<FightSpec> = {}): FightSpec => ({ attacker, defender: defender(), maxRounds: 1, ...over });
const kinds = (events: readonly FightEvent[]) => events.map((e) => e.kind);
const attacks = (events: readonly FightEvent[]) => events.filter((e) => e.kind === 'attack');

/** Runs a fight on scripted faces and checks that every face was used. */
function run(s: FightSpec, ...faces: number[]) {
  const dice = scripted(...faces);
  const result = runFight(s, dice);
  assert.equal(dice.remaining, 0, 'not all scripted faces were used');
  return result;
}

describe('rollDamage', { tags: ['unit'] }, () => {
  test('is 1d4 plus the Strength modifier', () => {
    const strong = createCharacter({ name: 'S', attributes: attributeScores({ str: 16 }) });
    assert.deepEqual(rollDamage(strong, false, scripted(2)), { faces: [2], modifier: 3, total: 5 });
  });

  test('rolls the dice twice on a critical hit', () => {
    assert.deepEqual(rollDamage(attacker, true, scripted(3, 4)), { faces: [3, 4], modifier: 0, total: 7 });
  });

  test('is at least 1', () => {
    const weak = createCharacter({ name: 'W', attributes: attributeScores({ str: 3 }) });
    assert.equal(rollDamage(weak, false, scripted(1)).total, 1);
  });
});

describe('runFight', { tags: ['unit'] }, () => {
  test('starts with initiative: both roll Reflexes and the higher acts first; a tie goes to the defender', () => {
    const order = (faces: number[]) => {
      const r = run(fight(), ...faces, 1, 1);
      const e = r.events[0];
      assert.ok(e?.kind === 'initiative');
      return [e.first, ...attacks(r.events).map((a) => (a.kind === 'attack' ? a.by : ''))];
    };
    assert.deepEqual(order([15, 10]), ['attacker', 'attacker', 'defender']);
    assert.deepEqual(order([5, 15]), ['defender', 'defender', 'attacker']);
    assert.deepEqual(order([10, 10]), ['defender', 'defender', 'attacker']);
  });

  test('each side starts with its maximum hit points', () => {
    const r = run(fight(), 15, 10, 1, 1);
    assert.deepEqual(r.maxHp, { attacker: 10, defender: 10 });
    assert.deepEqual(r.hp, { attacker: 10, defender: 10 });
  });

  test('an attack hits when d20 + Brawling meets the target’s Defence, for 1d4 + Strength modifier', () => {
    const r = run(fight(), 15, 10, 8, 3, 9); // attacker: 8 + 2 = 10 vs 10, hit for 3; defender: 9 vs 10, miss
    const [mine, theirs] = attacks(r.events);
    assert.ok(mine?.kind === 'attack' && mine.hit && mine.result.dc === 10 && mine.damage?.total === 3 && !mine.critical);
    assert.ok(theirs?.kind === 'attack' && !theirs.hit && theirs.damage === null);
    assert.equal(r.hp.defender, 7);
  });

  test('Defence includes the target’s Reflexes', () => {
    const nimble = createCharacter({ name: 'Nimble', training: { reflexes: 'trained' } }); // Defence 12
    const mine = attacks(run(fight({ defender: nimble }), 15, 10, 9, 1).events)[0]; // 9 + 2 = 11 vs 12
    assert.ok(mine?.kind === 'attack' && mine.result.dc === 12 && !mine.hit);
  });

  test('both sides can hit in the same round', () => {
    assert.deepEqual(run(fight(), 15, 10, 15, 2, 15, 3).hp, { attacker: 7, defender: 8 });
  });

  test('a natural 20 is a critical hit: the damage dice are rolled twice', () => {
    const r = run(fight(), 15, 10, 20, 4, 4, 20, 1); // 8 damage leaves 2 HP, so a nerve check follows
    const mine = attacks(r.events)[0];
    assert.ok(mine?.kind === 'attack' && mine.critical && mine.damage?.total === 8);
    assert.equal(r.hp.defender, 2);
  });

  test('a natural 1 always misses', () => {
    const brute = createCharacter({ name: 'Brute', attributes: attributeScores({ str: 20 }), training: { brawling: 'expert' } }); // +9
    const mine = attacks(run(fight({ attacker: brute }), 15, 10, 1, 1).events)[0];
    assert.ok(mine?.kind === 'attack' && mine.result.roll.total === 10 && !mine.hit);
  });

  test('a knocked-out character does not get to attack', () => {
    const frail = createCharacter({ name: 'Frail', attributes: attributeScores({ con: 1 }) }); // 5 HP
    const r = run(fight({ defender: frail }), 15, 10, 20, 4, 4);
    assert.deepEqual(kinds(r.events), ['initiative', 'attack', 'end']);
    assert.deepEqual(r.ending, { how: 'knocked-out', loser: 'defender' });
  });

  test('no nerve check while above half hit points', () => {
    assert.deepEqual(kinds(run(fight(), 15, 10, 15, 4, 1).events), ['initiative', 'attack', 'attack', 'end']); // 10 → 6 HP
  });

  test('the first time a character drops to half hit points or below, they make one DC 10 nerve check', () => {
    // Round 1: hit for 4 (10 → 6). Round 2: hit for 1 (→ 5, half): the check passes. Round 3: hit for 1 (→ 4): no check.
    const r = run(fight({ maxRounds: 3 }), 15, 10, 15, 4, 1, 15, 1, 10, 1, 15, 1, 1);
    assert.deepEqual(kinds(r.events), ['initiative', 'attack', 'attack', 'attack', 'nerve', 'attack', 'attack', 'attack', 'end']);
    const nerve = r.events.find((e) => e.kind === 'nerve');
    assert.ok(nerve?.kind === 'nerve' && nerve.check.trigger === 'hurt' && nerve.check.result.dc === 10 && nerve.check.passed);
  });

  test('being hurt carries no roll penalty', () => {
    const r = run(fight({ maxRounds: 2 }), 15, 10, 20, 2, 3, 20, 1, 1, 15, 1);
    for (const e of r.events) {
      if (e.kind === 'attack') assert.deepEqual(e.result.roll.modifiers.filter((m) => m.value < 0), []);
      if (e.kind === 'nerve') assert.deepEqual(e.check.result.roll.modifiers.filter((m) => m.value < 0), []);
    }
  });

  test('a defender who fails the nerve check surrenders; an attacker backs off', () => {
    assert.deepEqual(run(fight(), 15, 10, 20, 2, 3, 1).ending, { how: 'surrenders', loser: 'defender' });
    assert.deepEqual(run(fight(), 5, 15, 20, 2, 3, 1).ending, { how: 'backs-off', loser: 'attacker' });
  });

  test('a timid character flees; a hot-tempered one does not fight harder, it surrenders', () => {
    assert.deepEqual(run(fight({ defender: defender({ courage: 0.1 }) }), 15, 10, 20, 2, 3, 9).ending, { how: 'flees', loser: 'defender' });
    assert.deepEqual(run(fight({ defender: defender({ temper: 0.9 }) }), 15, 10, 20, 2, 3, 1).ending, { how: 'surrenders', loser: 'defender' });
  });

  test('reaching 0 hit points is a knockout', () => {
    const r = run(fight({ maxRounds: 3 }), 15, 10, 20, 4, 4, 20, 1, 15, 4);
    assert.deepEqual(r.ending, { how: 'knocked-out', loser: 'defender' });
    assert.equal(r.rounds, 2);
  });

  test('ends in a stalemate after maxRounds', () => {
    assert.deepEqual(run(fight({ maxRounds: 2 }), 15, 10, 1, 1, 1, 1).ending, { how: 'stalemate', loser: null });
  });

  test('defaults to d20 and 12 rounds, and rejects an invalid round limit', () => {
    assert.ok(runFight({ attacker, defender: defender() }, roller(seeded(1))).rounds <= 12);
    assert.throws(() => runFight(fight({ maxRounds: 0 }), scripted()), RangeError);
  });
});

describe('fight endings', { tags: ['unit'] }, () => {
  test('FIGHT_ENDING_INFO explains every ending', () => {
    for (const how of ['knocked-out', 'surrenders', 'backs-off', 'flees', 'stalemate'] as const)
      assert.ok(FIGHT_ENDING_INFO[how].title && FIGHT_ENDING_INFO[how].explanation, how);
  });

  test('fightEndingKey names the ending and who lost', () => {
    assert.equal(fightEndingKey({ how: 'flees', loser: 'attacker' }), 'flees:attacker');
    assert.equal(fightEndingKey({ how: 'stalemate', loser: null }), 'stalemate');
  });

  test('tallyFights counts endings and the counts sum to the number of runs', () => {
    const t = tallyFights(fight({ maxRounds: 12 }), roller(seeded(2)), 200);
    assert.equal(Object.values(t).reduce((a, b) => a + b, 0), 200);
  });
});

describe('describeFightEvent', { tags: ['unit'] }, () => {
  const log = (s: FightSpec, ...faces: number[]) => runFight(s, scripted(...faces)).events.map((e) => describeFightEvent(e, s));

  test('describes initiative, hits, misses and stalemate', () => {
    assert.deepEqual(log(fight(), 15, 10, 8, 3, 9), [
      'A acts first (Reflexes: A rolled 15, D rolled 10).',
      'Round 1: A attacks D: rolled 10 against Defence 10. Hit for 3 damage (D: 7 HP left).',
      'Round 1: D attacks A: rolled 9 against Defence 10. Miss.',
      'Stalemate: the round limit was reached with no winner.',
    ]);
  });

  test('describes natural 20s, natural 1s and the nerve check', () => {
    assert.deepEqual(log(fight(), 15, 10, 20, 2, 3, 20, 1).slice(1, 4), [
      'Round 1: A attacks D: rolled 22 against Defence 10 (natural 20). Critical hit for 5 damage (D: 5 HP left).',
      `D has dropped to half hit points and makes a nerve check: needed ${NERVE_DC.hurt}, rolled 20, passed.`,
      'Round 1: D attacks A: rolled 1 against Defence 10 (natural 1). Miss.',
    ]);
  });

  test('describes a failed nerve check', () => {
    assert.equal(log(fight(), 15, 10, 20, 2, 3, 1)[2], `D has dropped to half hit points and makes a nerve check: needed ${NERVE_DC.hurt}, rolled 1, failed.`);
  });

  test('describes the highest and lowest possible rolls on other dice', () => {
    assert.deepEqual(log(fight({ dice: DICE['3d6'] }), 4, 4, 4, 3, 3, 3, 6, 6, 6, 1, 1, 1, 1, 1).slice(1, 3), [
      'Round 1: A attacks D: rolled 20 against Defence 10 (highest possible roll). Critical hit for 2 damage (D: 8 HP left).',
      'Round 1: D attacks A: rolled 3 against Defence 10 (lowest possible roll). Miss.',
    ]);
  });

  test('describes every ending', () => {
    const s = fight();
    assert.equal(describeFightEnding({ how: 'knocked-out', loser: 'defender' }, s), 'D loses: knocked out (0 HP).');
    assert.equal(describeFightEnding({ how: 'surrenders', loser: 'defender' }, s), 'D loses: failed a nerve check and surrendered.');
    assert.equal(describeFightEnding({ how: 'backs-off', loser: 'attacker' }, s), 'A loses: failed a nerve check and backed off.');
    assert.equal(describeFightEnding({ how: 'flees', loser: 'defender' }, s), 'D loses: failed a nerve check and fled.');
  });
});

describe('runFight', { tags: ['property'] }, () => {
  const fightOf = fc.record({ seed: fc.integer(), a: fc.constantFrom(...BACKGROUNDS), d: fc.constantFrom(...BACKGROUNDS), maxRounds: fc.integer({ min: 1, max: 20 }) });
  const build = (c: { seed: number; a: BackgroundName; d: BackgroundName; maxRounds: number }): FightSpec => {
    const r = roller(seeded(c.seed));
    return { attacker: rollCharacter('A', c.a, r), defender: rollCharacter('D', c.d, r), maxRounds: c.maxRounds };
  };

  test('ends within maxRounds with exactly one end event, which is last', () => {
    fc.assert(
      fc.property(fightOf, (c) => {
        const r = runFight(build(c), roller(seeded(c.seed)));
        return r.rounds <= c.maxRounds && r.events.filter((e) => e.kind === 'end').length === 1 && r.events.at(-1)?.kind === 'end';
      }),
    );
  });

  test('keeps hit points between 0 and the maximum', () => {
    fc.assert(
      fc.property(fightOf, (c) => {
        const r = runFight(build(c), roller(seeded(c.seed)));
        return (['attacker', 'defender'] as const).every((side) => r.hp[side] >= 0 && r.hp[side] <= r.maxHp[side]);
      }),
    );
  });

  test('is deterministic for a seed', () => {
    fc.assert(fc.property(fightOf, (c) => assert.deepEqual(runFight(build(c), roller(seeded(c.seed))), runFight(build(c), roller(seeded(c.seed))))));
  });

  test('a fighter beats an accountant more often than the reverse', () => {
    const r = roller(seeded(8));
    const wins = (a: BackgroundName, d: BackgroundName) => {
      let n = 0;
      for (let i = 0; i < 300; i++) if (runFight({ attacker: rollCharacter('A', a, r), defender: rollCharacter('D', d, r) }, r).ending.loser === 'defender') n++;
      return n;
    };
    assert.ok(wins('fighter', 'accountant') > wins('accountant', 'fighter') + 60);
  });
});
