// Who is on each side of a fight in the playground, by roster id. Pure functions; persistence goes through an injected
// storage (localStorage).
import type { Side } from '../src/nerve';
import type { KeyValueStorage } from './roster';

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

export function loadParties(storage: KeyValueStorage): Parties | null {
  try {
    const text = storage.getItem(PARTIES_KEY);
    return text === null ? null : parseParties(text);
  } catch {
    return null;
  }
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
