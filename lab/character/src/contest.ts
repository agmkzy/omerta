// Contests: a multi-round opposed check that resolves automatically.
//
// Each round both characters roll. The difference between the rolls changes the lead: one point of lead per
// POINTS_PER_LEAD points of difference, rounded up. The lead is positive when the attacker is ahead and negative when the
// defender is. A character who gets `winningLead` points ahead wins. Neither side chooses actions. Nerve checks are
// triggered by events (falling behind by half the winning lead, taking a hit, having a weapon drawn on them); a failed
// nerve check ends the contest in a way decided by temperament. Every step is recorded as an event.
import { resolveCheck, resolveOpposed, type CheckResult, type Modifier, type OpposedResult, type Roll } from './check';
import { rollFor, type Character } from './character';
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
  fight: { name: 'Fight', description: 'Each round: Brawling against Brawling. Winning a round by 5 or more lands a hit (−1 to later rolls); three hits is a knockout.' },
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

export type Trigger = 'weapon-drawn' | 'falling-behind' | 'hit';

export type Ending =
  | { readonly how: 'outscored' | 'knocked-out' | 'gives-up' | 'flees' | 'withdraws'; readonly loser: Side }
  | { readonly how: 'stalemate'; readonly loser: null };

export type ContestEvent =
  | { readonly kind: 'round'; readonly round: number; readonly approach: Approach; readonly result: OpposedResult; readonly change: number; readonly lead: number }
  | { readonly kind: 'hit'; readonly round: number; readonly side: Side; readonly hits: number }
  | { readonly kind: 'nerve'; readonly round: number; readonly side: Side; readonly trigger: Trigger; readonly result: CheckResult; readonly passed: boolean }
  | { readonly kind: 'escalation'; readonly round: number; readonly side: Side }
  | { readonly kind: 'end'; readonly round: number; readonly ending: Ending };

export interface ContestResult {
  readonly events: readonly ContestEvent[];
  readonly ending: Ending;
  /** Positive: the attacker is ahead. */
  readonly lead: number;
  readonly rounds: number;
  readonly hits: Readonly<Record<Side, number>>;
}

/** What each kind of ending means, for explaining results. */
export const ENDING_INFO: { readonly [H in Ending['how']]: { readonly title: string; readonly explanation: string } } = {
  outscored: {
    title: 'Out-rolled',
    explanation: 'The other side won enough rounds to reach the winning lead. Decided by skill bonuses and dice.',
  },
  'knocked-out': { title: 'Knocked out', explanation: 'Took three hits in a fight.' },
  'gives-up': {
    title: 'Lost their nerve and gave up',
    explanation: 'Failed a nerve check (after falling behind by half the winning lead, taking a hit, or having a weapon drawn on them).',
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
/** In a fight, winning a round by at least this much lands a hit. */
export const HIT_MARGIN = 5;
export const HITS_TO_KNOCK_OUT = 3;
export const NERVE_DC: Readonly<Record<Trigger, number>> = { 'weapon-drawn': 12, 'falling-behind': 10, hit: 10 };
/** Added to the DC of the nerve check after a hit, per hit taken (including the current one). */
export const HIT_DC_STEP = 2;

export function runContest(spec: ContestSpec, roller: Roller): ContestResult {
  const dice = spec.dice ?? DICE.d20;
  const winningLead = spec.winningLead ?? 5;
  const maxRounds = spec.maxRounds ?? 12;
  assertOptions(winningLead, maxRounds, spec.withdrawAt);
  const halfway = Math.ceil(winningLead / 2);
  const sides: Record<Side, Character> = { attacker: spec.attacker, defender: spec.defender };

  const events: ContestEvent[] = [];
  const hits: Record<Side, number> = { attacker: 0, defender: 0 };
  const fellBehind: Record<Side, boolean> = { attacker: false, defender: false };
  const escalated: Record<Side, boolean> = { attacker: false, defender: false };
  let approach = spec.approach;
  let lead = 0;
  let round = 0;

  const injuryModifiers = (side: Side): Modifier[] => (hits[side] ? [{ value: -hits[side], reason: `Injured (${hits[side]})` }] : []);

  const roundRoll = (side: Side): Roll => {
    const c = sides[side];
    const modifiers = injuryModifiers(side);
    if (approach === 'fight') return rollFor(c, 'brawling', { dice, modifiers });
    if (side === 'attacker') return rollFor(c, 'intimidation', { dice, modifiers, situations: ['intimidate'], edges: approach === 'armed-threat' ? ['advantage'] : [] });
    return rollFor(c, 'nerve', { dice, modifiers, situations: ['hold-nerve', 'resist-intimidation'] });
  };

  const finish = (ending: Ending): ContestResult => {
    events.push({ kind: 'end', round, ending });
    return { events, ending, lead, rounds: round, hits };
  };

  /**
   * Makes a nerve check. Returns null if it passes. On a failure: a hot-tempered character escalates to a fight (once per
   * contest); a timid or cautious one flees; anyone else gives up.
   */
  const nerveCheck = (side: Side, trigger: Trigger): Ending | 'escalated' | null => {
    const dc = NERVE_DC[trigger] + (trigger === 'hit' ? HIT_DC_STEP * hits[side] : 0);
    const result = resolveCheck({ ...rollFor(sides[side], 'nerve', { dice, situations: ['hold-nerve'], modifiers: injuryModifiers(side) }), dc }, roller);
    const passed = result.margin >= 0;
    events.push({ kind: 'nerve', round, side, trigger, result, passed });
    if (passed) return null;
    const t = sides[side].temperament;
    if (leaning(t.temper) === 'high' && !escalated[side]) {
      escalated[side] = true;
      approach = 'fight';
      events.push({ kind: 'escalation', round, side });
      return 'escalated';
    }
    return { how: leaning(t.courage) === 'low' || leaning(t.caution) === 'high' ? 'flees' : 'gives-up', loser: side };
  };

  if (approach === 'armed-threat') {
    const failed = nerveCheck('defender', 'weapon-drawn');
    if (failed && failed !== 'escalated') return finish(failed);
  }

  while (round < maxRounds) {
    round++;
    const fighting = approach === 'fight';
    const result = resolveOpposed({ active: roundRoll('attacker'), passive: roundRoll('defender') }, roller);
    const difference = result.margin + 1;
    const before = lead;
    lead = Math.max(-winningLead, Math.min(winningLead, lead + Math.sign(difference) * Math.ceil(Math.abs(difference) / POINTS_PER_LEAD)));
    events.push({ kind: 'round', round, approach, result, change: lead - before, lead });
    if (difference === 0) continue;

    const loser: Side = difference > 0 ? 'defender' : 'attacker';
    const triggers: Trigger[] = [];
    if (fighting && Math.abs(difference) >= HIT_MARGIN) {
      hits[loser]++;
      events.push({ kind: 'hit', round, side: loser, hits: hits[loser] });
      if (hits[loser] >= HITS_TO_KNOCK_OUT) return finish({ how: 'knocked-out', loser });
      triggers.push('hit');
    }
    if (Math.abs(lead) === winningLead) return finish({ how: 'outscored', loser });
    if (!fellBehind[loser] && (loser === 'defender' ? lead >= halfway : lead <= -halfway)) {
      fellBehind[loser] = true;
      triggers.push('falling-behind');
    }
    // At most one nerve check per round; a hit takes precedence over falling behind.
    const trigger = triggers[0];
    if (trigger) {
      const failed = nerveCheck(loser, trigger);
      if (failed && failed !== 'escalated') return finish(failed);
    }
    if (spec.withdrawAt !== undefined && lead <= -spec.withdrawAt) return finish({ how: 'withdraws', loser: 'attacker' });
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
