// Timing and faces for the dice animation. The result of a roll is decided before the animation starts; this only
// decides what is shown on the way there.

/** How much longer the last step of the animation lasts than the first, less one: the last is six times the first. */
const SLOWDOWN = 5;

/** `count` delays in milliseconds, each longer than the last, adding up to `total`: a flicker that slows down. */
export function slowingDelays(count: number, total: number): number[] {
  if (count === 1) return [total];
  const weights = Array.from({ length: count }, (_, i) => 1 + SLOWDOWN * (i / (count - 1)) ** 2);
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (w / sum) * total);
}

/**
 * The faces a roulette-style sweep passes over: one step to the right at a time from `start`, wrapping from the last face
 * to the first, going round until it has taken at least `minSteps` and reaches `result`.
 */
export function sweepSequence(sides: number, start: number, result: number, minSteps: number): number[] {
  const distance = ((result - start - 1 + sides) % sides) + 1;
  const length = distance + sides * Math.max(0, Math.ceil((minSteps - distance) / sides));
  return Array.from({ length }, (_, i) => ((start + i) % sides) + 1);
}
