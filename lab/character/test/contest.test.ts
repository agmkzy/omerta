import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { rollCharacter } from '../src/backgrounds';
import { createCharacter, type Character } from '../src/character';
import { APPROACHES, runContest, tally, type ContestEvent, type ContestSpec } from '../src/contest';
import { roller, seeded } from '../src/random';
import { temperament } from '../src/temperament';
import { scripted } from './support';

// Tony: Intimidation +2, Brawling +2, Nerve +0. Vinnie: +0 at everything. Both middling in temperament unless a test says otherwise.
const tony = createCharacter({ name: 'Tony', training: { intimidation: 'trained', brawling: 'trained' } });
const vinnie = (t: Parameters<typeof temperament>[0] = {}): Character => createCharacter({ name: 'Vinnie', temperament: temperament(t) });

const spec = (over: Partial<ContestSpec> = {}): ContestSpec => ({ attacker: tony, defender: vinnie(), approach: 'intimidate', track: 5, maxRounds: 1, ...over });
const kinds = (events: readonly ContestEvent[]) => events.map((e) => e.kind);
const exchanges = (events: readonly ContestEvent[]) => events.filter((e) => e.kind === 'exchange');

function run(s: ContestSpec, ...faces: number[]) {
  const dice = scripted(...faces);
  const result = runContest(s, dice);
  assert.equal(dice.remaining, 0, 'the contest left faces unrolled');
  return result;
}

describe('a round of a contest', { tags: ['unit'] }, () => {
  test('the better roll moves the marker, a step for every 5 points it wins by', () => {
    const narrow = run(spec(), 12, 10); // 14 against 10
    assert.equal(narrow.marker, 1);
    const clear = run(spec(), 15, 10); // 17 against 10
    assert.equal(clear.marker, 2);
    assert.deepEqual(kinds(clear.events), ['exchange', 'end']);
  });

  test('a tie leaves the marker where it was', () => {
    assert.equal(run(spec(), 8, 10).marker, 0);
  });

  test('the defender can push back', () => {
    assert.equal(run(spec({ track: 8 }), 1, 15).marker, -3); // 3 against 15
  });

  test('runs out of rounds in a stalemate', () => {
    assert.deepEqual(run(spec({ maxRounds: 2 }), 8, 10, 8, 10).ending, { how: 'stalemate', loser: null });
  });
});

describe('the end of the track', { tags: ['unit'] }, () => {
  test('a man pushed to the end gives in', () => {
    const r = run(spec({ track: 1 }), 15, 10);
    assert.deepEqual(r.ending, { how: 'pushed', loser: 'defender' });
    assert.equal(r.marker, 1);
  });

  test('so does the man who started it', () => {
    assert.deepEqual(run(spec({ track: 1 }), 1, 20).ending, { how: 'pushed', loser: 'attacker' });
  });
});

describe('nerve', { tags: ['unit'] }, () => {
  test('a man pushed past halfway must hold his nerve; if he does, it goes on', () => {
    const r = run(spec({ track: 4 }), 15, 10, 10); // pushed to 2 of 4; Nerve 10 against 10
    assert.deepEqual(kinds(r.events), ['exchange', 'nerve', 'end']);
    const nerve = r.events[1];
    assert.ok(nerve?.kind === 'nerve' && nerve.side === 'defender' && nerve.trigger === 'pushed-back' && nerve.held);
    assert.equal(r.ending.how, 'stalemate');
  });

  test('if he doesn’t, he breaks', () => {
    const r = run(spec({ track: 4 }), 15, 10, 9);
    assert.deepEqual(r.ending, { how: 'yields', loser: 'defender' });
  });

  test('is tested once for being pushed back, not every round after', () => {
    const r = run(spec({ track: 4, maxRounds: 2 }), 15, 10, 10, 12, 10);
    assert.deepEqual(kinds(r.events), ['exchange', 'nerve', 'exchange', 'end']);
  });

  test('a timid man runs', () => {
    const r = run(spec({ track: 4, defender: vinnie({ courage: 0.1 }) }), 15, 10, 11); // 11 − 2 for being timid
    assert.deepEqual(r.ending, { how: 'flees', loser: 'defender' });
  });

  test('so does a cautious one', () => {
    assert.deepEqual(run(spec({ track: 4, defender: vinnie({ caution: 0.9 }) }), 15, 10, 9).ending, { how: 'flees', loser: 'defender' });
  });

  test('a hothead lashes out, and it turns into a fight', () => {
    const r = run(spec({ track: 4, maxRounds: 2, defender: vinnie({ temper: 0.9 }) }), 15, 10, 9, 10, 10);
    assert.deepEqual(kinds(r.events), ['exchange', 'nerve', 'lash-out', 'exchange', 'end']);
    const second = exchanges(r.events)[1];
    assert.ok(second?.kind === 'exchange' && second.approach === 'rough-up');
    assert.equal(r.ending.how, 'stalemate');
  });

  test('he lashes out only once; the next time he breaks, he gives up', () => {
    // Round 1 pushes him past halfway and he lashes out. Round 2 is a fight: a blow lands, Nerve fails again.
    const r = run(spec({ track: 6, maxRounds: 2, defender: vinnie({ temper: 0.9 }) }), 20, 10, 1, 15, 10, 1);
    assert.deepEqual(kinds(r.events), ['exchange', 'nerve', 'lash-out', 'exchange', 'hit', 'nerve', 'end']);
    assert.deepEqual(r.ending, { how: 'yields', loser: 'defender' });
  });
});

describe('at gunpoint', { tags: ['unit'] }, () => {
  test('the gun coming out tests his nerve before anything else', () => {
    const r = run(spec({ approach: 'gunpoint' }), 5);
    assert.deepEqual(kinds(r.events), ['nerve', 'end']);
    const nerve = r.events[0];
    assert.ok(nerve?.kind === 'nerve' && nerve.trigger === 'gun-drawn' && nerve.result.dc === 12);
    assert.deepEqual(r.ending, { how: 'yields', loser: 'defender' });
    assert.equal(r.rounds, 0);
  });

  test('the man with the gun has the advantage', () => {
    const r = run(spec({ approach: 'gunpoint' }), 12, 3, 15, 10); // holds his nerve, then 15 is kept over 3
    const first = exchanges(r.events)[0];
    assert.ok(first?.kind === 'exchange' && first.result.active.thrown.kept === 15 && first.result.active.edge === 'advantage');
  });
});

describe('roughing a man up', { tags: ['unit'] }, () => {
  const brawl = (over: Partial<ContestSpec> = {}) => spec({ approach: 'rough-up', track: 10, ...over });

  test('a clear win lands a blow, which tests his nerve and stays with him', () => {
    const r = run(brawl({ maxRounds: 2 }), 15, 10, 13, 10, 10);
    assert.deepEqual(kinds(r.events), ['exchange', 'hit', 'nerve', 'exchange', 'end']);
    const nerve = r.events[2];
    assert.ok(nerve?.kind === 'nerve' && nerve.trigger === 'hurt' && nerve.result.dc === 12 && nerve.result.roll.total === 12 && nerve.held);
    const second = exchanges(r.events)[1];
    assert.ok(second?.kind === 'exchange');
    assert.deepEqual(second.result.passive.modifiers.at(-1), { value: -1, reason: 'Hurt (1 blow)' });
    assert.equal(r.hurts.defender, 1);
  });

  test('a narrow win lands nothing', () => {
    assert.deepEqual(kinds(run(brawl(), 12, 10).events), ['exchange', 'end']);
  });

  test('three blows and he is down', () => {
    const r = run(brawl({ maxRounds: 5 }), 15, 10, 20, 15, 10, 20, 15, 10);
    assert.deepEqual(r.ending, { how: 'down', loser: 'defender' });
    assert.equal(r.hurts.defender, 3);
    assert.equal(r.rounds, 3);
  });
});

describe('walking away', { tags: ['unit'] }, () => {
  test('the man who started it leaves once it goes past his line', () => {
    const r = run(spec({ walkAwayAt: 2, maxRounds: 3 }), 2, 10); // 4 against 10: back 2
    assert.deepEqual(r.ending, { how: 'walked-away', loser: 'attacker' });
  });
});

describe('a contest’s terms', { tags: ['unit'] }, () => {
  test('are checked', () => {
    assert.throws(() => runContest(spec({ track: 0 }), scripted()), RangeError);
    assert.throws(() => runContest(spec({ maxRounds: 0 }), scripted()), RangeError);
    assert.throws(() => runContest(spec({ walkAwayAt: 6 }), scripted()), RangeError);
    assert.throws(() => runContest(spec({ walkAwayAt: 0 }), scripted()), RangeError);
  });

  test('default to a d20, a track of 5 and 12 rounds', () => {
    const r = runContest({ attacker: tony, defender: vinnie(), approach: 'intimidate' }, roller(seeded(1)));
    assert.ok(r.rounds <= 12);
  });
});

describe('many contests', { tags: ['unit'] }, () => {
  test('are tallied by how they ended', () => {
    const t = tally(spec({ maxRounds: 12 }), roller(seeded(2)), 200);
    assert.equal(Object.values(t).reduce((a, b) => a + b, 0), 200);
    assert.ok((t['pushed:defender'] ?? 0) + (t['yields:defender'] ?? 0) + (t['flees:defender'] ?? 0) > 0);
  });
});

describe('contests', { tags: ['property'] }, () => {
  const backgrounds = fc.constantFrom('legbreaker', 'wheelman', 'shooter', 'earner', 'hustler', 'bookkeeper', 'shopkeeper', 'labourer' as const);
  const contest = fc.record({
    seed: fc.integer(),
    a: backgrounds,
    d: backgrounds,
    approach: fc.constantFrom(...APPROACHES),
    track: fc.integer({ min: 1, max: 8 }),
    maxRounds: fc.integer({ min: 1, max: 20 }),
  });
  const build = (c: { seed: number; a: Parameters<typeof rollCharacter>[1]; d: Parameters<typeof rollCharacter>[1]; approach: (typeof APPROACHES)[number]; track: number; maxRounds: number }) => {
    const r = roller(seeded(c.seed));
    return { spec: { attacker: rollCharacter('A', c.a, r), defender: rollCharacter('D', c.d, r), approach: c.approach, track: c.track, maxRounds: c.maxRounds }, seed: c.seed };
  };

  test('always end, within their rounds, with one ending last', () => {
    fc.assert(
      fc.property(contest, (c) => {
        const { spec: s, seed } = build(c);
        const r = runContest(s, roller(seeded(seed)));
        const ends = r.events.filter((e) => e.kind === 'end');
        return r.rounds <= s.maxRounds && ends.length === 1 && r.events.at(-1)?.kind === 'end';
      }),
    );
  });

  test('keep the marker on the track', () => {
    fc.assert(
      fc.property(contest, (c) => {
        const { spec: s, seed } = build(c);
        return runContest(s, roller(seeded(seed))).events.every((e) => e.kind !== 'exchange' || Math.abs(e.marker) <= s.track);
      }),
    );
  });

  test('tell the same story from the same seed', () => {
    fc.assert(
      fc.property(contest, (c) => {
        const { spec: s, seed } = build(c);
        assert.deepEqual(runContest(s, roller(seeded(seed))), runContest(s, roller(seeded(seed))));
      }),
    );
  });

  test('favour the man better suited to them', () => {
    const r = roller(seeded(8));
    const wins = (a: 'legbreaker' | 'shopkeeper', d: 'legbreaker' | 'shopkeeper') => {
      let n = 0;
      for (let i = 0; i < 300; i++) {
        const out = runContest({ attacker: rollCharacter('A', a, r), defender: rollCharacter('D', d, r), approach: 'intimidate' }, r);
        if (out.ending.loser === 'defender') n++;
      }
      return n;
    };
    assert.ok(wins('legbreaker', 'shopkeeper') > wins('shopkeeper', 'legbreaker') + 60);
  });
});
