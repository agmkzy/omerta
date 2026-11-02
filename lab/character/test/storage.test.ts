import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { backup, contentHash } from '../playground/storage';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) };
}
const full = (initial: Record<string, string> = {}) => ({ ...memoryStorage(initial), setItem: () => { throw new Error('quota exceeded'); } });
const blocked = { getItem: (): string | null => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };

describe('backup', { tags: ['unit'] }, () => {
  test('keeps the text under a key named from its content', () => {
    const storage = memoryStorage();
    const key = backup(storage, 'lab:thing', 'old text');
    assert.equal(key, `lab:thing:backup:${contentHash('old text')}`);
    assert.equal(storage.data[key!], 'old text');
    assert.notEqual(backup(storage, 'lab:thing', 'other text'), key);
  });

  test('backing up the same text again reuses the one copy, even when storage is full', () => {
    const storage = memoryStorage();
    const key = backup(storage, 'lab:thing', 'old text');
    assert.equal(backup(storage, 'lab:thing', 'old text'), key);
    assert.equal(backup(full(storage.data), 'lab:thing', 'old text'), key);
    assert.equal(Object.keys(storage.data).length, 1);
  });

  test('returns null if the backup cannot be stored', () => {
    assert.equal(backup(full(), 'lab:thing', 'old text'), null);
    assert.equal(backup(blocked, 'lab:thing', 'old text'), null);
  });
});

describe('contentHash', { tags: ['unit'] }, () => {
  test('is the same for the same text and differs for small changes', () => {
    assert.equal(contentHash('abc'), contentHash('abc'));
    assert.match(contentHash('abc'), /^[0-9a-f]+$/);
    assert.equal(new Set(['', 'a', 'b', 'ab', 'ba', 'abc', 'abd']).size, new Set(['', 'a', 'b', 'ab', 'ba', 'abc', 'abd'].map(contentHash)).size);
  });
});
