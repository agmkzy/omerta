import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { attributeScores } from '../../../src/overhaul/character/attributes';
import { CAST_FORMAT, ReplacedCastError, cast, castOf } from '../../../src/overhaul/character/cast';
import { createCharacter } from '../../../src/overhaul/character/character';
import { temperament } from '../../../src/overhaul/character/temperament';

const sam = { id: 'sam', name: 'Sam', attributes: attributeScores({ agi: 14 }), training: { larceny: 'trained' }, startingTemperament: { caution: 0.8 } } as const;
const rico = { id: 'rico', name: 'Rico', background: 'fighter', attributes: attributeScores({ str: 16 }) } as const;

describe('cast', { tags: ['unit'] }, () => {
  test('holds every character, in the order given, as plain records with a format number', () => {
    const everyone = cast({ characters: [sam, rico] });
    assert.deepEqual(everyone.data, { format: CAST_FORMAT, characters: [createCharacter(sam), createCharacter(rico)], transfers: [], facts: [], nextId: 1 });
    assert.deepEqual(everyone.characters.map((c) => c.id), ['sam', 'rico']);
    assert.deepEqual(JSON.parse(JSON.stringify(everyone.data)), everyone.data);
  });

  test('is empty when given no one', () => {
    assert.deepEqual(cast().data, { format: CAST_FORMAT, characters: [], transfers: [], facts: [], nextId: 1 });
  });

  test('refuses two characters with the same id', () => {
    assert.throws(() => cast({ characters: [sam, { id: 'sam', name: 'Another Sam' }] }), RangeError);
    assert.throws(() => castOf({ format: CAST_FORMAT, characters: [createCharacter(sam), createCharacter(sam)], transfers: [], facts: [], nextId: 1 }), RangeError);
  });

  test('gives one handle per character, and refuses an id it does not hold', () => {
    const everyone = cast({ characters: [sam] });
    assert.equal(everyone.character('sam'), everyone.character('sam'));
    assert.equal(everyone.has('sam'), true);
    assert.equal(everyone.has('joe'), false);
    assert.throws(() => everyone.character('joe'), RangeError);
  });
});

describe('character handles', { tags: ['unit'] }, () => {
  const everyone = cast({ characters: [sam, rico] });
  const s = everyone.character('sam');

  test('give the record, the name and the cast they came from', () => {
    assert.equal(s.name, 'Sam');
    assert.deepEqual(s.data, createCharacter(sam));
    assert.equal(s.cast, everyone);
  });

  test('give each skill’s training, attribute and bonus, with every part of it', () => {
    assert.deepEqual(s.skills.larceny, {
      training: 'trained',
      attribute: 'agi',
      bonus: 4,
      modifiers: [{ value: 2, reason: 'Agility 14' }, { value: 2, reason: 'Trained in Larceny' }],
    });
    assert.deepEqual(s.skills.brawling, { training: 'untrained', attribute: 'str', bonus: 0, modifiers: [{ value: 0, reason: 'Strength 10' }] });
    assert.equal(everyone.character('rico').skills.intimidation.attribute, 'str');
  });

  test('give the current temperament, which is the starting one until conduct moves it', () => {
    assert.deepEqual(s.temperament, temperament({ caution: 0.8 }));
  });
});

describe('changes', { tags: ['unit'] }, () => {
  test('return a new cast and leave the old one as it was', () => {
    const before = cast({ characters: [sam] });
    const after = before.add(rico);
    assert.deepEqual(before.characters.map((c) => c.id), ['sam']);
    assert.deepEqual(after.characters.map((c) => c.id), ['sam', 'rico']);
  });

  test('share every unchanged character record with the old cast', () => {
    const before = cast({ characters: [sam] });
    assert.equal(before.add(rico).data.characters[0], before.data.characters[0]);
  });

  test('replace the old cast, which can still be read but not changed', () => {
    const before = cast({ characters: [sam] });
    const after = before.add(rico);
    assert.equal(before.current, false);
    assert.equal(after.current, true);
    assert.equal(before.character('sam').name, 'Sam');
    assert.throws(() => before.add({ id: 'joe', name: 'Joe' }), ReplacedCastError);
    assert.throws(() => before.character('sam').cast.add({ id: 'joe', name: 'Joe' }), ReplacedCastError);
  });

  test('that fail leave the cast current', () => {
    const everyone = cast({ characters: [sam] });
    assert.throws(() => everyone.add({ id: 'sam', name: 'Another Sam' }), RangeError);
    assert.throws(() => everyone.add({ id: 'joe', name: 'Joe', proficiencyBonus: 9 }), RangeError);
    assert.equal(everyone.current, true);
  });
});

describe('what a character can see of another', { tags: ['unit'] }, () => {
  const everyone = cast({ characters: [sam, rico] });

  test('is only what anyone present can see: none of their private state', () => {
    assert.deepEqual(everyone.character('rico').seenBy(everyone.character('sam')), { id: 'rico', name: 'Rico', looks: 'unhurt', items: [] });
  });

  test('is refused for a viewer from another cast', () => {
    const other = cast({ characters: [sam] });
    assert.throws(() => everyone.character('rico').seenBy(other.character('sam')), RangeError);
  });
});

describe('changes', { tags: ['property'] }, () => {
  test('never alter an earlier cast, and only the newest can be changed', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.stringMatching(/^[a-z]{1,6}$/), { minLength: 1, maxLength: 8 }), (ids) => {
        const casts = [cast()];
        for (const id of ids) casts.push(casts.at(-1)!.add({ id, name: id.toUpperCase() }));
        casts.forEach((c, i) => {
          assert.deepEqual(c.data.characters.map((x) => x.id), ids.slice(0, i));
          assert.equal(c.current, i === ids.length);
        });
      }),
    );
  });
});
