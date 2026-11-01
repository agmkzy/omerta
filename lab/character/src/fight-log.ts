// Plain-text descriptions of fight events, one short line each, for logs and the playground. Rounds are not repeated in
// each line (a log groups lines by round), and roll breakdowns are left to whoever shows the detail.
import type { Dice } from './dice';
import { atLeast, diceDistribution } from './distribution';
import { percent } from './explain';
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
      const roll = `${name(r.id)} attacks ${name(r.target)}: ${dice.name}${plus(r.bonus)} against Defence ${r.dc}`;
      if (r.die > 1) return `${roll}${which}.`;
      const chance = percent(attackHitChance(dice, r.bonus, r.dc));
      if (!d20) return `${roll}. ${chance} to hit.`;
      return `${roll}. Needs ${Math.min(20, Math.max(2, r.dc - r.bonus))} or more to hit (${chance}).`;
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
