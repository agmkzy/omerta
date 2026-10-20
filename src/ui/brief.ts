// The week in review: what happened, what changed, what is coming. Written like a morning at the counter.
import { fmtTime, money, shortTime } from '../core';
import { DAY } from '../types';
import { back } from './common';
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
  const paper = (w.papers ?? []).at(-1);
  let out = back();
  if (paper) {
    out += `<div class="card paper"><div class="mast">THE NEW YORK HERALD</div><div class="dateline">${esc(fmtTime(paper.t + DAY).replace(/,\s*\d\d:\d\d$/, ''))} &middot; Five cents</div><h2 class="lead">${esc(paper.lead)}</h2>${paper.items.map((i) => `<div class="pi"><b>${esc(i.head)}</b>${i.body ? `<span>${esc(i.body)}</span>` : ''}</div>`).join('')}<div class="alsoin"><i>Also in the paper</i>${paper.filler.map((x) => `<p>${esc(x)}</p>`).join('')}</div><p class="small-note">The paper only prints what it can prove. It doesn’t know who did what, and it won’t say who it suspects.</p></div>`;
  }
  out += `<h2 class="sect">Your week<small>${prev ? 'since ' + esc(shortTime(prev.t)) : 'so far'}</small></h2>`;
  const delta = (cur: number, was: number, f: (n: number) => string) => { const d = cur - was; return d === 0 ? 'no change' : (d > 0 ? '+' : '') + f(d); };
  if (prev) {
    const rows = [
      ['Cash', `${money(p.cash)} (${delta(p.cash, prev.cash, money)})`],
      ['Reputation', `${Math.round(p.standing)} (${delta(Math.round(p.standing), Math.round(prev.standing), (n) => String(n))})`],
      ['Heat', p.heat > prev.heat + 0.05 ? 'rising' : p.heat < prev.heat - 0.05 ? 'cooling' : 'steady'],
    ];
    if (p.rank !== prev.rank) rows.push(['Rank', `${prev.rank} → ${p.rank}`]);
    out += `<div class="card"><ul class="rows">${rows.map(([k, v]) => `<li><span>${k}</span><span class="v">${esc(v)}</span></li>`).join('')}</ul></div>`;
  } else out += `<div class="card"><p class="muted">Nothing to compare with yet. Give it a week.</p></div>`;

  const since = prev?.t ?? w.now - 7 * DAY;
  const news = Object.entries(p.known).map(([id]) => w.facts[id]).filter((f) => f && !f.minor && f.t >= since).sort((a, b) => b.t - a.t).slice(0, 8);
  out += `<h2 class="sect">What you’ve heard<small>word on the street</small></h2><div class="card">${news.length ? news.map((f) => `<div class="note">${lk(f.text)}<div class="src">${esc(shortTime(f.t))}</div></div>`).join('') : '<p class="muted">Quiet. Which means nothing.</p>'}</div>`;

  const run = storiesOf(w).filter((s) => !s.closed).slice(0, 4);
  if (run.length) out += `<h2 class="sect">Still brewing</h2><div class="list">${run.map((s) => `<button class="need" data-a="story:${s.key}"><span class="dot ${s.tone === 'red' ? 'red' : 'amber'}"></span><span><span class="t">${esc(s.title)}</span><span class="s" style="display:block">${esc(s.stage)}</span></span></button>`).join('')}</div>`;

  const cu = comingUp();
  if (cu.length) out += `<h2 class="sect">Coming up</h2><div class="card"><ul class="rows">${cu.map((c) => `<li><span>${esc(shortTime(c.t))}</span><span class="v" style="text-align:left;margin-left:12px">${esc(c.text)}</span></li>`).join('')}</ul></div>`;

  const pins = pinned(w, p).slice(0, 5);
  if (pins.length) out += `<h2 class="sect">People you’re watching</h2><div class="card"><ul class="rows">${pins.map((c) => `<li><button class="rowbtn" data-a="ent:${c.id}" style="display:flex;justify-content:space-between;width:100%;text-align:left"><span>${esc(c.name)}</span><span class="v">${esc((p.notes?.[c.id]?.tags ?? []).join(', ') || 'pinned')}</span></button></li>`).join('')}</ul></div>`;
  return out;
}
