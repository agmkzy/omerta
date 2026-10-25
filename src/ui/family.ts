// The line of succession: who is ahead of you for the next seat, and what you can do about each of them.
import { eligible, isRunner, LADDER, members, readiness, seats, capOf, Readiness } from '../career';
import { famName } from '../core';
import { Character, Id, World } from '../types';
import { esc, P, pl, W } from './links';

export interface QRow { c: Character; r: Readiness }

// Everyone of one rank in a family, ordered the way the family weighs them for the next seat.
export function queueOf(w: World, fid: Id, rank?: 'associate' | 'soldier'): QRow[] {
  const rk = rank ?? 'associate';
  return members(w, fid)
    .filter((c) => c.rank === rk && !isRunner(w, c))
    .map((c) => ({ c, r: readiness(w, c)! }))
    .filter((x) => x.r)
    .sort((a, b) => Number(eligible(b.r)) - Number(eligible(a.r)) || b.r.score - a.r.score);
}

export function queueView(): string {
  const w = W(), p = P();
  const fid = p.familyId;
  if (!fid || (p.rank !== 'associate' && p.rank !== 'soldier')) return '';
  const rk = p.rank;
  const to = LADDER[LADDER.indexOf(rk) + 1];
  const rows = queueOf(w, fid, rk);
  const open = Math.max(0, capOf(w, fid, to) - seats(w, fid, to));
  const mine = rows.findIndex((x) => x.c.id === p.id);
  // V89: the line in words. Who is ahead of you and how near each man is; the numbers the family weighs stay behind the curtain.
  // What still stands between you and the seat is said once, in the road above this (pathview.ts), not repeated here.
  const near = (x: QRow) => (eligible(x.r) ? 'ready now' : x.r.score >= 0.75 ? 'close' : x.r.score >= 0.45 ? 'getting there' : 'a long way off');
  let out = `<h2 class="lf-h">Next in line for ${to === 'soldier' ? 'soldier' : 'captain'}<small>${open ? (open > 1 ? open + ' seats open' : 'a seat is open') : 'no seat open'}</small></h2>`;
  out += `<p class="lf-note">The family weighs what a man has earned, how far the boss trusts him, his name, and who will vouch for him. ${mine === 0 ? 'Right now, that’s you.' : mine === 1 ? 'One man is ahead of you.' : mine > 1 ? `${mine} men are ahead of you.` : ''}</p>`;
  out += `<ul class="ui-list q lf-line">` + rows.map((x, i) => ({ ...x, i })).filter((x) => x.i < 3 || Math.abs(x.i - mine) <= 1).map((x, k, arr) => {
    const { c, r, i } = x;
    const you = c.id === p.id;
    const boss = c.bossId ? w.chars[c.bossId] : undefined;
    const gap = k > 0 && i - arr[k - 1].i > 1 ? `<li class="muted lf-gap">&hellip; ${i - arr[k - 1].i - 1} more &hellip;</li>` : '';
    const who = [boss && !you ? 'under ' + esc(boss.name.split(' ')[0]) : '', r.sponsor ? `someone speaks for ${you ? 'you' : 'him'}` : `nobody speaks for ${you ? 'you' : 'him'}`].filter(Boolean).join(' &middot; ');
    return `${gap}<li class="${you ? 'you' : ''}"><span class="qn">${i + 1}</span><span class="qb"><span>${you ? '<b>You</b>' : pl(c)} <span class="lf-near ${eligible(r) ? 'good' : ''}">${near(x)}</span></span><small class="muted">${who}</small></span>${you ? '' : `<button class="mini" data-a="rival:${c.id}">Deal with him</button>`}</li>`;
  }).join('') + `</ul>`;
  void famName;
  return out;
}
