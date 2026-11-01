// Randomness is injected. Nothing in the lab calls Math.random, so results are reproducible from a seed.

/** A stream of numbers in [0, 1). The game's `Rng` (src/rng.ts) already has this shape, so it can be passed in as it is. */
export interface RandomSource {
  next(): number;
}

/** Rolls one die. Tests use a scripted roller that returns predetermined faces. */
export interface Roller {
  /** A face from 1 to `sides`. */
  roll(sides: number): number;
}

/** A seeded source using mulberry32, the same generator as the game, so a seed produces the same sequence in both. */
export function seeded(seed: number): RandomSource {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export function roller(source: RandomSource): Roller {
  return {
    roll(sides) {
      if (!Number.isInteger(sides) || sides < 1) throw new RangeError(`a die needs a whole number of faces, got ${sides}`);
      return 1 + Math.floor(source.next() * sides);
    },
  };
}
