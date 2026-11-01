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
import { NERVE_DC, nerveCheck, nerveCheckSpec, otherSide, type NerveCheck, type Side } from './nerve';
import { replay, type Roller } from './random';
import { diceDistribution } from './distribution';

/** Omit applied to each member of a union separately. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

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

/** What a die in a fight is rolled for, with the numbers involved. `die` counts the dice of a multi-dice roll. */
export type FightRollReason = (
  | { readonly kind: 'initiative'; readonly id: string; readonly bonus: number }
  | { readonly kind: 'target'; readonly id: string; readonly options: readonly string[] }
  | { readonly kind: 'attack'; readonly id: string; readonly target: string; readonly bonus: number; readonly dc: number }
  | { readonly kind: 'damage'; readonly id: string; readonly target: string; readonly modifier: number; readonly critical: boolean }
  | { readonly kind: 'nerve'; readonly id: string; readonly trigger: 'hurt' | 'allies-down'; readonly bonus: number; readonly dc: number }
) & { readonly die: number; readonly of: number };

/** A roll the fight is waiting for. */
export interface RollRequest {
  readonly sides: number;
  readonly reason: FightRollReason;
}

/** A fight replayed from some rolls: either finished, or waiting for the next roll with the fight so far. */
export type FightStep =
  | { readonly done: true; readonly result: FightResult }
  | {
      readonly done: false;
      readonly request: RollRequest;
      /** The round the roll is for; 0 while rolling initiative. */
      readonly round: number;
      readonly events: readonly FightEvent[];
      readonly fighters: readonly Fighter[];
    };

export interface RollOdds {
  /** Every possible result of the whole roll: the dice, the total with bonuses, its chance, and whether it succeeds. */
  readonly bars: readonly { readonly dice: number; readonly total: number; readonly probability: number; readonly success: boolean | null }[];
  /** The average total. */
  readonly average: number;
  /** For an attack or nerve check, the chance it succeeds. */
  readonly success: { readonly label: 'to hit' | 'to hold'; readonly chance: number } | null;
  /** For an attack, the chance of a critical hit. */
  readonly critical: number | null;
  /** For an attack: average damage on a hit and on a critical hit, and the damage the attack is expected to do. */
  readonly damage: { readonly average: number; readonly criticalAverage: number; readonly expected: number } | null;
}

/** The exact odds of a roll a fight is waiting for, over the whole roll (all its dice). */
export function rollOdds(request: RollRequest, fighters: readonly Fighter[], dice: Dice): RollOdds {
  const r = request.reason;
  const strength = (id: string) => abilityModifier(fighters.find((f) => f.id === id)!.character.attributes.str);
  const none = { success: null, critical: null, damage: null };
  if (r.kind === 'target') {
    const n = r.options.length;
    const bars = r.options.map((_, i) => ({ dice: i + 1, total: i + 1, probability: 1 / n, success: null }));
    return { bars, average: (n + 1) / 2, ...none };
  }
  if (r.kind === 'damage') {
    const bars = damageBars(r.of, r.modifier);
    return { bars, average: bars.reduce((sum, b) => sum + b.probability * b.total, 0), ...none };
  }
  const d = diceDistribution(dice, 'none');
  const highest = dice.count * dice.sides;
  const succeeds = (kept: number): boolean | null => {
    if (r.kind === 'attack') return kept === highest || (kept !== dice.count && kept + r.bonus >= r.dc);
    if (r.kind === 'nerve') return kept + r.bonus >= r.dc;
    return null;
  };
  const bars = d.probabilities.map((probability, i) => ({ dice: d.min + i, total: d.min + i + r.bonus, probability, success: succeeds(d.min + i) }));
  const average = bars.reduce((sum, b) => sum + b.probability * b.total, 0);
  if (r.kind === 'initiative') return { bars, average, ...none };
  const chance = bars.reduce((sum, b) => (b.success ? sum + b.probability : sum), 0);
  if (r.kind === 'nerve') return { bars, average, success: { label: 'to hold', chance }, critical: null, damage: null };
  const critical = bars.at(-1)!.probability;
  const mean = (count: number) => damageBars(count, strength(r.id)).reduce((sum, b) => sum + b.probability * b.total, 0);
  const damage = { average: mean(1), criticalAverage: mean(2), expected: (chance - critical) * mean(1) + critical * mean(2) };
  return { bars, average, success: { label: 'to hit', chance }, critical, damage };
}

/** Every damage result for this many d4s and modifier, with the minimum of 1. */
function damageBars(count: number, modifier: number): RollOdds['bars'] {
  const d = diceDistribution({ count, sides: UNARMED_DAMAGE_DIE }, 'none');
  return d.probabilities.map((probability, i) => ({ dice: d.min + i, total: Math.max(1, d.min + i + modifier), probability, success: null }));
}

/** The chance an attack with this bonus hits this Defence: natural 20s (the highest roll) always hit, natural 1s never do. */
export function attackHitChance(dice: Dice, bonus: number, dc: number): number {
  const d = diceDistribution(dice, 'none');
  const highest = dice.count * dice.sides;
  return d.probabilities.reduce((sum, p, i) => {
    const kept = d.min + i;
    return kept === highest || (kept !== dice.count && kept + bonus >= dc) ? sum + p : sum;
  }, 0);
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
  return fight(spec, roller, { events: [], fighters: [], round: 0 });
}

/** Raised by stepFight's roller when it runs out of given faces. */
class AwaitingRoll {
  constructor(readonly request: RollRequest) {}
}

/**
 * Replays a fight from the faces rolled so far (in the order the fight asks for them). If the faces run out before the
 * fight ends, returns the roll it is waiting for, with the events and fighters so far. Throws if a face is not on its die.
 */
export function stepFight(spec: FightSpec, faces: readonly number[]): FightStep {
  const record: FightRecord = { events: [], fighters: [], round: 0 };
  const given = replay(faces, {
    roll(sides, reason) {
      throw new AwaitingRoll({ sides, reason: reason as FightRollReason });
    },
  });
  try {
    return { done: true, result: fight(spec, given, record) };
  } catch (e) {
    if (!(e instanceof AwaitingRoll)) throw e;
    return { done: false, request: e.request, round: record.round, events: [...record.events], fighters: record.fighters.map(publicFighter) };
  }
}

/** Where a fight keeps its events and fighters, so stepFight can show them if the fight stops partway. */
interface FightRecord {
  events: FightEvent[];
  fighters: FighterState[];
  round: number;
}

function publicFighter({ nerveTested: _, ...f }: FighterState): Fighter {
  return { ...f };
}

function fight(spec: FightSpec, roller: Roller, record: FightRecord): FightResult {
  const dice = spec.dice ?? DICE.d20;
  const maxRounds = spec.maxRounds ?? 12;
  if (!Number.isInteger(maxRounds) || maxRounds < 1) throw new RangeError(`maxRounds must be a positive integer, got ${maxRounds}`);
  if (!spec.attackers.length || !spec.defenders.length) throw new RangeError('each side needs at least one fighter');

  const make = (side: Side, prefix: string) => (character: Character, i: number): FighterState => {
    const maxHp = maxHitPoints(character);
    return { id: `${prefix}${i + 1}`, side, character, hp: maxHp, maxHp, status: 'fighting', nerveTested: false };
  };
  const fighters = [...spec.attackers.map(make('attacker', 'A')), ...spec.defenders.map(make('defender', 'B'))];
  const { events } = record;
  record.fighters = fighters;

  /** A roller that tells whoever is rolling what each die is for. */
  const rollingFor = (reason: DistributiveOmit<FightRollReason, 'die' | 'of'>, of: number): Roller => {
    let die = 0;
    return { roll: (sides) => roller.roll(sides, { ...reason, die: ++die, of } as FightRollReason) };
  };
  const groupChecked: Record<Side, boolean> = { attacker: false, defender: false };
  let round = 0;

  const fightingOn = (side: Side) => fighters.filter((f) => f.side === side && f.status === 'fighting');
  const finish = (winner: Side | null): FightResult => {
    events.push({ kind: 'end', round, winner });
    return { events, winner, rounds: round, fighters: fighters.map(publicFighter) };
  };

  // Initiative: everyone rolls in list order; highest first, defenders first on a tie, then list order.
  const rolls = fighters.map((f, index) => {
    const reflexes = rollFor(f.character, 'reflexes', { dice });
    return { f, index, roll: throwRoll(reflexes, rollingFor({ kind: 'initiative', id: f.id, bonus: bonusOf(reflexes.modifiers) }, dice.count)) };
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
    const bonus = bonusOf(nerveCheckSpec(f.character, trigger, dice).modifiers);
    const check = nerveCheck(f.character, trigger, false, dice, rollingFor({ kind: 'nerve', id: f.id, trigger, bonus, dc: NERVE_DC[trigger] }, dice.count));
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
    const options = enemies.map((e) => e.id);
    const target = enemies.length === 1 ? enemies[0]! : enemies[rollingFor({ kind: 'target', id: by.id, options }, 1).roll(enemies.length) - 1]!;
    const brawling = rollFor(by.character, 'brawling', { dice });
    const dc = defence(target.character);
    const result = resolveCheck({ ...brawling, dc }, rollingFor({ kind: 'attack', id: by.id, target: target.id, bonus: bonusOf(brawling.modifiers), dc }, dice.count));
    const kept = result.roll.thrown.kept;
    const critical = kept === dice.count * dice.sides;
    const hit = critical || (kept !== dice.count && result.margin >= 0);
    const modifier = abilityModifier(by.character.attributes.str);
    const damage = hit ? rollDamage(by.character, critical, rollingFor({ kind: 'damage', id: by.id, target: target.id, modifier, critical }, critical ? 2 : 1)) : null;
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
    record.round = ++round;
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
