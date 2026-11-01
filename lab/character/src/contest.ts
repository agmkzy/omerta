// Contests: a multi-round opposed check that resolves automatically. Neither side chooses actions.
//
// Intimidation and armed threats are decided by a lead. Each round both characters roll, and the higher roll gains one point
// of lead per POINTS_PER_LEAD points of difference, rounded up. The lead is positive when the attacker is ahead. A character
// who gets `winningLead` points ahead wins.
//
// Fights are decided by hit points instead. Each round both characters roll Brawling, and the higher roll deals damage
// (1d4 + Strength modifier; dice rolled twice on a critical hit). A character at 0 hit points is knocked out.
//
// Nerve checks are triggered by events (falling behind by half the winning lead, taking damage at half hit points or
// below, having a weapon drawn on them); a failed nerve check ends the contest in a way decided by temperament. Every
// step is recorded as an event.
import { resolveCheck, resolveOpposed, type CheckResult, type Modifier, type OpposedResult, type Roll } from './check';
import { abilityModifier } from './attributes';
import { maxHitPoints, rollFor, type Character } from './character';
import { DICE, type Dice } from './dice';
import type { Roller } from './random';
import { leaning, type Trait } from './temperament';

export const APPROACHES = ['intimidation', 'armed-threat', 'fight'] as const;
export type Approach = (typeof APPROACHES)[number];

export const APPROACH_INFO: { readonly [A in Approach]: { readonly name: string; readonly description: string } } = {
  intimidation: { name: 'Intimidation', description: 'Each round: the attacker’s Intimidation against the defender’s Nerve.' },
  'armed-threat': {
    name: 'Armed threat',
    description: 'As Intimidation, but the attacker has advantage, and the defender must pass a DC 12 nerve check before the first round.',
  },
  fight: {
    name: 'Fight',
    description: 'Each round: Brawling against Brawling. The higher roll deals 1d4 + Strength modifier damage (dice doubled when winning by 10 or more). 0 hit points is a knockout.',
  },
};

export type Side = 'attacker' | 'defender';

export interface ContestSpec {
  readonly attacker: Character;
  readonly defender: Character;
  readonly approach: Approach;
  readonly dice?: Dice;
  /** How far ahead a character must get to win. Default 5. */
  readonly winningLead?: number;
  /** If set, the attacker withdraws when the defender is this far ahead. */
  readonly withdrawAt?: number;
  /** Default 12. */
  readonly maxRounds?: number;
}

export type Trigger = 'weapon-drawn' | 'falling-behind' | 'hurt';

export type Ending =
  | { readonly how: 'outscored' | 'knocked-out' | 'gives-up' | 'flees' | 'withdraws'; readonly loser: Side }
  | { readonly how: 'stalemate'; readonly loser: null };

export interface Damage {
  readonly faces: readonly number[];
  readonly modifier: number;
  readonly total: number;
}

export interface Hit {
  readonly by: Side;
  readonly damage: Damage;
  readonly critical: boolean;
}

export type ContestEvent =
  | { readonly kind: 'round'; readonly round: number; readonly approach: Approach; readonly result: OpposedResult; readonly change: number; readonly lead: number }
  | { readonly kind: 'fight-round'; readonly round: number; readonly result: OpposedResult; readonly hit: Hit | null; readonly hp: Readonly<Record<Side, number>> }
  | { readonly kind: 'nerve'; readonly round: number; readonly side: Side; readonly trigger: Trigger; readonly result: CheckResult; readonly passed: boolean }
  | { readonly kind: 'escalation'; readonly round: number; readonly side: Side }
  | { readonly kind: 'end'; readonly round: number; readonly ending: Ending };

export interface ContestResult {
  readonly events: readonly ContestEvent[];
  readonly ending: Ending;
  /** Positive: the attacker is ahead. */
  readonly lead: number;
  readonly rounds: number;
  readonly hp: Readonly<Record<Side, number>>;
  readonly maxHp: Readonly<Record<Side, number>>;
}

/** What each kind of ending means, for explaining results. */
export const ENDING_INFO: { readonly [H in Ending['how']]: { readonly title: string; readonly explanation: string } } = {
  outscored: {
    title: 'Out-rolled',
    explanation: 'The other side won enough rounds to reach the winning lead. Decided by skill bonuses and dice.',
  },
  'knocked-out': { title: 'Knocked out', explanation: 'Reduced to 0 hit points in a fight.' },
  'gives-up': {
    title: 'Lost their nerve and gave up',
    explanation: 'Failed a nerve check (after falling behind by half the winning lead, being hit while badly hurt, or having a weapon drawn on them).',
  },
  flees: { title: 'Lost their nerve and fled', explanation: 'Failed a nerve check, and their low courage or high caution made them run.' },
  withdraws: { title: 'Withdrew', explanation: 'The attacker fell as far behind as the withdraw setting allows.' },
  stalemate: { title: 'Stalemate', explanation: 'Nobody won before the round limit.' },
};

/** How temperament decides the result of a failed nerve check (implemented in runContest). */
export const NERVE_FAILURE: Readonly<Partial<Record<Trait, string>>> = {
  temper: 'If high: on a failed nerve check, escalates to a fight instead of losing (once per contest).',
  courage: 'If low: flees on a failed nerve check.',
  caution: 'If high: flees on a failed nerve check.',
};

/** Points of roll difference per point of lead (rounded up). */
export const POINTS_PER_LEAD = 5;
/** In a fight, winning a round by at least this much is a critical hit. */
export const CRITICAL_MARGIN = 10;
/** Unarmed damage: 1d4 + Strength modifier, minimum 1. */
export const UNARMED_DAMAGE_DIE = 4;
/** Nerve check DCs. `hurt` is the check after each hit that leaves a character at half hit points or below. */
export const NERVE_DC: Readonly<Record<Trigger, number>> = { 'weapon-drawn': 12, 'falling-behind': 10, hurt: 12 };
/** Roll penalty at half hit points or below. */
export const BADLY_HURT_PENALTY = -2;

/** Damage dealt by a hit: 1d4 (2d4 on a critical) + Strength modifier, minimum 1. */
export function rollDamage(c: Character, critical: boolean, roller: Roller): Damage {
  const faces = Array.from({ length: critical ? 2 : 1 }, () => roller.roll(UNARMED_DAMAGE_DIE));
  const modifier = abilityModifier(c.attributes.str);
  return { faces, modifier, total: Math.max(1, faces.reduce((a, b) => a + b, 0) + modifier) };
}

export function runContest(spec: ContestSpec, roller: Roller): ContestResult {
  const dice = spec.dice ?? DICE.d20;
  const winningLead = spec.winningLead ?? 5;
  const maxRounds = spec.maxRounds ?? 12;
  assertOptions(winningLead, maxRounds, spec.withdrawAt);
  const halfway = Math.ceil(winningLead / 2);
  const sides: Record<Side, Character> = { attacker: spec.attacker, defender: spec.defender };

  const events: ContestEvent[] = [];
  const maxHp: Record<Side, number> = { attacker: maxHitPoints(spec.attacker), defender: maxHitPoints(spec.defender) };
  const hp: Record<Side, number> = { ...maxHp };
  const fellBehind: Record<Side, boolean> = { attacker: false, defender: false };
  const escalated: Record<Side, boolean> = { attacker: false, defender: false };
  let approach = spec.approach;
  let lead = 0;
  let round = 0;

  const badlyHurt = (side: Side) => hp[side] <= maxHp[side] / 2;
  const injuryModifiers = (side: Side): Modifier[] => (badlyHurt(side) ? [{ value: BADLY_HURT_PENALTY, reason: 'Badly hurt' }] : []);

  const roundRoll = (side: Side): Roll => {
    const c = sides[side];
    const modifiers = injuryModifiers(side);
    if (approach === 'fight') return rollFor(c, 'brawling', { dice, modifiers });
    if (side === 'attacker') return rollFor(c, 'intimidation', { dice, modifiers, situations: ['intimidate'], edges: approach === 'armed-threat' ? ['advantage'] : [] });
    return rollFor(c, 'nerve', { dice, modifiers, situations: ['hold-nerve', 'resist-intimidation'] });
  };

  const finish = (ending: Ending): ContestResult => {
    events.push({ kind: 'end', round, ending });
    return { events, ending, lead, rounds: round, hp, maxHp };
  };

  /**
   * Makes a nerve check. Returns the ending if the contest is over, or null if it continues. On a failure: a hot-tempered
   * character escalates to a fight (once, and not when already fighting) and the contest continues; a timid or cautious
   * one flees; anyone else gives up.
   */
  const nerveCheck = (side: Side, trigger: Trigger): Ending | null => {
    const result = resolveCheck({ ...rollFor(sides[side], 'nerve', { dice, situations: ['hold-nerve'], modifiers: injuryModifiers(side) }), dc: NERVE_DC[trigger] }, roller);
    const passed = result.margin >= 0;
    events.push({ kind: 'nerve', round, side, trigger, result, passed });
    if (passed) return null;
    const t = sides[side].temperament;
    if (leaning(t.temper) === 'high' && !escalated[side] && approach !== 'fight') {
      escalated[side] = true;
      approach = 'fight';
      events.push({ kind: 'escalation', round, side });
      return null;
    }
    return { how: leaning(t.courage) === 'low' || leaning(t.caution) === 'high' ? 'flees' : 'gives-up', loser: side };
  };

  if (approach === 'armed-threat') {
    const failed = nerveCheck('defender', 'weapon-drawn');
    if (failed) return finish(failed);
  }

  /** A round decided by hit points. Returns an ending, or null to continue. */
  const fightRound = (): Ending | null => {
    const result = resolveOpposed({ active: roundRoll('attacker'), passive: roundRoll('defender') }, roller);
    const difference = result.margin + 1;
    if (difference === 0) {
      events.push({ kind: 'fight-round', round, result, hit: null, hp: { ...hp } });
      return null;
    }
    const by: Side = difference > 0 ? 'attacker' : 'defender';
    const target: Side = by === 'attacker' ? 'defender' : 'attacker';
    const critical = Math.abs(difference) >= CRITICAL_MARGIN;
    const damage = rollDamage(sides[by], critical, roller);
    hp[target] = Math.max(0, hp[target] - damage.total);
    events.push({ kind: 'fight-round', round, result, hit: { by, damage, critical }, hp: { ...hp } });
    if (hp[target] === 0) return { how: 'knocked-out', loser: target };
    return badlyHurt(target) ? nerveCheck(target, 'hurt') : null;
  };

  /** A round decided by the lead. Returns an ending, or null to continue. */
  const leadRound = (): Ending | null => {
    const result = resolveOpposed({ active: roundRoll('attacker'), passive: roundRoll('defender') }, roller);
    const difference = result.margin + 1;
    const before = lead;
    lead = Math.max(-winningLead, Math.min(winningLead, lead + Math.sign(difference) * Math.ceil(Math.abs(difference) / POINTS_PER_LEAD)));
    events.push({ kind: 'round', round, approach, result, change: lead - before, lead });
    if (difference === 0) return null;
    const loser: Side = difference > 0 ? 'defender' : 'attacker';
    if (Math.abs(lead) === winningLead) return { how: 'outscored', loser };
    if (!fellBehind[loser] && (loser === 'defender' ? lead >= halfway : lead <= -halfway)) {
      fellBehind[loser] = true;
      const failed = nerveCheck(loser, 'falling-behind');
      if (failed) return failed;
    }
    if (spec.withdrawAt !== undefined && lead <= -spec.withdrawAt) return { how: 'withdraws', loser: 'attacker' };
    return null;
  };

  while (round < maxRounds) {
    round++;
    const ending = approach === 'fight' ? fightRound() : leadRound();
    if (ending) return finish(ending);
  }
  return finish({ how: 'stalemate', loser: null });
}

/** The key used by `tally` for an ending, e.g. "outscored:defender" or "stalemate". */
export function endingKey(ending: Ending): string {
  return ending.loser ? `${ending.how}:${ending.loser}` : ending.how;
}

/** Runs the contest `runs` times and counts the endings by `endingKey`. */
export function tally(spec: ContestSpec, roller: Roller, runs: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let i = 0; i < runs; i++) {
    const key = endingKey(runContest(spec, roller).ending);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function assertOptions(winningLead: number, maxRounds: number, withdrawAt: number | undefined): void {
  if (!Number.isInteger(winningLead) || winningLead < 1) throw new RangeError(`winningLead must be a positive integer, got ${winningLead}`);
  if (!Number.isInteger(maxRounds) || maxRounds < 1) throw new RangeError(`maxRounds must be a positive integer, got ${maxRounds}`);
  if (withdrawAt !== undefined && (!Number.isInteger(withdrawAt) || withdrawAt < 1 || withdrawAt > winningLead))
    throw new RangeError(`withdrawAt must be an integer from 1 to winningLead (${winningLead}), got ${withdrawAt}`);
}
