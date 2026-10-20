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
  let out = `<h2 class="sect">Next in line for ${to === 'soldier' ? 'soldier' : 'capo'}<small>${open ? open + ' seat' + (open > 1 ? 's' : '') + ' open' : 'no seat open'}</small></h2>`;
  out += `<p class="muted pad">The family weighs what a man has earned, how the boss trusts him, his name and who will vouch for him. ${mine === 0 ? 'Right now that’s you.' : mine > 0 ? `${mine} ahead of you.` : ''}</p>`;
  out += `<div class="card"><ul class="rows q">` + rows.map((x, i) => ({ ...x, i })).filter((x) => x.i < 5 || Math.abs(x.i - mine) <= 1).map(({ c, r, i }, k, arr) => {
    const you = c.id === p.id;
    const boss = c.bossId ? w.chars[c.bossId] : undefined;
    const pct = Math.round(r.score * 100);
    const gap = k > 0 && i - arr[k - 1].i > 1 ? `<li class="muted" style="justify-content:center">&hellip; ${i - arr[k - 1].i - 1} more &hellip;</li>` : '';
    return `${gap}<li class="${you ? 'you' : ''}"><span class="qn">${i + 1}</span><span class="qb"><span>${you ? '<b>You</b>' : pl(c)}${i === 0 ? ' <span class="tag green">next</span>' : ''}</span><small class="muted">${boss ? 'under ' + esc(boss.name.split(' ')[0]) + ' &middot; ' : ''}earned ${Math.round(r.earn * 100)}% &middot; ${r.sponsor ? 'has a sponsor' : 'no sponsor'}</small><span class="qbar"><i style="width:${pct}%"></i></span></span>${you ? '' : `<button class="mini" data-a="rival:${c.id}">Deal with him</button>`}</li>`;
  }).join('') + `</ul></div>`;
  if (mine >= 0) { const bl = rows[mine].r.blockers; if (bl.length) out += `<div class="callout"><b>What’s holding you back:</b> ${esc(bl.join('; '))}.</div>`; }
  void famName;
  return out;
}
