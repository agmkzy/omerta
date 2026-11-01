// Plain-text descriptions of contest events, for logs and the playground.
import { APPROACH_INFO, type ContestEvent, type ContestSpec, type Ending, type Side, type Trigger } from './contest';

const TRIGGER_TEXT: Readonly<Record<Trigger, string>> = {
  'weapon-drawn': 'weapon drawn on them',
  'falling-behind': 'fell behind by half the winning lead',
  hurt: 'dropped to half hit points',
};

/** "Fighter 1 leads by 2", "Shopkeeper 1 leads by 1" or "level". */
export function describeLead(lead: number, spec: ContestSpec): string {
  if (lead === 0) return 'level';
  return `${(lead > 0 ? spec.attacker : spec.defender).name} leads by ${Math.abs(lead)}`;
}

export function describeEvent(event: ContestEvent, spec: ContestSpec): string {
  const name = (side: Side) => spec[side].name;
  switch (event.kind) {
    case 'round': {
      const { active, passive } = event.result;
      const gainer = event.change > 0 ? name('attacker') : name('defender');
      const change = event.change === 0 ? 'No change' : `${gainer} gains ${Math.abs(event.change)}`;
      return `Round ${event.round} (${APPROACH_INFO[event.approach].name}): ${name('attacker')} rolled ${active.total}, ${name('defender')} rolled ${passive.total}. ${change}; ${describeLead(event.lead, spec)}.`;
    }
    case 'initiative': {
      const { active, passive } = event.result;
      return `${name(event.first)} acts first (Reflexes: ${name('attacker')} rolled ${active.total}, ${name('defender')} rolled ${passive.total}).`;
    }
    case 'attack': {
      const target: Side = event.by === 'attacker' ? 'defender' : 'attacker';
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
      return `${name(event.side)} makes a nerve check (${TRIGGER_TEXT[event.trigger]}): needed ${event.result.dc}, rolled ${event.result.roll.total}, ${event.passed ? 'passed' : 'failed'}.`;
    case 'escalation':
      return `${name(event.side)} escalates. The contest becomes a fight.`;
    case 'end':
      return describeEnding(event.ending, spec);
  }
}

export function describeEnding(ending: Ending, spec: ContestSpec): string {
  if (ending.how === 'stalemate') return 'Stalemate: the round limit was reached with no winner.';
  const loser = spec[ending.loser].name;
  const winner = spec[ending.loser === 'attacker' ? 'defender' : 'attacker'].name;
  switch (ending.how) {
    case 'outscored':
      return `${loser} loses: ${winner} reached the winning lead.`;
    case 'knocked-out':
      return `${loser} loses: knocked out (0 HP).`;
    case 'surrenders':
      return `${loser} loses: failed a nerve check and surrendered.`;
    case 'backs-off':
      return `${loser} loses: failed a nerve check and backed off.`;
    case 'complies':
      return `${loser} loses: failed a nerve check and complied.`;
    case 'backs-down':
      return `${loser} loses: failed a nerve check and backed down.`;
    case 'flees':
      return `${loser} loses: failed a nerve check and fled.`;
    case 'withdraws':
      return `${loser} loses: withdrew after falling too far behind.`;
  }
}
