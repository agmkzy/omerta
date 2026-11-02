// Test doubles. A scripted roller returns predetermined faces in order, so a test can state the dice results explicitly.
// A labelled roller does the same for fights, with the faces listed by what they are for, so a test reads as the fight.
import assert from 'node:assert/strict';
import type { FightResult, FightRollReason, FightSpec } from '../src/fight';
import { runFight } from '../src/fight';
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

/** The faces for a fight, by what they are for, each list in the order the fight asks. A multi-dice roll takes one per die. */
export type FightRolls = Partial<Record<FightRollReason['kind'], readonly number[]>>;

/** A fight roller that answers each roll from the list for its kind, recording every face in the order used. */
export function labelled(rolls: FightRolls) {
  const queues = new Map(Object.entries(rolls).map(([kind, faces]) => [kind, [...faces]]));
  const faces: number[] = [];
  return {
    faces,
    roll(sides: number, reason: FightRollReason): number {
      const face = queues.get(reason.kind)?.shift();
      if (face === undefined) throw new Error(`no ${reason.kind} roll scripted for ${reason.by.name}`);
      if (!Number.isInteger(face) || face < 1 || face > sides) throw new Error(`scripted ${reason.kind} face ${face} is not on a d${sides}`);
      faces.push(face);
      return face;
    },
    /** The scripted faces the fight did not use, by kind. */
    unused(): FightRolls {
      return Object.fromEntries([...queues].filter(([, q]) => q.length > 0));
    },
  };
}

/** Runs a fight on labelled faces and checks that every one was used. */
export function fightWith(spec: FightSpec, rolls: FightRolls): FightResult {
  const dice = labelled(rolls);
  const result = runFight(spec, dice);
  assert.deepEqual(dice.unused(), {}, 'not all scripted faces were used');
  return result;
}

/** The faces a fight uses, in order, from labelled faces: for stepping through it. */
export function facesFor(spec: FightSpec, rolls: FightRolls): number[] {
  const dice = labelled(rolls);
  runFight(spec, dice);
  return dice.faces;
}
