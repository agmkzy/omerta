// Fights between two squads, following the lab's D&D-style rules, with the plan's additions: weapons, a nerve check against
// weapons at the start, being set upon, ambushes, fleeing as a roll, and losing one's temper. This module plays a fight over
// plain character records and returns what happened; the cast (cast.ts) records its facts and consequences. Every die is
// rolled through the roller with what it is for, so a test can script a fight by what each roll is for.
// See docs/overhaul/plans/character/README.md (Fights).
//
// Turns: every fighter rolls Reflexes for initiative; highest first, defenders first on a tie, then squad order. On their
// turn a fighter attacks a random enemy who is fighting or fleeing (their weapon's skill against the target's Defence, 10 +
// Reflexes), or, if fleeing, tries to get away. Advantage, which does not stack: ganging up (someone on the attacker's side
// has attacked that target this round), the first round of being set upon, having lost one's temper, and a target who left
// themselves open or was caught fleeing. The highest possible roll always hits and doubles the damage dice; the lowest always
// misses. A fighter at 0 hit points is knocked out.
import { abilityModifier } from './attributes';
import { bonusOf, combineEdges, grade, opposedMargin, resolveCheck, succeeded, throwRoll, totalOf, type CheckResult, type Modifier, type OpposedResult, type Roll, type RollResult, type Total } from './check';
import type { CharacterRecord, Id } from './character';
import { conditionOf, effectModifiers, maxHitPoints } from './condition';
import { currentTemperament, type Conduct } from './conduct';
import { DICE, extremeOf, type Edge } from './dice';
import { strongestWeapon, type Weapon } from './items';
import { NERVE_ROLL, nerveCheck, type NerveCheck } from './nerve';
import type { Roller } from './random';
import { attributeUsed, skillModifiers, type Skill } from './skills';
import { leaning, temperamentModifiers } from './temperament';

export type Side = 'attacker' | 'defender';
export const otherSide = (s: Side): Side => (s === 'attacker' ? 'defender' : 'attacker');

/** Sparring: from full health, unarmed, no nerve checks, ended by the first to half health, and nothing lasts. A real fight: as things are, and it all lasts. */
export type FightKind = 'sparring' | 'real';
/** How a real fight starts: as an ordinary fight, with the attackers setting on their targets, or from an ambush. */
export type FightStart = 'ordinary' | 'set-upon' | 'ambush';

/** The round limit, as in the lab. */
export const MAX_ROUNDS = 12;

/** What a weapon does in a fight: the skill it is used with, its damage dice, and whether Strength adds to the damage. */
export const WEAPON_USE: { readonly [W in Weapon | 'none']: { readonly skill: Skill; readonly count: number; readonly sides: number; readonly strength: boolean } } = {
  none: { skill: 'brawling', count: 1, sides: 4, strength: true },
  knife: { skill: 'brawling', count: 1, sides: 6, strength: true },
  pistol: { skill: 'firearms', count: 2, sides: 6, strength: false },
};

/** Weapons from weakest to strongest, bare hands first: a stronger one outclasses a weaker one. */
const RANK: readonly (Weapon | 'none')[] = ['none', 'knife', 'pistol'];
export const outclasses = (a: Weapon | 'none', b: Weapon | 'none') => RANK.indexOf(a) > RANK.indexOf(b);

/** The nerve check's DC for each reason a fighter checks. At the start of a fight, all that apply make one check at the highest. */
export const NERVE_DC = { hurt: 10, 'allies-down': 10, knife: 12, pistol: 15, 'set-upon': 10, 'set-upon-each-extra': 2 } as const;

export const FIGHTER_STATUSES = ['fighting', 'fleeing', 'beaten', 'knocked-out', 'fled'] as const;
export type FighterStatus = (typeof FIGHTER_STATUSES)[number];

/** Why a nerve check is made: at the start of a fight, at half health, or with half one's squad out. */
export type NerveTrigger = 'start' | 'hurt' | 'allies-down';

/** What a die in a fight is rolled for, with who rolls it. */
export type FightRollReason =
  | { readonly kind: 'stealth' | 'initiative' | 'nerve' | 'escape' | 'chase' | 'damage'; readonly by: Id }
  | { readonly kind: 'target'; readonly by: Id; readonly options: readonly Id[] }
  | { readonly kind: 'attack'; readonly by: Id; readonly target: Id };

export type FightEvent =
  | { readonly kind: 'ambush'; readonly stealth: RollResult; readonly surprised: readonly Id[] }
  | { readonly kind: 'initiative'; readonly order: readonly Id[] }
  | { readonly kind: 'nerve'; readonly round: number; readonly id: Id; readonly trigger: NerveTrigger; readonly check: NerveCheck; readonly temper: boolean }
  | { readonly kind: 'attack'; readonly round: number; readonly by: Id; readonly target: Id; readonly result: CheckResult; readonly hit: 'critical' | 'hit' | 'miss'; readonly damage: number; readonly hp: number; readonly free: boolean }
  | { readonly kind: 'escape'; readonly round: number; readonly id: Id; readonly from: Id | null; readonly result: OpposedResult | null; readonly got: 'away' | 'away-chased' | 'caught' }
  | { readonly kind: 'status'; readonly round: number; readonly id: Id; readonly status: Exclude<FighterStatus, 'fighting'> }
  | { readonly kind: 'end'; readonly round: number; readonly winner: Side | null };

/** A fighter as they finished. */
export interface FighterResult {
  readonly id: Id;
  readonly side: Side;
  readonly weapon: Weapon | 'none';
  readonly startHp: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly status: FighterStatus;
  /** Members of the other squad who attacked them, in the order they first did, with the damage each did. */
  readonly attackedBy: readonly { readonly id: Id; readonly damage: number }[];
  /** Who dropped them to 0 hit points. */
  readonly droppedBy?: Id;
  /** They failed a nerve check, so they are shaken afterwards. */
  readonly lostNerve: boolean;
  /** How they reacted, as conduct: holding their nerve, running, giving in, losing their temper. */
  readonly reactions: readonly Conduct[];
}

export interface FightResult {
  readonly kind: FightKind;
  readonly start: FightStart;
  readonly events: readonly FightEvent[];
  /** The squad with someone still fighting, or null for a stalemate. */
  readonly winner: Side | null;
  readonly rounds: number;
  /** Attackers, then defenders, each squad in its given order. */
  readonly fighters: readonly FighterResult[];
}

export interface FightSpec {
  readonly attackers: readonly CharacterRecord[];
  readonly defenders: readonly CharacterRecord[];
  readonly kind: FightKind;
  readonly start?: FightStart;
  /** The round limit; default MAX_ROUNDS. */
  readonly maxRounds?: number;
  /** Anything more on an attacker's Stealth roll for an ambush, such as their job's plan. */
  readonly stealth?: ReadonlyMap<Id, { readonly modifiers: readonly Modifier[]; readonly edge: Edge }>;
}

interface State {
  readonly c: CharacterRecord;
  readonly side: Side;
  readonly weapon: Weapon | 'none';
  readonly maxHp: number;
  readonly startHp: number;
  hp: number;
  status: FighterStatus;
  hurtChecked: boolean;
  surprised: boolean;
  /** Lost their temper: advantage on their next turn's attacks. */
  tempered: boolean;
  /** Left themselves open, or caught fleeing: attacks against them have advantage until their next turn. */
  exposed: boolean;
  lostNerve: boolean;
  readonly attackedBy: Map<Id, number>;
  droppedBy?: Id;
  readonly reactions: Conduct[];
}

/** A fighter's modifiers on a skill roll in a fight: the skill and the effects, hurt excepted. */
function fightModifiers(c: CharacterRecord, skill: Skill): Modifier[] {
  return [...skillModifiers(c, skill), ...effectModifiers(conditionOf(c, c.condition), skill, attributeUsed(c, skill), { inFight: true })];
}

/** What an attack must reach to hit a fighter: 10 plus their Reflexes. */
export function defenceOf(c: CharacterRecord): Total {
  return { base: 10, modifiers: fightModifiers(c, 'reflexes') };
}

const d20 = (modifiers: readonly Modifier[], edge: Edge = 'none'): Roll => ({ dice: DICE.d20, edge, modifiers });

/** Throws RangeError for a fight that cannot be fought: an empty squad, someone in both or twice, or someone unconscious in a real fight. */
export function assertFight(spec: FightSpec): void {
  if (!spec.attackers.length || !spec.defenders.length) throw new RangeError('each squad needs at least one fighter');
  const ids = [...spec.attackers, ...spec.defenders].map((c) => c.id);
  if (new Set(ids).size !== ids.length) throw new RangeError('a fighter can be in only one squad, once');
  if (spec.kind === 'real') for (const c of [...spec.attackers, ...spec.defenders]) if (c.condition.hitPoints === 0) throw new RangeError(`${c.name} is unconscious`);
  if (spec.kind === 'sparring' && (spec.start ?? 'ordinary') !== 'ordinary') throw new RangeError('sparring starts as an ordinary fight');
  const rounds = spec.maxRounds ?? MAX_ROUNDS;
  if (!Number.isInteger(rounds) || rounds < 1) throw new RangeError(`the round limit is a whole number from 1, got ${rounds}`);
}

export function fight(spec: FightSpec, roller: Roller): FightResult {
  assertFight(spec);
  const real = spec.kind === 'real';
  const start = spec.start ?? 'ordinary';
  const events: FightEvent[] = [];
  const make = (side: Side) => (c: CharacterRecord): State => {
    const maxHp = maxHitPoints(c);
    const hp = real ? c.condition.hitPoints : maxHp;
    const weapon = real ? strongestWeapon(c.inventory, ['carried', 'shown']) : 'none';
    return { c, side, weapon, maxHp, startHp: hp, hp, status: 'fighting', hurtChecked: false, surprised: false, tempered: false, exposed: false, lostNerve: false, attackedBy: new Map(), reactions: [] };
  };
  const fighters = [...spec.attackers.map(make('attacker')), ...spec.defenders.map(make('defender'))];
  const squad = (side: Side) => fighters.filter((f) => f.side === side);
  const fighting = (side: Side) => squad(side).filter((f) => f.status === 'fighting');
  const rolling = (reason: FightRollReason): Roller => ({ roll: (sides) => roller.roll(sides, reason) });
  let round = 0;

  const setStatus = (f: State, status: Exclude<FighterStatus, 'fighting'>) => {
    f.status = status;
    events.push({ kind: 'status', round, id: f.c.id, status });
  };

  /** A nerve check at a DC. Passing, a volatile fighter loses their temper; failing, they try to flee or give in, by temperament. */
  const testNerve = (f: State, trigger: NerveTrigger, dc: number) => {
    const roll = d20([...fightModifiers(f.c, NERVE_ROLL.skill), ...temperamentModifiers(currentTemperament(f.c), NERVE_ROLL.situations)]);
    const check = nerveCheck(roll, dc, currentTemperament(f.c), rolling({ kind: 'nerve', by: f.c.id }));
    const temper = check.passed && leaning(currentTemperament(f.c).volatility) === 'high';
    events.push({ kind: 'nerve', round, id: f.c.id, trigger, check, temper });
    if (check.passed) {
      f.reactions.push('holding-their-nerve');
      if (squad(f.side).some((o) => o !== f && o.status !== 'fighting')) f.reactions.push('standing-by-their-squad');
      if (temper) {
        f.tempered = f.exposed = true;
        f.reactions.push('losing-their-temper');
      }
      return;
    }
    f.lostNerve = true;
    if (check.response === 'flees') {
      f.reactions.push('running');
      if (squad(f.side).some((o) => o !== f && o.status === 'fighting')) f.reactions.push('leaving-their-squad');
      setStatus(f, 'fleeing');
    } else {
      f.reactions.push('giving-in-in-a-fight');
      setStatus(f, 'beaten');
    }
  };

  const alliesChecked: Record<Side, boolean> = { attacker: false, defender: false };
  /** The first time at least half a squad is out of the fight (fleeing is not out), everyone left fighting on it makes a nerve check. */
  const alliesDown = (side: Side) => {
    const all = squad(side);
    const out = all.filter((f) => ['beaten', 'knocked-out', 'fled'].includes(f.status)).length;
    if (!real || alliesChecked[side] || all.length < 2 || out * 2 < all.length) return;
    alliesChecked[side] = true;
    for (const f of fighting(side)) testNerve(f, 'allies-down', NERVE_DC['allies-down']);
  };

  /** Initiative: Reflexes; highest first, defenders first on a tie, then squad order. */
  const rolls = fighters.map((f, i) => ({ f, i, total: throwRoll(d20(fightModifiers(f.c, 'reflexes')), rolling({ kind: 'initiative', by: f.c.id })).total }));
  const rank = (s: Side) => (s === 'defender' ? 0 : 1);
  rolls.sort((a, b) => b.total - a.total || rank(a.f.side) - rank(b.f.side) || a.i - b.i);
  const order = rolls.map((r) => r.f);
  events.push({ kind: 'initiative', order: order.map((f) => f.c.id) });
  const holder = order.find((f) => f.side === 'attacker')!;

  if (real && start === 'ambush') {
    // the squad's lowest Stealth roll, the noisiest giving them away, against each target's passive Notice
    const stealth = squad('attacker')
      .map((f) => {
        const more = spec.stealth?.get(f.c.id);
        return throwRoll(d20([...fightModifiers(f.c, 'stealth'), ...(more?.modifiers ?? [])], more?.edge ?? 'none'), rolling({ kind: 'stealth', by: f.c.id }));
      })
      .reduce((low, r) => (r.total < low.total ? r : low));
    const surprised = squad('defender').filter((f) => stealth.total >= 10 + bonusOf(fightModifiers(f.c, 'notice')));
    for (const f of surprised) f.surprised = true;
    events.push({ kind: 'ambush', stealth, surprised: surprised.map((f) => f.c.id) });
  }

  if (real) {
    // At the start, every reason a fighter has to check their nerve is checked at once, at the highest DC among them.
    for (const f of order) {
      const dcs: number[] = [];
      const faced = squad(otherSide(f.side)).map((o) => o.weapon).filter((w): w is Weapon => w !== 'none' && outclasses(w, f.weapon));
      if (faced.length) dcs.push(Math.max(...faced.map((w) => NERVE_DC[w])));
      if (start === 'set-upon' && f.side === 'defender') dcs.push(NERVE_DC['set-upon'] + NERVE_DC['set-upon-each-extra'] * (squad('attacker').length - 1));
      if (f.hp * 2 <= f.maxHp) {
        f.hurtChecked = true;
        dcs.push(NERVE_DC.hurt);
      }
      if (dcs.length) testNerve(f, 'start', Math.max(...dcs));
    }
    for (const side of ['attacker', 'defender'] as const) alliesDown(side);
  }

  const attackedThisRound = new Set<Id>();

  /** An attack on a target; a free one is the chaser's, as a fleeing fighter gets away. */
  const attack = (by: State, target: State, free: boolean) => {
    const use = WEAPON_USE[by.weapon];
    const edge = combineEdges([
      ...(attackedThisRound.has(target.c.id) ? ['advantage' as const] : []),
      ...(start === 'set-upon' && round === 1 && by.side === 'attacker' ? ['advantage' as const] : []),
      ...(by.tempered ? ['advantage' as const] : []),
      ...(target.exposed ? ['advantage' as const] : []),
    ]);
    attackedThisRound.add(target.c.id);
    const result = resolveCheck({ ...d20(fightModifiers(by.c, use.skill), edge), dc: totalOf(defenceOf(target.c)) }, rolling({ kind: 'attack', by: by.c.id, target: target.c.id }));
    const extreme = extremeOf(result.roll.thrown.kept, DICE.d20);
    const hit = extreme === 'highest' ? 'critical' : extreme === 'lowest' || !succeeded(grade(result.margin)) ? 'miss' : 'hit';
    let damage = 0;
    if (hit !== 'miss') {
      const dmg = rolling({ kind: 'damage', by: by.c.id });
      const faces = Array.from({ length: use.count * (hit === 'critical' ? 2 : 1) }, () => dmg.roll(use.sides));
      const strength = use.strength ? abilityModifier(by.c.attributes.str) : 0;
      damage = Math.min(target.hp, Math.max(1, faces.reduce((a, b) => a + b, 0) + strength));
      target.hp -= damage;
    }
    target.attackedBy.set(by.c.id, (target.attackedBy.get(by.c.id) ?? 0) + damage);
    events.push({ kind: 'attack', round, by: by.c.id, target: target.c.id, result, hit, damage, hp: target.hp, free });
    if (damage === 0) return;
    if (target.hp === 0) {
      target.droppedBy = by.c.id;
      setStatus(target, 'knocked-out');
    } else if (real && target.status === 'fighting' && target.hp * 2 <= target.maxHp && !target.hurtChecked) {
      target.hurtChecked = true;
      testNerve(target, 'hurt', NERVE_DC.hurt);
    }
    if (target.status !== 'fighting') alliesDown(target.side);
  };

  /** An escape: Reflexes against the highest Reflexes among the enemies still fighting (Brawling against the holder's, if held). */
  const escape = (f: State, last: boolean) => {
    // (held through the first round, including an escape made before it starts)
    const held = start === 'set-upon' && round <= 1 && f.side === 'defender' && holder.status === 'fighting';
    const chasers = fighting(otherSide(f.side));
    if (!chasers.length) {
      events.push({ kind: 'escape', round, id: f.c.id, from: null, result: null, got: 'away' });
      return setStatus(f, 'fled');
    }
    const skill: Skill = held ? 'brawling' : 'reflexes';
    const chaser = held ? holder : chasers.reduce((best, o) => (bonusOf(fightModifiers(o.c, 'reflexes')) > bonusOf(fightModifiers(best.c, 'reflexes')) ? o : best));
    const active = throwRoll(d20(fightModifiers(f.c, skill)), rolling({ kind: 'escape', by: f.c.id }));
    const passive = throwRoll(d20(fightModifiers(chaser.c, skill)), rolling({ kind: 'chase', by: chaser.c.id }));
    const margin = opposedMargin(active.total - passive.total);
    const result: OpposedResult = { active, passive, margin, outcome: grade(margin) };
    const got = result.outcome === 'partial' ? 'away-chased' : succeeded(result.outcome) ? 'away' : 'caught';
    events.push({ kind: 'escape', round, id: f.c.id, from: chaser.c.id, result, got });
    if (got === 'away-chased') attack(chaser, f, true);
    if (f.status !== 'fleeing') return;
    if (got === 'caught') {
      if (last) setStatus(f, 'beaten');
      else f.exposed = true;
    } else setStatus(f, 'fled');
  };

  const pickTarget = (by: State): State => {
    const enemies = squad(otherSide(by.side)).filter((f) => f.status === 'fighting' || f.status === 'fleeing');
    if (enemies.length === 1) return enemies[0]!;
    return enemies[rolling({ kind: 'target', by: by.c.id, options: enemies.map((e) => e.c.id) }).roll(enemies.length) - 1]!;
  };

  /** Sparring ends for everyone when the first fighter drops to half health, and their squad loses. */
  const sparringLoser = (): Side | null => (real ? null : (fighters.find((f) => f.hp * 2 <= f.maxHp)?.side ?? null));

  const finish = (winner: Side | null): FightResult => {
    if (real) {
      // the losing squad's fleeing make one last escape; on the winning squad no one is left to chase them; in a stalemate everyone gets away
      for (const f of order) if (f.status === 'fleeing') winner === null ? setStatus(f, 'fled') : escape(f, f.side !== winner);
    }
    events.push({ kind: 'end', round, winner });
    return {
      kind: spec.kind,
      start,
      events,
      winner,
      rounds: round,
      fighters: fighters.map((f) => ({
        id: f.c.id,
        side: f.side,
        weapon: f.weapon,
        startHp: f.startHp,
        hp: f.hp,
        maxHp: f.maxHp,
        status: f.status,
        attackedBy: [...f.attackedBy].map(([id, damage]) => ({ id, damage })),
        ...(f.droppedBy !== undefined && { droppedBy: f.droppedBy }),
        lostNerve: f.lostNerve,
        reactions: f.reactions,
      })),
    };
  };
  const decided = (): Side | null | undefined => {
    const loser = sparringLoser();
    if (loser) return otherSide(loser);
    for (const side of ['attacker', 'defender'] as const) if (!fighting(side).length) return otherSide(side);
    return undefined;
  };

  const before = decided();
  if (before !== undefined) return finish(before);
  while (round < (spec.maxRounds ?? MAX_ROUNDS)) {
    round++;
    attackedThisRound.clear();
    for (const f of order) {
      if (f.surprised && round === 1) continue;
      if (f.status === 'fighting') {
        f.exposed = false;
        attack(f, pickTarget(f), false);
        f.tempered = false;
      } else if (f.status === 'fleeing') {
        f.exposed = false;
        escape(f, false);
      } else continue;
      const after = decided();
      if (after !== undefined) return finish(after);
    }
  }
  return finish(null);
}
