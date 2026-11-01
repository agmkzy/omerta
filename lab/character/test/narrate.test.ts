import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { createCharacter } from '../src/character';
import { runContest, type ContestSpec } from '../src/contest';
import { narrate } from '../src/narrate';
import { temperament } from '../src/temperament';
import { scripted } from './support';

const tony = createCharacter({ name: 'Tony', training: { intimidation: 'trained', brawling: 'trained' } });
const vinnie = (t: Parameters<typeof temperament>[0] = {}) => createCharacter({ name: 'Vinnie', temperament: temperament(t) });
const spec = (over: Partial<ContestSpec> = {}): ContestSpec => ({ attacker: tony, defender: vinnie(), approach: 'intimidate', track: 4, maxRounds: 1, ...over });
const story = (s: ContestSpec, ...faces: number[]) => {
  const r = runContest(s, scripted(...faces));
  return r.events.map((e) => narrate(e, s));
};

describe('a contest told in words', { tags: ['unit'] }, () => {
  test('pressure, a test of nerve, and giving in', () => {
    assert.deepEqual(story(spec(), 15, 10, 9), [
      'Round 1. Tony leans on Vinnie (17 against 10). Vinnie gives ground.',
      'Vinnie is losing and knows it. He needs 10 to hold his nerve: 9. It goes.',
      'Vinnie gives in.',
    ]);
  });

  test('standing firm, and a draw', () => {
    assert.deepEqual(story(spec(), 8, 10), ['Round 1. Tony leans on Vinnie (10 against 10). Neither gives an inch.', 'Neither man breaks. It is left unsettled.']);
    assert.deepEqual(story(spec({ track: 8 }), 1, 15)[0], 'Round 1. Tony leans on Vinnie (3 against 15). Vinnie stands up to him, and Tony gives ground.');
  });

  test('a gun, a blow, a hothead', () => {
    assert.deepEqual(story(spec({ approach: 'gunpoint' }), 5), ['Tony draws a gun. Vinnie needs 12 to hold his nerve: 5. It goes.', 'Vinnie gives in.']);
    assert.deepEqual(story(spec({ approach: 'rough-up', track: 10 }), 15, 10, 13), [
      'Round 1. Tony and Vinnie trade blows (17 against 10). Vinnie gives ground.',
      'Vinnie takes a blow (1 so far).',
      'Vinnie is hurt. He needs 12 to hold his nerve: 12. He holds.',
      'Neither man breaks. It is left unsettled.',
    ]);
    assert.deepEqual(story(spec({ maxRounds: 2, defender: vinnie({ temper: 0.9 }) }), 15, 10, 9, 10, 10).slice(2, 3), ['Vinnie snaps and goes for him. It is a fight now.']);
  });

  test('every way it can end', () => {
    assert.equal(story(spec({ track: 1 }), 15, 10).at(-1), 'Vinnie gives in.');
    assert.equal(story(spec({ track: 1 }), 1, 20).at(-1), 'Tony backs down.');
    assert.equal(story(spec({ track: 4, defender: vinnie({ courage: 0.1 }) }), 15, 10, 11).at(-1), 'Vinnie runs.');
    assert.equal(story(spec({ walkAwayAt: 2, track: 5 }), 2, 10).at(-1), 'Tony has seen enough and walks away.');
    assert.equal(story(spec({ approach: 'rough-up', track: 1 }), 12, 10).at(-1), 'Vinnie is beaten.');
    assert.equal(story(spec({ approach: 'rough-up', track: 10, maxRounds: 5 }), 15, 10, 20, 15, 10, 20, 15, 10).at(-1), 'Vinnie goes down and stays down.');
    assert.equal(story(spec({ approach: 'rough-up', track: 1 }), 1, 20).at(-1), 'Tony is beaten.');
  });

  test('a man who started it and loses his nerve gives up', () => {
    // Pushed back past halfway (−2 of 4), Tony's own nerve fails.
    assert.equal(story(spec({ maxRounds: 2 }), 1, 12, 1).at(-1), 'Tony gives it up as a bad job.');
  });
});
