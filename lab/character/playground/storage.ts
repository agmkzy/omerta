// Browser storage as the playground uses it, and backups of stored text that is about to be saved over.

/** The subset of the Web Storage API the playground needs. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Keeps stored text under a backup key named from its content (`<key>:backup:<hash>`), so backing up the same text again
 * (on every reload, say) reuses the one copy. Returns the backup key, or null if it could not be stored.
 */
export function backup(storage: KeyValueStorage, key: string, text: string): string | null {
  const backupKey = `${key}:backup:${contentHash(text)}`;
  try {
    if (storage.getItem(backupKey) !== text) storage.setItem(backupKey, text);
    return backupKey;
  } catch {
    return null;
  }
}

/** A 53-bit hash of the text (cyrb53), as hex. Not cryptographic; it only needs to tell different texts apart. */
export function contentHash(text: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}
