// Stepping through a fight one roll at a time. A fight is kept as the faces rolled so far; replaying them shows the fight
// up to that point and the roll it is waiting for, so a player can roll each die, choose its result, or go back.
import { DICE, facesForTotal } from './dice';
import { AwaitingRoll, playFight, type FightEvent, type FightResult, type FightRollReason, type FightRoller, type FightSpec, type Fighter, type RollRequest } from './fight';

/** A fight replayed from some rolls: either finished, or waiting for the next roll with the fight so far. */
export type FightStep = (
  | { readonly done: true; readonly result: FightResult }
  | {
      readonly done: false;
      readonly request: RollRequest;
      /** The round the roll is for; 0 while rolling initiative. */
      readonly round: number;
      readonly events: readonly FightEvent[];
      readonly fighters: readonly Fighter[];
    }
) & {
  /** Where each whole roll starts among the faces used: a roll of several dice (3d6, say) is chosen and undone together. */
  readonly rollStarts: readonly number[];
};

/**
 * Replays a fight from the faces rolled so far (in the order the fight asks for them). If the faces run out before the
 * fight ends, returns the roll it is waiting for, with the events and fighters so far. Throws if a face is not on its die.
 */
export function stepFight(spec: FightSpec, faces: readonly number[]): FightStep {
  const dice = spec.dice ?? DICE.d20;
  const rollStarts: number[] = [];
  let used = 0;
  const given: FightRoller = {
    roll(sides: number, reason: FightRollReason) {
      const face = faces[used];
      if (face === undefined) throw new AwaitingRoll({ sides, dice, reason });
      if (!Number.isInteger(face) || face < 1 || face > sides) throw new RangeError(`face ${face} is not on a d${sides}`);
      if (reason.die === 1) rollStarts.push(used);
      used++;
      return face;
    },
  };
  const played = playFight(spec, given);
  if (played.finished) return { done: true, result: played.result, rollStarts };
  return { done: false, request: played.request, round: played.round, events: played.events, fighters: played.fighters, rollStarts };
}

/** The faces with the last whole roll removed. */
export function withoutLastRoll(spec: FightSpec, faces: readonly number[]): number[] {
  return faces.slice(0, stepFight(spec, faces).rollStarts.at(-1) ?? 0);
}

/** How many dice make up each throw of a roll: with advantage a roll is two throws of the fight's dice. */
function throwSize(request: RollRequest): number {
  return request.reason.kind === 'attack' && request.reason.edge === 'advantage' ? request.reason.of / 2 : request.reason.of;
}

/** The result that counts from a whole roll's faces: their total, or with advantage the higher of the two throws. */
export function resultOf(request: RollRequest, faces: readonly number[]): number {
  const size = throwSize(request);
  const sum = (from: number) => faces.slice(from, from + size).reduce((a, b) => a + b, 0);
  return size === request.reason.of ? sum(0) : Math.max(sum(0), sum(size));
}

/** Faces that give this result for the whole roll: split into dice, and with advantage the other throw as low as possible. */
export function facesForResult(request: RollRequest, result: number): number[] {
  const size = throwSize(request);
  const faces = facesForTotal(result, size, request.sides);
  return size === request.reason.of ? faces : [...faces, ...Array.from({ length: size }, () => 1)];
}
