// Fights, following D&D's combat rules. When a fight starts both characters roll Reflexes for initiative; the higher acts
// first each round (a tie goes to the defender). Each round each character attacks: d20 + Brawling against the target's
// Defence (10 + Reflexes bonus). A hit deals 1d4 + Strength modifier, at least 1; a natural 20 always hits and rolls the
// damage dice twice; a natural 1 always misses. A character at 0 hit points is knocked out and does not act.
//
// Nerve follows D&D's optional morale rule: the first time a character drops to half hit points or below, they make one
// nerve check (fight or flight). Passing commits them to the fight. Failing ends it: they flee, or yield (a defender
// surrenders, an attacker backs off). Every step is recorded as an event.
import { abilityModifier } from './attributes';
import { resolveCheck, resolveOpposed, type CheckResult, type OpposedResult } from './check';
import { defence, maxHitPoints, rollFor, type Character } from './character';
import { DICE, type Dice } from './dice';
import { nerveCheck, otherSide, type NerveCheck, type Side } from './nerve';
import type { Roller } from './random';

export interface FightSpec {
  readonly attacker: Character;
  readonly defender: Character;
  readonly dice?: Dice;
  /** Default 12. */
  readonly maxRounds?: number;
}

export interface Damage {
  readonly faces: readonly number[];
  readonly modifier: number;
  readonly total: number;
}

export type FightEnding =
  | { readonly how: 'knocked-out' | 'flees'; readonly loser: Side }
  /** The defender lost their nerve and stopped resisting. */
  | { readonly how: 'surrenders'; readonly loser: 'defender' }
  /** The attacker lost their nerve and stopped attacking. */
  | { readonly how: 'backs-off'; readonly loser: 'attacker' }
  | { readonly how: 'stalemate'; readonly loser: null };

export type FightEvent =
  | { readonly kind: 'initiative'; readonly result: OpposedResult; readonly first: Side }
  | {
      readonly kind: 'attack';
      readonly round: number;
      readonly by: Side;
      /** The attack roll against the target's Defence (the DC). */
      readonly result: CheckResult;
      readonly hit: boolean;
      readonly critical: boolean;
      readonly damage: Damage | null;
      readonly hp: Readonly<Record<Side, number>>;
    }
  | { readonly kind: 'nerve'; readonly round: number; readonly side: Side; readonly check: NerveCheck }
  | { readonly kind: 'end'; readonly round: number; readonly ending: FightEnding };

export interface FightResult {
  readonly events: readonly FightEvent[];
  readonly ending: FightEnding;
  readonly rounds: number;
  readonly hp: Readonly<Record<Side, number>>;
  readonly maxHp: Readonly<Record<Side, number>>;
}

/** What each kind of ending means, for explaining results. */
export const FIGHT_ENDING_INFO: { readonly [H in FightEnding['how']]: { readonly title: string; readonly explanation: string } } = {
  'knocked-out': { title: 'Knocked out', explanation: 'Reduced to 0 hit points.' },
  surrenders: {
    title: 'Lost their nerve and surrendered',
    explanation: 'Failed the nerve check at half hit points and stopped resisting. Still there and conscious.',
  },
  'backs-off': {
    title: 'Lost their nerve and backed off',
    explanation: 'Failed the nerve check at half hit points and stopped attacking, without getting what they came for.',
  },
  flees: { title: 'Lost their nerve and fled', explanation: 'Failed the nerve check at half hit points, and their low courage or high caution made them run.' },
  stalemate: { title: 'Stalemate', explanation: 'Nobody won before the round limit.' },
};

/** Unarmed damage: 1d4 + Strength modifier, minimum 1. */
export const UNARMED_DAMAGE_DIE = 4;

/** Damage dealt by a hit: 1d4 (2d4 on a critical) + Strength modifier, minimum 1. */
export function rollDamage(c: Character, critical: boolean, roller: Roller): Damage {
  const faces = Array.from({ length: critical ? 2 : 1 }, () => roller.roll(UNARMED_DAMAGE_DIE));
  const modifier = abilityModifier(c.attributes.str);
  return { faces, modifier, total: Math.max(1, faces.reduce((a, b) => a + b, 0) + modifier) };
}

export function runFight(spec: FightSpec, roller: Roller): FightResult {
  const dice = spec.dice ?? DICE.d20;
  const maxRounds = spec.maxRounds ?? 12;
  if (!Number.isInteger(maxRounds) || maxRounds < 1) throw new RangeError(`maxRounds must be a positive integer, got ${maxRounds}`);
  const sides: Record<Side, Character> = { attacker: spec.attacker, defender: spec.defender };
  const maxHp: Record<Side, number> = { attacker: maxHitPoints(spec.attacker), defender: maxHitPoints(spec.defender) };
  const hp: Record<Side, number> = { ...maxHp };
  const nerveTested: Record<Side, boolean> = { attacker: false, defender: false };
  const events: FightEvent[] = [];
  let round = 0;

  const finish = (ending: FightEnding): FightResult => {
    events.push({ kind: 'end', round, ending });
    return { events, ending, rounds: round, hp, maxHp };
  };

  const initiative = resolveOpposed({ active: rollFor(sides.attacker, 'reflexes', { dice }), passive: rollFor(sides.defender, 'reflexes', { dice }) }, roller);
  const first: Side = initiative.margin >= 0 ? 'attacker' : 'defender';
  events.push({ kind: 'initiative', result: initiative, first });
  const order: readonly Side[] = [first, otherSide(first)];

  /** One attack. Returns an ending, or null to continue. */
  const attack = (by: Side): FightEnding | null => {
    const target = otherSide(by);
    const result = resolveCheck({ ...rollFor(sides[by], 'brawling', { dice }), dc: defence(sides[target]) }, roller);
    const kept = result.roll.thrown.kept;
    const critical = kept === dice.count * dice.sides;
    const hit = critical || (kept !== dice.count && result.margin >= 0);
    const damage = hit ? rollDamage(sides[by], critical, roller) : null;
    if (damage) hp[target] = Math.max(0, hp[target] - damage.total);
    events.push({ kind: 'attack', round, by, result, hit, critical, damage, hp: { ...hp } });
    if (!damage) return null;
    if (hp[target] === 0) return { how: 'knocked-out', loser: target };
    if (hp[target] > maxHp[target] / 2 || nerveTested[target]) return null;
    nerveTested[target] = true;
    const check = nerveCheck(sides[target], 'hurt', false, dice, roller);
    events.push({ kind: 'nerve', round, side: target, check });
    if (check.response === 'flees') return { how: 'flees', loser: target };
    if (check.response === null) return null;
    return target === 'defender' ? { how: 'surrenders', loser: 'defender' } : { how: 'backs-off', loser: 'attacker' };
  };

  while (round < maxRounds) {
    round++;
    for (const side of order) {
      const ending = attack(side);
      if (ending) return finish(ending);
    }
  }
  return finish({ how: 'stalemate', loser: null });
}

/** A key for counting endings, e.g. "knocked-out:defender" or "stalemate". */
export function fightEndingKey(ending: FightEnding): string {
  return ending.loser ? `${ending.how}:${ending.loser}` : ending.how;
}

/** Runs the fight `runs` times and counts the endings by `fightEndingKey`. */
export function tallyFights(spec: FightSpec, roller: Roller, runs: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let i = 0; i < runs; i++) {
    const key = fightEndingKey(runFight(spec, roller).ending);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
