// A contest: a tug-of-war that runs itself. Each round both men roll, and the better roll moves a marker towards the other's
// end of the track. Nobody chooses moves; Nerve checks fire on their own when something happens (pushed back, hurt, a gun
// drawn), and a man who fails one breaks the way his temperament says. Every step is recorded as an event.
import { resolveCheck, resolveOpposed, type CheckResult, type Modifier, type OpposedResult, type Roll } from './check';
import { rollFor, type Character } from './character';
import { DICE, type Dice } from './dice';
import type { Roller } from './random';
import { leaning, type Situation } from './temperament';

export const APPROACHES = ['intimidate', 'gunpoint', 'rough-up'] as const;
export type Approach = (typeof APPROACHES)[number];

export type Side = 'attacker' | 'defender';

export interface ContestSpec {
  readonly attacker: Character;
  readonly defender: Character;
  readonly approach: Approach;
  readonly dice?: Dice;
  /** Steps from the middle to either end. */
  readonly track?: number;
  /** The attacker leaves once the marker is this far towards the defender's end. Without it, he never does. */
  readonly walkAwayAt?: number;
  readonly maxRounds?: number;
}

export type Trigger = 'gun-drawn' | 'pushed-back' | 'hurt';

export type Ending =
  | { readonly how: 'pushed' | 'down' | 'yields' | 'flees' | 'walked-away'; readonly loser: Side }
  | { readonly how: 'stalemate'; readonly loser: null };

export type ContestEvent =
  | { readonly kind: 'exchange'; readonly round: number; readonly approach: Approach; readonly result: OpposedResult; readonly moved: number; readonly marker: number }
  | { readonly kind: 'hit'; readonly round: number; readonly side: Side; readonly hurts: number }
  | { readonly kind: 'nerve'; readonly round: number; readonly side: Side; readonly trigger: Trigger; readonly result: CheckResult; readonly held: boolean }
  | { readonly kind: 'lash-out'; readonly round: number; readonly side: Side }
  | { readonly kind: 'end'; readonly round: number; readonly ending: Ending };

export interface ContestResult {
  readonly events: readonly ContestEvent[];
  readonly ending: Ending;
  readonly marker: number;
  readonly rounds: number;
  readonly hurts: Readonly<Record<Side, number>>;
}

/** Points of a round's win per step the marker moves. */
export const POINTS_PER_STEP = 5;
/** A fight's round won by this much lands a blow. */
export const BLOW_MARGIN = 5;
export const BLOWS_TO_DROP = 3;
export const NERVE_DC: Readonly<Record<Trigger, number>> = { 'gun-drawn': 12, 'pushed-back': 10, hurt: 10 };
/** Each blow taken, this one included, makes the Nerve check after a blow this much harder. */
export const HURT_DC_STEP = 2;

export function runContest(spec: ContestSpec, roller: Roller): ContestResult {
  const dice = spec.dice ?? DICE.d20;
  const track = spec.track ?? 5;
  const maxRounds = spec.maxRounds ?? 12;
  assertTerms(track, maxRounds, spec.walkAwayAt);
  const halfway = Math.ceil(track / 2);
  const men: Record<Side, Character> = { attacker: spec.attacker, defender: spec.defender };

  const events: ContestEvent[] = [];
  const hurts: Record<Side, number> = { attacker: 0, defender: 0 };
  const pushedBack: Record<Side, boolean> = { attacker: false, defender: false };
  const lashedOut: Record<Side, boolean> = { attacker: false, defender: false };
  let approach = spec.approach;
  let marker = 0;
  let round = 0;

  const hurtModifiers = (side: Side): Modifier[] =>
    hurts[side] ? [{ value: -hurts[side], reason: `Hurt (${hurts[side]} ${hurts[side] === 1 ? 'blow' : 'blows'})` }] : [];

  const roundRoll = (side: Side): Roll => {
    const man = men[side];
    const modifiers = hurtModifiers(side);
    if (approach === 'rough-up') return rollFor(man, 'brawling', { dice, modifiers });
    if (side === 'attacker') return rollFor(man, 'intimidation', { dice, modifiers, situations: ['intimidate'], edges: approach === 'gunpoint' ? ['advantage'] : [] });
    return rollFor(man, 'nerve', { dice, modifiers, situations: ['hold-nerve', 'resist-intimidation'] });
  };

  const finish = (ending: Ending): ContestResult => {
    events.push({ kind: 'end', round, ending });
    return { events, ending, marker, rounds: round, hurts };
  };

  /** A Nerve check; if it fails, how he breaks. A hothead lashes out once (and it becomes a fight); the timid or cautious run. */
  const holdNerve = (side: Side, trigger: Trigger): Ending | 'lashed-out' | null => {
    const situations: Situation[] = ['hold-nerve'];
    const dc = NERVE_DC[trigger] + (trigger === 'hurt' ? HURT_DC_STEP * hurts[side] : 0);
    const result = resolveCheck({ ...rollFor(men[side], 'nerve', { dice, situations, modifiers: hurtModifiers(side) }), dc }, roller);
    const held = result.margin >= 0;
    events.push({ kind: 'nerve', round, side, trigger, result, held });
    if (held) return null;
    const t = men[side].temperament;
    if (leaning(t.temper) === 'high' && !lashedOut[side]) {
      lashedOut[side] = true;
      approach = 'rough-up';
      events.push({ kind: 'lash-out', round, side });
      return 'lashed-out';
    }
    return { how: leaning(t.courage) === 'low' || leaning(t.caution) === 'high' ? 'flees' : 'yields', loser: side };
  };

  if (approach === 'gunpoint') {
    const broke = holdNerve('defender', 'gun-drawn');
    if (broke && broke !== 'lashed-out') return finish(broke);
  }

  while (round < maxRounds) {
    round++;
    const fightRound = approach === 'rough-up';
    const result = resolveOpposed({ active: roundRoll('attacker'), passive: roundRoll('defender') }, roller);
    const swing = result.margin + 1;
    const before = marker;
    marker = Math.max(-track, Math.min(track, marker + Math.sign(swing) * Math.ceil(Math.abs(swing) / POINTS_PER_STEP)));
    events.push({ kind: 'exchange', round, approach: fightRound ? 'rough-up' : approach, result, moved: marker - before, marker });
    if (swing === 0) continue;

    const loser: Side = swing > 0 ? 'defender' : 'attacker';
    const triggers: Trigger[] = [];
    if (fightRound && Math.abs(swing) >= BLOW_MARGIN) {
      hurts[loser]++;
      events.push({ kind: 'hit', round, side: loser, hurts: hurts[loser] });
      if (hurts[loser] >= BLOWS_TO_DROP) return finish({ how: 'down', loser });
      triggers.push('hurt');
    }
    if (Math.abs(marker) === track) return finish({ how: 'pushed', loser });
    if (!pushedBack[loser] && (loser === 'defender' ? marker >= halfway : marker <= -halfway)) {
      pushedBack[loser] = true;
      triggers.push('pushed-back');
    }
    // One Nerve check a round, against the worst of what happened to him.
    const trigger = triggers[0];
    if (trigger) {
      const broke = holdNerve(loser, trigger);
      if (broke && broke !== 'lashed-out') return finish(broke);
    }
    if (spec.walkAwayAt !== undefined && marker <= -spec.walkAwayAt) return finish({ how: 'walked-away', loser: 'attacker' });
  }
  return finish({ how: 'stalemate', loser: null });
}

/** Runs the contest many times and counts how each ended: "pushed:defender", "flees:attacker", "stalemate"… */
export function tally(spec: ContestSpec, roller: Roller, runs: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let i = 0; i < runs; i++) {
    const { ending } = runContest(spec, roller);
    const key = ending.loser ? `${ending.how}:${ending.loser}` : ending.how;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function assertTerms(track: number, maxRounds: number, walkAwayAt: number | undefined): void {
  if (!Number.isInteger(track) || track < 1) throw new RangeError(`the track needs at least one step each way, got ${track}`);
  if (!Number.isInteger(maxRounds) || maxRounds < 1) throw new RangeError(`a contest needs at least one round, got ${maxRounds}`);
  if (walkAwayAt !== undefined && (!Number.isInteger(walkAwayAt) || walkAwayAt < 1 || walkAwayAt > track))
    throw new RangeError(`the walk-away line must be on the track (1 to ${track}), got ${walkAwayAt}`);
}
