// Plain-text descriptions of fight events, one short line each, for logs and the playground. Rounds are not repeated in
// each line (a log groups lines by round), and roll breakdowns are left to whoever shows the detail.
import type { FightEvent, FightResult } from './fight';

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
