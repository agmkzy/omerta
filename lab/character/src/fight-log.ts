// Plain-text descriptions of fight events, for logs and the playground.
import type { FightEvent, FightResult } from './fight';

const SIDE_LETTER = { attacker: 'A', defender: 'B' } as const;

/** Describes an event, naming fighters from the fight's result. */
export function describeFightEvent(event: FightEvent, fight: FightResult): string {
  const name = (id: string) => fight.fighters.find((f) => f.id === id)!.character.name;
  switch (event.kind) {
    case 'initiative':
      return `Initiative order: ${event.order.map((o) => `${name(o.id)} (${o.roll.total})`).join(', ')}.`;
    case 'attack': {
      const { roll } = event.result;
      const d20 = roll.dice.count === 1 && roll.dice.sides === 20;
      const highest = roll.thrown.kept === roll.dice.count * roll.dice.sides;
      const lowest = roll.thrown.kept === roll.dice.count;
      const natural = highest ? (d20 ? ' (natural 20)' : ' (highest possible roll)') : lowest ? (d20 ? ' (natural 1)' : ' (lowest possible roll)') : '';
      const outcome = event.damage
        ? `${event.critical ? 'Critical hit' : 'Hit'} for ${event.damage.total} damage (${name(event.target)}: ${event.hp} HP left).`
        : 'Miss.';
      return `Round ${event.round}: ${name(event.by)} attacks ${name(event.target)}: rolled ${roll.total} against Defence ${event.result.dc}${natural}. ${outcome}`;
    }
    case 'nerve': {
      const why = event.trigger === 'hurt' ? 'has dropped to half hit points' : 'sees half their side out of the fight';
      const { result, passed } = event.check;
      return `${name(event.id)} ${why} and makes a nerve check: needed ${result.dc}, rolled ${result.roll.total}, ${passed ? 'passed' : 'failed'}.`;
    }
    case 'out':
      return `${name(event.id)} ${{ 'knocked-out': 'is knocked out', surrendered: 'surrenders', 'backed-off': 'backs off', fled: 'flees' }[event.status]}.`;
    case 'end':
      if (event.winner === null) return 'Stalemate: the round limit was reached with no winner.';
      return `Side ${SIDE_LETTER[event.winner]} wins: nobody on side ${SIDE_LETTER[event.winner === 'attacker' ? 'defender' : 'attacker']} is still fighting.`;
  }
}
