// Cash moves only by recorded transfers, as in the game's ledger. Each transfer names who paid whom, how much, why and when.
// Money entering or leaving the cast comes from or goes to the world, so all cash has a recorded source: an opening balance
// is a transfer from the world. Each character's cash is also stored, and auditCash checks that the two always agree.
import type { CharacterRecord, Id } from './character';
import type { FactId } from './facts';
import { ITEMS, type Item } from './items';
import { assertTime } from './time';

/** The party for money from or to outside the cast. No character can have this id. */
export const WORLD = 'world';
export type Party = Id;

export interface Transfer {
  readonly from: Party;
  readonly to: Party;
  /** The cash moved, or, with `item`, how many of it. */
  readonly amount: number;
  /** An item changing hands, rather than cash. */
  readonly item?: Item;
  readonly why: string;
  /** When it was made, in minutes. */
  readonly at: number;
  /** The fact that caused it, such as a robbery. */
  readonly cause?: FactId;
}

/** Throws RangeError for a transfer that is not a positive whole amount between two different parties, with a reason and a time. */
export function assertTransfer(t: Transfer): void {
  if (!Number.isInteger(t.amount) || t.amount < 1) throw new RangeError(`a transfer is a whole amount from 1, got ${t.amount}`);
  if (t.from === t.to) throw new RangeError(`a transfer needs two different parties, got ${t.from} twice`);
  if (typeof t.why !== 'string' || t.why === '') throw new RangeError('a transfer needs a reason');
  assertTime(t.at, 'a transfer’s time');
}

/**
 * Throws RangeError unless the transfers and the characters' cash agree: every transfer is valid and between the world and
 * characters in the cast, in time order, every character's cash is what the transfers give them, and no one's cash ever
 * went below 0.
 */
export function auditCash(characters: readonly CharacterRecord[], transfers: readonly Transfer[]): void {
  const ids = new Set(characters.map((c) => c.id));
  if (ids.has(WORLD)) throw new RangeError(`no character can have the id ${WORLD}`);
  const running = new Map<Party, number>();
  let last = 0;
  for (const t of transfers) {
    assertTransfer(t);
    if (t.at < last) throw new RangeError(`a transfer at ${t.at} is recorded after one at ${last}`);
    last = t.at;
    for (const p of [t.from, t.to]) if (p !== WORLD && !ids.has(p)) throw new RangeError(`a transfer names ${p}, who is not in the cast`);
    if (t.item !== undefined) continue;
    const left = (running.get(t.from) ?? 0) - t.amount;
    if (t.from !== WORLD && left < 0) throw new RangeError(`${t.from} paid ${t.amount} with only ${left + t.amount}`);
    running.set(t.from, left);
    running.set(t.to, (running.get(t.to) ?? 0) + t.amount);
  }
  auditItems(characters, transfers);
  for (const c of characters)
    if (c.inventory.cash !== (running.get(c.id) ?? 0))
      throw new RangeError(`${c.id} has ${c.inventory.cash} in cash, but the transfers give them ${running.get(c.id) ?? 0}`);
}

/**
 * Throws RangeError unless every character holds exactly the items the transfers give them, of each kind, and no one ever
 * gave an item they did not hold.
 */
function auditItems(characters: readonly CharacterRecord[], transfers: readonly Transfer[]): void {
  const held = new Map<string, number>();
  const key = (p: Party, i: Item) => `${p}\u0000${i}`;
  for (const t of transfers) {
    if (t.item === undefined) continue;
    if (!ITEMS.includes(t.item)) throw new RangeError(`unknown item ${String(t.item)}`);
    const left = (held.get(key(t.from, t.item)) ?? 0) - t.amount;
    if (t.from !== WORLD && left < 0) throw new RangeError(`${t.from} gave ${t.amount} ${t.item} without holding them`);
    held.set(key(t.from, t.item), left);
    held.set(key(t.to, t.item), (held.get(key(t.to, t.item)) ?? 0) + t.amount);
  }
  for (const c of characters)
    for (const i of ITEMS) {
      const count = c.inventory.items.filter((h) => h.item === i).length;
      if (count !== (held.get(key(c.id, i)) ?? 0)) throw new RangeError(`${c.id} holds ${count} ${i}, but the transfers give them ${held.get(key(c.id, i)) ?? 0}`);
    }
}
