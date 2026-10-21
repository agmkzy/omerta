// Accessors and world builders shared by every system's tests. Each builder says what it builds and takes every argument
// explicitly; there is no fresh() with hidden defaults. System-specific fixtures live in <system>/fixtures.ts. Every test
// file gets its own copy of these modules (Vitest isolates files), so any cache in them is per file.
import { deserialize, serialize } from '../engine';
import { createWorld } from '../world';
import { World } from '../types';

/** The player's character. */
export const P = (w: World) => w.chars[w.playerId!];

/** A copy of a world through a save and a load. */
export const clone = (w: World) => deserialize(serialize(w));

/** World `seed` as generated, at day 0, with the player named Tony Marino. Not cached: cheap to build. */
export const newWorld = (seed: number) => createWorld(seed, 'Tony Marino');
