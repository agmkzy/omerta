// Dice for the playground. Each use gets its own stream, drawn from one seed per page load, so no two panels share dice,
// each load rolls differently, and nothing calls Math.random. (The Dice and odds tab uses the seed chosen there.)
import { roller, seeded, type Roller } from '../src/random';

const seeds = roller(seeded(Date.now() >>> 0));

/** A new stream of dice. */
export function newDice(): Roller {
  return roller(seeded(seeds.roll(2 ** 32 - 1)));
}
