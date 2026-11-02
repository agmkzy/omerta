import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { attributeScores } from '../src/attributes';
import { BACKGROUNDS, rollCharacter } from '../src/backgrounds';
import { createCharacter } from '../src/character';
import { roller, seeded } from '../src/random';
import { CHARACTER_FORMAT, NewerFormatError, loadCharacter, readCharacter, saveCharacter } from '../src/serialize';
import { temperament } from '../src/temperament';

const sample = createCharacter({
  name: 'Sample',
  background: 'driver',
  attributes: attributeScores({ agi: 16 }),
  training: { driving: 'expert', notice: 'trained' },
  proficiencyBonus: 3,
  temperament: temperament({ caution: 0.8 }),
});

describe('saveCharacter', { tags: ['unit'] }, () => {
  test('includes the format version and every field', () => {
    const saved = saveCharacter(sample);
    assert.equal(saved.format, CHARACTER_FORMAT);
    assert.equal(saved.name, 'Sample');
    assert.equal(saved.background, 'driver');
    assert.equal(saved.attributes.agi, 16);
    assert.deepEqual(saved.training, { driving: 'expert', notice: 'trained' });
    assert.equal(saved.proficiencyBonus, 3);
    assert.equal(saved.temperament.caution, 0.8);
  });

  test('omits the background when there is none', () => {
    assert.equal('background' in saveCharacter(createCharacter({ name: 'X' })), false);
  });
});

describe('loadCharacter', { tags: ['unit'] }, () => {
  test('restores a saved character through JSON', () => {
    assert.deepEqual(loadCharacter(JSON.parse(JSON.stringify(saveCharacter(sample)))), sample);
  });

  test('defaults missing optional fields', () => {
    const c = loadCharacter({ format: 1, name: 'Minimal' });
    assert.deepEqual(c, createCharacter({ name: 'Minimal' }));
  });

  test('defaults individual missing attributes and traits, so new fields can be added later', () => {
    const c = loadCharacter({ format: 1, name: 'Partial', attributes: { str: 14 }, temperament: { greed: 0.9 } });
    assert.equal(c.attributes.str, 14);
    assert.equal(c.attributes.cha, 10);
    assert.equal(c.temperament.greed, 0.9);
    assert.equal(c.temperament.pride, 0.5);
  });

  test('treats an explicit untrained entry as no training', () => {
    assert.deepEqual(loadCharacter({ format: 1, name: 'X', training: { driving: 'untrained', notice: 'trained' } }).training, { notice: 'trained' });
  });

  test('ignores anything it does not recognise, and reports it, so the caller can keep the original', () => {
    const { character, ignored } = readCharacter({
      format: 2, name: 'X', background: 'astronaut', notes: 'unused',
      training: { juggling: 'expert', driving: 'trained' }, attributes: { luck: 18, str: 14 }, temperament: { whimsy: 0.9, greed: 0.2 },
    });
    assert.deepEqual(character, createCharacter({ name: 'X', training: { driving: 'trained' }, attributes: attributeScores({ str: 14 }), temperament: temperament({ greed: 0.2 }) }));
    assert.deepEqual([...ignored].sort(), ['attributes.luck', 'background', 'notes', 'temperament.whimsy', 'training.juggling']);
  });

  test('reports nothing ignored for a character this version saved', () => {
    assert.deepEqual(readCharacter(JSON.parse(JSON.stringify(saveCharacter(sample)))).ignored, []);
  });

  test('rejects data that is not a saved character', () => {
    for (const bad of [null, 'text', 42, [], { name: 'No format' }, { format: 0, name: 'X' }, { format: 1.5, name: 'X' }, { format: 1 }, { format: 1, name: 7 }])
      assert.throws(() => loadCharacter(bad), TypeError, JSON.stringify(bad));
  });

  test('migrates format 1 background names', () => {
    assert.equal(loadCharacter({ format: 1, name: 'Old', background: 'enforcer' }).background, 'fighter');
    assert.equal(loadCharacter({ format: 1, name: 'Old', background: 'bookkeeper' }).background, 'accountant');
    assert.equal(loadCharacter({ format: 1, name: 'Old', background: 'driver' }).background, 'driver');
  });

  test('rejects a newer format', () => {
    assert.throws(() => loadCharacter({ format: CHARACTER_FORMAT + 1, name: 'Future' }), NewerFormatError);
  });

  test('rejects invalid values', () => {
    assert.throws(() => loadCharacter({ format: 1, name: 'X', attributes: { str: 30 } }), RangeError);
    assert.throws(() => loadCharacter({ format: 1, name: 'X', attributes: { str: '12' } }), TypeError);
    assert.throws(() => loadCharacter({ format: 1, name: 'X', training: { driving: 'master' } }), RangeError);
    assert.throws(() => loadCharacter({ format: 1, name: 'X', temperament: { greed: 2 } }), RangeError);
    assert.throws(() => loadCharacter({ format: 1, name: 'X', proficiencyBonus: 9 }), RangeError);
    assert.throws(() => loadCharacter({ format: 1, name: 'X', training: [] }), TypeError);
    assert.throws(() => loadCharacter({ format: 1, name: 'X', proficiencyBonus: '3' }), TypeError);
  });
});

describe('saveCharacter and loadCharacter', { tags: ['property'] }, () => {
  test('round-trip any rolled character through JSON', () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom(...BACKGROUNDS), fc.integer({ min: 2, max: 6 }), (seed, b, pb) => {
        const c = rollCharacter('R', b, roller(seeded(seed)), { proficiencyBonus: pb });
        assert.deepEqual(loadCharacter(JSON.parse(JSON.stringify(saveCharacter(c)))), c);
      }),
    );
  });
});
