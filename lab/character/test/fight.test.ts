import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { attributeScores } from '../src/attributes';
import { BACKGROUNDS, rollCharacter, type BackgroundName } from '../src/backgrounds';
import { createCharacter, type Character } from '../src/character';
import { DICE } from '../src/dice';
import { FIGHTER_STATUSES, FIGHTER_STATUS_INFO, fightStats, rollDamage, runFight, tallyFights, type FightEvent, type FightResult, type FightSpec } from '../src/fight';
import { describeFightEvent } from '../src/fight-log';
import { NERVE_DC } from '../src/nerve';
import { roller, seeded } from '../src/random';
import { temperament } from '../src/temperament';
import { scripted } from './support';

// Attackers attack at +2 (trained Brawling); defenders at +0. Everyone has Defence 10, 10 HP (half is 5), Reflexes +0 and
// average temperament unless stated. Fighters are A1, A2… (attackers) and B1, B2… (defenders).
// Dice order: initiative (attackers, then defenders, in list order), then each turn in initiative order: the target (a
// die with one face per enemy still fighting, rolled only when there is a choice), the attack roll, damage, nerve checks.
const attacker = (name = 'A') => createCharacter({ name, training: { brawling: 'trained' } });
const defender = (t: Parameters<typeof temperament>[0] = {}, name = 'D'): Character => createCharacter({ name, temperament: temperament(t) });
const frail = (name: string) => createCharacter({ name, attributes: attributeScores({ con: 1 }) }); // 5 HP
const duel = (over: Partial<FightSpec> = {}): FightSpec => ({ attackers: [attacker()], defenders: [defender()], maxRounds: 1, ...over });
const kinds = (events: readonly FightEvent[]) => events.map((e) => e.kind);
const attacks = (events: readonly FightEvent[]) => events.filter((e) => e.kind === 'attack');
const fighter = (r: FightResult, id: string) => r.fighters.find((f) => f.id === id)!;

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
    assert.deepEqual(rollDamage(attacker(), true, scripted(3, 4)), { faces: [3, 4], modifier: 0, total: 7 });
  });

  test('is at least 1', () => {
    const weak = createCharacter({ name: 'W', attributes: attributeScores({ str: 3 }) });
    assert.equal(rollDamage(weak, false, scripted(1)).total, 1);
  });
});

describe('fightStats', { tags: ['unit'] }, () => {
  test('lists the numbers a fight uses for a character', () => {
    const c = createCharacter({
      name: 'S',
      attributes: attributeScores({ str: 16, agi: 14, con: 14, wis: 12 }),
      training: { brawling: 'trained', reflexes: 'trained' },
      temperament: temperament({ courage: 0.9 }),
    });
    assert.deepEqual(fightStats(c), { hitPoints: 12, attack: 5, defence: 14, damageDie: 4, damageModifier: 3, initiative: 4, nerve: 4 });
  });
});

describe('runFight: one against one', { tags: ['unit'] }, () => {
  test('starts with initiative: both roll Reflexes and the higher acts first; a tie goes to the defender', () => {
    const order = (faces: number[]) => {
      const r = run(duel(), ...faces, 1, 1);
      return attacks(r.events).map((a) => (a.kind === 'attack' ? a.by : ''));
    };
    assert.deepEqual(order([15, 10]), ['A1', 'B1']);
    assert.deepEqual(order([5, 15]), ['B1', 'A1']);
    assert.deepEqual(order([10, 10]), ['B1', 'A1']);
  });

  test('each fighter starts with their maximum hit points', () => {
    const r = run(duel(), 15, 10, 1, 1);
    assert.deepEqual(r.fighters.map((f) => [f.id, f.hp, f.maxHp, f.status]), [['A1', 10, 10, 'fighting'], ['B1', 10, 10, 'fighting']]);
  });

  test('an attack hits when d20 + Brawling meets the target’s Defence, for 1d4 + Strength modifier', () => {
    const r = run(duel(), 15, 10, 8, 3, 9); // A1: 8 + 2 = 10 vs 10, hit for 3; B1: 9 vs 10, miss
    const [mine, theirs] = attacks(r.events);
    assert.ok(mine?.kind === 'attack' && mine.target === 'B1' && mine.hit && mine.result.dc === 10 && mine.damage?.total === 3 && mine.hp === 7);
    assert.ok(theirs?.kind === 'attack' && !theirs.hit && theirs.damage === null);
    assert.equal(fighter(r, 'B1').hp, 7);
  });

  test('Defence includes the target’s Reflexes', () => {
    const nimble = createCharacter({ name: 'Nimble', training: { reflexes: 'trained' } }); // Defence 12
    const mine = attacks(run(duel({ defenders: [nimble] }), 15, 10, 9, 1).events)[0];
    assert.ok(mine?.kind === 'attack' && mine.result.dc === 12 && !mine.hit);
  });

  test('both sides can hit in the same round', () => {
    const r = run(duel(), 15, 10, 15, 2, 15, 3);
    assert.deepEqual([fighter(r, 'A1').hp, fighter(r, 'B1').hp], [7, 8]);
  });

  test('a natural 20 is a critical hit: the damage dice are rolled twice', () => {
    const r = run(duel(), 15, 10, 20, 4, 4, 20, 1); // 8 damage leaves 2 HP, so a nerve check follows
    const mine = attacks(r.events)[0];
    assert.ok(mine?.kind === 'attack' && mine.critical && mine.damage?.total === 8);
  });

  test('a natural 1 always misses', () => {
    const brute = createCharacter({ name: 'Brute', attributes: attributeScores({ str: 20 }), training: { brawling: 'expert' } }); // +9
    const mine = attacks(run(duel({ attackers: [brute] }), 15, 10, 1, 1).events)[0];
    assert.ok(mine?.kind === 'attack' && mine.result.roll.total === 10 && !mine.hit);
  });

  test('0 hit points is a knockout; the knocked-out fighter does not act and their side loses', () => {
    const r = run(duel({ defenders: [frail('F')] }), 15, 10, 20, 4, 4);
    assert.deepEqual(kinds(r.events), ['initiative', 'attack', 'out', 'end']);
    assert.equal(fighter(r, 'B1').status, 'knocked-out');
    assert.equal(r.winner, 'attacker');
  });

  test('no nerve check while above half hit points', () => {
    assert.deepEqual(kinds(run(duel(), 15, 10, 15, 4, 1).events), ['initiative', 'attack', 'attack', 'end']);
  });

  test('the first time a fighter drops to half hit points or below, they make one DC 10 nerve check', () => {
    const r = run(duel({ maxRounds: 3 }), 15, 10, 15, 4, 1, 15, 1, 10, 1, 15, 1, 1);
    assert.deepEqual(kinds(r.events), ['initiative', 'attack', 'attack', 'attack', 'nerve', 'attack', 'attack', 'attack', 'end']);
    const nerve = r.events.find((e) => e.kind === 'nerve');
    assert.ok(nerve?.kind === 'nerve' && nerve.trigger === 'hurt' && nerve.check.result.dc === NERVE_DC.hurt && nerve.check.passed);
  });

  test('being hurt carries no roll penalty', () => {
    const r = run(duel({ maxRounds: 2 }), 15, 10, 20, 2, 3, 20, 1, 1, 15, 1);
    for (const e of r.events) {
      if (e.kind === 'attack') assert.deepEqual(e.result.roll.modifiers.filter((m) => m.value < 0), []);
      if (e.kind === 'nerve') assert.deepEqual(e.check.result.roll.modifiers.filter((m) => m.value < 0), []);
    }
  });

  test('failing the nerve check: a defender surrenders, an attacker backs off, a timid fighter flees', () => {
    assert.equal(fighter(run(duel(), 15, 10, 20, 2, 3, 1), 'B1').status, 'surrendered');
    assert.equal(fighter(run(duel(), 5, 15, 20, 2, 3, 1), 'A1').status, 'backed-off');
    assert.equal(fighter(run(duel({ defenders: [defender({ courage: 0.1 })] }), 15, 10, 20, 2, 3, 9), 'B1').status, 'fled');
    assert.equal(fighter(run(duel({ defenders: [defender({ temper: 0.9 })] }), 15, 10, 20, 2, 3, 1), 'B1').status, 'surrendered');
  });

  test('ends in a stalemate after maxRounds', () => {
    const r = run(duel({ maxRounds: 2 }), 15, 10, 1, 1, 1, 1);
    assert.equal(r.winner, null);
    assert.equal(r.rounds, 2);
  });

  test('defaults to d20 and 12 rounds, and rejects an invalid round limit or an empty side', () => {
    assert.ok(runFight({ attackers: [attacker()], defenders: [defender()] }, roller(seeded(1))).rounds <= 12);
    assert.throws(() => runFight(duel({ maxRounds: 0 }), scripted()), RangeError);
    assert.throws(() => runFight(duel({ defenders: [] }), scripted()), RangeError);
  });
});

describe('runFight: parties', { tags: ['unit'] }, () => {
  test('everyone rolls initiative; the order is highest first, defenders first on a tie, then list order', () => {
    const r = run({ attackers: [attacker('A'), attacker('B')], defenders: [defender({}, 'C'), defender({}, 'D')], maxRounds: 1 }, 12, 8, 15, 8, 1, 1, 1, 1, 1, 1, 1, 1);
    const init = r.events[0];
    assert.ok(init?.kind === 'initiative');
    assert.deepEqual(init.order.map((o) => o.id), ['B1', 'A1', 'B2', 'A2']);
    assert.deepEqual(attacks(r.events).map((a) => (a.kind === 'attack' ? a.by : '')), ['B1', 'A1', 'B2', 'A2']);
  });

  test('each fighter attacks a random enemy who is still fighting', () => {
    const r = run({ attackers: [attacker()], defenders: [defender({}, 'C'), defender({}, 'D')], maxRounds: 1 }, 15, 10, 10, 2, 1, 1, 1);
    const targets = attacks(r.events).map((a) => (a.kind === 'attack' ? `${a.by}→${a.target}` : ''));
    assert.deepEqual(targets, ['A1→B2', 'B1→A1', 'B2→A1']);
  });

  test('a knocked-out fighter is not attacked; when half a side is out, the rest of that side make a nerve check', () => {
    // A1 knocks out B1 (5 HP). Half the defenders are out, so B2 makes a nerve check and passes. In round 2 B2 is A1's
    // only target, so no die is rolled to choose.
    const r = run({ attackers: [attacker()], defenders: [frail('F'), defender({}, 'D')], maxRounds: 2 }, 15, 10, 10, 1, 20, 4, 4, 20, 1, 1, 1);
    assert.deepEqual(kinds(r.events), ['initiative', 'attack', 'out', 'nerve', 'attack', 'attack', 'attack', 'end']);
    const nerve = r.events.find((e) => e.kind === 'nerve');
    assert.ok(nerve?.kind === 'nerve' && nerve.id === 'B2' && nerve.trigger === 'allies-down' && nerve.check.result.dc === NERVE_DC['allies-down']);
    const later = attacks(r.events).filter((a) => a.kind === 'attack' && a.by === 'A1');
    assert.ok(later.every((a) => a.kind === 'attack' && a.target === 'B2' || a.kind === 'attack' && a.round === 1));
    assert.equal(fighter(r, 'B1').status, 'knocked-out');
    assert.equal(r.winner, null);
  });

  test('a side loses when none of its fighters is still fighting', () => {
    const r = run({ attackers: [attacker()], defenders: [frail('F'), defender({}, 'D')], maxRounds: 2 }, 15, 10, 10, 1, 20, 4, 4, 1);
    assert.deepEqual(kinds(r.events), ['initiative', 'attack', 'out', 'nerve', 'out', 'end']);
    assert.deepEqual(r.fighters.map((f) => f.status), ['fighting', 'knocked-out', 'surrendered']);
    assert.equal(r.winner, 'attacker');
  });

  test('the group nerve check happens once per side, when at least half the side is out', () => {
    // Three frail defenders. B1 out: 1 of 3, no check. B2 out: 2 of 3, B3 checks. B3 out: no further check.
    const r = run({ attackers: [attacker()], defenders: [frail('F'), frail('G'), frail('H')], maxRounds: 3 },
      20, 1, 1, 1, 1, 20, 4, 4, 1, 1, 1, 20, 4, 4, 20, 1, 20, 4, 4);
    assert.equal(r.events.filter((e) => e.kind === 'nerve').length, 1);
    assert.deepEqual(r.fighters.map((f) => f.status), ['fighting', 'knocked-out', 'knocked-out', 'knocked-out']);
    assert.equal(r.winner, 'attacker');
  });
});

describe('fighter statuses', { tags: ['unit'] }, () => {
  test('FIGHTER_STATUS_INFO explains every status', () => {
    for (const s of FIGHTER_STATUSES) assert.ok(FIGHTER_STATUS_INFO[s].title && FIGHTER_STATUS_INFO[s].explanation, s);
  });

  test('tallyFights counts wins per side and each fighter’s final status', () => {
    const t = tallyFights({ attackers: [attacker(), attacker('B')], defenders: [defender()], maxRounds: 12 }, roller(seeded(2)), 200);
    assert.equal(t.wins.attacker + t.wins.defender + t.wins.stalemate, 200);
    for (const id of ['A1', 'A2', 'B1']) assert.equal(Object.values(t.statuses[id]!).reduce((a, b) => a + b, 0), 200, id);
    assert.ok(tallyFights(duel({ maxRounds: 1 }), roller(seeded(3)), 50).wins.stalemate > 0);
  });
});

describe('describeFightEvent', { tags: ['unit'] }, () => {
  const log = (s: FightSpec, ...faces: number[]) => {
    const r = runFight(s, scripted(...faces));
    return r.events.map((e) => describeFightEvent(e, r));
  };

  test('says each thing once: turn order, hits, misses and the result', () => {
    assert.deepEqual(log(duel(), 15, 10, 8, 3, 9), [
      'Turn order: A (15), D (10).',
      'A hits D: 3 damage, 7 HP left (rolled 10 vs Defence 10).',
      'D misses A (rolled 9 vs Defence 10).',
      'Stalemate: the round limit was reached.',
    ]);
  });

  test('names natural 20s and 1s instead of the total, and describes nerve checks', () => {
    assert.deepEqual(log(duel(), 15, 10, 20, 2, 3, 20, 1).slice(1, 4), [
      'A lands a critical hit on D: 5 damage, 5 HP left (natural 20).',
      'D is at half HP and holds their nerve (rolled 20 vs 10).',
      'D misses A (natural 1).',
    ]);
    assert.equal(log(duel(), 15, 10, 20, 2, 3, 1)[2], 'D is at half HP and loses their nerve (rolled 1 vs 10).');
  });

  test('can leave out the numbers when the dice are shown separately, keeping natural 20s and 1s', () => {
    const lines = (...faces: number[]) => {
      const r = runFight(duel(), scripted(...faces));
      return r.events.map((e) => describeFightEvent(e, r, { rolls: false }));
    };
    assert.deepEqual(lines(15, 10, 8, 3, 9).slice(0, 3), ['Turn order: A, D.', 'A hits D: 3 damage, 7 HP left.', 'D misses A.']);
    assert.deepEqual(lines(15, 10, 20, 2, 3, 20, 1).slice(1, 4), [
      'A lands a critical hit on D: 5 damage, 5 HP left (natural 20).',
      'D is at half HP and holds their nerve.',
      'D misses A (natural 1).',
    ]);
  });

  test('names the highest and lowest possible rolls on other dice', () => {
    assert.deepEqual(log(duel({ dice: DICE['3d6'] }), 4, 4, 4, 3, 3, 3, 6, 6, 6, 1, 1, 1, 1, 1).slice(1, 3), [
      'A lands a critical hit on D: 2 damage, 8 HP left (highest possible roll).',
      'D misses A (lowest possible roll).',
    ]);
  });

  test('describes fighters leaving, the group nerve check and the winner', () => {
    const party = { attackers: [attacker()], defenders: [frail('F'), defender({}, 'D')], maxRounds: 2 };
    assert.deepEqual(log(party, 15, 10, 10, 1, 20, 4, 4, 1).slice(2), [
      'F is knocked out.',
      'D sees half their side out of the fight and loses their nerve (rolled 1 vs 10).',
      'D surrenders.',
      'Left wins.',
    ]);
    assert.equal(log(duel(), 5, 15, 20, 2, 3, 1).slice(-2).join(' '), 'A backs off. Right wins.');
    assert.equal(log(duel({ defenders: [defender({ courage: 0.1 })] }), 15, 10, 20, 2, 3, 9).at(-2), 'D flees.');
  });
});

describe('runFight', { tags: ['property'] }, () => {
  const party = fc.array(fc.constantFrom(...BACKGROUNDS), { minLength: 1, maxLength: 3 });
  const fightOf = fc.record({ seed: fc.integer(), a: party, d: party, maxRounds: fc.integer({ min: 1, max: 20 }) });
  const build = (c: { seed: number; a: BackgroundName[]; d: BackgroundName[]; maxRounds: number }): FightSpec => {
    const r = roller(seeded(c.seed));
    return { attackers: c.a.map((b, i) => rollCharacter(`A${i}`, b, r)), defenders: c.d.map((b, i) => rollCharacter(`D${i}`, b, r)), maxRounds: c.maxRounds };
  };

  test('ends within maxRounds with exactly one end event, which is last', () => {
    fc.assert(
      fc.property(fightOf, (c) => {
        const r = runFight(build(c), roller(seeded(c.seed)));
        return r.rounds <= c.maxRounds && r.events.filter((e) => e.kind === 'end').length === 1 && r.events.at(-1)?.kind === 'end';
      }),
    );
  });

  test('the winning side has someone still fighting and the losing side has nobody', () => {
    fc.assert(
      fc.property(fightOf, (c) => {
        const r = runFight(build(c), roller(seeded(c.seed)));
        const standing = (side: 'attacker' | 'defender') => r.fighters.some((f) => f.side === side && f.status === 'fighting');
        if (r.winner === null) return standing('attacker') && standing('defender');
        return standing(r.winner) && !standing(r.winner === 'attacker' ? 'defender' : 'attacker');
      }),
    );
  });

  test('keeps hit points between 0 and the maximum, and only knocked-out fighters at 0', () => {
    fc.assert(
      fc.property(fightOf, (c) =>
        runFight(build(c), roller(seeded(c.seed))).fighters.every((f) => f.hp >= 0 && f.hp <= f.maxHp && (f.hp === 0) === (f.status === 'knocked-out'))),
    );
  });

  test('is deterministic for a seed', () => {
    fc.assert(fc.property(fightOf, (c) => assert.deepEqual(runFight(build(c), roller(seeded(c.seed))), runFight(build(c), roller(seeded(c.seed))))));
  });

  test('two fighters beat one more often than not', () => {
    const r = roller(seeded(8));
    let wins = 0;
    for (let i = 0; i < 300; i++) {
      const out = runFight({ attackers: [rollCharacter('A', 'labourer', r), rollCharacter('B', 'labourer', r)], defenders: [rollCharacter('C', 'labourer', r)] }, r);
      if (out.winner === 'attacker') wins++;
    }
    assert.ok(wins > 200, `${wins} of 300`);
  });
});
