import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { createCharacter } from '../src/character';
import { saveCharacter } from '../src/serialize';
import { readFileSync } from 'node:fs';
import {
  ROSTER_KEY,
  addEntry,
  backupRoster,
  needsBackup,
  createRoster,
  loadRoster,
  parseRoster,
  removeEntry,
  saveRoster,
  select,
  serializeRoster,
  setSide,
  swapSides,
  updateEntry,
  type Entry,
  type Roster,
} from '../playground/roster';

const entry = (id: string): Entry => ({ id, character: createCharacter({ name: id.toUpperCase() }) });
const three = (): Roster => createRoster([entry('a'), entry('b'), entry('c')]);

/** An in-memory stand-in for localStorage. */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) };
}
const brokenStorage = {
  getItem: (): string | null => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('createRoster', { tags: ['unit'] }, () => {
  test('selects the first entry and assigns the first two as attacker and defender', () => {
    const r = three();
    assert.deepEqual([r.selected, r.attacker, r.defender], ['a', 'a', 'b']);
  });

  test('requires at least two entries with unique ids', () => {
    assert.throws(() => createRoster([entry('a')]), RangeError);
    assert.throws(() => createRoster([entry('a'), entry('a')]), RangeError);
  });
});

describe('roster edits', { tags: ['unit'] }, () => {
  test('addEntry appends and selects the new entry', () => {
    const r = addEntry(three(), entry('d'));
    assert.deepEqual(r.entries.map((e) => e.id), ['a', 'b', 'c', 'd']);
    assert.equal(r.selected, 'd');
    assert.throws(() => addEntry(r, entry('d')), RangeError);
  });

  test('updateEntry replaces the character', () => {
    const r = updateEntry(three(), 'b', createCharacter({ name: 'Renamed' }));
    assert.equal(r.entries[1]!.character.name, 'Renamed');
    assert.throws(() => updateEntry(r, 'zz', createCharacter({ name: 'X' })), RangeError);
  });

  test('removeEntry reassigns the selection and sides', () => {
    const r = removeEntry(three(), 'a');
    assert.deepEqual(r.entries.map((e) => e.id), ['b', 'c']);
    assert.equal(r.selected, 'b');
    assert.deepEqual([r.attacker, r.defender], ['c', 'b']);
  });

  test('removeEntry keeps references to entries that remain', () => {
    const r = removeEntry(select(three(), 'b'), 'c');
    assert.deepEqual([r.selected, r.attacker, r.defender], ['b', 'a', 'b']);
  });

  test('removeEntry refuses to go below two entries', () => {
    assert.throws(() => removeEntry(removeEntry(three(), 'c'), 'b'), RangeError);
    assert.throws(() => removeEntry(three(), 'zz'), RangeError);
  });

  test('select changes the selected entry', () => {
    assert.equal(select(three(), 'c').selected, 'c');
    assert.throws(() => select(three(), 'zz'), RangeError);
  });

  test('setSide assigns a side, swapping if that entry holds the other side', () => {
    const r = three();
    assert.deepEqual([setSide(r, 'attacker', 'c').attacker, setSide(r, 'attacker', 'c').defender], ['c', 'b']);
    assert.deepEqual([setSide(r, 'defender', 'c').attacker, setSide(r, 'defender', 'c').defender], ['a', 'c']);
    assert.deepEqual([setSide(r, 'attacker', 'b').attacker, setSide(r, 'attacker', 'b').defender], ['b', 'a']);
    assert.deepEqual([setSide(r, 'defender', 'a').attacker, setSide(r, 'defender', 'a').defender], ['b', 'a']);
    assert.throws(() => setSide(r, 'attacker', 'zz'), RangeError);
  });

  test('swapSides exchanges attacker and defender', () => {
    const r = swapSides(three());
    assert.deepEqual([r.attacker, r.defender], ['b', 'a']);
  });
});

describe('serializeRoster and parseRoster', { tags: ['unit'] }, () => {
  test('round-trip a roster', () => {
    const r = setSide(select(three(), 'c'), 'defender', 'c');
    assert.deepEqual(parseRoster(serializeRoster(r)), { roster: r, dropped: 0 });
  });

  test('load a save written by an older build (roster format 1, character format 1), migrating old background names', () => {
    const { roster, dropped } = parseRoster(readFileSync(new URL('./fixtures/roster-format1.json', import.meta.url), 'utf8'));
    assert.equal(dropped, 0);
    assert.deepEqual(roster?.entries.map((e) => [e.character.name, e.character.background]), [['Enforcer 1', 'fighter'], ['Shopkeeper 1', 'shopkeeper']]);
    assert.equal(roster?.entries[0]!.character.training.brawling, 'expert');
  });

  test('do not read a newer roster format', () => {
    const saved = JSON.parse(serializeRoster(three())) as Record<string, unknown>;
    assert.deepEqual(parseRoster(JSON.stringify({ ...saved, format: 99 })), { roster: null, dropped: 0 });
  });

  test('drop invalid or duplicate entries and repair references', () => {
    const text = JSON.stringify({
      format: 1,
      entries: [
        { id: 'a', character: saveCharacter(createCharacter({ name: 'A' })) },
        { id: 'bad', character: { format: 1, name: 'Bad', attributes: { str: 99 } } },
        { id: 'a', character: saveCharacter(createCharacter({ name: 'Duplicate' })) },
        { id: 'c', character: saveCharacter(createCharacter({ name: 'C' })) },
        'not an entry',
      ],
      selected: 'bad',
      attacker: 'c',
      defender: 'c',
    });
    const { roster: r, dropped } = parseRoster(text);
    assert.ok(r);
    assert.equal(dropped, 3);
    assert.deepEqual(r.entries.map((e) => [e.id, e.character.name]), [['a', 'A'], ['c', 'C']]);
    assert.deepEqual([r.selected, r.attacker, r.defender], ['a', 'c', 'a']);
  });

  test('repair references that are not strings', () => {
    const saved = JSON.parse(serializeRoster(three())) as Record<string, unknown>;
    const r = parseRoster(JSON.stringify({ ...saved, selected: 5, attacker: null })).roster;
    assert.ok(r);
    assert.deepEqual([r.selected, r.attacker, r.defender], ['a', 'a', 'b']);
  });

  test('return null for unusable data', () => {
    const one = JSON.stringify({ format: 1, entries: [{ id: 'a', character: saveCharacter(createCharacter({ name: 'A' })) }] });
    for (const bad of ['', '{', 'null', '[]', '{"format":1,"entries":[]}', '{"format":1}', '{"format":"1","entries":[]}', one]) assert.equal(parseRoster(bad).roster, null, bad);
  });
});

describe('loadRoster and saveRoster', { tags: ['unit'] }, () => {
  test('save to and load from storage, returning the stored text too', () => {
    const storage = memoryStorage();
    assert.equal(saveRoster(storage, three()), true);
    assert.ok(storage.data[ROSTER_KEY]);
    assert.deepEqual(loadRoster(storage), { roster: three(), dropped: 0, raw: storage.data[ROSTER_KEY] });
  });

  test('find nothing when nothing is stored', () => {
    assert.deepEqual(loadRoster(memoryStorage()), { roster: null, dropped: 0, raw: null });
  });

  test('fail softly when storage is unavailable', () => {
    assert.deepEqual(loadRoster(brokenStorage), { roster: null, dropped: 0, raw: null });
    assert.equal(saveRoster(brokenStorage, three()), false);
  });

  test('stored text that could not be fully read needs backing up before anything is saved over it', () => {
    assert.equal(needsBackup({ roster: null, dropped: 0, raw: null }), false);
    assert.equal(needsBackup({ roster: three(), dropped: 0, raw: '…' }), false);
    assert.equal(needsBackup({ roster: null, dropped: 0, raw: 'unreadable' }), true);
    assert.equal(needsBackup({ roster: three(), dropped: 1, raw: '…' }), true);
  });

  test('a backup keeps the stored text under its own key', () => {
    const storage = memoryStorage();
    assert.equal(backupRoster(storage, 'old text', 1700000000000), `${ROSTER_KEY}:backup:1700000000000`);
    assert.equal(storage.data[`${ROSTER_KEY}:backup:1700000000000`], 'old text');
    assert.equal(backupRoster(brokenStorage, 'old text', 1), null);
  });
});
