// The playground's saved characters: a list of entries, the one selected for editing, and the two assigned as attacker and
// defender. Pure functions over an immutable roster; persistence goes through an injected storage (localStorage).
import type { Character } from '../src/character';
import type { Side } from '../src/contest';
import { loadCharacter, saveCharacter } from '../src/serialize';

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

/** Removes an entry. The roster must keep at least two, so a contest always has two sides. */
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

/** Parses a saved roster. Invalid or duplicate entries are dropped and references repaired; null if unusable. */
export function parseRoster(text: string): Roster | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  if (d.format !== ROSTER_FORMAT || !Array.isArray(d.entries)) return null;
  const entries: Entry[] = [];
  for (const raw of d.entries) {
    try {
      const e = raw as { id: unknown; character: unknown };
      if (typeof e.id !== 'string' || entries.some((x) => x.id === e.id)) continue;
      entries.push({ id: e.id, character: loadCharacter(e.character) });
    } catch {
      // An entry that fails validation is dropped; the rest still load.
    }
  }
  if (entries.length < 2) return null;
  const ref = (v: unknown) => (typeof v === 'string' ? v : '');
  return repair({ entries, selected: ref(d.selected), attacker: ref(d.attacker), defender: ref(d.defender) });
}

export function loadRoster(storage: KeyValueStorage): Roster | null {
  try {
    const text = storage.getItem(ROSTER_KEY);
    return text === null ? null : parseRoster(text);
  } catch {
    return null;
  }
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
