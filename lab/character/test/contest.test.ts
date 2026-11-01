import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { BACKGROUNDS, rollCharacter, type BackgroundName } from '../src/backgrounds';
import { attributeScores } from '../src/attributes';
import { createCharacter, type Character } from '../src/character';
import { APPROACHES, APPROACH_INFO, ENDING_INFO, NERVE_DC, NERVE_FAILURE, endingKey, rollDamage, runContest, tally, type Approach, type ContestEvent, type ContestSpec } from '../src/contest';
import { roller, seeded } from '../src/random';
import { temperament } from '../src/temperament';
import { scripted } from './support';

// Attacker: Intimidation +2, Brawling +2, Nerve +0. Defender: +0 to everything. Both have average temperament unless stated.
const attacker = createCharacter({ name: 'Attacker', training: { intimidation: 'trained', brawling: 'trained' } });
const defender = (t: Parameters<typeof temperament>[0] = {}): Character => createCharacter({ name: 'Defender', temperament: temperament(t) });

const spec = (over: Partial<ContestSpec> = {}): ContestSpec => ({ attacker, defender: defender(), approach: 'intimidation', winningLead: 5, maxRounds: 1, ...over });
const kinds = (events: readonly ContestEvent[]) => events.map((e) => e.kind);
const roundEvents = (events: readonly ContestEvent[]) => events.filter((e) => e.kind === 'round');

/** Runs a contest on scripted faces and checks that every face was used. */
function run(s: ContestSpec, ...faces: number[]) {
  const dice = scripted(...faces);
  const result = runContest(s, dice);
  assert.equal(dice.remaining, 0, 'not all scripted faces were used');
  return result;
}

describe('runContest: lead', { tags: ['unit'] }, () => {
  test('the round winner gains one point of lead per 5 points of roll difference, rounded up', () => {
    assert.equal(run(spec(), 12, 10).lead, 1); // 14 vs 10
    const r = run(spec(), 15, 10); // 17 vs 10
    assert.equal(r.lead, 2);
    assert.deepEqual(kinds(r.events), ['round', 'end']);
  });

  test('a tied round does not change the lead', () => {
    assert.equal(run(spec(), 8, 10).lead, 0);
  });

  test('the lead goes negative when the defender wins rounds', () => {
    assert.equal(run(spec({ winningLead: 8 }), 1, 15).lead, -3); // 3 vs 15
  });

  test('ends in a stalemate after maxRounds', () => {
    assert.deepEqual(run(spec({ maxRounds: 2 }), 8, 10, 8, 10).ending, { how: 'stalemate', loser: null });
  });
});

describe('runContest: winning lead', { tags: ['unit'] }, () => {
  test('the attacker wins on reaching the winning lead', () => {
    const r = run(spec({ winningLead: 1 }), 15, 10);
    assert.deepEqual(r.ending, { how: 'outscored', loser: 'defender' });
    assert.equal(r.lead, 1);
  });

  test('the defender wins on reaching the winning lead', () => {
    assert.deepEqual(run(spec({ winningLead: 1 }), 1, 20).ending, { how: 'outscored', loser: 'attacker' });
  });
});

describe('runContest: nerve checks', { tags: ['unit'] }, () => {
  test('a side falling behind by half the winning lead makes a DC 10 nerve check; passing continues the contest', () => {
    const r = run(spec({ winningLead: 4 }), 15, 10, 10); // lead 2 of 4; nerve 10 vs DC 10
    assert.deepEqual(kinds(r.events), ['round', 'nerve', 'end']);
    const nerve = r.events[1];
    assert.ok(nerve?.kind === 'nerve' && nerve.side === 'defender' && nerve.trigger === 'falling-behind' && nerve.passed);
    assert.equal(r.ending.how, 'stalemate');
  });

  test('a defender who fails the nerve check, with average temperament, complies', () => {
    assert.deepEqual(run(spec({ winningLead: 4 }), 15, 10, 9).ending, { how: 'complies', loser: 'defender' });
  });

  test('an attacker who fails the nerve check, with average temperament, backs down', () => {
    assert.deepEqual(run(spec({ winningLead: 4 }), 1, 12, 1).ending, { how: 'backs-down', loser: 'attacker' }); // 3 vs 12: behind by 2
  });

  test('the falling-behind check happens only once per side', () => {
    const r = run(spec({ winningLead: 4, maxRounds: 2 }), 15, 10, 10, 12, 10);
    assert.deepEqual(kinds(r.events), ['round', 'nerve', 'round', 'end']);
  });

  test('low courage: flees on failure', () => {
    const r = run(spec({ winningLead: 4, defender: defender({ courage: 0.1 }) }), 15, 10, 11); // 11 − 2 (timid)
    assert.deepEqual(r.ending, { how: 'flees', loser: 'defender' });
  });

  test('high caution: flees on failure', () => {
    assert.deepEqual(run(spec({ winningLead: 4, defender: defender({ caution: 0.9 }) }), 15, 10, 9).ending, { how: 'flees', loser: 'defender' });
  });

  test('high temper: escalates on failure and the contest becomes a fight', () => {
    // Round 2 is a fight: initiative (a tie, so the defender goes first), then both attacks miss.
    const r = run(spec({ winningLead: 4, maxRounds: 2, defender: defender({ temper: 0.9 }) }), 15, 10, 9, 10, 10, 1, 1);
    assert.deepEqual(kinds(r.events), ['round', 'nerve', 'escalation', 'initiative', 'attack', 'attack', 'end']);
    assert.equal(r.ending.how, 'stalemate');
  });

  test('high temper: does not escalate during a fight; a failed nerve check surrenders', () => {
    // Round 1: lead 3 of 6, nerve fails, escalates. Round 2 (fight): the attacker wins initiative and lands a critical
    // hit for 5 (10 → 5 HP, half); the defender's nerve fails again.
    const r = run(spec({ winningLead: 6, maxRounds: 2, defender: defender({ temper: 0.9 }) }), 20, 10, 1, 15, 10, 20, 2, 3, 1);
    assert.deepEqual(kinds(r.events), ['round', 'nerve', 'escalation', 'initiative', 'attack', 'nerve', 'end']);
    assert.deepEqual(r.ending, { how: 'surrenders', loser: 'defender' });
  });
});

describe('runContest: armed threat', { tags: ['unit'] }, () => {
  test('the defender makes a DC 12 nerve check before the first round', () => {
    const r = run(spec({ approach: 'armed-threat' }), 5);
    assert.deepEqual(kinds(r.events), ['nerve', 'end']);
    const nerve = r.events[0];
    assert.ok(nerve?.kind === 'nerve' && nerve.trigger === 'weapon-drawn' && nerve.result.dc === 12);
    assert.deepEqual(r.ending, { how: 'complies', loser: 'defender' });
    assert.equal(r.rounds, 0);
  });

  test('the attacker rolls with advantage', () => {
    const r = run(spec({ approach: 'armed-threat' }), 12, 3, 15, 10); // nerve passes; attacker keeps 15 over 3
    const first = roundEvents(r.events)[0];
    assert.ok(first?.kind === 'round' && first.result.active.thrown.kept === 15 && first.result.active.edge === 'advantage');
  });
});

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

describe('runContest: fight', { tags: ['unit'] }, () => {
  // The attacker attacks at +2 (trained Brawling); the defender at +0. Both have Defence 10 and 10 HP (half is 5).
  // Dice order: initiative (attacker, then defender), then each attack in turn: attack roll, damage, any nerve check.
  const fight = (over: Partial<ContestSpec> = {}) => spec({ approach: 'fight', ...over });
  const attacks = (events: readonly ContestEvent[]) => events.filter((e) => e.kind === 'attack');

  test('starts with initiative: both roll Reflexes and the higher acts first', () => {
    const first = (faces: number[]) => {
      const r = run(fight(), ...faces, 1, 1);
      const e = r.events[0];
      assert.ok(e?.kind === 'initiative');
      return [e.first, ...attacks(r.events).map((a) => (a.kind === 'attack' ? a.by : ''))];
    };
    assert.deepEqual(first([15, 10]), ['attacker', 'attacker', 'defender']);
    assert.deepEqual(first([5, 15]), ['defender', 'defender', 'attacker']);
    assert.deepEqual(first([10, 10]), ['defender', 'defender', 'attacker']); // a tie goes to the defender
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
    const r = run(fight({ defender: nimble }), 15, 10, 9, 1); // 9 + 2 = 11 vs 12
    const mine = attacks(r.events)[0];
    assert.ok(mine?.kind === 'attack' && mine.result.dc === 12 && !mine.hit);
  });

  test('both sides can hit in the same round', () => {
    const r = run(fight(), 15, 10, 15, 2, 15, 3);
    assert.deepEqual(r.hp, { attacker: 7, defender: 8 });
  });

  test('a natural 20 is a critical hit: the damage dice are rolled twice', () => {
    const r = run(fight(), 15, 10, 20, 4, 4, 20, 1); // 8 damage leaves 2 HP, so a nerve check follows
    const mine = attacks(r.events)[0];
    assert.ok(mine?.kind === 'attack' && mine.critical && mine.damage?.total === 8);
    assert.equal(r.hp.defender, 2);
  });

  test('a natural 1 always misses', () => {
    const brute = createCharacter({ name: 'Brute', attributes: attributeScores({ str: 20 }), training: { brawling: 'expert' } }); // +9
    const r = run(fight({ attacker: brute }), 15, 10, 1, 1);
    const mine = attacks(r.events)[0];
    assert.ok(mine?.kind === 'attack' && mine.result.roll.total === 10 && !mine.hit);
  });

  test('a knocked-out character does not get to attack', () => {
    const r = run(fight({ defender: createCharacter({ name: 'Frail', attributes: attributeScores({ con: 1 }) }) }), 15, 10, 20, 4, 4); // 5 HP
    assert.deepEqual(kinds(r.events), ['initiative', 'attack', 'end']);
    assert.deepEqual(r.ending, { how: 'knocked-out', loser: 'defender' });
    assert.equal(r.hp.defender, 0);
  });

  test('no nerve check while above half hit points', () => {
    assert.deepEqual(kinds(run(fight(), 15, 10, 15, 4, 1).events), ['initiative', 'attack', 'attack', 'end']); // 10 → 6 HP
  });

  test('the first time a character drops to half hit points or below, they make one DC 10 nerve check', () => {
    // Round 1: hit for 4 (10 → 6 HP). Round 2: hit for 1 (→ 5 HP, half): the nerve check passes. Round 3: hit for 1 (→ 4
    // HP): no further check. The defender misses every time.
    const r = run(fight({ maxRounds: 3 }), 15, 10, 15, 4, 1, 15, 1, 10, 1, 15, 1, 1);
    assert.deepEqual(kinds(r.events), ['initiative', 'attack', 'attack', 'attack', 'nerve', 'attack', 'attack', 'attack', 'end']);
    const nerve = r.events.find((e) => e.kind === 'nerve');
    assert.ok(nerve?.kind === 'nerve' && nerve.trigger === 'hurt' && nerve.result.dc === 10 && nerve.passed);
    assert.equal(NERVE_DC.hurt, 10);
  });

  test('being hurt carries no roll penalty', () => {
    const r = run(fight({ maxRounds: 2 }), 15, 10, 20, 2, 3, 20, 1, 1, 15, 1);
    for (const e of r.events) if (e.kind === 'attack' || e.kind === 'nerve') assert.deepEqual(e.result.roll.modifiers.filter((m) => m.value < 0), []);
  });

  test('a defender who fails the nerve check in a fight surrenders', () => {
    const r = run(fight(), 15, 10, 20, 2, 3, 1); // critical for 5: 10 → 5 HP; nerve fails
    assert.deepEqual(r.ending, { how: 'surrenders', loser: 'defender' });
  });

  test('an attacker who fails the nerve check in a fight backs off', () => {
    const r = run(fight(), 5, 15, 20, 2, 3, 1); // the defender acts first: critical for 5; nerve fails
    assert.deepEqual(r.ending, { how: 'backs-off', loser: 'attacker' });
  });

  test('reaching 0 hit points is a knockout', () => {
    const r = run(fight({ maxRounds: 3 }), 15, 10, 20, 4, 4, 20, 1, 15, 4);
    assert.deepEqual(r.ending, { how: 'knocked-out', loser: 'defender' });
    assert.equal(r.rounds, 2);
  });

  test('does not use the lead', () => {
    assert.equal(run(fight(), 15, 10, 1, 1).lead, 0);
  });
});

describe('runContest: withdrawAt', { tags: ['unit'] }, () => {
  test('the attacker withdraws when the defender leads by withdrawAt', () => {
    const r = run(spec({ withdrawAt: 2, maxRounds: 3 }), 2, 10); // 4 vs 10: defender leads by 2
    assert.deepEqual(r.ending, { how: 'withdraws', loser: 'attacker' });
  });
});

describe('runContest: options', { tags: ['unit'] }, () => {
  test('throws for invalid winningLead, maxRounds or withdrawAt', () => {
    assert.throws(() => runContest(spec({ winningLead: 0 }), scripted()), RangeError);
    assert.throws(() => runContest(spec({ maxRounds: 0 }), scripted()), RangeError);
    assert.throws(() => runContest(spec({ withdrawAt: 6 }), scripted()), RangeError);
    assert.throws(() => runContest(spec({ withdrawAt: 0 }), scripted()), RangeError);
  });

  test('defaults to d20, winning lead 5 and 12 rounds', () => {
    const r = runContest({ attacker, defender: defender(), approach: 'intimidation' }, roller(seeded(1)));
    assert.ok(r.rounds <= 12);
  });
});

describe('contest descriptions', { tags: ['unit'] }, () => {
  test('describe every approach and the traits that decide a failed nerve check', () => {
    for (const a of APPROACHES) assert.ok(APPROACH_INFO[a].name && APPROACH_INFO[a].description, a);
    assert.deepEqual(Object.keys(NERVE_FAILURE).sort(), ['caution', 'courage', 'temper']);
  });
});

describe('ENDING_INFO', { tags: ['unit'] }, () => {
  test('explains every way a contest can end', () => {
    for (const how of ['outscored', 'knocked-out', 'surrenders', 'backs-off', 'complies', 'backs-down', 'flees', 'withdraws', 'stalemate'] as const)
      assert.ok(ENDING_INFO[how].title && ENDING_INFO[how].explanation, how);
  });
});

describe('tally', { tags: ['unit'] }, () => {
  test('counts endings by key and the counts sum to the number of runs', () => {
    const t = tally(spec({ maxRounds: 12 }), roller(seeded(2)), 200);
    assert.equal(Object.values(t).reduce((a, b) => a + b, 0), 200);
    assert.ok((t['outscored:defender'] ?? 0) + (t['complies:defender'] ?? 0) + (t['flees:defender'] ?? 0) > 0);
  });

  test('endingKey combines how and loser, or is just "stalemate"', () => {
    assert.equal(endingKey({ how: 'flees', loser: 'attacker' }), 'flees:attacker');
    assert.equal(endingKey({ how: 'stalemate', loser: null }), 'stalemate');
  });
});

describe('runContest', { tags: ['property'] }, () => {
  const contest = fc.record({
    seed: fc.integer(),
    a: fc.constantFrom(...BACKGROUNDS),
    d: fc.constantFrom(...BACKGROUNDS),
    approach: fc.constantFrom(...APPROACHES),
    winningLead: fc.integer({ min: 1, max: 8 }),
    maxRounds: fc.integer({ min: 1, max: 20 }),
  });
  const build = (c: { seed: number; a: BackgroundName; d: BackgroundName; approach: Approach; winningLead: number; maxRounds: number }) => {
    const r = roller(seeded(c.seed));
    const s: ContestSpec = { attacker: rollCharacter('A', c.a, r), defender: rollCharacter('D', c.d, r), approach: c.approach, winningLead: c.winningLead, maxRounds: c.maxRounds };
    return { spec: s, seed: c.seed };
  };

  test('ends within maxRounds with exactly one end event, which is last', () => {
    fc.assert(
      fc.property(contest, (c) => {
        const { spec: s, seed } = build(c);
        const r = runContest(s, roller(seeded(seed)));
        return r.rounds <= s.maxRounds! && r.events.filter((e) => e.kind === 'end').length === 1 && r.events.at(-1)?.kind === 'end';
      }),
    );
  });

  test('keeps hit points between 0 and the maximum', () => {
    fc.assert(
      fc.property(contest, (c) => {
        const { spec: s, seed } = build(c);
        const r = runContest(s, roller(seeded(seed)));
        return (['attacker', 'defender'] as const).every((side) => r.hp[side] >= 0 && r.hp[side] <= r.maxHp[side]);
      }),
    );
  });

  test('keeps the lead within ±winningLead', () => {
    fc.assert(
      fc.property(contest, (c) => {
        const { spec: s, seed } = build(c);
        return runContest(s, roller(seeded(seed))).events.every((e) => e.kind !== 'round' || Math.abs(e.lead) <= s.winningLead!);
      }),
    );
  });

  test('is deterministic for a seed', () => {
    fc.assert(
      fc.property(contest, (c) => {
        const { spec: s, seed } = build(c);
        assert.deepEqual(runContest(s, roller(seeded(seed))), runContest(s, roller(seeded(seed))));
      }),
    );
  });

  test('a fighter intimidating a shopkeeper wins more often than the reverse', () => {
    const r = roller(seeded(8));
    const wins = (a: BackgroundName, d: BackgroundName) => {
      let n = 0;
      for (let i = 0; i < 300; i++) {
        const out = runContest({ attacker: rollCharacter('A', a, r), defender: rollCharacter('D', d, r), approach: 'intimidation' }, r);
        if (out.ending.loser === 'defender') n++;
      }
      return n;
    };
    assert.ok(wins('fighter', 'shopkeeper') > wins('shopkeeper', 'fighter') + 60);
  });
});
