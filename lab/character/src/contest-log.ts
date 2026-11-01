// Plain-text descriptions of contest events, for logs and the playground.
import { APPROACH_INFO, type ContestEvent, type ContestSpec, type Ending, type Side, type Trigger } from './contest';

const TRIGGER_TEXT: Readonly<Record<Trigger, string>> = {
  'weapon-drawn': 'weapon drawn on them',
  'falling-behind': 'fell behind by half the winning lead',
  hurt: 'took damage',
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
    case 'fight-round': {
      const { active, passive } = event.result;
      const rolls = `Round ${event.round} (Fight): ${name('attacker')} rolled ${active.total}, ${name('defender')} rolled ${passive.total}.`;
      if (!event.hit) return `${rolls} No hit.`;
      const target: Side = event.hit.by === 'attacker' ? 'defender' : 'attacker';
      const hit = event.hit.critical ? 'lands a critical hit' : 'hits';
      return `${rolls} ${name(event.hit.by)} ${hit} for ${event.hit.damage.total} damage (${name(target)}: ${event.hp[target]} HP left).`;
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
    case 'gives-up':
      return `${loser} loses: failed a nerve check and gave up.`;
    case 'flees':
      return `${loser} loses: failed a nerve check and fled.`;
    case 'withdraws':
      return `${loser} loses: withdrew after falling too far behind.`;
  }
}
