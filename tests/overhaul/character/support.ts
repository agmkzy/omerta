// Test doubles. A scripted roller returns predetermined faces in order, so a test can state the dice results explicitly.
// A labelled roller does the same for fights, with the faces listed by what they are for, so a test reads as the fight.
import type { FightRollReason } from '../../../src/overhaul/character/fight';
import type { Roller } from '../../../src/overhaul/character/random';

export function scripted(...faces: number[]): Roller {
  const queue = [...faces];
  return {
    roll(sides) {
      const face = queue.shift();
      if (face === undefined) throw new Error('scripted roller ran out of faces');
      if (!Number.isInteger(face) || face < 1 || face > sides) throw new Error(`scripted face ${face} is not on a d${sides}`);
      return face;
    },
  };
}

/** The faces for a fight, by what each roll is for, each list in the order the fight asks. A multi-dice roll takes one per die. */
export type FightRolls = Partial<Record<FightRollReason['kind'], readonly number[]>>;

/** A roller that answers each fight roll from the list for its kind, and can say which faces were not used. */
export function labelled(rolls: FightRolls): Roller & { unused(): FightRolls } {
  const queues = new Map(Object.entries(rolls).map(([kind, faces]) => [kind, [...faces]]));
  return {
    roll(sides, reason) {
      const r = reason as FightRollReason;
      const face = queues.get(r.kind)?.shift();
      if (face === undefined) throw new Error(`no ${r.kind} roll scripted for ${r.by}`);
      if (!Number.isInteger(face) || face < 1 || face > sides) throw new Error(`scripted ${r.kind} face ${face} is not on a d${sides}`);
      return face;
    },
    unused: () => Object.fromEntries([...queues].filter(([, q]) => q.length > 0)),
  };
}
