// Test doubles. A scripted roller returns predetermined faces in order, so a test can state the dice results explicitly.
import type { Roller } from '../src/random';

export function scripted(...faces: number[]): Roller & { readonly remaining: number } {
  const queue = [...faces];
  return {
    roll(sides) {
      const face = queue.shift();
      if (face === undefined) throw new Error('scripted roller ran out of faces');
      if (!Number.isInteger(face) || face < 1 || face > sides) throw new Error(`scripted face ${face} is not on a d${sides}`);
      return face;
    },
    get remaining() {
      return queue.length;
    },
  };
}
