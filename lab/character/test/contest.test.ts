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

  test('failing the nerve check ends the contest; average temperament gives up', () => {
    assert.deepEqual(run(spec({ winningLead: 4 }), 15, 10, 9).ending, { how: 'gives-up', loser: 'defender' });
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
    // Round 2 is a fight: 12 vs 10, not a win by 5, so no hit.
    const r = run(spec({ winningLead: 4, maxRounds: 2, defender: defender({ temper: 0.9 }) }), 15, 10, 9, 10, 10);
    assert.deepEqual(kinds(r.events), ['round', 'nerve', 'escalation', 'fight-round', 'end']);
    assert.equal(r.ending.how, 'stalemate');
  });

  test('high temper: does not escalate during a fight; a failed nerve check gives up', () => {
    // Round 1: lead 3 of 6, nerve fails, escalates. Round 2 (fight): critical hit for 5 (10 → 5 HP, badly hurt), nerve fails again.
    const r = run(spec({ winningLead: 6, maxRounds: 2, defender: defender({ temper: 0.9 }) }), 20, 10, 1, 20, 5, 2, 3, 1);
    assert.deepEqual(kinds(r.events), ['round', 'nerve', 'escalation', 'fight-round', 'nerve', 'end']);
    assert.deepEqual(r.ending, { how: 'gives-up', loser: 'defender' });
  });
});

describe('runContest: armed threat', { tags: ['unit'] }, () => {
  test('the defender makes a DC 12 nerve check before the first round', () => {
    const r = run(spec({ approach: 'armed-threat' }), 5);
    assert.deepEqual(kinds(r.events), ['nerve', 'end']);
    const nerve = r.events[0];
    assert.ok(nerve?.kind === 'nerve' && nerve.trigger === 'weapon-drawn' && nerve.result.dc === 12);
    assert.deepEqual(r.ending, { how: 'gives-up', loser: 'defender' });
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
  // Both characters have 10 HP, so 5 HP or below is badly hurt.
  const fight = (over: Partial<ContestSpec> = {}) => spec({ approach: 'fight', ...over });
  const fightRounds = (events: readonly ContestEvent[]) => events.filter((e) => e.kind === 'fight-round');

  test('each side starts with its maximum hit points', () => {
    const r = run(fight(), 8, 10);
    assert.deepEqual(r.maxHp, { attacker: 10, defender: 10 });
    assert.deepEqual(r.hp, { attacker: 10, defender: 10 });
  });

  test('winning a round by 5 or more hits for 1d4 + Strength modifier', () => {
    const r = run(fight(), 15, 10, 3); // 17 vs 10; 3 damage
    const round = fightRounds(r.events)[0];
    assert.ok(round?.kind === 'fight-round' && round.hit?.by === 'attacker' && round.hit.damage.total === 3 && !round.hit.critical);
    assert.equal(r.hp.defender, 7);
  });

  test('winning by less than 5, or a tie, is no hit', () => {
    for (const faces of [[12, 10], [8, 10]]) {
      const round = fightRounds(run(fight(), ...faces).events)[0];
      assert.ok(round?.kind === 'fight-round' && round.hit === null, faces.join(','));
    }
  });

  test('the defender can hit the attacker', () => {
    const r = run(fight(), 5, 15, 2); // 7 vs 15: a hit for 2
    assert.equal(r.hp.attacker, 8);
  });

  test('winning by 10 or more is a critical hit', () => {
    const r = run(fight(), 20, 5, 4, 4, 20); // 22 vs 5; 8 damage, then a nerve check at 2 HP
    const round = fightRounds(r.events)[0];
    assert.ok(round?.kind === 'fight-round' && round.hit?.critical === true);
    assert.equal(r.hp.defender, 2);
  });

  test('no nerve check while above half hit points', () => {
    assert.deepEqual(kinds(run(fight(), 15, 10, 4).events), ['fight-round', 'end']); // 10 → 6 HP
  });

  test('each hit taken at half hit points or below triggers a nerve check, and gives −2 to rolls', () => {
    const r = run(fight({ maxRounds: 3 }), 15, 10, 4, 15, 10, 1, 20, 10, 10);
    assert.deepEqual(kinds(r.events), ['fight-round', 'fight-round', 'nerve', 'fight-round', 'end']);
    const nerve = r.events[2];
    assert.ok(nerve?.kind === 'nerve' && nerve.trigger === 'hurt' && nerve.result.dc === NERVE_DC.hurt && nerve.result.roll.modifiers.some((m) => m.reason === 'Badly hurt'));
    const third = fightRounds(r.events)[2];
    assert.ok(third?.kind === 'fight-round');
    assert.deepEqual(third.result.passive.modifiers.at(-1), { value: -2, reason: 'Badly hurt' });
    assert.equal(r.hp.defender, 5);
  });

  test('failing the nerve check when badly hurt ends the fight', () => {
    assert.deepEqual(run(fight({ maxRounds: 2 }), 15, 10, 4, 15, 10, 1, 1).ending, { how: 'gives-up', loser: 'defender' });
  });

  test('reaching 0 hit points is a knockout', () => {
    const r = run(fight({ maxRounds: 3 }), 20, 5, 4, 4, 20, 15, 10, 2);
    assert.deepEqual(r.ending, { how: 'knocked-out', loser: 'defender' });
    assert.equal(r.hp.defender, 0);
    assert.equal(r.rounds, 2);
  });

  test('does not use the lead', () => {
    assert.equal(run(fight(), 15, 10, 1).lead, 0);
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
    for (const how of ['outscored', 'knocked-out', 'gives-up', 'flees', 'withdraws', 'stalemate'] as const)
      assert.ok(ENDING_INFO[how].title && ENDING_INFO[how].explanation, how);
  });
});

describe('tally', { tags: ['unit'] }, () => {
  test('counts endings by key and the counts sum to the number of runs', () => {
    const t = tally(spec({ maxRounds: 12 }), roller(seeded(2)), 200);
    assert.equal(Object.values(t).reduce((a, b) => a + b, 0), 200);
    assert.ok((t['outscored:defender'] ?? 0) + (t['gives-up:defender'] ?? 0) + (t['flees:defender'] ?? 0) > 0);
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
