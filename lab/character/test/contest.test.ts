import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { BACKGROUNDS, rollCharacter, type BackgroundName } from '../src/backgrounds';
import { createCharacter, type Character } from '../src/character';
import { APPROACHES, APPROACH_INFO, NERVE_FAILURE, endingKey, runContest, tally, type Approach, type ContestEvent, type ContestSpec } from '../src/contest';
import { roller, seeded } from '../src/random';
import { temperament } from '../src/temperament';
import { scripted } from './support';

// Attacker: Intimidation +2, Brawling +2, Nerve +0. Defender: +0 to everything. Both have average temperament unless stated.
const attacker = createCharacter({ name: 'Attacker', training: { intimidation: 'trained', brawling: 'trained' } });
const defender = (t: Parameters<typeof temperament>[0] = {}): Character => createCharacter({ name: 'Defender', temperament: temperament(t) });

const spec = (over: Partial<ContestSpec> = {}): ContestSpec => ({ attacker, defender: defender(), approach: 'intimidate', track: 5, maxRounds: 1, ...over });
const kinds = (events: readonly ContestEvent[]) => events.map((e) => e.kind);
const exchanges = (events: readonly ContestEvent[]) => events.filter((e) => e.kind === 'exchange');

/** Runs a contest on scripted faces and checks that every face was used. */
function run(s: ContestSpec, ...faces: number[]) {
  const dice = scripted(...faces);
  const result = runContest(s, dice);
  assert.equal(dice.remaining, 0, 'not all scripted faces were used');
  return result;
}

describe('runContest: marker movement', { tags: ['unit'] }, () => {
  test('moves the marker one step per 5 points of difference, rounded up', () => {
    assert.equal(run(spec(), 12, 10).marker, 1); // 14 vs 10
    const r = run(spec(), 15, 10); // 17 vs 10
    assert.equal(r.marker, 2);
    assert.deepEqual(kinds(r.events), ['exchange', 'end']);
  });

  test('does not move the marker on a tie', () => {
    assert.equal(run(spec(), 8, 10).marker, 0);
  });

  test('moves the marker towards the attacker when the defender wins', () => {
    assert.equal(run(spec({ track: 8 }), 1, 15).marker, -3); // 3 vs 15
  });

  test('ends in a stalemate after maxRounds', () => {
    assert.deepEqual(run(spec({ maxRounds: 2 }), 8, 10, 8, 10).ending, { how: 'stalemate', loser: null });
  });
});

describe('runContest: end of track', { tags: ['unit'] }, () => {
  test('the defender loses when the marker reaches +track', () => {
    const r = run(spec({ track: 1 }), 15, 10);
    assert.deepEqual(r.ending, { how: 'pushed', loser: 'defender' });
    assert.equal(r.marker, 1);
  });

  test('the attacker loses when the marker reaches -track', () => {
    assert.deepEqual(run(spec({ track: 1 }), 1, 20).ending, { how: 'pushed', loser: 'attacker' });
  });
});

describe('runContest: nerve checks', { tags: ['unit'] }, () => {
  test('a side pushed past halfway makes a DC 10 nerve check; passing continues the contest', () => {
    const r = run(spec({ track: 4 }), 15, 10, 10); // marker 2 of 4; nerve 10 vs DC 10
    assert.deepEqual(kinds(r.events), ['exchange', 'nerve', 'end']);
    const nerve = r.events[1];
    assert.ok(nerve?.kind === 'nerve' && nerve.side === 'defender' && nerve.trigger === 'pushed-back' && nerve.held);
    assert.equal(r.ending.how, 'stalemate');
  });

  test('failing the nerve check ends the contest; average temperament yields', () => {
    assert.deepEqual(run(spec({ track: 4 }), 15, 10, 9).ending, { how: 'yields', loser: 'defender' });
  });

  test('the pushed-back check happens only once per side', () => {
    const r = run(spec({ track: 4, maxRounds: 2 }), 15, 10, 10, 12, 10);
    assert.deepEqual(kinds(r.events), ['exchange', 'nerve', 'exchange', 'end']);
  });

  test('low courage: flees on failure', () => {
    const r = run(spec({ track: 4, defender: defender({ courage: 0.1 }) }), 15, 10, 11); // 11 − 2 (timid)
    assert.deepEqual(r.ending, { how: 'flees', loser: 'defender' });
  });

  test('high caution: flees on failure', () => {
    assert.deepEqual(run(spec({ track: 4, defender: defender({ caution: 0.9 }) }), 15, 10, 9).ending, { how: 'flees', loser: 'defender' });
  });

  test('high temper: lashes out on failure and the contest becomes a brawl', () => {
    const r = run(spec({ track: 4, maxRounds: 2, defender: defender({ temper: 0.9 }) }), 15, 10, 9, 10, 10);
    assert.deepEqual(kinds(r.events), ['exchange', 'nerve', 'lash-out', 'exchange', 'end']);
    const second = exchanges(r.events)[1];
    assert.ok(second?.kind === 'exchange' && second.approach === 'brawl');
    assert.equal(r.ending.how, 'stalemate');
  });

  test('high temper: lashes out only once; a second failure yields', () => {
    // Round 1: marker 3 of 6, nerve fails, lashes out. Round 2 (brawl): hit taken, nerve fails again.
    const r = run(spec({ track: 6, maxRounds: 2, defender: defender({ temper: 0.9 }) }), 20, 10, 1, 15, 10, 1);
    assert.deepEqual(kinds(r.events), ['exchange', 'nerve', 'lash-out', 'exchange', 'hit', 'nerve', 'end']);
    assert.deepEqual(r.ending, { how: 'yields', loser: 'defender' });
  });
});

describe('runContest: gunpoint', { tags: ['unit'] }, () => {
  test('the defender makes a DC 12 nerve check before the first round', () => {
    const r = run(spec({ approach: 'gunpoint' }), 5);
    assert.deepEqual(kinds(r.events), ['nerve', 'end']);
    const nerve = r.events[0];
    assert.ok(nerve?.kind === 'nerve' && nerve.trigger === 'gun-drawn' && nerve.result.dc === 12);
    assert.deepEqual(r.ending, { how: 'yields', loser: 'defender' });
    assert.equal(r.rounds, 0);
  });

  test('the attacker rolls with advantage', () => {
    const r = run(spec({ approach: 'gunpoint' }), 12, 3, 15, 10); // nerve passes; attacker keeps 15 over 3
    const first = exchanges(r.events)[0];
    assert.ok(first?.kind === 'exchange' && first.result.active.thrown.kept === 15 && first.result.active.edge === 'advantage');
  });
});

describe('runContest: brawl', { tags: ['unit'] }, () => {
  const brawl = (over: Partial<ContestSpec> = {}) => spec({ approach: 'brawl', track: 10, ...over });

  test('winning a round by 5 or more lands a hit, followed by a nerve check and a −1 penalty per hit', () => {
    const r = run(brawl({ maxRounds: 2 }), 15, 10, 13, 10, 10);
    assert.deepEqual(kinds(r.events), ['exchange', 'hit', 'nerve', 'exchange', 'end']);
    const nerve = r.events[2];
    assert.ok(nerve?.kind === 'nerve' && nerve.trigger === 'hit' && nerve.result.dc === 12 && nerve.result.roll.total === 12 && nerve.held);
    const second = exchanges(r.events)[1];
    assert.ok(second?.kind === 'exchange');
    assert.deepEqual(second.result.passive.modifiers.at(-1), { value: -1, reason: 'Injured (1)' });
    assert.equal(r.hits.defender, 1);
  });

  test('winning by less than 5 lands no hit', () => {
    assert.deepEqual(kinds(run(brawl(), 12, 10).events), ['exchange', 'end']);
  });

  test('three hits is a knockout', () => {
    const r = run(brawl({ maxRounds: 5 }), 15, 10, 20, 15, 10, 20, 15, 10);
    assert.deepEqual(r.ending, { how: 'knocked-out', loser: 'defender' });
    assert.equal(r.hits.defender, 3);
    assert.equal(r.rounds, 3);
  });
});

describe('runContest: walk-away line', { tags: ['unit'] }, () => {
  test('the attacker withdraws when the marker reaches -walkAwayAt', () => {
    const r = run(spec({ walkAwayAt: 2, maxRounds: 3 }), 2, 10); // 4 vs 10: marker −2
    assert.deepEqual(r.ending, { how: 'walked-away', loser: 'attacker' });
  });
});

describe('runContest: options', { tags: ['unit'] }, () => {
  test('throws for invalid track, maxRounds or walkAwayAt', () => {
    assert.throws(() => runContest(spec({ track: 0 }), scripted()), RangeError);
    assert.throws(() => runContest(spec({ maxRounds: 0 }), scripted()), RangeError);
    assert.throws(() => runContest(spec({ walkAwayAt: 6 }), scripted()), RangeError);
    assert.throws(() => runContest(spec({ walkAwayAt: 0 }), scripted()), RangeError);
  });

  test('defaults to d20, track 5 and 12 rounds', () => {
    const r = runContest({ attacker, defender: defender(), approach: 'intimidate' }, roller(seeded(1)));
    assert.ok(r.rounds <= 12);
  });
});

describe('contest descriptions', { tags: ['unit'] }, () => {
  test('describe every approach and the traits that decide a failed nerve check', () => {
    for (const a of APPROACHES) assert.ok(APPROACH_INFO[a].name && APPROACH_INFO[a].description, a);
    assert.deepEqual(Object.keys(NERVE_FAILURE).sort(), ['caution', 'courage', 'temper']);
  });
});

describe('tally', { tags: ['unit'] }, () => {
  test('counts endings by key and the counts sum to the number of runs', () => {
    const t = tally(spec({ maxRounds: 12 }), roller(seeded(2)), 200);
    assert.equal(Object.values(t).reduce((a, b) => a + b, 0), 200);
    assert.ok((t['pushed:defender'] ?? 0) + (t['yields:defender'] ?? 0) + (t['flees:defender'] ?? 0) > 0);
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
    track: fc.integer({ min: 1, max: 8 }),
    maxRounds: fc.integer({ min: 1, max: 20 }),
  });
  const build = (c: { seed: number; a: BackgroundName; d: BackgroundName; approach: Approach; track: number; maxRounds: number }) => {
    const r = roller(seeded(c.seed));
    const s: ContestSpec = { attacker: rollCharacter('A', c.a, r), defender: rollCharacter('D', c.d, r), approach: c.approach, track: c.track, maxRounds: c.maxRounds };
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

  test('keeps the marker within the track', () => {
    fc.assert(
      fc.property(contest, (c) => {
        const { spec: s, seed } = build(c);
        return runContest(s, roller(seeded(seed))).events.every((e) => e.kind !== 'exchange' || Math.abs(e.marker) <= s.track!);
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

  test('an enforcer intimidating a shopkeeper wins more often than the reverse', () => {
    const r = roller(seeded(8));
    const wins = (a: BackgroundName, d: BackgroundName) => {
      let n = 0;
      for (let i = 0; i < 300; i++) {
        const out = runContest({ attacker: rollCharacter('A', a, r), defender: rollCharacter('D', d, r), approach: 'intimidate' }, r);
        if (out.ending.loser === 'defender') n++;
      }
      return n;
    };
    assert.ok(wins('enforcer', 'shopkeeper') > wins('shopkeeper', 'enforcer') + 60);
  });
});
