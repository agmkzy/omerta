// The playground's shared state: the roster of characters, saved to localStorage after every change.
import { BACKGROUND_INFO, rollCharacter, type BackgroundName } from '../src/backgrounds';
import type { Character } from '../src/character';
import type { Side } from '../src/nerve';
import { roller, seeded } from '../src/random';
import { PARTIES_KEY } from './parties';
import { createRoster, openRoster, saveRoster, type Roster } from './roster';
import type { KeyValueStorage } from './storage';

type Listener = (source: string) => void;

/** localStorage, or null where it is unavailable (e.g. blocked by the browser). */
export const storage: KeyValueStorage | null = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();

// New characters are rolled from one seeded stream per page load.
const dice = roller(seeded(Date.now() >>> 0));
const listeners: Listener[] = [];

// Open the saved roster, or start a new one. See openRoster for how saved data it cannot fully read is protected.
const opened = openRoster(storage, () => createRoster([
  { id: newId(), character: rollCharacter('Fighter 1', 'fighter', dice) },
  { id: newId(), character: rollCharacter('Shopkeeper 1', 'shopkeeper', dice) },
]), [PARTIES_KEY]);
let roster: Roster = opened.roster;
let lastSaveOk = opened.saved;

/** A warning to show if saved characters could not all be read, saying where the original data was kept. */
export function loadWarning(): string | null {
  return opened.warning;
}

/** False if nothing may be saved this session, to protect saved data this version could not fully read. */
export function canSave(): boolean {
  return opened.canSave;
}

export function getRoster(): Roster {
  return roster;
}

/** Applies a change, saves it and notifies listeners. `source` identifies the panel making the change. */
export function change(update: (r: Roster) => Roster, source: string): void {
  roster = update(roster);
  lastSaveOk = storage !== null && opened.canSave && saveRoster(storage, roster);
  for (const l of listeners) l(source);
}

export function onChange(listener: Listener): void {
  listeners.push(listener);
}

/** False if the last change could not be saved. */
export function saved(): boolean {
  return lastSaveOk;
}

export function characterById(id: string): Character {
  return roster.entries.find((e) => e.id === id)!.character;
}

export function sideCharacter(side: Side): Character {
  return characterById(roster[side]);
}

export function newId(): string {
  return crypto.randomUUID();
}

/** Rolls a new character. Without a name, it is named after the background and numbered. */
export function rollNew(background: BackgroundName, name?: string): Character {
  const base = BACKGROUND_INFO[background].name;
  const taken = new Set(roster.entries.map((e) => e.character.name));
  let n = 1;
  while (taken.has(`${base} ${n}`)) n++;
  return rollCharacter(name ?? `${base} ${n}`, background, dice);
}
