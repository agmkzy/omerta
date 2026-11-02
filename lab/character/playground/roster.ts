// The playground's saved characters: a list of entries, the one selected for editing, and the two assigned as attacker and
// defender. Pure functions over an immutable roster; persistence goes through an injected storage (localStorage).
import type { Character } from '../src/character';
import type { Side } from '../src/nerve';
import { NewerFormatError, readCharacter, saveCharacter } from '../src/serialize';

export interface Entry {
  readonly id: string;
  readonly character: Character;
}

export interface Roster {
  readonly entries: readonly Entry[];
  readonly selected: string;
  readonly attacker: string;
  readonly defender: string;
}

/** The subset of the Web Storage API the roster needs. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const ROSTER_KEY = 'character-lab:roster';
const ROSTER_FORMAT = 1;

export function createRoster(entries: readonly Entry[]): Roster {
  assertUsable(entries);
  return repair({ entries, selected: '', attacker: '', defender: '' });
}

export function addEntry(r: Roster, e: Entry): Roster {
  if (has(r, e.id)) throw new RangeError(`duplicate id ${e.id}`);
  return { ...r, entries: [...r.entries, e], selected: e.id };
}

export function updateEntry(r: Roster, id: string, character: Character): Roster {
  assertHas(r, id);
  return { ...r, entries: r.entries.map((e) => (e.id === id ? { id, character } : e)) };
}

/** Removes an entry. The roster must keep at least two, so a check or fight always has two sides. */
export function removeEntry(r: Roster, id: string): Roster {
  assertHas(r, id);
  const entries = r.entries.filter((e) => e.id !== id);
  assertUsable(entries);
  return repair({ ...r, entries });
}

export function select(r: Roster, id: string): Roster {
  assertHas(r, id);
  return { ...r, selected: id };
}

/** Assigns an entry to a side. If it currently holds the other side, the two sides are swapped. */
export function setSide(r: Roster, side: Side, id: string): Roster {
  assertHas(r, id);
  const other = side === 'attacker' ? 'defender' : 'attacker';
  if (r[other] === id) return swapSides(r);
  return { ...r, [side]: id };
}

export function swapSides(r: Roster): Roster {
  return { ...r, attacker: r.defender, defender: r.attacker };
}

export function serializeRoster(r: Roster): string {
  return JSON.stringify({
    format: ROSTER_FORMAT,
    entries: r.entries.map((e) => ({ id: e.id, character: saveCharacter(e.character) })),
    selected: r.selected,
    attacker: r.attacker,
    defender: r.defender,
  });
}

/** A saved roster as read. */
export interface ParsedRoster {
  /** Null if fewer than two characters could be read. */
  readonly roster: Roster | null;
  /** Entries that could not be read, and were left out. */
  readonly dropped: number;
  /** Entries read with some saved details left out, because this version does not recognise them. */
  readonly incomplete: number;
  /** Whether any of it was saved by a newer version, which this version does not read. */
  readonly newer: boolean;
}

const NOTHING_READ = { roster: null, dropped: 0, incomplete: 0, newer: false } as const;

/** Parses a saved roster. Entries that cannot be read, or repeat an id, are dropped (and counted) and references repaired. */
export function parseRoster(text: string): ParsedRoster {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NOTHING_READ;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return NOTHING_READ;
  const d = data as Record<string, unknown>;
  // Older formats would be migrated here.
  if (typeof d.format !== 'number' || !Number.isInteger(d.format) || d.format < 1) return NOTHING_READ;
  if (d.format > ROSTER_FORMAT) return { ...NOTHING_READ, newer: true };
  if (!Array.isArray(d.entries)) return NOTHING_READ;
  const entries: Entry[] = [];
  let incomplete = 0;
  let newer = false;
  for (const raw of d.entries) {
    try {
      const e = raw as { id: unknown; character: unknown };
      if (typeof e.id !== 'string' || entries.some((x) => x.id === e.id)) continue;
      const { character, ignored } = readCharacter(e.character);
      entries.push({ id: e.id, character });
      if (ignored.length > 0) incomplete++;
    } catch (error) {
      // An entry that fails validation is dropped (and counted); the rest still load.
      if (error instanceof NewerFormatError) newer = true;
    }
  }
  const dropped = d.entries.length - entries.length;
  if (entries.length < 2) return { roster: null, dropped, incomplete, newer };
  const ref = (v: unknown) => (typeof v === 'string' ? v : '');
  return { roster: repair({ entries, selected: ref(d.selected), attacker: ref(d.attacker), defender: ref(d.defender) }), dropped, incomplete, newer };
}

/** The roster as stored: what could be read, and the stored text itself (null if there was none). */
export interface LoadedRoster extends ParsedRoster {
  readonly raw: string | null;
}

export function loadRoster(storage: KeyValueStorage): LoadedRoster {
  let raw: string | null = null;
  try {
    raw = storage.getItem(ROSTER_KEY);
  } catch {
    // Unreadable storage is treated as empty; saving to it will fail and say so.
  }
  return raw === null ? { ...NOTHING_READ, raw } : { ...parseRoster(raw), raw };
}

/** What the playground starts with. */
export interface OpenedRoster {
  /** The saved roster, or null to start with a new one. */
  readonly roster: Roster | null;
  /** False if changes must not be saved this session, so that saved data is not lost. */
  readonly canSave: boolean;
  /** For the user, when saved data could not all be read: what happened, and where the original is kept. */
  readonly warning: string | null;
}

/**
 * Reads the saved roster without risking data it cannot fully read. Data from a newer version is left alone and nothing
 * is saved this session. Anything else that could not be fully read is backed up first; if that fails, nothing is saved.
 */
export function openRoster(storage: KeyValueStorage | null): OpenedRoster {
  if (!storage) return { roster: null, canSave: false, warning: null };
  const loaded = loadRoster(storage);
  const { roster, raw } = loaded;
  if (raw === null) return { roster, canSave: true, warning: null };
  if (loaded.newer) {
    const which = roster ? 'Some of the saved characters were' : 'The saved characters were';
    return { roster, canSave: false, warning: `${which} saved by a newer version of the lab, which this version cannot read. They have been left as they are, and changes will not be saved this session.` };
  }
  const problems = roster === null
    ? ['The saved characters could not be loaded.']
    : [
        ...(loaded.dropped > 0 ? [`${characters(loaded.dropped)} could not be read.`] : []),
        ...(loaded.incomplete > 0 ? [`${characters(loaded.incomplete)} had details this version does not recognise, which were left out.`] : []),
      ];
  if (problems.length === 0) return { roster, canSave: true, warning: null };
  const key = backupRoster(storage, raw);
  const kept = key
    ? `The original data is kept in this browser’s storage under “${key}”.`
    : 'The original data could not be backed up, so changes will not be saved this session.';
  return { roster, canSave: key !== null, warning: `${problems.join(' ')} ${kept}` };
}

const characters = (n: number): string => `${n} saved ${n === 1 ? 'character' : 'characters'}`;

/**
 * Keeps stored text under a backup key named from its content, so backing up the same text again (on every reload, say)
 * reuses the one copy. Returns the key, or null if it could not be stored.
 */
export function backupRoster(storage: KeyValueStorage, raw: string): string | null {
  const key = `${ROSTER_KEY}:backup:${contentHash(raw)}`;
  try {
    if (storage.getItem(key) !== raw) storage.setItem(key, raw);
    return key;
  } catch {
    return null;
  }
}

/** A 53-bit hash of the text (cyrb53), as hex. Not cryptographic; it only needs to tell different texts apart. */
function contentHash(text: string): string {
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

/** Returns false if the roster could not be saved (e.g. storage blocked or full). */
export function saveRoster(storage: KeyValueStorage, r: Roster): boolean {
  try {
    storage.setItem(ROSTER_KEY, serializeRoster(r));
    return true;
  } catch {
    return false;
  }
}

/** Points any reference to a missing entry at an existing one, keeping attacker and defender distinct. */
function repair(r: Roster): Roster {
  const ids = r.entries.map((e) => e.id);
  const first = (except?: string) => ids.find((id) => id !== except)!;
  const selected = ids.includes(r.selected) ? r.selected : first();
  let attacker: string | undefined = ids.includes(r.attacker) ? r.attacker : undefined;
  let defender: string | undefined = ids.includes(r.defender) && r.defender !== attacker ? r.defender : undefined;
  attacker ??= first(defender);
  defender ??= first(attacker);
  return { entries: r.entries, selected, attacker, defender };
}

function has(r: Roster, id: string): boolean {
  return r.entries.some((e) => e.id === id);
}

function assertHas(r: Roster, id: string): void {
  if (!has(r, id)) throw new RangeError(`no entry with id ${id}`);
}

function assertUsable(entries: readonly Entry[]): void {
  if (entries.length < 2) throw new RangeError('a roster needs at least two characters');
  if (new Set(entries.map((e) => e.id)).size !== entries.length) throw new RangeError('roster ids must be unique');
}
