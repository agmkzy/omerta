// Business (the redesign, owner 26 October): what you run, on one page, in the order a man thinks about it. The week in a line
// (tap for all of it); what is running; Sunday's envelope; money owed either way; and a way into starting something new.
import { money } from '../core';
import { envelopeBlock, lendingCard, owedBlock, weekFull } from './lifeview';
import { hiddenBlock, runningBlock, waysBlock } from './views_c';
import { week } from './money';
import { rows, title } from './kit';
import { esc, P, S, W } from './links';

const backTo = `<button class="ui-back" data-a="sub:business.home">‹ Business</button>`;

export function businessRoom(): string {
  const w = W(), p = P();
  const at = S.sub.business;
  if (at === 'week' || at === 'money') return backTo + title('Your week') + weekFull();
  if (at === 'new') return backTo + title('Start something new', 'What you could set going, and who could use a loan.') + waysBlock() + lendingCard() + hiddenBlock();
  const wk = week(w, p);
  let out = `<button class="bz-week" data-a="sub:business.week"><span class="bz-week__k">This week</span><span class="bz-week__fig"><b>${esc(money(wk.inTotal))} in</b> · ${esc(money(wk.outTotal))} out</span><span class="bz-week__s">${wk.soFar ? `${esc(money(wk.soFar))} in so far this week` : 'It comes in on Sunday evening'} · all of it ›</span></button>`;
  out += runningBlock();
  out += envelopeBlock();
  out += owedBlock();
  out += `<h2 class="ui-h">Something new</h2>` + rows([{ title: 'Start something new', sub: 'Rackets you could set up, scores worth a look, men who could use a loan.', a: 'sub:business.new' }]);
  return out;
}
