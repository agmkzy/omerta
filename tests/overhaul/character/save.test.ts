import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { attributeScores } from '../../../src/overhaul/character/attributes';
import { BACKGROUNDS, rollCharacter } from '../../../src/overhaul/character/backgrounds';
import { CAST_FORMAT, cast, castOf } from '../../../src/overhaul/character/cast';
import { createCharacter } from '../../../src/overhaul/character/character';
import { roller, seeded } from '../../../src/overhaul/character/random';
import { MIGRATIONS, NewerFormatError, loadCast, migrate, readCast, type Migration } from '../../../src/overhaul/character/save';

const everyone = cast({
  characters: [
    { id: 'sam', name: 'Sam', background: 'driver', attributes: attributeScores({ agi: 16 }), training: { driving: 'expert', notice: 'trained' }, proficiencyBonus: 3, startingTemperament: { caution: 0.8 } },
    { id: 'rico', name: 'Rico' },
  ],
});
const throughJson = (data: unknown): unknown => JSON.parse(JSON.stringify(data));
const one = (character: Record<string, unknown>) => ({ format: CAST_FORMAT, characters: [character] });
const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

describe('loadCast', { tags: ['unit'] }, () => {
  test('restores a saved cast through JSON', () => {
    assert.deepEqual(loadCast(throughJson(everyone.data)).data, everyone.data);
  });

  test('reports nothing ignored for a cast this version saved', () => {
    assert.deepEqual(readCast(throughJson(everyone.data)).ignored, []);
  });

  test('gives a current cast, whatever the saved one was', () => {
    everyone.add({ id: 'joe', name: 'Joe' });
    assert.equal(loadCast(throughJson(everyone.data)).current, true);
  });

  test('defaults missing optional fields', () => {
    assert.deepEqual(loadCast({ format: 1 }).data, cast().data);
    assert.deepEqual(loadCast(one({ id: 'm', name: 'Minimal' })).data.characters[0], createCharacter({ id: 'm', name: 'Minimal' }));
  });

  test('defaults individual missing attributes and traits, so new fields can be added later', () => {
    const c = loadCast(one({ id: 'p', name: 'Partial', attributes: { str: 14 }, startingTemperament: { greed: 0.9 } })).data.characters[0]!;
    assert.equal(c.attributes.str, 14);
    assert.equal(c.attributes.cha, 10);
    assert.equal(c.startingTemperament.greed, 0.9);
    assert.equal(c.startingTemperament.pride, 0.5);
  });

  test('treats an explicit untrained entry as no training', () => {
    assert.deepEqual(loadCast(one({ id: 'x', name: 'X', training: { driving: 'untrained', notice: 'trained' } })).data.characters[0]!.training, { notice: 'trained' });
  });

  test('leaves out anything it does not recognise, and reports where it was, so the caller can keep the original', () => {
    const { cast: loaded, ignored } = readCast({
      format: 1, notes: 'unused',
      characters: [{
        id: 'x', name: 'X', background: 'astronaut', notes: 'unused',
        training: { juggling: 'expert', driving: 'trained' }, attributes: { luck: 18, str: 14 }, startingTemperament: { whimsy: 0.9, greed: 0.2 },
      }],
    });
    assert.deepEqual(loaded.data.characters[0], createCharacter({ id: 'x', name: 'X', training: { driving: 'trained' }, attributes: attributeScores({ str: 14 }), startingTemperament: { greed: 0.2 } }));
    assert.deepEqual([...ignored].sort(), [
      'characters[0].attributes.luck', 'characters[0].background', 'characters[0].notes',
      'characters[0].startingTemperament.whimsy', 'characters[0].training.juggling', 'notes',
    ]);
  });

  test('rejects data that is not a saved cast', () => {
    for (const bad of [null, 'text', 42, [], { characters: [] }, { format: 0 }, { format: 1.5 }, { format: 1, characters: {} }, one({ name: 'No id' }), one({ id: 'x' }), one({ id: 'x', name: 7 }), { format: 1, characters: [null] }])
      assert.throws(() => loadCast(bad), TypeError, JSON.stringify(bad));
  });

  test('rejects a newer format', () => {
    assert.throws(() => loadCast({ format: CAST_FORMAT + 1 }), NewerFormatError);
  });

  test('rejects invalid values, and two characters with one id', () => {
    assert.throws(() => loadCast(one({ id: 'x', name: 'X', attributes: { str: 30 } })), RangeError);
    assert.throws(() => loadCast(one({ id: 'x', name: 'X', attributes: { str: '12' } })), TypeError);
    assert.throws(() => loadCast(one({ id: 'x', name: 'X', training: { driving: 'master' } })), RangeError);
    assert.throws(() => loadCast(one({ id: 'x', name: 'X', startingTemperament: { greed: 2 } })), RangeError);
    assert.throws(() => loadCast(one({ id: 'x', name: 'X', proficiencyBonus: 9 })), RangeError);
    assert.throws(() => loadCast(one({ id: 'x', name: 'X', training: [] })), TypeError);
    assert.throws(() => loadCast(one({ id: 'x', name: 'X', proficiencyBonus: '3' })), TypeError);
    assert.throws(() => loadCast({ format: 1, characters: [{ id: 'x', name: 'X' }, { id: 'x', name: 'Y' }] }), RangeError);
  });

  test('loads a cast saved in format 1, which must keep loading: its characters are at full health', () => {
    const { cast: loaded, ignored } = readCast(fixture('cast-format1.json'));
    assert.deepEqual(ignored, []);
    assert.deepEqual(loaded.characters.map((c) => c.name), ['Sam', 'Rico']);
    assert.equal(loaded.character('sam').skills.deception.bonus, 2 + 4);
    assert.equal(loaded.character('rico').temperament.volatility, 0.75);
    assert.deepEqual(loaded.characters.map((c) => [c.condition.hitPoints, c.condition.maxHitPoints, c.condition.effects]), [[10, 10, []], [12, 12, []]]);
  });

  test('loads a cast saved in format 2, which must keep loading', () => {
    const { cast: loaded, ignored } = readCast(fixture('cast-format2.json'));
    assert.deepEqual(ignored, []);
    assert.deepEqual(loaded.character('sam').condition, { hitPoints: 4, effects: ['drunk'], maxHitPoints: 10, hurt: true, unconscious: false });
    assert.equal(loaded.character('rico').restingAt(1500), true);
  });

  test('restores a character’s condition, and leaves out effects and fields it does not recognise', () => {
    const hurt = loadCast(throughJson(everyone.data)).character('sam').damage(6).character('sam').affect('shaken').character('sam').rest({ now: 60, hours: 1 }).character('sam').damage(2);
    assert.deepEqual(loadCast(throughJson(hurt.data)).data, hurt.data);
    const { cast: loaded, ignored } = readCast(one({ id: 'x', name: 'X', condition: { hitPoints: 3, effects: ['sober', 'shaken'], mood: 'bad' } }));
    assert.deepEqual(loaded.character('x').data.condition, { hitPoints: 3, effects: ['shaken'] });
    assert.deepEqual([...ignored].sort(), ['characters[0].condition.effects.sober', 'characters[0].condition.mood']);
  });

  test('rejects a condition of the wrong shape or out of range', () => {
    for (const condition of [[], { hitPoints: '3' }, { effects: 'shaken' }, { rest: { from: 0 } }, { rest: 5 }])
      assert.throws(() => loadCast(one({ id: 'x', name: 'X', condition })), TypeError, JSON.stringify(condition));
    for (const condition of [{ hitPoints: 99 }, { rest: { from: 9, until: 3 } }])
      assert.throws(() => loadCast(one({ id: 'x', name: 'X', condition })), RangeError, JSON.stringify(condition));
  });
});

describe('migrations', { tags: ['unit'] }, () => {
  test('there is one for each format after the first', () => {
    assert.equal(MIGRATIONS.length, CAST_FORMAT - 1);
  });

  test('1 to 2 gives each character an empty condition, which loads as full health with no effects', () => {
    const d: Record<string, unknown> = { format: 1, characters: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', condition: { hitPoints: 2 } }, null] };
    migrate(d, 1);
    assert.deepEqual(d.characters, [{ id: 'a', name: 'A', condition: {} }, { id: 'b', name: 'B', condition: { hitPoints: 2 } }, null]);
    const notAList: Record<string, unknown> = { format: 1, characters: 'none' };
    migrate(notAList, 1);
    assert.equal(notAList.characters, 'none');
  });

  test('run in order from the saved format to the newest', () => {
    const steps: Migration[] = [(d) => void ((d.seen as string[]).push('1 to 2')), (d) => void ((d.seen as string[]).push('2 to 3'))];
    const from = (format: number) => {
      const d = { seen: [] as string[] };
      migrate(d, format, steps);
      return d.seen;
    };
    assert.deepEqual(from(1), ['1 to 2', '2 to 3']);
    assert.deepEqual(from(2), ['2 to 3']);
    assert.deepEqual(from(3), []);
  });
});

describe('saving and loading', { tags: ['property'] }, () => {
  test('round-trip any cast of rolled characters through JSON', () => {
    fc.assert(
      fc.property(fc.integer(), fc.array(fc.constantFrom(...BACKGROUNDS), { maxLength: 4 }), fc.integer({ min: 2, max: 6 }), (seed, backgrounds, pb) => {
        const r = roller(seeded(seed));
        const data = { format: CAST_FORMAT, characters: backgrounds.map((b, i) => rollCharacter(`c${i}`, `C${i}`, b, r, { proficiencyBonus: pb })) };
        assert.deepEqual(loadCast(throughJson(castOf(data).data)).data, data);
      }),
    );
  });
});
