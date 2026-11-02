// Who is on each side of a fight in the playground, by roster id. Pure functions, and a line-up that reads and saves
// through an injected storage (localStorage).
import type { Side } from '../src/nerve';
import { backup, type KeyValueStorage } from './storage';

export interface Parties {
  readonly attackers: readonly string[];
  readonly defenders: readonly string[];
}

export const PARTIES_KEY = 'character-lab:parties';

/** Puts a character on a side (moving them off the other), or out of the fight with null. */
export function assign(p: Parties, id: string, side: Side | null): Parties {
  const attackers = p.attackers.filter((x) => x !== id);
  const defenders = p.defenders.filter((x) => x !== id);
  if (side === 'attacker') return p.attackers.includes(id) ? p : { attackers: [...attackers, id], defenders };
  if (side === 'defender') return p.defenders.includes(id) ? p : { attackers, defenders: [...defenders, id] };
  return { attackers, defenders };
}

export function sideOf(p: Parties, id: string): Side | null {
  return p.attackers.includes(id) ? 'attacker' : p.defenders.includes(id) ? 'defender' : null;
}

export function canFight(p: Parties): boolean {
  return p.attackers.length > 0 && p.defenders.length > 0;
}

/** Drops ids that are no longer in the roster. */
export function reconcile(p: Parties, ids: readonly string[]): Parties {
  return { attackers: p.attackers.filter((x) => ids.includes(x)), defenders: p.defenders.filter((x) => ids.includes(x)) };
}

export function serializeParties(p: Parties): string {
  return JSON.stringify(p);
}

/** Parses saved parties; ids that are not strings or that appear twice are dropped. Null if unusable. */
export function parseParties(text: string): Parties | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const { attackers, defenders } = data as Record<string, unknown>;
  if (!Array.isArray(attackers) || !Array.isArray(defenders)) return null;
  const seen = new Set<string>();
  const keep = (ids: unknown[]) => ids.filter((x): x is string => typeof x === 'string' && !seen.has(x) && Boolean(seen.add(x)));
  return { attackers: keep(attackers), defenders: keep(defenders) };
}

/** The stored line-up as read, whether it may be saved over, and what to tell the user if it could not all be read. */
export interface OpenedParties {
  readonly parties: Parties | null;
  readonly canSave: boolean;
  readonly warning: string | null;
}

/**
 * Reads the stored line-up. If saving what was read would change the stored text (it was corrupt, or held something this
 * version does not recognise), the text is backed up first, and if that fails, or storage cannot be read, it may not be
 * saved over.
 */
export function openParties(storage: KeyValueStorage | null): OpenedParties {
  if (!storage) return { parties: null, canSave: false, warning: null };
  let text: string | null;
  try {
    text = storage.getItem(PARTIES_KEY);
  } catch {
    return { parties: null, canSave: false, warning: 'The saved line-up could not be read from this browser’s storage, so changes to it will not be saved this session.' };
  }
  if (text === null) return { parties: null, canSave: true, warning: null };
  const parties = parseParties(text);
  if (parties && serializeParties(parties) === text) return { parties, canSave: true, warning: null };
  const key = backup(storage, PARTIES_KEY, text);
  return key
    ? { parties, canSave: true, warning: `The saved line-up could not be fully read. The original is kept in this browser’s storage under “${key}”.` }
    : { parties, canSave: false, warning: 'The saved line-up could not be fully read, and could not be backed up, so changes to it will not be saved this session.' };
}

/** The fight line-up for one page. */
export interface LineUp {
  /**
   * The line-up for these roster ids: ids no longer in the roster are left out, and an empty line-up is the 1st against
   * the 2nd character. This never saves, so looking at the line-up never changes what is stored.
   */
  current(ids: readonly string[]): Parties;
  /** Changes the line-up, and saves it if it may be saved over and `canSave` (the roster's rule) allows. */
  set(p: Parties): void;
  /** What to tell the user if the line-up could not all be read, or changes to it are not being saved; null if all is well. */
  note(): string | null;
}

/** A line-up read from storage when first needed (see openParties). */
export function lineUp(storage: KeyValueStorage | null, canSave: () => boolean): LineUp {
  let opened: { parties: Parties; canSave: boolean; warning: string | null } | null = null;
  let lastSaveFailed = false;
  const open = () => {
    if (!opened) {
      const read = openParties(storage);
      opened = { ...read, parties: read.parties ?? { attackers: [], defenders: [] } };
    }
    return opened;
  };
  /** Why changes are not being saved now, if they are not; null when a read warning that blocks saving already says so. */
  const savingNote = (lineUpCanSave: boolean): string | null => {
    if (!storage) return 'Changes to the line-up are not saved: browser storage is unavailable.';
    if (!lineUpCanSave) return null;
    if (!canSave()) return 'Changes to the line-up are not saved this session, to protect the saved characters (see the warning at the top of the page).';
    if (lastSaveFailed) return 'The last change to the line-up was not saved: the browser refused to store it (its storage may be full).';
    return null;
  };
  return {
    current(ids) {
      const o = open();
      const kept = reconcile(o.parties, ids);
      o.parties = kept.attackers.length || kept.defenders.length ? kept : { attackers: ids.slice(0, 1), defenders: ids.slice(1, 2) };
      return o.parties;
    },
    set(p) {
      const o = open();
      o.parties = p;
      if (storage && o.canSave && canSave()) lastSaveFailed = !saveParties(storage, p);
    },
    note() {
      const o = open();
      const notes = [o.warning, savingNote(o.canSave)].filter((n) => n !== null);
      return notes.length ? notes.join(' ') : null;
    },
  };
}

/** Returns false if the parties could not be saved. */
export function saveParties(storage: KeyValueStorage, p: Parties): boolean {
  try {
    storage.setItem(PARTIES_KEY, serializeParties(p));
    return true;
  } catch {
    return false;
  }
}
