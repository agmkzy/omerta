// Timing and faces for the dice animation. The result of a roll is decided before the animation starts; this only
// decides what is shown on the way there.
import type { Roller } from '../src/random';

/** `count` delays in milliseconds, each longer than the last, adding up to `total`: a flicker that slows down. */
export function slowingDelays(count: number, total: number): number[] {
  if (count === 1) return [total];
  const weights = Array.from({ length: count }, (_, i) => 1 + 5 * (i / (count - 1)) ** 2);
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (w / sum) * total);
}

/** `count` faces to flicker through, ending on `result`, never showing the same face twice in a row. */
export function flickerSequence(sides: number, count: number, result: number, roller: Roller): number[] {
  if (sides === 1) return Array.from({ length: count }, () => 1);
  const faces = [result];
  while (faces.length < count) {
    const after = faces[0]!;
    const face = roller.roll(sides - 1);
    faces.unshift(face >= after ? face + 1 : face);
  }
  return faces;
}
