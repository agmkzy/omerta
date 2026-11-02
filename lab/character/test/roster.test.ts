import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { createCharacter } from '../src/character';
import { saveCharacter } from '../src/serialize';
import { readFileSync } from 'node:fs';
import { PARTIES_KEY } from '../playground/parties';
import {
  ROSTER_KEY,
  addEntry,
  createRoster,
  loadRoster,
  openRoster,
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
/** Storage that can be read but is full, so nothing more can be written. */
function fullStorage(initial: Record<string, string>) {
  return { ...memoryStorage(initial), setItem: () => { throw new Error('quota exceeded'); } };
}
const backupKeys = (data: Record<string, string>) => Object.keys(data).filter((k) => k.startsWith(`${ROSTER_KEY}:backup:`));
const saved = (id: string, character: unknown) => ({ id, character });
const rosterText = (entries: unknown[]) => JSON.stringify({ format: 1, entries, selected: 'a', attacker: 'a', defender: 'b' });
const good = (id: string) => saved(id, saveCharacter(createCharacter({ name: id.toUpperCase() })));
const read = { dropped: 0, incomplete: 0, ignored: [], newer: false };
const stored = { raw: null, unreadable: false };
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
    assert.deepEqual(parseRoster(serializeRoster(r)), { roster: r, ...read });
  });

  test('load a save written by an older build (roster format 1, character format 1), migrating old background names', () => {
    const { roster, dropped } = parseRoster(readFileSync(new URL('./fixtures/roster-format1.json', import.meta.url), 'utf8'));
    assert.equal(dropped, 0);
    assert.deepEqual(roster?.entries.map((e) => [e.character.name, e.character.background]), [['Enforcer 1', 'fighter'], ['Shopkeeper 1', 'shopkeeper']]);
    assert.equal(roster?.entries[0]!.character.training.brawling, 'expert');
  });

  test('do not read a newer roster format, and say that is why', () => {
    const stored = JSON.parse(serializeRoster(three())) as Record<string, unknown>;
    assert.deepEqual(parseRoster(JSON.stringify({ ...stored, format: 2 })), { roster: null, ...read, newer: true });
  });

  test('say when an entry was saved by a newer version', () => {
    const p = parseRoster(rosterText([good('a'), good('b'), saved('c', { format: 99, name: 'C' })]));
    assert.deepEqual([p.roster?.entries.length, p.dropped, p.newer], [2, 1, true]);
  });

  test('count entries read with details left out', () => {
    const odd = saved('c', { ...saveCharacter(createCharacter({ name: 'C' })), training: { juggling: 'expert' } });
    const p = parseRoster(rosterText([good('a'), good('b'), odd]));
    assert.deepEqual([p.roster?.entries.length, p.dropped, p.incomplete], [3, 0, 1]);
  });

  test('list fields of the roster it does not recognise, and count entries with fields it does not recognise', () => {
    const text = JSON.stringify({ ...JSON.parse(rosterText([good('a'), { ...good('b'), tags: ['x'] }])), notes: 'kept by a later version' });
    const p = parseRoster(text);
    assert.deepEqual([p.roster?.entries.length, p.incomplete, p.ignored], [2, 1, ['notes']]);
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
    const { roster: r, dropped, newer } = parseRoster(text);
    assert.ok(r);
    assert.equal(dropped, 3);
    assert.equal(newer, false);
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
    for (const bad of ['', '{', 'null', '[]', '{"format":1,"entries":[]}', '{"format":1}', '{"format":"1","entries":[]}', '{"format":0,"entries":[]}', '{"format":-3,"entries":[]}', '{"format":0.5,"entries":[]}', one]) {
      assert.equal(parseRoster(bad).roster, null, bad);
      assert.equal(parseRoster(bad).newer, false, bad);
    }
  });
});

describe('loadRoster and saveRoster', { tags: ['unit'] }, () => {
  test('save to and load from storage, returning the stored text too', () => {
    const storage = memoryStorage();
    assert.equal(saveRoster(storage, three()), true);
    assert.ok(storage.data[ROSTER_KEY]);
    assert.deepEqual(loadRoster(storage), { roster: three(), ...read, raw: storage.data[ROSTER_KEY], unreadable: false });
  });

  test('find nothing when nothing is stored', () => {
    assert.deepEqual(loadRoster(memoryStorage()), { roster: null, ...read, ...stored });
  });

  test('say when storage cannot be read, as distinct from holding nothing', () => {
    assert.deepEqual(loadRoster(brokenStorage), { roster: null, ...read, ...stored, unreadable: true });
    assert.equal(saveRoster(brokenStorage, three()), false);
  });
});

describe('openRoster', { tags: ['unit'] }, () => {
  const corrupt = '{"format":1,"entries":[';
  const fresh = () => createRoster([entry('new1'), entry('new2')]);
  const open = (storage: Parameters<typeof openRoster>[0], alsoKeep: string[] = []) => openRoster(storage, fresh, alsoKeep);

  test('without storage, starts afresh and saves nothing', () => {
    assert.deepEqual(open(null), { roster: fresh(), canSave: false, saved: false, warning: null });
  });

  test('with nothing stored, starts afresh and saves the new roster at once', () => {
    const storage = memoryStorage();
    assert.deepEqual(open(storage), { roster: fresh(), canSave: true, saved: true, warning: null });
    assert.equal(storage.data[ROSTER_KEY], serializeRoster(fresh()));
    assert.equal(open(fullStorage({})).saved, false);
  });

  test('storage that cannot be read is left alone, as it may hold saved data', () => {
    let writes = 0;
    const storage = { ...brokenStorage, setItem: () => void writes++ };
    const opened = open(storage, ['other']);
    assert.deepEqual([opened.roster, opened.canSave, opened.saved], [fresh(), false, false]);
    assert.match(opened.warning ?? '', /^The saved characters could not be read from this browser’s storage\. They have been left as they are/);
    assert.equal(writes, 0);
  });

  test('a roster read in full opens as saved, with no warning or backup', () => {
    const storage = memoryStorage();
    saveRoster(storage, three());
    assert.deepEqual(open(storage, [PARTIES_KEY]), { roster: three(), canSave: true, saved: true, warning: null });
    assert.deepEqual(backupKeys(storage.data), []);
  });

  test('data that cannot be read is backed up and left as it is, and the warning names the backup', () => {
    const storage = memoryStorage({ [ROSTER_KEY]: corrupt });
    const opened = open(storage);
    const [key] = backupKeys(storage.data);
    assert.deepEqual([opened.roster, opened.canSave, opened.saved], [fresh(), true, false]);
    assert.equal(storage.data[key!], corrupt);
    assert.equal(storage.data[ROSTER_KEY], corrupt);
    assert.equal(opened.warning, `The saved characters could not be loaded. The original data is kept in this browser’s storage under “${key}”.`);
  });

  test('the keys in alsoKeep are backed up with it, if they hold anything', () => {
    const storage = memoryStorage({ [ROSTER_KEY]: corrupt, [PARTIES_KEY]: '{"attackers":["a"],"defenders":["b"]}' });
    const opened = open(storage, [PARTIES_KEY, 'character-lab:empty']);
    const parties = Object.keys(storage.data).find((k) => k.startsWith(`${PARTIES_KEY}:backup:`));
    assert.equal(storage.data[parties!], storage.data[PARTIES_KEY]);
    assert.match(opened.warning ?? '', new RegExp(`under “${ROSTER_KEY}:backup:[0-9a-f]+” and “${parties}”\\.$`));
  });

  test('a roster read only in part is backed up, and the warning says what was left out', () => {
    const odd = saved('c', { ...saveCharacter(createCharacter({ name: 'C' })), attributes: { luck: 18 } });
    const text = JSON.stringify({ ...JSON.parse(rosterText([good('a'), good('b'), odd, saved('d', { name: 'No format' })])), notes: 'x' });
    const storage = memoryStorage({ [ROSTER_KEY]: text });
    const opened = open(storage);
    const [key] = backupKeys(storage.data);
    assert.deepEqual(opened.roster.entries.map((e) => e.id), ['a', 'b', 'c']);
    assert.equal(storage.data[key!], text);
    assert.equal(opened.warning, [
      '1 saved character could not be read.',
      '1 saved character had details this version does not recognise, which were left out.',
      'Some saved settings this version does not recognise were left out.',
      `The original data is kept in this browser’s storage under “${key}”.`,
    ].join(' '));
  });

  test('counts characters in the plural', () => {
    const storage = memoryStorage({ [ROSTER_KEY]: rosterText([good('a'), good('b'), 'x', 'y']) });
    assert.match(open(storage).warning ?? '', /^2 saved characters could not be read\./);
  });

  test('reopening the same unreadable data makes no further backups', () => {
    const storage = memoryStorage({ [ROSTER_KEY]: corrupt });
    for (let i = 0; i < 3; i++) open(storage);
    assert.equal(backupKeys(storage.data).length, 1);
  });

  test('if a backup cannot be made, nothing may be saved', () => {
    const opened = open(fullStorage({ [ROSTER_KEY]: corrupt }));
    assert.deepEqual([opened.canSave, opened.saved], [false, false]);
    assert.equal(opened.warning, 'The saved characters could not be loaded. The original data could not be backed up, so changes will not be saved this session.');
    const unreadableExtra = { ...memoryStorage({ [ROSTER_KEY]: corrupt }), getItem: (k: string) => { if (k === 'other') throw new Error('blocked'); return k === ROSTER_KEY ? corrupt : null; } };
    assert.equal(open(unreadableExtra, ['other']).canSave, false);
  });

  test('data from a newer version is left alone: no backup, and nothing may be saved', () => {
    const newer = JSON.stringify({ format: 2, entries: [] });
    const storage = memoryStorage({ [ROSTER_KEY]: newer });
    const opened = open(storage);
    assert.deepEqual([opened.roster, opened.canSave, opened.saved], [fresh(), false, false]);
    assert.match(opened.warning ?? '', /^The saved characters were saved by a newer version of the lab/);
    assert.deepEqual(backupKeys(storage.data), []);
    assert.equal(storage.data[ROSTER_KEY], newer);
  });

  test('a newer character among readable ones also leaves the data alone, showing what could be read', () => {
    const storage = memoryStorage({ [ROSTER_KEY]: rosterText([good('a'), good('b'), saved('c', { format: 99, name: 'C' })]) });
    const opened = open(storage);
    assert.deepEqual([opened.roster.entries.map((e) => e.id), opened.canSave], [['a', 'b'], false]);
    assert.match(opened.warning ?? '', /^Some of the saved characters were saved by a newer version/);
  });
});
