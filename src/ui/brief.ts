// The week in review: what happened, what changed, what is coming. Written like a morning at the counter.
import { fmtTime, money, shortTime } from '../core';
import { DAY } from '../types';
import { back } from './common';
import { toSide } from './layout';
import { esc, lk, P, S, W } from './links';
import { storiesOf } from './stories';
import { pinned } from '../notebook';

export function comingUp(): { t: number; text: string }[] {
  const w = W();
  const out: { t: number; text: string }[] = [];
  for (const e of w.events ?? []) {
    if (e.done || e.t < w.now - DAY) continue;
    const host = w.chars[e.host];
    const d = e.about ? w.chars[e.about] : undefined;
    out.push({ t: e.t, text: e.kind === 'funeral' ? `Funeral${d ? ': ' + d.name : ''}, ${e.place}` : `${e.kind[0].toUpperCase() + e.kind.slice(1)}, ${e.place}${host ? ' (' + host.name.split(' ')[0] + ')' : ''}` });
  }
  const p = P();
  for (const d of w.debts) if (d.status === 'active' && d.creditor === p.id && d.nextDue < w.now + 4 * DAY) out.push({ t: d.nextDue, text: `${w.chars[d.debtor].name} owes you ${money(d.weeklyPayment)}` });
  return out.sort((a, b) => a.t - b.t).slice(0, 6);
}

export function briefView(): string {
  const w = W();
  const p = P();
  const snaps = w.snaps ?? [];
  const prev = snaps[snaps.length - 1];
  S.seenBrief = w.now;
  const papers = w.papers ?? [];
  const at = Math.max(0, Math.min(papers.length - 1, S.paperAt ?? papers.length - 1));
  const paper = papers[at];
  let out = back();
  if (paper) out += herald(paper, at, papers.length);
  else out += `<p class="muted pad">The Herald comes out on Mondays. The first edition isn’t out yet.</p>`;
  // V88: the paper is the page; your own week goes beside it.
  let side = '';
  side += `<h2 class="sect">Your week<small>${prev ? 'since ' + esc(shortTime(prev.t)) : 'so far'}</small></h2>`;
  const delta = (cur: number, was: number, f: (n: number) => string) => { const d = cur - was; return d === 0 ? 'no change' : (d > 0 ? '+' : '') + f(d); };
  if (prev) {
    const rows = [
      ['Cash', `${money(p.cash)} (${delta(p.cash, prev.cash, money)})`],
      ['Reputation', `${Math.round(p.standing)} (${delta(Math.round(p.standing), Math.round(prev.standing), (n) => String(n))})`],
      ['Heat', p.heat > prev.heat + 0.05 ? 'rising' : p.heat < prev.heat - 0.05 ? 'cooling' : 'steady'],
    ];
    if (p.rank !== prev.rank) rows.push(['Rank', `${prev.rank} → ${p.rank}`]);
    side += `<div class="card"><ul class="rows">${rows.map(([k, v]) => `<li><span>${k}</span><span class="v">${esc(v)}</span></li>`).join('')}</ul></div>`;
  } else side += `<div class="card"><p class="muted">Nothing to compare with yet. Give it a week.</p></div>`;

  const since = prev?.t ?? w.now - 7 * DAY;
  const news = Object.entries(p.known).map(([id]) => w.facts[id]).filter((f) => f && !f.minor && f.t >= since).sort((a, b) => b.t - a.t).slice(0, 8);
  out += `<h2 class="sect">What you’ve heard<small>word on the street</small></h2><div class="card">${news.length ? news.map((f) => `<div class="note">${lk(f.text)}<div class="src">${esc(shortTime(f.t))}</div></div>`).join('') : '<p class="muted">Quiet. Which means nothing.</p>'}</div>`;

  const run = storiesOf(w).filter((s) => !s.closed).slice(0, 4);
  if (run.length) out += `<h2 class="sect">Still brewing</h2><div class="list">${run.map((s) => `<button class="need" data-a="story:${s.key}"><span class="dot ${s.tone === 'red' ? 'red' : 'amber'}"></span><span><span class="t">${esc(s.title)}</span><span class="s" style="display:block">${esc(s.stage)}</span></span></button>`).join('')}</div>`;

  const cu = comingUp();
  if (cu.length) side += `<h2 class="sect">Coming up</h2><div class="card"><ul class="rows">${cu.map((c) => `<li><span>${esc(shortTime(c.t))}</span><span class="v" style="text-align:left;margin-left:12px">${esc(c.text)}</span></li>`).join('')}</ul></div>`;

  const pins = pinned(w, p).slice(0, 5);
  if (pins.length) side += `<h2 class="sect">People you’re watching</h2><div class="card"><ul class="rows">${pins.map((c) => `<li><button class="rowbtn" data-a="ent:${c.id}" style="display:flex;justify-content:space-between;width:100%;text-align:left"><span>${esc(c.name)}</span><span class="v">${esc((p.notes?.[c.id]?.tags ?? []).join(', ') || 'pinned')}</span></button></li>`).join('')}</ul></div>`;
  toSide(side);
  return out;
}

// ------------------------------------------------------------------ the paper
// The Monday Herald as a front page: masthead, banner headline, the stories in columns, the briefs, and the back issues.
const HEAD_DAY = (t: number) => fmtTime(t + DAY).replace(/,\s*\d\d:\d\d$/, '');
function herald(paper: NonNullable<ReturnType<typeof W>['papers']>[number], at: number, n: number): string {
  const nav = n > 1 ? `<nav class="herald__issues" aria-label="Editions"><button class="mini" data-a="paper:${at - 1}" ${at === 0 ? 'disabled' : ''}>&lsaquo; Earlier edition</button><span>${at === n - 1 ? 'This week' : `${n - 1 - at} week${n - 1 - at > 1 ? 's' : ''} ago`}</span><button class="mini" data-a="paper:${at + 1}" ${at === n - 1 ? 'disabled' : ''}>Later edition &rsaquo;</button></nav>` : '';
  const items = paper.items.map((i, k) => `<section class="herald__item${k === 0 ? ' first' : ''}"><h3>${esc(i.head)}</h3>${i.body ? `<p>${esc(i.body)}</p>` : ''}</section>`).join('');
  return `${nav}<article class="herald">
    <header class="herald__mast">
      <div class="herald__ears"><span>Late City<br>Edition</span><span>Five<br>Cents</span></div>
      <h1 class="herald__name">The New York Herald</h1>
      <div class="herald__date"><span>${esc(HEAD_DAY(paper.t))}</span><span>New York</span></div>
    </header>
    <h2 class="herald__lead">${esc(paper.lead)}</h2>
    ${items ? `<div class="herald__cols">${items}</div>` : '<p class="herald__quiet">Nothing else the police would put their name to.</p>'}
    <aside class="herald__also"><h4>Also in today’s paper</h4>${paper.filler.map((x) => `<p>${esc(x)}</p>`).join('')}</aside>
    <p class="herald__note">The paper only prints what it can prove. It doesn’t know who did what, and it won’t say who it suspects.</p>
  </article>`;
}
