// Cash moves only by recorded transfers, as in the game's ledger. Each transfer names who paid whom, how much, why and when.
// Money entering or leaving the cast comes from or goes to the world, so all cash has a recorded source: an opening balance
// is a transfer from the world. Each character's cash is also stored, and auditCash checks that the two always agree.
import type { CharacterRecord, Id } from './character';
import { assertTime } from './time';

/** The party for money from or to outside the cast. No character can have this id. */
export const WORLD = 'world';
export type Party = Id;

export interface Transfer {
  readonly from: Party;
  readonly to: Party;
  readonly amount: number;
  readonly why: string;
  /** When it was made, in minutes. */
  readonly at: number;
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
    const left = (running.get(t.from) ?? 0) - t.amount;
    if (t.from !== WORLD && left < 0) throw new RangeError(`${t.from} paid ${t.amount} with only ${left + t.amount}`);
    running.set(t.from, left);
    running.set(t.to, (running.get(t.to) ?? 0) + t.amount);
  }
  for (const c of characters)
    if (c.inventory.cash !== (running.get(c.id) ?? 0))
      throw new RangeError(`${c.id} has ${c.inventory.cash} in cash, but the transfers give them ${running.get(c.id) ?? 0}`);
}
