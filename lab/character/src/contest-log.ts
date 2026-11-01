// Plain-text descriptions of contest events, for logs and the playground.
import type { ContestEvent, ContestSpec, Ending, Side, Trigger } from './contest';

const TRIGGER_TEXT: Readonly<Record<Trigger, string>> = { 'gun-drawn': 'gun drawn', 'pushed-back': 'pushed back', hit: 'hit' };

export function describeEvent(event: ContestEvent, spec: ContestSpec): string {
  const name = (side: Side) => spec[side].name;
  switch (event.kind) {
    case 'exchange': {
      const { active, passive } = event.result;
      const movement = event.moved === 0 ? `Marker unchanged (${event.marker}).` : `Marker ${event.moved > 0 ? '+' : ''}${event.moved} (now ${event.marker}).`;
      return `Round ${event.round} (${event.approach}): ${name('attacker')} ${active.total} vs ${name('defender')} ${passive.total}. ${movement}`;
    }
    case 'hit':
      return `${name(event.side)} takes a hit (${event.hits} total).`;
    case 'nerve':
      return `${name(event.side)} nerve check (${TRIGGER_TEXT[event.trigger]}), DC ${event.result.dc}: ${event.result.roll.total}, ${event.held ? 'passed' : 'failed'}.`;
    case 'lash-out':
      return `${name(event.side)} lashes out. The contest becomes a brawl.`;
    case 'end':
      return describeEnding(event.ending, spec);
  }
}

export function describeEnding(ending: Ending, spec: ContestSpec): string {
  if (ending.how === 'stalemate') return 'Stalemate: round limit reached.';
  const loser = spec[ending.loser].name;
  const reason = {
    pushed: 'pushed to the end of the track',
    'knocked-out': 'knocked out',
    yields: 'failed a nerve check and yields',
    flees: 'failed a nerve check and flees',
    'walked-away': 'withdraws at the walk-away line',
  }[ending.how];
  return `${loser} loses: ${reason}.`;
}
