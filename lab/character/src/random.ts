// Randomness is injected. Nothing in the lab calls Math.random, so results are reproducible from a seed.

/** A stream of numbers in [0, 1). The game's `Rng` (src/rng.ts) already has this shape, so it can be passed in as it is. */
export interface RandomSource {
  next(): number;
}

/** Why a die is being rolled, for anything that wants to show the roll or choose its result. */
export interface RollReason {
  readonly kind: string;
}

/** Rolls one die. Tests use a scripted roller that returns predetermined faces. */
export interface Roller {
  /** A face from 1 to `sides`. `reason` says what the roll is for, where the caller knows. */
  roll(sides: number, reason?: RollReason): number;
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

/**
 * A roller that returns the given faces first, then rolls with `then`. It records every face it returns, so a fight (or
 * anything else) can be replayed exactly from its faces, or replayed up to a point and continued.
 */
export function replay(faces: readonly number[], then: Roller): Roller & { readonly faces: number[] } {
  const record: number[] = [];
  return {
    faces: record,
    roll(sides, reason) {
      const given = faces[record.length];
      if (given !== undefined && (!Number.isInteger(given) || given < 1 || given > sides)) throw new RangeError(`face ${given} is not on a d${sides}`);
      const face = given ?? then.roll(sides, reason);
      record.push(face);
      return face;
    },
  };
}
