// Fights between two sides of one or more fighters, following D&D's combat rules. Every fighter rolls Reflexes for
// initiative; the order is highest first (defenders first on a tie, then list order). On their turn, each fighter still in
// the fight attacks a random enemy who is still fighting: the fight's dice (a d20 by default) + Brawling against the
// target's Defence (10 + Reflexes bonus). Ganging up, after D&D's optional flanking rule: an attack has advantage if
// someone on the attacker's side has already attacked that target this round. A hit deals 1d4 + Strength modifier, at
// least 1; the highest possible roll (a natural 20 on a d20) always hits and rolls the damage dice twice; the lowest
// always misses. A fighter at 0 hit points is knocked out.
//
// Nerve follows D&D's optional morale rules. The first time a fighter drops to half hit points or below, they make one
// nerve check. The first time at least half of a side is out of the fight, everyone left on that side makes one. A
// failure takes that fighter out of the fight: they flee (timid or cautious) or yield (a defender surrenders, an attacker
// backs off). A side loses when none of its fighters is still fighting. Every step is recorded as an event.
import { abilityModifier, ATTRIBUTE_INFO } from './attributes';
import { bonusOf, passes, resolveCheck, throwRoll, totalOf, type CheckResult, type Modifier, type RollResult, type Total } from './check';
import { defence, defenceOf, maxHitPoints, rollFor, type Character } from './character';
import { DICE, extremeOf, type Dice } from './dice';
import { FLEES_WHEN, nerveCheck, nerveCheckSpec, otherSide, type NerveCheck, type Side } from './nerve';
import type { Roller } from './random';

/** Omit applied to each member of a union separately. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** The round limit when a fight does not set one. */
export const DEFAULT_MAX_ROUNDS = 12;

export interface FightSpec {
  readonly attackers: readonly Character[];
  readonly defenders: readonly Character[];
  /** Default d20. */
  readonly dice?: Dice;
  /** Default DEFAULT_MAX_ROUNDS. */
  readonly maxRounds?: number;
}

export interface Damage {
  readonly faces: readonly number[];
  readonly modifier: number;
  readonly total: number;
  /** True when the dice and modifier came to less than 1, so the minimum of 1 was dealt. */
  readonly minimumApplied: boolean;
}

export const FIGHTER_STATUSES = ['fighting', 'knocked-out', 'surrendered', 'backed-off', 'fled'] as const;
export type FighterStatus = (typeof FIGHTER_STATUSES)[number];

export const FIGHTER_STATUS_INFO: { readonly [S in FighterStatus]: { readonly label: string; readonly title: string; readonly explanation: string } } = {
  fighting: { label: 'Still fighting', title: 'Still fighting', explanation: 'Was still in the fight at the end.' },
  'knocked-out': { label: 'Knocked out', title: 'Knocked out', explanation: 'Reduced to 0 hit points.' },
  surrendered: { label: 'Surrendered', title: 'Lost their nerve and surrendered', explanation: 'A defender who failed a nerve check and stopped resisting. Still there and conscious.' },
  'backed-off': { label: 'Backed off', title: 'Lost their nerve and backed off', explanation: 'An attacker who failed a nerve check and stopped attacking.' },
  fled: { label: 'Fled', title: 'Lost their nerve and fled', explanation: `Failed a nerve check, and their ${FLEES_WHEN} made them run.` },
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
      readonly outcome: AttackOutcome;
      /** Whether the dice showed their highest or lowest possible result, which decides the attack whatever the bonus. */
      readonly extreme: 'highest' | 'lowest' | null;
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

/** The damage modifier: Strength, with its reason. */
export function damageModifiers(c: Character): Modifier[] {
  return [{ value: abilityModifier(c.attributes.str), reason: `${ATTRIBUTE_INFO.str.name} ${c.attributes.str}` }];
}

/** Damage dealt by a hit: 1d4 (2d4 on a critical) + Strength modifier, minimum 1. */
export function rollDamage(c: Character, critical: boolean, roller: Roller): Damage {
  const faces = Array.from({ length: critical ? 2 : 1 }, () => roller.roll(UNARMED_DAMAGE_DIE));
  const modifier = bonusOf(damageModifiers(c));
  const raw = faces.reduce((a, b) => a + b, 0) + modifier;
  return { faces, modifier, total: Math.max(1, raw), minimumApplied: raw < 1 };
}

export type AttackOutcome = 'critical' | 'hit' | 'miss';

/**
 * The attack rule. `kept` is the dice result before bonuses: the highest possible roll always hits and is a critical hit,
 * the lowest always misses, and otherwise the attack hits if the total meets the target's Defence.
 */
export function attackOutcome(kept: number, bonus: number, defence: number, dice: Pick<Dice, 'count' | 'sides'>): AttackOutcome {
  const extreme = extremeOf(kept, dice);
  if (extreme === 'highest') return 'critical';
  if (extreme === 'lowest') return 'miss';
  return passes(kept + bonus - defence) ? 'hit' : 'miss';
}

export interface FightStats {
  readonly hitPoints: number;
  /** Added to the dice when attacking (the Brawling bonus). */
  readonly attack: number;
  /** What an attack must reach to hit them. */
  readonly defence: number;
  readonly damageDie: number;
  readonly damageModifier: number;
  /** Added to the dice for initiative (the Reflexes bonus). */
  readonly initiative: number;
  /** Added to the dice for nerve checks, including temperament. */
  readonly nerve: number;
}

/** The numbers a fight uses for a character, for showing on screen. */
export function fightStats(c: Character): FightStats {
  return {
    hitPoints: maxHitPoints(c),
    attack: bonusOf(rollFor(c, 'brawling').modifiers),
    defence: defence(c),
    damageDie: UNARMED_DAMAGE_DIE,
    damageModifier: bonusOf(damageModifiers(c)),
    initiative: bonusOf(rollFor(c, 'reflexes').modifiers),
    nerve: bonusOf(nerveCheckSpec(c, 'hurt', DICE.d20).modifiers),
  };
}

/** A fighter named in a roll reason. */
export interface Named {
  readonly id: string;
  readonly name: string;
}

/**
 * What a die in a fight is rolled for, with everything needed to explain it: who rolls, against whom, and the modifiers
 * (each with its reason) that are added. `die` counts the dice of a multi-dice roll, from 1 to `of`.
 */
export type FightRollReason = (
  | { readonly kind: 'initiative'; readonly by: Named; readonly modifiers: readonly Modifier[] }
  | { readonly kind: 'target'; readonly by: Named; readonly options: readonly Named[] }
  | {
      readonly kind: 'attack';
      readonly by: Named;
      readonly target: Named;
      readonly modifiers: readonly Modifier[];
      /** The target's Defence and its parts. */
      readonly defence: Total;
      readonly edge: 'none' | 'advantage';
      /** The damage modifiers if it hits, for working out the damage to expect. */
      readonly damage: readonly Modifier[];
    }
  | { readonly kind: 'damage'; readonly by: Named; readonly target: Named; readonly modifiers: readonly Modifier[]; readonly critical: boolean }
  | { readonly kind: 'nerve'; readonly by: Named; readonly trigger: 'hurt' | 'allies-down'; readonly modifiers: readonly Modifier[]; readonly dc: number }
) & { readonly die: number; readonly of: number };

/** A roll a fight asks for: one die, what it is for, and the fight's dice. It holds everything needed to explain the roll. */
export interface RollRequest {
  readonly sides: number;
  readonly dice: Dice;
  readonly reason: FightRollReason;
}

/** A roller that is told what each fight roll is for. Any Roller will do. */
export interface FightRoller {
  roll(sides: number, reason: FightRollReason): number;
}

export interface FighterState {
  id: string;
  side: Side;
  character: Character;
  hp: number;
  maxHp: number;
  status: FighterStatus;
  nerveTested: boolean;
}

export function runFight(spec: FightSpec, roller: FightRoller): FightResult {
  return playFight(spec, roller, { events: [], fighters: [], round: 0 });
}

/** Where a fight keeps its events and fighters as it goes, so a fight stopped partway (see stepFight) can show them. */
export interface FightRecord {
  events: FightEvent[];
  fighters: FighterState[];
  round: number;
}

export function publicFighter({ nerveTested: _, ...f }: FighterState): Fighter {
  return { ...f };
}

/** Plays a fight, recording it as it goes. runFight and stepFight are the ways in. */
export function playFight(spec: FightSpec, roller: FightRoller, record: FightRecord): FightResult {
  const dice = spec.dice ?? DICE.d20;
  const maxRounds = spec.maxRounds ?? DEFAULT_MAX_ROUNDS;
  if (!Number.isInteger(maxRounds) || maxRounds < 1) throw new RangeError(`maxRounds must be a positive integer, got ${maxRounds}`);
  if (!spec.attackers.length || !spec.defenders.length) throw new RangeError('each side needs at least one fighter');

  const make = (side: Side, prefix: string) => (character: Character, i: number): FighterState => {
    const maxHp = maxHitPoints(character);
    return { id: `${prefix}${i + 1}`, side, character, hp: maxHp, maxHp, status: 'fighting', nerveTested: false };
  };
  const fighters = [...spec.attackers.map(make('attacker', 'A')), ...spec.defenders.map(make('defender', 'B'))];
  const { events } = record;
  record.fighters = fighters;
  const named = (f: FighterState): Named => ({ id: f.id, name: f.character.name });

  /** A roller for one roll of `of` dice, telling the fight's roller what each die is for. */
  const rollingFor = (reason: DistributiveOmit<FightRollReason, 'die' | 'of'>, of: number): Roller => {
    let die = 0;
    return { roll: (sides) => roller.roll(sides, { ...reason, die: ++die, of }) };
  };
  const groupChecked: Record<Side, boolean> = { attacker: false, defender: false };
  /** Who has been attacked so far this round: a second attacker on the same target has advantage (ganging up). */
  const attackedThisRound = new Set<string>();
  let round = 0;

  const fightingOn = (side: Side) => fighters.filter((f) => f.side === side && f.status === 'fighting');
  const finish = (winner: Side | null): FightResult => {
    events.push({ kind: 'end', round, winner });
    return { events, winner, rounds: round, fighters: fighters.map(publicFighter) };
  };

  // Initiative: everyone rolls in list order; highest first, defenders first on a tie, then list order.
  const rolls = fighters.map((f, index) => {
    const reflexes = rollFor(f.character, 'reflexes', { dice });
    return { f, index, roll: throwRoll(reflexes, rollingFor({ kind: 'initiative', by: named(f), modifiers: reflexes.modifiers }, dice.count)) };
  });
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
    const { modifiers, dc } = nerveCheckSpec(f.character, trigger, dice);
    const check = nerveCheck(f.character, trigger, false, dice, rollingFor({ kind: 'nerve', by: named(f), trigger, modifiers, dc }, dice.count));
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

  const pickTarget = (by: FighterState): FighterState => {
    const enemies = fightingOn(otherSide(by.side));
    if (enemies.length === 1) return enemies[0]!;
    return enemies[rollingFor({ kind: 'target', by: named(by), options: enemies.map(named) }, 1).roll(enemies.length) - 1]!;
  };

  const attack = (by: FighterState) => {
    const target = pickTarget(by);
    const edge = attackedThisRound.has(target.id) ? 'advantage' : 'none';
    attackedThisRound.add(target.id);
    const brawling = rollFor(by.character, 'brawling', { dice, edges: [edge] });
    const defence = defenceOf(target.character);
    const damageMods = damageModifiers(by.character);
    const reason = { kind: 'attack', by: named(by), target: named(target), modifiers: brawling.modifiers, defence, edge, damage: damageMods } as const;
    const result = resolveCheck({ ...brawling, dc: totalOf(defence) }, rollingFor(reason, edge === 'advantage' ? dice.count * 2 : dice.count));
    const kept = result.roll.thrown.kept;
    const outcome = attackOutcome(kept, result.roll.bonus, result.dc, dice);
    const critical = outcome === 'critical';
    const damage = outcome === 'miss' ? null : rollDamage(by.character, critical, rollingFor({ kind: 'damage', by: named(by), target: named(target), modifiers: damageMods, critical }, critical ? 2 : 1));
    if (damage) target.hp = Math.max(0, target.hp - damage.total);
    events.push({ kind: 'attack', round, by: by.id, target: target.id, result, outcome, extreme: extremeOf(kept, dice), damage, hp: target.hp });
    if (!damage) return;
    if (target.hp === 0) takeOut(target, 'knocked-out');
    else if (target.hp <= target.maxHp / 2 && !target.nerveTested) {
      target.nerveTested = true;
      testNerve(target, 'hurt');
    }
    if (target.status !== 'fighting') groupMorale(target.side);
  };

  while (round < maxRounds) {
    record.round = ++round;
    attackedThisRound.clear();
    for (const f of order) {
      if (f.status !== 'fighting') continue;
      attack(f);
      for (const side of ['attacker', 'defender'] as const) if (!fightingOn(side).length) return finish(otherSide(side));
    }
  }
  return finish(null);
}
