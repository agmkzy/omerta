import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { attributeScores } from '../src/attributes';
import { BACKGROUNDS, rollCharacter, type BackgroundName } from '../src/backgrounds';
import { createCharacter, type Character } from '../src/character';
import { DICE } from '../src/dice';
import { DEFAULT_MAX_ROUNDS, FIGHTER_STATUSES, FIGHTER_STATUS_INFO, attackOutcome, fightStats, playFight, rollDamage, runFight, type FightEvent, type FightResult, type FightSpec } from '../src/fight';
import { NERVE_DC } from '../src/nerve';
import { roller, seeded } from '../src/random';
import { temperament } from '../src/temperament';
import { fightWith, scripted } from './support';

// Attackers attack at +2 (trained Brawling); defenders at +0. Everyone has Defence 10, 10 HP (half is 5), Reflexes +0 and
// average temperament unless stated. Fighters are A1, A2… (attackers) and B1, B2… (defenders).
const attacker = (name = 'A') => createCharacter({ name, training: { brawling: 'trained' } });
const defender = (t: Parameters<typeof temperament>[0] = {}, name = 'D'): Character => createCharacter({ name, temperament: temperament(t) });
const frail = (name: string) => createCharacter({ name, attributes: attributeScores({ con: 1 }) }); // 5 HP
const duel = (over: Partial<FightSpec> = {}): FightSpec => ({ attackers: [attacker()], defenders: [defender()], maxRounds: 1, ...over });
const oneAgainstTwo = (maxRounds = 1): FightSpec => ({ attackers: [attacker()], defenders: [defender({}, 'C'), defender({}, 'D')], maxRounds });

type Attack = Extract<FightEvent, { kind: 'attack' }>;
type Nerve = Extract<FightEvent, { kind: 'nerve' }>;
const kinds = (r: FightResult) => r.events.map((e) => e.kind);
const attacks = (r: FightResult) => r.events.filter((e): e is Attack => e.kind === 'attack');
const nerves = (r: FightResult) => r.events.filter((e): e is Nerve => e.kind === 'nerve');
const status = (r: FightResult, id: string) => r.fighters.find((f) => f.id === id)?.status;
const hp = (r: FightResult, id: string) => r.fighters.find((f) => f.id === id)?.hp;
/** An attack's fields that tests check. */
const brief = (a: Attack | undefined) => a && { by: a.by, target: a.target, outcome: a.outcome, dc: a.result.dc, total: a.result.roll.total, damage: a.damage?.total ?? null, hp: a.hp };

describe('rollDamage', { tags: ['unit'] }, () => {
  test('is 1d4 plus the Strength modifier', () => {
    const strong = createCharacter({ name: 'S', attributes: attributeScores({ str: 16 }) });
    assert.deepEqual(rollDamage(strong, false, scripted(2)), { faces: [2], modifier: 3, total: 5, minimumApplied: false });
  });

  test('rolls the dice twice on a critical hit', () => {
    assert.deepEqual(rollDamage(attacker(), true, scripted(3, 4)), { faces: [3, 4], modifier: 0, total: 7, minimumApplied: false });
  });

  test('is at least 1, and says when the minimum applied', () => {
    const weak = createCharacter({ name: 'W', attributes: attributeScores({ str: 3 }) });
    assert.deepEqual(rollDamage(weak, false, scripted(1)), { faces: [1], modifier: -4, total: 1, minimumApplied: true });
  });
});

describe('attackOutcome', { tags: ['unit'] }, () => {
  test('hits when the total meets the Defence', () => {
    assert.deepEqual([7, 8].map((kept) => attackOutcome(kept, 2, 10, DICE.d20)), ['miss', 'hit']);
  });

  test('the highest possible roll is a critical hit and the lowest a miss, whatever the bonus and Defence', () => {
    assert.equal(attackOutcome(20, -30, 10, DICE.d20), 'critical');
    assert.equal(attackOutcome(1, 30, 10, DICE.d20), 'miss');
    assert.equal(attackOutcome(18, -30, 10, DICE['3d6']), 'critical');
    assert.equal(attackOutcome(3, 30, 10, DICE['3d6']), 'miss');
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
    const order = (initiative: number[]) => attacks(fightWith(duel(), { initiative, attack: [1, 1] })).map((a) => a.by);
    assert.deepEqual(order([15, 10]), ['A1', 'B1']);
    assert.deepEqual(order([5, 15]), ['B1', 'A1']);
    assert.deepEqual(order([10, 10]), ['B1', 'A1']);
  });

  test('each fighter starts with their maximum hit points', () => {
    const r = fightWith(duel(), { initiative: [15, 10], attack: [1, 1] });
    assert.deepEqual(r.fighters.map((f) => [f.id, f.hp, f.maxHp, f.status]), [['A1', 10, 10, 'fighting'], ['B1', 10, 10, 'fighting']]);
  });

  test('an attack hits when the dice + Brawling meets the target’s Defence, for 1d4 + Strength modifier', () => {
    const r = fightWith(duel(), { initiative: [15, 10], attack: [8, 9], damage: [3] }); // A1: 8 + 2 = 10, a hit; B1: 9, a miss
    assert.deepEqual(attacks(r).map(brief), [
      { by: 'A1', target: 'B1', outcome: 'hit', dc: 10, total: 10, damage: 3, hp: 7 },
      { by: 'B1', target: 'A1', outcome: 'miss', dc: 10, total: 9, damage: null, hp: 10 },
    ]);
  });

  test('Defence includes the target’s Reflexes', () => {
    const nimble = createCharacter({ name: 'Nimble', training: { reflexes: 'trained' } }); // Defence 12
    const [mine] = attacks(fightWith(duel({ defenders: [nimble] }), { initiative: [15, 10], attack: [9, 1] }));
    assert.deepEqual([mine?.result.dc, mine?.outcome], [12, 'miss']);
  });

  test('both sides can hit in the same round', () => {
    const r = fightWith(duel(), { initiative: [15, 10], attack: [15, 15], damage: [2, 3] });
    assert.deepEqual([hp(r, 'A1'), hp(r, 'B1')], [7, 8]);
  });

  test('a natural 20 is a critical hit: the damage dice are rolled twice', () => {
    const r = fightWith(duel(), { initiative: [15, 10], attack: [20, 1], damage: [4, 4], nerve: [20] }); // 8 damage leaves 2 HP
    assert.deepEqual([attacks(r)[0]?.outcome, attacks(r)[0]?.extreme, attacks(r)[0]?.damage?.total], ['critical', 'highest', 8]);
  });

  test('a natural 1 always misses', () => {
    const brute = createCharacter({ name: 'Brute', attributes: attributeScores({ str: 20 }), training: { brawling: 'expert' } }); // +9
    const [mine] = attacks(fightWith(duel({ attackers: [brute] }), { initiative: [15, 10], attack: [1, 1] }));
    assert.deepEqual([mine?.result.roll.total, mine?.outcome, mine?.extreme], [10, 'miss', 'lowest']);
  });

  test('0 hit points is a knockout; the knocked-out fighter does not act and their side loses', () => {
    const r = fightWith(duel({ defenders: [frail('F')] }), { initiative: [15, 10], attack: [20], damage: [4, 4] });
    assert.deepEqual(kinds(r), ['initiative', 'attack', 'out', 'end']);
    assert.deepEqual([status(r, 'B1'), r.winner], ['knocked-out', 'attacker']);
  });

  test('no nerve check while above half hit points', () => {
    assert.deepEqual(kinds(fightWith(duel(), { initiative: [15, 10], attack: [15, 1], damage: [4] })), ['initiative', 'attack', 'attack', 'end']);
  });

  test('the first time a fighter drops to half hit points or below, they make one DC 10 nerve check', () => {
    // B1 drops to 6, then 5 (half: a nerve check, passed), then 4 (no second check).
    const r = fightWith(duel({ maxRounds: 3 }), { initiative: [15, 10], attack: [15, 1, 15, 1, 15, 1], damage: [4, 1, 1], nerve: [10] });
    assert.deepEqual(kinds(r), ['initiative', 'attack', 'attack', 'attack', 'nerve', 'attack', 'attack', 'attack', 'end']);
    assert.deepEqual(nerves(r).map((n) => [n.id, n.trigger, n.check.result.dc, n.check.passed]), [['B1', 'hurt', NERVE_DC.hurt, true]]);
  });

  test('being hurt carries no roll penalty', () => {
    const r = fightWith(duel({ maxRounds: 2 }), { initiative: [15, 10], attack: [20, 1, 1, 15], damage: [2, 3, 1], nerve: [20] });
    const penalties = r.events.flatMap((e) => (e.kind === 'attack' ? e.result.roll.modifiers : e.kind === 'nerve' ? e.check.result.roll.modifiers : [])).filter((m) => m.value < 0);
    assert.deepEqual(penalties, []);
  });

  test('failing the nerve check: a defender surrenders, an attacker backs off, a timid fighter flees', () => {
    const fail = { attack: [20], damage: [2, 3], nerve: [1] };
    assert.equal(status(fightWith(duel(), { initiative: [15, 10], ...fail }), 'B1'), 'surrendered');
    assert.equal(status(fightWith(duel(), { initiative: [5, 15], ...fail }), 'A1'), 'backed-off');
    assert.equal(status(fightWith(duel({ defenders: [defender({ courage: 0.1 })] }), { initiative: [15, 10], ...fail, nerve: [9] }), 'B1'), 'fled');
    assert.equal(status(fightWith(duel({ defenders: [defender({ temper: 0.9 })] }), { initiative: [15, 10], ...fail }), 'B1'), 'surrendered');
  });

  test('ends in a stalemate after maxRounds', () => {
    const r = fightWith(duel({ maxRounds: 2 }), { initiative: [15, 10], attack: [1, 1, 1, 1] });
    assert.deepEqual([r.winner, r.rounds], [null, 2]);
  });

  test('playFight pauses only for AwaitingRoll; anything else thrown propagates', () => {
    const broken = { roll: (): number => { throw new Error('broken roller'); } };
    assert.throws(() => playFight(duel(), broken), /broken roller/);
    assert.throws(() => playFight(duel({ maxRounds: 0 }), broken), RangeError);
  });

  test('defaults to d20 and the default round limit, and rejects an invalid round limit or an empty side', () => {
    const r = runFight({ attackers: [attacker()], defenders: [defender()] }, roller(seeded(1)));
    assert.ok(r.rounds <= DEFAULT_MAX_ROUNDS, `${r.rounds} rounds`);
    assert.equal(attacks(r)[0]?.result.roll.dice, DICE.d20);
    assert.throws(() => runFight(duel({ maxRounds: 0 }), scripted()), RangeError);
    assert.throws(() => runFight(duel({ defenders: [] }), scripted()), RangeError);
  });
});

describe('runFight: parties', { tags: ['unit'] }, () => {
  test('everyone rolls initiative; the order is highest first, defenders first on a tie, then list order', () => {
    const spec = { attackers: [attacker('A'), attacker('B')], defenders: [defender({}, 'C'), defender({}, 'D')], maxRounds: 1 };
    // The second attacks on A1 and B1 have advantage, so take two dice.
    const r = fightWith(spec, { initiative: [12, 8, 15, 8], target: [1, 1, 1, 1], attack: [1, 1, 1, 1, 1, 1] });
    const init = r.events[0];
    assert.deepEqual(init?.kind === 'initiative' && init.order.map((o) => o.id), ['B1', 'A1', 'B2', 'A2']);
    assert.deepEqual(attacks(r).map((a) => a.by), ['B1', 'A1', 'B2', 'A2']);
  });

  test('each fighter attacks a random enemy who is still fighting; the die is rolled only when there is a choice', () => {
    const r = fightWith(oneAgainstTwo(), { initiative: [15, 10, 10], target: [2], attack: [1, 1, 1, 1] });
    assert.deepEqual(attacks(r).map((a) => `${a.by}→${a.target}`), ['A1→B2', 'B1→A1', 'B2→A1']);
  });

  test('ganging up: an attack has advantage if someone on the same side has already attacked that target this round', () => {
    // Each round B1 attacks A1 first (no advantage), then B2 attacks A1 too (advantage).
    const r = fightWith(oneAgainstTwo(2), { initiative: [15, 10, 10], target: [2, 1], attack: [1, 1, 1, 1, 1, 1, 1, 1] });
    assert.deepEqual(attacks(r).map((a) => `${a.by}:${a.result.roll.edge}`), ['A1:none', 'B1:none', 'B2:advantage', 'A1:none', 'B1:none', 'B2:advantage']);
  });

  test('advantage keeps the higher of the two throws', () => {
    const r = fightWith(oneAgainstTwo(), { initiative: [15, 10, 10], target: [2], attack: [1, 1, 3, 15], damage: [2] });
    const ganging = attacks(r).find((a) => a.by === 'B2');
    assert.deepEqual([ganging?.result.roll.thrown.kept, ganging?.outcome], [15, 'hit']);
  });

  test('a knocked-out fighter is not attacked; when half a side is out, the rest of that side make a nerve check', () => {
    // A1 knocks out B1 (5 HP). Half the defenders are out, so B2 makes a nerve check and passes. In round 2 B2 is A1's
    // only target, so no die is rolled to choose.
    const r = fightWith({ attackers: [attacker()], defenders: [frail('F'), defender({}, 'D')], maxRounds: 2 }, { initiative: [15, 10, 10], target: [1], attack: [20, 1, 1, 1], damage: [4, 4], nerve: [20] });
    assert.deepEqual(kinds(r), ['initiative', 'attack', 'out', 'nerve', 'attack', 'attack', 'attack', 'end']);
    assert.deepEqual(nerves(r).map((n) => [n.id, n.trigger, n.check.result.dc]), [['B2', 'allies-down', NERVE_DC['allies-down']]]);
    assert.deepEqual(attacks(r).filter((a) => a.by === 'A1').map((a) => a.target), ['B1', 'B2']);
    assert.deepEqual([status(r, 'B1'), r.winner], ['knocked-out', null]);
  });

  test('a side loses when none of its fighters is still fighting', () => {
    const r = fightWith({ attackers: [attacker()], defenders: [frail('F'), defender({}, 'D')], maxRounds: 2 }, { initiative: [15, 10, 10], target: [1], attack: [20], damage: [4, 4], nerve: [1] });
    assert.deepEqual(kinds(r), ['initiative', 'attack', 'out', 'nerve', 'out', 'end']);
    assert.deepEqual(r.fighters.map((f) => f.status), ['fighting', 'knocked-out', 'surrendered']);
    assert.equal(r.winner, 'attacker');
  });

  test('the group nerve check happens once per side, when at least half the side is out', () => {
    // Three frail defenders. B1 out: 1 of 3, no check. B2 out: 2 of 3, B3 checks. B3 out: no further check.
    const r = fightWith({ attackers: [attacker()], defenders: [frail('F'), frail('G'), frail('H')], maxRounds: 3 }, {
      initiative: [20, 1, 1, 1], target: [1, 1], attack: [20, 1, 1, 1, 20, 1, 20], damage: [4, 4, 4, 4, 4, 4], nerve: [20],
    });
    assert.deepEqual(nerves(r).map((n) => n.id), ['B3']);
    assert.deepEqual(r.fighters.map((f) => f.status), ['fighting', 'knocked-out', 'knocked-out', 'knocked-out']);
    assert.equal(r.winner, 'attacker');
  });
});

describe('FIGHTER_STATUS_INFO', { tags: ['unit'] }, () => {
  test('labels and explains every status', () => {
    for (const s of FIGHTER_STATUSES) {
      const info = FIGHTER_STATUS_INFO[s];
      assert.deepEqual([info.label !== '', info.title !== '', info.explanation !== ''], [true, true, true], s);
    }
    assert.match(FIGHTER_STATUS_INFO.fled.explanation, /low courage or high caution/);
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
        assert.ok(r.rounds <= c.maxRounds, `${r.rounds} rounds`);
        assert.deepEqual([r.events.filter((e) => e.kind === 'end').length, r.events.at(-1)?.kind], [1, 'end']);
      }),
    );
  });

  test('the winning side has someone still fighting and the losing side has nobody', () => {
    fc.assert(
      fc.property(fightOf, (c) => {
        const r = runFight(build(c), roller(seeded(c.seed)));
        const standing = (side: 'attacker' | 'defender') => r.fighters.some((f) => f.side === side && f.status === 'fighting');
        const expected = r.winner === null ? [true, true] : r.winner === 'attacker' ? [true, false] : [false, true];
        assert.deepEqual([standing('attacker'), standing('defender')], expected);
      }),
    );
  });

  test('keeps hit points between 0 and the maximum, and only knocked-out fighters at 0', () => {
    fc.assert(
      fc.property(fightOf, (c) => {
        for (const f of runFight(build(c), roller(seeded(c.seed))).fighters) {
          assert.ok(f.hp >= 0 && f.hp <= f.maxHp, `${f.id}: ${f.hp} of ${f.maxHp}`);
          assert.equal(f.hp === 0, f.status === 'knocked-out', f.id);
        }
      }),
    );
  });

  test('every attack’s outcome follows attackOutcome, and only hits deal damage', () => {
    fc.assert(
      fc.property(fightOf, (c) => {
        for (const a of attacks(runFight(build(c), roller(seeded(c.seed))))) {
          assert.equal(a.outcome, attackOutcome(a.result.roll.thrown.kept, a.result.roll.bonus, a.result.dc, a.result.roll.dice));
          assert.equal(a.damage === null, a.outcome === 'miss');
        }
      }),
    );
  });

  test('is deterministic for a seed', () => {
    fc.assert(fc.property(fightOf, (c) => assert.deepEqual(runFight(build(c), roller(seeded(c.seed))), runFight(build(c), roller(seeded(c.seed))))));
  });
});

describe('runFight', { tags: ['statistical'] }, () => {
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
