import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { createCharacter } from '../src/character';
import { runContest, type ContestSpec } from '../src/contest';
import { describeEvent } from '../src/contest-log';
import { temperament } from '../src/temperament';
import { scripted } from './support';

const attacker = createCharacter({ name: 'A', training: { intimidation: 'trained', brawling: 'trained' } });
const defender = (t: Parameters<typeof temperament>[0] = {}) => createCharacter({ name: 'D', temperament: temperament(t) });
const spec = (over: Partial<ContestSpec> = {}): ContestSpec => ({ attacker, defender: defender(), approach: 'intimidate', track: 4, maxRounds: 1, ...over });
const log = (s: ContestSpec, ...faces: number[]) => runContest(s, scripted(...faces)).events.map((e) => describeEvent(e, s));

describe('describeEvent', { tags: ['unit'] }, () => {
  test('describes exchanges, nerve checks and the ending', () => {
    assert.deepEqual(log(spec(), 15, 10, 9), [
      'Round 1 (intimidate): A 17 vs D 10. Marker +2 (now 2).',
      'D nerve check (pushed back), DC 10: 9, failed.',
      'D loses: failed a nerve check and yields.',
    ]);
  });

  test('describes an unchanged marker and backward movement', () => {
    assert.deepEqual(log(spec(), 8, 10)[0], 'Round 1 (intimidate): A 10 vs D 10. Marker unchanged (0).');
    assert.deepEqual(log(spec({ track: 8 }), 1, 15)[0], 'Round 1 (intimidate): A 3 vs D 15. Marker -3 (now -3).');
  });

  test('describes gun-drawn checks, hits and lash-outs', () => {
    assert.deepEqual(log(spec({ approach: 'gunpoint' }), 5)[0], 'D nerve check (gun drawn), DC 12: 5, failed.');
    assert.deepEqual(log(spec({ approach: 'brawl', track: 10 }), 15, 10, 13).slice(1, 3), ['D takes a hit (1 total).', 'D nerve check (hit), DC 12: 12, passed.']);
    assert.deepEqual(log(spec({ maxRounds: 2, defender: defender({ temper: 0.9 }) }), 15, 10, 9, 10, 10)[2], 'D lashes out. The contest becomes a brawl.');
  });

  test('describes every kind of ending', () => {
    assert.equal(log(spec({ track: 1 }), 15, 10).at(-1), 'D loses: pushed to the end of the track.');
    assert.equal(log(spec({ track: 4, defender: defender({ courage: 0.1 }) }), 15, 10, 11).at(-1), 'D loses: failed a nerve check and flees.');
    assert.equal(log(spec({ walkAwayAt: 2, track: 5 }), 2, 10).at(-1), 'A loses: withdraws at the walk-away line.');
    assert.equal(log(spec({ approach: 'brawl', track: 10, maxRounds: 5 }), 15, 10, 20, 15, 10, 20, 15, 10).at(-1), 'D loses: knocked out.');
    assert.equal(log(spec(), 8, 10).at(-1), 'Stalemate: round limit reached.');
  });
});
