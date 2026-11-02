// The playground's saved characters: a list of entries, the one selected for editing, and the two assigned as attacker and
// defender. Pure functions over an immutable roster; persistence goes through an injected storage (localStorage).
import type { Character } from '../src/character';
import type { Side } from '../src/nerve';
import { NewerFormatError, readCharacter, saveCharacter, type SavedCharacter } from '../src/serialize';
import { backup, type KeyValueStorage } from './storage';

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

/** A roster as stored. */
interface SavedRoster {
  readonly format: number;
  readonly entries: readonly { readonly id: string; readonly character: SavedCharacter }[];
  readonly selected: string;
  readonly attacker: string;
  readonly defender: string;
}

export function serializeRoster(r: Roster): string {
  const saved: SavedRoster = {
    format: ROSTER_FORMAT,
    entries: r.entries.map((e) => ({ id: e.id, character: saveCharacter(e.character) })),
    selected: r.selected,
    attacker: r.attacker,
    defender: r.defender,
  };
  return JSON.stringify(saved);
}

/** A saved roster as read. */
export interface ParsedRoster {
  /** Null if fewer than two characters could be read. */
  readonly roster: Roster | null;
  /** Entries that could not be read, and were left out. */
  readonly dropped: number;
  /** Entries read with some saved details left out, because this version does not recognise them. */
  readonly incomplete: number;
  /** Fields of the roster itself that this version does not recognise, and left out. */
  readonly ignored: readonly string[];
  /** Whether any of it was saved by a newer version, which this version does not read. */
  readonly newer: boolean;
}

const NOTHING_READ: ParsedRoster = { roster: null, dropped: 0, incomplete: 0, ignored: [], newer: false };
// The fields of a saved roster and entry; the type check fails if one is missing or misspelt.
const ROSTER_FIELDS: readonly string[] = Object.keys({ format: true, entries: true, selected: true, attacker: true, defender: true } satisfies Record<keyof SavedRoster, true>);
const ENTRY_FIELDS: readonly string[] = Object.keys({ id: true, character: true } satisfies Record<keyof SavedRoster['entries'][number], true>);

/**
 * Parses a saved roster. Entries that cannot be read, or repeat an id, are dropped (and counted), anything not recognised
 * is counted or listed, and references are repaired.
 */
export function parseRoster(text: string): ParsedRoster {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NOTHING_READ;
  }
  if (!isObject(data)) return NOTHING_READ;
  // Older formats would be migrated here.
  if (typeof data.format !== 'number' || !Number.isInteger(data.format) || data.format < 1) return NOTHING_READ;
  if (data.format > ROSTER_FORMAT) return { ...NOTHING_READ, newer: true };
  if (!Array.isArray(data.entries)) return NOTHING_READ;
  const entries: Entry[] = [];
  let incomplete = 0;
  let newer = false;
  for (const raw of data.entries) {
    try {
      if (!isObject(raw) || typeof raw.id !== 'string' || entries.some((x) => x.id === raw.id)) continue;
      const { character, ignored } = readCharacter(raw.character);
      entries.push({ id: raw.id, character });
      if (ignored.length > 0 || Object.keys(raw).some((k) => !ENTRY_FIELDS.includes(k))) incomplete++;
    } catch (error) {
      // An entry that fails validation is dropped (and counted); the rest still load.
      if (error instanceof NewerFormatError) newer = true;
    }
  }
  const dropped = data.entries.length - entries.length;
  const ignored = Object.keys(data).filter((k) => !ROSTER_FIELDS.includes(k));
  if (entries.length < 2) return { roster: null, dropped, incomplete, ignored, newer };
  const ref = (v: unknown) => (typeof v === 'string' ? v : '');
  const roster = repair({ entries, selected: ref(data.selected), attacker: ref(data.attacker), defender: ref(data.defender) });
  return { roster, dropped, incomplete, ignored, newer };
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The roster as stored: what could be read, and the stored text itself (null if there was none). */
export interface LoadedRoster extends ParsedRoster {
  readonly raw: string | null;
  /** True if storage refused to be read, so there may be saved data that could not be seen. */
  readonly unreadable: boolean;
}

export function loadRoster(storage: KeyValueStorage): LoadedRoster {
  let raw: string | null;
  try {
    raw = storage.getItem(ROSTER_KEY);
  } catch {
    return { ...NOTHING_READ, raw: null, unreadable: true };
  }
  return { ...(raw === null ? NOTHING_READ : parseRoster(raw)), raw, unreadable: false };
}

/** What the playground starts with. */
export interface OpenedRoster {
  readonly roster: Roster;
  /** False if changes must not be saved this session, so that saved data is not lost. */
  readonly canSave: boolean;
  /** Whether what is stored matches `roster`. */
  readonly saved: boolean;
  /** For the user, when saved data could not all be read: what happened, and where the original is kept. */
  readonly warning: string | null;
}

/**
 * Reads the saved roster, or starts a `fresh` one, without risking data it cannot fully read:
 * - If storage cannot be read, or holds data from a newer version, the data is left alone and nothing is saved.
 * - Anything else that could not be fully read is backed up, with the other keys in `alsoKeep` (data that refers to the
 *   roster, such as the fight line-up), and left as it is until the first change. If a backup fails, nothing is saved.
 * - A fresh roster with nothing stored before is saved at once.
 */
export function openRoster(storage: KeyValueStorage | null, fresh: () => Roster, alsoKeep: readonly string[] = []): OpenedRoster {
  const readOnly = (roster: Roster, warning: string | null): OpenedRoster => ({ roster, canSave: false, saved: false, warning });
  if (!storage) return readOnly(fresh(), null);
  const loaded = loadRoster(storage);
  if (loaded.unreadable) return readOnly(fresh(), 'The saved characters could not be read from this browser’s storage. They have been left as they are, and changes will not be saved this session.');
  if (loaded.raw === null) {
    const roster = fresh();
    return { roster, canSave: true, saved: saveRoster(storage, roster), warning: null };
  }
  const roster = loaded.roster ?? fresh();
  if (loaded.newer) {
    const which = loaded.roster ? 'Some of the saved characters were' : 'The saved characters were';
    return readOnly(roster, `${which} saved by a newer version of the lab, which this version cannot read. They have been left as they are, and changes will not be saved this session.`);
  }
  const problems = problemsWith(loaded);
  if (problems.length === 0) return { roster, canSave: true, saved: true, warning: null };
  const kept = [ROSTER_KEY, ...alsoKeep].map((key) => keep(storage, key));
  if (kept.some((k) => k.kind === 'failed')) return readOnly(roster, `${problems.join(' ')} The original data could not be backed up, so changes will not be saved this session.`);
  const where = kept.flatMap((k) => (k.kind === 'kept' ? [`“${k.key}”`] : [])).join(' and ');
  return { roster, canSave: true, saved: false, warning: `${problems.join(' ')} The original data is kept in this browser’s storage under ${where}.` };
}

/** What could not be read, in sentences for the user; none if the roster was read in full. */
function problemsWith(loaded: ParsedRoster): string[] {
  if (loaded.roster === null) return ['The saved characters could not be loaded.'];
  return [
    ...(loaded.dropped > 0 ? [`${characters(loaded.dropped)} could not be read.`] : []),
    ...(loaded.incomplete > 0 ? [`${characters(loaded.incomplete)} had details this version does not recognise, which were left out.`] : []),
    ...(loaded.ignored.length > 0 ? ['Some saved settings this version does not recognise were left out.'] : []),
  ];
}

const characters = (n: number): string => `${n} saved ${n === 1 ? 'character' : 'characters'}`;

/** The result of backing up a key: where it was kept, that nothing was stored there, or that it could not be kept. */
type Kept = { readonly kind: 'kept'; readonly key: string } | { readonly kind: 'nothing-stored' } | { readonly kind: 'failed' };

function keep(storage: KeyValueStorage, key: string): Kept {
  let text: string | null;
  try {
    text = storage.getItem(key);
  } catch {
    return { kind: 'failed' };
  }
  if (text === null) return { kind: 'nothing-stored' };
  const backupKey = backup(storage, key, text);
  return backupKey === null ? { kind: 'failed' } : { kind: 'kept', key: backupKey };
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
