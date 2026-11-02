// Plain-text descriptions of fight events, one short line each, for logs and the playground. Rounds are not repeated in
// each line (a log groups lines by round), and roll breakdowns are left to whoever shows the detail.
import { abilityModifier } from './attributes';
import { bonusOf, type Modifier } from './check';
import { defenceModifiers, rollFor } from './character';
import type { Dice } from './dice';
import { atLeast, diceDistribution } from './distribution';
import { percent } from './explain';
import { nerveCheckSpec } from './nerve';
import { UNARMED_DAMAGE_DIE, attackHitChance, type Fighter, type FightEvent, type FightResult, type RollRequest } from './fight';

const SIDE_NAME = { attacker: 'Left', defender: 'Right' } as const;

export interface DescribeOptions {
  /** Include roll totals and DCs. Leave them out when the dice are shown separately; natural 20s and 1s are still named. */
  readonly rolls?: boolean;
}

/** Describes an event, naming fighters from the fight's result. */
export function describeFightEvent(event: FightEvent, fight: FightResult, options: DescribeOptions = {}): string {
  const rolls = options.rolls ?? true;
  const numbers = (text: string) => (rolls ? ` (${text})` : '');
  const name = (id: string) => fight.fighters.find((f) => f.id === id)!.character.name;
  switch (event.kind) {
    case 'initiative':
      return `Turn order: ${event.order.map((o) => `${name(o.id)}${numbers(String(o.roll.total))}`).join(', ')}.`;
    case 'attack': {
      const { roll } = event.result;
      const d20 = roll.dice.count === 1 && roll.dice.sides === 20;
      const highest = roll.thrown.kept === roll.dice.count * roll.dice.sides;
      const lowest = roll.thrown.kept === roll.dice.count;
      const natural = highest ? (d20 ? 'natural 20' : 'highest possible roll') : lowest ? (d20 ? 'natural 1' : 'lowest possible roll') : null;
      const why = natural ? ` (${natural})` : numbers(`rolled ${roll.total} vs Defence ${event.result.dc}`);
      if (!event.damage) return `${name(event.by)} misses ${name(event.target)}${why}.`;
      const hits = event.critical ? `lands a critical hit on ${name(event.target)}` : `hits ${name(event.target)}`;
      return `${name(event.by)} ${hits}: ${event.damage.total} damage, ${event.hp} HP left${why}.`;
    }
    case 'nerve': {
      const situation = event.trigger === 'hurt' ? 'is at half HP' : 'sees half their side out of the fight';
      const { result, passed } = event.check;
      return `${name(event.id)} ${situation} and ${passed ? 'holds' : 'loses'} their nerve${numbers(`rolled ${result.roll.total} vs ${result.dc}`)}.`;
    }
    case 'out':
      return `${name(event.id)} ${{ 'knocked-out': 'is knocked out', surrendered: 'surrenders', 'backed-off': 'backs off', fled: 'flees' }[event.status]}.`;
    case 'end':
      return event.winner === null ? 'Stalemate: the round limit was reached.' : `${SIDE_NAME[event.winner]} wins.`;
  }
}

/**
 * Describes a roll the fight is waiting for: what it is for, and for an attack or nerve check, what it needs and the
 * chance. On a d20 it gives the number needed; on other dice only the chance. Midway through a multi-dice roll (when
 * stepping die by die) it names the die and gives neither, as the earlier dice have already changed the odds.
 */
export function describeRollRequest(request: RollRequest, fighters: readonly Fighter[], dice: Dice): string {
  const r = request.reason;
  const name = (id: string) => fighters.find((f) => f.id === id)!.character.name;
  const plus = (n: number) => (n < 0 ? ` − ${-n}` : ` + ${n}`);
  const which = r.die > 1 ? ` (die ${r.die} of ${r.of})` : '';
  const d20 = dice.count === 1 && dice.sides === 20;
  switch (r.kind) {
    case 'initiative':
      return `${name(r.id)} rolls initiative: ${dice.name}${plus(r.bonus)}${which}.`;
    case 'target':
      return `${name(r.id)} picks who to attack: ${r.options.map((id, i) => `${i + 1} = ${name(id)}`).join(', ')}.`;
    case 'damage': {
      const modifier = r.modifier ? plus(r.modifier) : '';
      const what = r.critical ? 'damage for a critical hit' : 'damage';
      return `${name(r.id)} rolls ${what} against ${name(r.target)}: ${r.of}d${UNARMED_DAMAGE_DIE}${modifier}${which}.`;
    }
    case 'attack': {
      const advantage = r.edge === 'advantage' ? ' with advantage (someone else is already attacking them)' : '';
      const roll = `${name(r.id)} attacks ${name(r.target)}${advantage}: ${dice.name}${plus(r.bonus)} against Defence ${r.dc}`;
      if (r.die > 1) return `${roll}${which}.`;
      const chance = percent(attackHitChance(dice, r.bonus, r.dc, r.edge));
      if (!d20) return `${roll}. ${chance} to hit.`;
      return `${roll}. Needs ${Math.min(20, Math.max(2, r.dc - r.bonus))} or more ${r.edge === 'advantage' ? 'on either die' : 'to hit'} (${chance}).`;
    }
    case 'nerve': {
      const situation = r.trigger === 'hurt' ? 'is at half HP' : 'sees half their side out of the fight';
      const roll = `${name(r.id)} ${situation} and must hold their nerve: ${dice.name}${plus(r.bonus)} against ${r.dc}`;
      if (r.die > 1) return `${roll}${which}.`;
      const needs = r.dc - r.bonus;
      if (needs <= dice.count) return `${roll}. Holds whatever the roll.`;
      const chance = percent(atLeast(diceDistribution(dice, 'none'), needs));
      return d20 ? `${roll}. Needs ${needs} or more (${chance}).` : `${roll}. ${chance} to hold.`;
    }
  }
}

export interface RollExplanation {
  /** What the roll is for, in a sentence. */
  readonly purpose: string;
  /** The parts of the roller's bonus, each with its reason. */
  readonly bonus: readonly Modifier[];
  /** For an attack, the target's Defence and its parts. */
  readonly against: { readonly label: string; readonly total: number; readonly parts: readonly Modifier[] } | null;
}

/** How the rule for the highest and lowest possible attack rolls reads on these dice. */
function extremes(dice: Dice): string {
  if (dice.count === 1 && dice.sides === 20) return 'A natural 20 always hits and is a critical hit; a natural 1 always misses.';
  return `The highest possible roll (${dice.count * dice.sides}) always hits and is a critical hit; the lowest (${dice.count}) always misses.`;
}

/** Why a roll is being made and where its numbers come from, worded for the fight's dice. */
export function explainRoll(request: RollRequest, fighters: readonly Fighter[], dice: Dice): RollExplanation {
  const r = request.reason;
  const fighter = (id: string) => fighters.find((f) => f.id === id)!.character;
  const c = fighter(r.id);
  const nerve = `${dice.name} + Nerve (Wisdom or Constitution, training and temperament)`;
  switch (r.kind) {
    case 'initiative':
      return {
        purpose: `Initiative decides who acts first each round: ${dice.name} + Reflexes (the Agility modifier, plus any Reflexes training).`,
        bonus: rollFor(c, 'reflexes').modifiers,
        against: null,
      };
    case 'target':
      return { purpose: 'Each fighter attacks a random enemy who is still fighting; the die picks which.', bonus: [], against: null };
    case 'attack': {
      const target = fighter(r.target);
      const parts = defenceModifiers(target);
      const advantage = r.edge === 'advantage'
        ? ' This attack has advantage: someone else on their side has already attacked this target this round, so the dice are rolled twice and the higher result counts.'
        : '';
      return {
        purpose: `An attack hits if ${dice.name} + Brawling (the Strength modifier, plus any Brawling training) meets the target’s Defence. ${extremes(dice)}${advantage}`,
        bonus: rollFor(c, 'brawling').modifiers,
        against: { label: `${target.name}’s Defence`, total: bonusOf(parts), parts },
      };
    }
    case 'damage':
      return {
        purpose: `Damage is 1d${UNARMED_DAMAGE_DIE} plus the Strength modifier, at least 1. A critical hit rolls the damage dice twice.`,
        bonus: [{ value: abilityModifier(c.attributes.str), reason: `Strength ${c.attributes.str}` }],
        against: null,
      };
    case 'nerve':
      return {
        purpose:
          r.trigger === 'hurt'
            ? `The first time a fighter drops to half HP, they make one nerve check: ${nerve}. Failing takes them out of the fight.`
            : `The first time half their side is out of the fight, everyone left makes one nerve check: ${nerve}. Failing takes them out of the fight.`,
        bonus: nerveCheckSpec(c, r.trigger, dice).modifiers,
        against: null,
      };
  }
}
