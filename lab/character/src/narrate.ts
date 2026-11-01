// A contest's events in words. The playground shows the numbers; the game would keep the words and hide them.
import type { ContestEvent, ContestSpec, Side } from './contest';

export function narrate(event: ContestEvent, spec: ContestSpec): string {
  const name = (side: Side) => (side === 'attacker' ? spec.attacker : spec.defender).name;
  const a = name('attacker');
  const d = name('defender');
  switch (event.kind) {
    case 'exchange': {
      const what = event.approach === 'rough-up' ? `${a} and ${d} trade blows` : `${a} leans on ${d}`;
      const result = event.moved > 0 ? `${d} gives ground.` : event.moved < 0 ? `${d} stands up to him, and ${a} gives ground.` : 'Neither gives an inch.';
      return `Round ${event.round}. ${what} (${event.result.active.total} against ${event.result.passive.total}). ${result}`;
    }
    case 'hit':
      return `${name(event.side)} takes a blow (${event.hurts} so far).`;
    case 'nerve': {
      const who = name(event.side);
      const why = { 'gun-drawn': `${a} draws a gun. ${who}`, 'pushed-back': `${who} is losing and knows it. He`, hurt: `${who} is hurt. He` }[event.trigger];
      return `${why} needs ${event.result.dc} to hold his nerve: ${event.result.roll.total}. ${event.held ? 'He holds.' : 'It goes.'}`;
    }
    case 'lash-out':
      return `${name(event.side)} snaps and goes for him. It is a fight now.`;
    case 'end': {
      const { ending } = event;
      if (ending.how === 'stalemate') return 'Neither man breaks. It is left unsettled.';
      const loser = name(ending.loser);
      const attackerLost = ending.loser === 'attacker';
      switch (ending.how) {
        case 'pushed':
          if (event.approach === 'rough-up') return `${loser} is beaten.`;
          return attackerLost ? `${loser} backs down.` : `${loser} gives in.`;
        case 'yields':
          return attackerLost ? `${loser} gives it up as a bad job.` : `${loser} gives in.`;
        case 'flees':
          return `${loser} runs.`;
        case 'down':
          return `${loser} goes down and stays down.`;
        case 'walked-away':
          return `${loser} has seen enough and walks away.`;
      }
    }
  }
}
