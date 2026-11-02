import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { PARTIES_KEY, assign, canFight, lineUp, openParties, parseParties, reconcile, saveParties, serializeParties, sideOf, type Parties } from '../playground/parties';

const parties: Parties = { attackers: ['a'], defenders: ['b'] };

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

describe('parties', { tags: ['unit'] }, () => {
  test('assign puts a character on a side, moving them off the other', () => {
    assert.deepEqual(assign(parties, 'c', 'attacker'), { attackers: ['a', 'c'], defenders: ['b'] });
    assert.deepEqual(assign(parties, 'a', 'defender'), { attackers: [], defenders: ['b', 'a'] });
    assert.deepEqual(assign(parties, 'a', 'attacker'), parties);
    assert.deepEqual(assign(parties, 'b', 'defender'), parties);
  });

  test('assign with no side takes a character out of the fight', () => {
    assert.deepEqual(assign(parties, 'b', null), { attackers: ['a'], defenders: [] });
  });

  test('sideOf says which side a character is on', () => {
    assert.deepEqual([sideOf(parties, 'a'), sideOf(parties, 'b'), sideOf(parties, 'c')], ['attacker', 'defender', null]);
  });

  test('canFight needs someone on each side', () => {
    assert.equal(canFight(parties), true);
    assert.equal(canFight({ attackers: ['a'], defenders: [] }), false);
  });

  test('reconcile drops characters that no longer exist', () => {
    assert.deepEqual(reconcile({ attackers: ['a', 'x'], defenders: ['b'] }, ['a', 'b']), parties);
  });
});

describe('saving parties', { tags: ['unit'] }, () => {
  test('round-trip through text', () => {
    assert.deepEqual(parseParties(serializeParties(parties)), parties);
  });

  test('parse rejects unusable text and drops ids that are not strings or appear twice', () => {
    for (const bad of ['', '{', 'null', '[]', '{"attackers":[]}', '{"attackers":"a","defenders":[]}']) assert.equal(parseParties(bad), null, bad);
    assert.deepEqual(parseParties('{"attackers":["a",3,"a"],"defenders":["a","b"]}'), parties);
  });

  test('save to storage, failing softly', () => {
    const storage = memoryStorage();
    assert.equal(saveParties(storage, parties), true);
    assert.equal(storage.data[PARTIES_KEY], serializeParties(parties));
    assert.equal(saveParties(brokenStorage, parties), false);
  });
});

describe('openParties', { tags: ['unit'] }, () => {
  const backups = (data: Record<string, string>) => Object.keys(data).filter((k) => k.startsWith(`${PARTIES_KEY}:backup:`));
  const full = (initial: Record<string, string>) => ({ ...memoryStorage(initial), setItem: () => { throw new Error('quota exceeded'); } });

  test('reads a line-up saved by this version, with no backup', () => {
    const storage = memoryStorage({ [PARTIES_KEY]: serializeParties(parties) });
    assert.deepEqual(openParties(storage), { parties, canSave: true, warning: null });
    assert.deepEqual(backups(storage.data), []);
  });

  test('with nothing stored there is nothing to read, and it may be saved', () => {
    assert.deepEqual(openParties(memoryStorage()), { parties: null, canSave: true, warning: null });
  });

  test('without storage, or storage that cannot be read, it may not be saved', () => {
    assert.deepEqual(openParties(null), { parties: null, canSave: false, warning: null });
    assert.deepEqual(openParties(brokenStorage), { parties: null, canSave: false, warning: 'The saved line-up could not be read from this browser’s storage, so changes to it will not be saved this session.' });
  });

  test('backs up a stored line-up that saving would change: corrupt, or with something not recognised', () => {
    for (const text of ['{', '{"attackers":["a"],"defenders":["b"],"order":["b","a"]}', '{"attackers":["a",3],"defenders":["b"]}']) {
      const storage = memoryStorage({ [PARTIES_KEY]: text });
      const opened = openParties(storage);
      assert.equal(opened.canSave, true, text);
      const keys = backups(storage.data);
      assert.deepEqual(keys.map((k) => storage.data[k]), [text], text);
      assert.equal(opened.warning, `The saved line-up could not be fully read. The original is kept in this browser’s storage under “${keys[0]}”.`);
    }
  });

  test('if that backup fails, it may not be saved', () => {
    assert.deepEqual(openParties(full({ [PARTIES_KEY]: '{' })), { parties: null, canSave: false, warning: 'The saved line-up could not be fully read, or backed up, so changes to it will not be saved this session.' });
  });
});

describe('lineUp', { tags: ['unit'] }, () => {
  /** Storage that counts writes to the line-up. */
  function counting(initial: Record<string, string> = {}) {
    const storage = memoryStorage(initial);
    let writes = 0;
    return { storage: { ...storage, setItem: (k: string, v: string) => { if (k === PARTIES_KEY) writes++; storage.setItem(k, v); } }, data: storage.data, writes: () => writes };
  }

  test('starts from the saved line-up, leaving out ids no longer in the roster, without saving', () => {
    const c = counting({ [PARTIES_KEY]: serializeParties({ attackers: ['a', 'gone'], defenders: ['b'] }) });
    const line = lineUp(c.storage, () => true);
    assert.deepEqual(line.current(['a', 'b', 'c']), parties);
    assert.equal(c.writes(), 0);
  });

  test('an empty line-up is the 1st against the 2nd character, without saving', () => {
    const c = counting({ [PARTIES_KEY]: serializeParties({ attackers: ['gone'], defenders: [] }) });
    assert.deepEqual(lineUp(c.storage, () => true).current(['x', 'y', 'z']), { attackers: ['x'], defenders: ['y'] });
    assert.deepEqual(lineUp(memoryStorage(), () => true).current(['x', 'y']), { attackers: ['x'], defenders: ['y'] });
    assert.equal(c.writes(), 0);
  });

  test('saves a change, and current then returns it', () => {
    const c = counting();
    const line = lineUp(c.storage, () => true);
    line.set({ attackers: ['b'], defenders: ['a'] });
    assert.equal(c.data[PARTIES_KEY], serializeParties({ attackers: ['b'], defenders: ['a'] }));
    assert.deepEqual(line.current(['a', 'b']), { attackers: ['b'], defenders: ['a'] });
  });

  test('does not save a change when the roster may not be saved, or the stored line-up may not be saved over', () => {
    const blocked = counting();
    lineUp(blocked.storage, () => false).set(parties);
    assert.equal(blocked.writes(), 0);
    // Storage that holds a corrupt line-up and refuses every write, so the backup fails.
    let attempts = 0;
    const failing = { getItem: (k: string) => (k === PARTIES_KEY ? '{' : null), setItem: (k: string) => { if (k === PARTIES_KEY) attempts++; throw new Error('quota exceeded'); } };
    lineUp(failing, () => true).set(parties);
    assert.equal(attempts, 0);
  });

  test('says nothing when all is well, and says why changes are not saved when they are not', () => {
    assert.equal(lineUp(memoryStorage(), () => true).note(), null);
    assert.equal(lineUp(null, () => true).note(), 'Changes to the line-up are not saved: browser storage is unavailable.');
    assert.match(lineUp(memoryStorage(), () => false).note() ?? '', /^Changes to the line-up are not saved this session, to protect the saved characters/);
    assert.match(lineUp(memoryStorage({ [PARTIES_KEY]: '{' }), () => true).note() ?? '', /^The saved line-up could not be fully read\. The original is kept/);
  });

  test('says when the last change could not be saved, until one is', () => {
    let refuse = true;
    const storage = { ...memoryStorage(), setItem: () => { if (refuse) throw new Error('quota exceeded'); } };
    const line = lineUp(storage, () => true);
    line.set(parties);
    assert.match(line.note() ?? '', /^The last change to the line-up was not saved/);
    refuse = false;
    line.set(parties);
    assert.equal(line.note(), null);
  });
});
