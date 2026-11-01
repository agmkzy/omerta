import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { PARTIES_KEY, assign, canFight, loadParties, parseParties, reconcile, saveParties, serializeParties, sideOf, type Parties } from '../playground/parties';

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

  test('save to and load from storage, failing softly', () => {
    const storage = memoryStorage();
    assert.equal(saveParties(storage, parties), true);
    assert.ok(storage.data[PARTIES_KEY]);
    assert.deepEqual(loadParties(storage), parties);
    assert.equal(loadParties(memoryStorage()), null);
    assert.equal(loadParties(brokenStorage), null);
    assert.equal(saveParties(brokenStorage, parties), false);
  });
});
