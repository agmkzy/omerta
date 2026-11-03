// Time is a number of minutes, as in the game (src/types.ts), so the game's `now` can be passed straight through.
export const HOUR = 60;
export const DAY = 24 * HOUR;

/** Throws RangeError unless `now` is a whole, non-negative number of minutes. */
export function assertTime(now: number, what = 'a time'): void {
  if (!Number.isInteger(now) || now < 0) throw new RangeError(`${what} is a whole number of minutes from 0, got ${now}`);
}
