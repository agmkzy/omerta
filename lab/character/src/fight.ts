// Fights between two sides of one or more fighters, following D&D's combat rules. Every fighter rolls Reflexes for
// initiative; the order is highest first (defenders first on a tie, then list order). On their turn, each fighter still in
// the fight attacks a random enemy who is still fighting: d20 + Brawling against the target's Defence (10 + Reflexes
// bonus). A hit deals 1d4 + Strength modifier, at least 1; a natural 20 always hits and rolls the damage dice twice; a
// natural 1 always misses. A fighter at 0 hit points is knocked out.
//
// Nerve follows D&D's optional morale rules. The first time a fighter drops to half hit points or below, they make one
// nerve check. The first time at least half of a side is out of the fight, everyone left on that side makes one. A
// failure takes that fighter out of the fight: they flee (timid or cautious) or yield (a defender surrenders, an attacker
// backs off). A side loses when none of its fighters is still fighting. Every step is recorded as an event.
import { abilityModifier } from './attributes';
import { bonusOf, resolveCheck, throwRoll, type CheckResult, type RollResult } from './check';
import { defence, maxHitPoints, rollFor, type Character } from './character';
import { DICE, type Dice } from './dice';
import { nerveCheck, nerveCheckSpec, otherSide, type NerveCheck, type Side } from './nerve';
import type { Roller } from './random';

export interface FightSpec {
  readonly attackers: readonly Character[];
  readonly defenders: readonly Character[];
  readonly dice?: Dice;
  /** Default 12. */
  readonly maxRounds?: number;
}

export interface Damage {
  readonly faces: readonly number[];
  readonly modifier: number;
  readonly total: number;
}

export const FIGHTER_STATUSES = ['fighting', 'knocked-out', 'surrendered', 'backed-off', 'fled'] as const;
export type FighterStatus = (typeof FIGHTER_STATUSES)[number];

export const FIGHTER_STATUS_INFO: { readonly [S in FighterStatus]: { readonly title: string; readonly explanation: string } } = {
  fighting: { title: 'Still fighting', explanation: 'Was still in the fight at the end.' },
  'knocked-out': { title: 'Knocked out', explanation: 'Reduced to 0 hit points.' },
  surrendered: { title: 'Lost their nerve and surrendered', explanation: 'A defender who failed a nerve check and stopped resisting. Still there and conscious.' },
  'backed-off': { title: 'Lost their nerve and backed off', explanation: 'An attacker who failed a nerve check and stopped attacking.' },
  fled: { title: 'Lost their nerve and fled', explanation: 'Failed a nerve check, and their low courage or high caution made them run.' },
};

export interface Fighter {
  /** A1, A2… for attackers; B1, B2… for defenders. */
  readonly id: string;
  readonly side: Side;
  readonly character: Character;
  readonly hp: number;
  readonly maxHp: number;
  readonly status: FighterStatus;
}

export type FightEvent =
  | { readonly kind: 'initiative'; readonly order: readonly { readonly id: string; readonly roll: RollResult }[] }
  | {
      readonly kind: 'attack';
      readonly round: number;
      readonly by: string;
      readonly target: string;
      /** The attack roll against the target's Defence (the DC). */
      readonly result: CheckResult;
      readonly hit: boolean;
      readonly critical: boolean;
      readonly damage: Damage | null;
      /** The target's hit points after the attack. */
      readonly hp: number;
    }
  | { readonly kind: 'nerve'; readonly round: number; readonly id: string; readonly trigger: 'hurt' | 'allies-down'; readonly check: NerveCheck }
  | { readonly kind: 'out'; readonly round: number; readonly id: string; readonly status: Exclude<FighterStatus, 'fighting'> }
  | { readonly kind: 'end'; readonly round: number; readonly winner: Side | null };

export interface FightResult {
  readonly events: readonly FightEvent[];
  /** The side with someone still fighting, or null for a stalemate. */
  readonly winner: Side | null;
  readonly rounds: number;
  /** Every fighter as they finished: attackers, then defenders. */
  readonly fighters: readonly Fighter[];
}

/** Unarmed damage: 1d4 + Strength modifier, minimum 1. */
export const UNARMED_DAMAGE_DIE = 4;

/** Damage dealt by a hit: 1d4 (2d4 on a critical) + Strength modifier, minimum 1. */
export function rollDamage(c: Character, critical: boolean, roller: Roller): Damage {
  const faces = Array.from({ length: critical ? 2 : 1 }, () => roller.roll(UNARMED_DAMAGE_DIE));
  const modifier = abilityModifier(c.attributes.str);
  return { faces, modifier, total: Math.max(1, faces.reduce((a, b) => a + b, 0) + modifier) };
}

export interface FightStats {
  readonly hitPoints: number;
  /** Added to the d20 when attacking (the Brawling bonus). */
  readonly attack: number;
  /** What an attack must reach to hit them. */
  readonly defence: number;
  readonly damageDie: number;
  readonly damageModifier: number;
  /** Added to the d20 for initiative (the Reflexes bonus). */
  readonly initiative: number;
  /** Added to the d20 for nerve checks, including temperament. */
  readonly nerve: number;
}

/** The numbers a fight uses for a character, for showing on screen. */
export function fightStats(c: Character): FightStats {
  return {
    hitPoints: maxHitPoints(c),
    attack: bonusOf(rollFor(c, 'brawling').modifiers),
    defence: defence(c),
    damageDie: UNARMED_DAMAGE_DIE,
    damageModifier: abilityModifier(c.attributes.str),
    initiative: bonusOf(rollFor(c, 'reflexes').modifiers),
    nerve: bonusOf(nerveCheckSpec(c, 'hurt', DICE.d20).modifiers),
  };
}

interface FighterState {
  id: string;
  side: Side;
  character: Character;
  hp: number;
  maxHp: number;
  status: FighterStatus;
  nerveTested: boolean;
}

export function runFight(spec: FightSpec, roller: Roller): FightResult {
  const dice = spec.dice ?? DICE.d20;
  const maxRounds = spec.maxRounds ?? 12;
  if (!Number.isInteger(maxRounds) || maxRounds < 1) throw new RangeError(`maxRounds must be a positive integer, got ${maxRounds}`);
  if (!spec.attackers.length || !spec.defenders.length) throw new RangeError('each side needs at least one fighter');

  const make = (side: Side, prefix: string) => (character: Character, i: number): FighterState => {
    const maxHp = maxHitPoints(character);
    return { id: `${prefix}${i + 1}`, side, character, hp: maxHp, maxHp, status: 'fighting', nerveTested: false };
  };
  const fighters = [...spec.attackers.map(make('attacker', 'A')), ...spec.defenders.map(make('defender', 'B'))];
  const events: FightEvent[] = [];
  const groupChecked: Record<Side, boolean> = { attacker: false, defender: false };
  let round = 0;

  const fightingOn = (side: Side) => fighters.filter((f) => f.side === side && f.status === 'fighting');
  const finish = (winner: Side | null): FightResult => {
    events.push({ kind: 'end', round, winner });
    return { events, winner, rounds: round, fighters: fighters.map(({ nerveTested: _, ...f }) => f) };
  };

  // Initiative: everyone rolls in list order; highest first, defenders first on a tie, then list order.
  const rolls = fighters.map((f, index) => ({ f, index, roll: throwRoll(rollFor(f.character, 'reflexes', { dice }), roller) }));
  const sideRank = (side: Side) => (side === 'defender' ? 0 : 1);
  rolls.sort((a, b) => b.roll.total - a.roll.total || sideRank(a.f.side) - sideRank(b.f.side) || a.index - b.index);
  events.push({ kind: 'initiative', order: rolls.map(({ f, roll }) => ({ id: f.id, roll })) });
  const order = rolls.map((r) => r.f);

  const takeOut = (f: FighterState, status: Exclude<FighterStatus, 'fighting'>) => {
    f.status = status;
    events.push({ kind: 'out', round, id: f.id, status });
  };

  /** A nerve check; a failure takes the fighter out of the fight. */
  const testNerve = (f: FighterState, trigger: 'hurt' | 'allies-down') => {
    const check = nerveCheck(f.character, trigger, false, dice, roller);
    events.push({ kind: 'nerve', round, id: f.id, trigger, check });
    if (check.response === 'flees') takeOut(f, 'fled');
    else if (check.response) takeOut(f, f.side === 'defender' ? 'surrendered' : 'backed-off');
  };

  /** The first time at least half a side is out, everyone left on it makes a nerve check. */
  const groupMorale = (side: Side) => {
    const all = fighters.filter((f) => f.side === side);
    const left = fightingOn(side);
    if (groupChecked[side] || all.length < 2 || left.length === 0 || (all.length - left.length) * 2 < all.length) return;
    groupChecked[side] = true;
    for (const f of left) testNerve(f, 'allies-down');
  };

  const attack = (by: FighterState) => {
    const enemies = fightingOn(otherSide(by.side));
    const target = enemies.length === 1 ? enemies[0]! : enemies[roller.roll(enemies.length) - 1]!;
    const result = resolveCheck({ ...rollFor(by.character, 'brawling', { dice }), dc: defence(target.character) }, roller);
    const kept = result.roll.thrown.kept;
    const critical = kept === dice.count * dice.sides;
    const hit = critical || (kept !== dice.count && result.margin >= 0);
    const damage = hit ? rollDamage(by.character, critical, roller) : null;
    if (damage) target.hp = Math.max(0, target.hp - damage.total);
    events.push({ kind: 'attack', round, by: by.id, target: target.id, result, hit, critical, damage, hp: target.hp });
    if (!damage) return;
    if (target.hp === 0) takeOut(target, 'knocked-out');
    else if (target.hp <= target.maxHp / 2 && !target.nerveTested) {
      target.nerveTested = true;
      testNerve(target, 'hurt');
    }
    if (target.status !== 'fighting') groupMorale(target.side);
  };

  while (round < maxRounds) {
    round++;
    for (const f of order) {
      if (f.status !== 'fighting') continue;
      attack(f);
      for (const side of ['attacker', 'defender'] as const) if (!fightingOn(side).length) return finish(otherSide(side));
    }
  }
  return finish(null);
}

export interface FightTally {
  readonly wins: Readonly<Record<Side | 'stalemate', number>>;
  /** For each fighter id, how often they finished with each status. */
  readonly statuses: Readonly<Record<string, Readonly<Record<FighterStatus, number>>>>;
}

/** Runs the fight `runs` times and counts the winners and each fighter's final status. */
export function tallyFights(spec: FightSpec, roller: Roller, runs: number): FightTally {
  const wins: Record<Side | 'stalemate', number> = { attacker: 0, defender: 0, stalemate: 0 };
  const statuses: Record<string, Record<FighterStatus, number>> = {};
  for (let i = 0; i < runs; i++) {
    const r = runFight(spec, roller);
    wins[r.winner ?? 'stalemate']++;
    for (const f of r.fighters) {
      statuses[f.id] ??= Object.fromEntries(FIGHTER_STATUSES.map((s) => [s, 0])) as Record<FighterStatus, number>;
      statuses[f.id]![f.status]++;
    }
  }
  return { wins, statuses };
}
