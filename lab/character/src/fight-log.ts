// Plain-text descriptions of fight events, for logs and the playground.
import { otherSide, type Side } from './nerve';
import type { FightEnding, FightEvent, FightSpec } from './fight';

export function describeFightEvent(event: FightEvent, spec: FightSpec): string {
  const name = (side: Side) => spec[side].name;
  switch (event.kind) {
    case 'initiative': {
      const { active, passive } = event.result;
      return `${name(event.first)} acts first (Reflexes: ${name('attacker')} rolled ${active.total}, ${name('defender')} rolled ${passive.total}).`;
    }
    case 'attack': {
      const target = otherSide(event.by);
      const { roll } = event.result;
      const d20 = roll.dice.count === 1 && roll.dice.sides === 20;
      const highest = roll.thrown.kept === roll.dice.count * roll.dice.sides;
      const lowest = roll.thrown.kept === roll.dice.count;
      const natural = highest ? (d20 ? ' (natural 20)' : ' (highest possible roll)') : lowest ? (d20 ? ' (natural 1)' : ' (lowest possible roll)') : '';
      const outcome = event.damage
        ? `${event.critical ? 'Critical hit' : 'Hit'} for ${event.damage.total} damage (${name(target)}: ${event.hp[target]} HP left).`
        : 'Miss.';
      return `Round ${event.round}: ${name(event.by)} attacks ${name(target)}: rolled ${roll.total} against Defence ${event.result.dc}${natural}. ${outcome}`;
    }
    case 'nerve':
      return `${name(event.side)} has dropped to half hit points and makes a nerve check: needed ${event.check.result.dc}, rolled ${event.check.result.roll.total}, ${event.check.passed ? 'passed' : 'failed'}.`;
    case 'end':
      return describeFightEnding(event.ending, spec);
  }
}

export function describeFightEnding(ending: FightEnding, spec: FightSpec): string {
  if (ending.how === 'stalemate') return 'Stalemate: the round limit was reached with no winner.';
  const loser = spec[ending.loser].name;
  switch (ending.how) {
    case 'knocked-out':
      return `${loser} loses: knocked out (0 HP).`;
    case 'surrenders':
      return `${loser} loses: failed a nerve check and surrendered.`;
    case 'backs-off':
      return `${loser} loses: failed a nerve check and backed off.`;
    case 'flees':
      return `${loser} loses: failed a nerve check and fled.`;
  }
}
