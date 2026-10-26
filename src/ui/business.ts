// Business (the redesign, owner 26 October), in two rooms like the family's:
//   What you run   the week in a line (tap for all of it), what is running, Sunday's envelope, money owed either way
//   Work going     what you could take on: the offers in front of you, scores and rackets to start, men who could use a loan
import { money } from '../core';
import { envelopeBlock, lendingCard, owedBlock, weekFull } from './lifeview';
import { hiddenBlock, runningBlock, waysBlock } from './views_c';
import { isAttn, needRow, needs } from './views_a';
import { week } from './money';
import { h, rows, title } from './kit';
import { esc, P, S, W } from './links';

export function businessRoom(): string {
  const w = W(), p = P();
  if (S.sub.business === 'week' || S.sub.business === 'money') return `<button class="ui-back" data-a="sub:business.run">‹ What you run</button>` + title('Your week') + weekFull();
  const wk = week(w, p);
  let out = `<button class="bz-week" data-a="sub:business.week"><span class="bz-week__k">This week</span><span class="bz-week__fig"><b>${esc(money(wk.inTotal))} in</b> · ${esc(money(wk.outTotal))} out</span><span class="bz-week__s">${wk.soFar ? `${esc(money(wk.soFar))} in so far this week` : 'It comes in on Sunday evening'} · all of it ›</span></button>`;
  out += runningBlock();
  out += envelopeBlock();
  out += owedBlock();
  return out;
}

export function workRoom(): string {
  // the work offered you (the same offers Today lists; reports and loose ends stay on Today), then what you could set going yourself
  const offers = needs().filter((n) => !isAttn(n) && n.a.startsWith('job:'));
  let out = offers.length ? h('Offers', String(offers.length)) + rows(offers.map(needRow)) : '';
  out += waysBlock() + lendingCard() + hiddenBlock();
  return out;
}
