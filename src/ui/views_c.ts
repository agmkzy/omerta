// Rackets and ways to earn: what is running, what you could start, and exactly what is on offer right now.
import { avatar } from './common';
import { acts, btn, choices, h, quiet, rows, type Pick, type Row } from './kit';
import { week, weekLine } from './money';
import { powerOptions } from '../powers2';
import { SOURCE_LABEL } from '../books';
import { money, ownerBiz, shortTime } from '../core';
import { schemes, ventureOf } from '../jobs';
import { orderMenu, OrderOpt } from '../orders';
import { lateOf } from '../people';
import { canStart, OPS } from '../rackets';
import { isMade } from '../politics';
import { DAY, Id, Op, World } from '../types';
import { progress, bandOf } from '../ambition';
import { WAYS, WAY_CATS, Way, wayById } from '../ways';
import { back, svg } from './common';
import { toSide } from './layout';
import { bl, esc, lk, P, pl, S, W } from './links';

const crew = (w: World) => Object.values(w.chars).filter((c) => c.alive && c.bossId === w.playerId);
const ago = (w: World, t: number) => Math.max(1, Math.round((w.now - t) / DAY));

function myOps(w: World, kind: string): Op[] {
  return w.ops.filter((o) => o.owner === w.playerId && o.kind === kind && o.state !== 'closed' && o.state !== 'done');
}
function protectedShops(w: World) {
  return Object.values(w.biz).filter((b) => b.open && b.protection && b.protection.collectorId === w.playerId && b.protection.fee > 0);
}
function myDebts(w: World) {
  return w.debts.filter((d) => d.status === 'active' && d.creditor === w.playerId);
}

// ---------------------------------------------------------------- menu bucketing
function bucket(w: World) {
  const all = orderMenu(w, P());
  S.planOpts = all;
  const idx = (o: OrderOpt) => all.indexOf(o);
  const pick = (f: (o: OrderOpt) => boolean) => all.filter(f).map((o) => ({ o, i: idx(o) }));
  return {
    lean: pick((o) => o.group === 'Money' && o.label.startsWith('Lean on')),
    shake: pick((o) => o.group === 'Money' && o.label.startsWith('Shake')),
    collect: pick((o) => o.group === 'Money' && o.label.startsWith('Collect')),
    cars: pick((o) => o.group === 'Cars'),
    burglary: pick((o) => o.group === 'Burglary'),
    scams: pick((o) => o.group === 'Scams'),
    favours: pick((o) => o.group === 'Watch' || o.group === 'Other'),
  };
}

interface Status { running: number; badge: string; tone: 'run' | 'ok' | 'lock'; line: string }
function statusOf(w: World, way: Way, b: ReturnType<typeof bucket>): Status {
  const p = P();
  switch (way.kind) {
    case 'op': {
      const d = OPS[way.op!];
      const run = myOps(w, way.op!);
      const dists = d.districts ?? [p.district];
      const err = run.length ? null : canStart(w, p, way.op!, dists[0]);
      if (run.length) return { running: run.length, badge: 'Running', tone: 'run', line: `${run.length} running · ${money(run.reduce((a, o) => a + o.last, 0))} last week · ${money(run.reduce((a, o) => a + o.total, 0))} so far` };
      if (err) return { running: 0, badge: 'Locked', tone: 'lock', line: err };
      return { running: 0, badge: 'Ready', tone: 'ok', line: d.cost ? `Ready to set up for ${money(d.cost)}.` : 'Ready to set up. Costs nothing.' };
    }
    case 'protection': {
      const sh = protectedShops(w);
      const tgt = b.lean.length;
      if (sh.length) return { running: sh.length, badge: 'Running', tone: 'run', line: `${sh.length} shop${sh.length > 1 ? 's' : ''} paying · ${money(sh.reduce((a, x) => a + x.protection!.fee, 0))} a week${tgt ? ` · ${tgt} more you could lean on` : ''}` };
      return tgt ? { running: 0, badge: 'Ready', tone: 'ok', line: `${tgt} shop${tgt > 1 ? 's' : ''} you could lean on.` } : { running: 0, badge: 'Nothing now', tone: 'lock', line: 'No shop worth leaning on right now.' };
    }
    case 'loans': {
      const ds = myDebts(w);
      if (ds.length) return { running: ds.length, badge: 'Running', tone: 'run', line: `${ds.length} loan${ds.length > 1 ? 's' : ''} out · ${money(ds.reduce((a, d) => a + d.balance, 0))} owed to you` };
      return p.cash >= 300 ? { running: 0, badge: 'Ready', tone: 'ok', line: 'Lend to a man who’s short.' } : { running: 0, badge: 'Locked', tone: 'lock', line: 'You need at least $300 to lend.' };
    }
    case 'cars': {
      if (p.cars) return { running: p.cars, badge: 'In stock', tone: 'run', line: `${p.cars} car${p.cars > 1 ? 's' : ''} on your hands. Sell them.` };
      return { running: 0, badge: 'Ready', tone: 'ok', line: 'Needs nothing but nerve.' };
    }
    case 'burglary':
      return b.burglary.length ? { running: 0, badge: 'Ready', tone: 'ok', line: `${b.burglary.length} place${b.burglary.length > 1 ? 's' : ''} worth a look.` } : { running: 0, badge: 'Nothing now', tone: 'lock', line: 'No suitable target right now.' };
    case 'hijack': {
      const out = w.ops.filter((o) => o.owner === p.id && o.kind === 'hijack' && o.state === 'out');
      const free = crew(w).filter((c) => c.jailedUntil <= w.now && c.hurtUntil <= w.now);
      if (out.length) return { running: out.length, badge: 'Out now', tone: 'run', line: `${out.length} crew out on a truck.` };
      return free.length >= 2 ? { running: 0, badge: 'Ready', tone: 'ok', line: `${free.length} men free to go.` } : { running: 0, badge: 'Locked', tone: 'lock', line: 'You need two free men you trust.' };
    }
    case 'fence': {
      const mv = schemes(w, p).filter((s) => s.move);
      return p.cars || p.goods ? { running: 0, badge: 'Ready', tone: 'ok', line: `${p.cars ? p.cars + ' cars' : ''}${p.cars && p.goods ? ' and ' : ''}${p.goods ? money(p.goods) + ' in goods' : ''} to move.` } : { running: 0, badge: 'Nothing now', tone: 'lock', line: mv.length ? 'You’ve nothing to sell right now.' : 'You’ve nothing to sell right now.' };
    }
    case 'scams':
      return b.scams.length ? { running: 0, badge: 'Ready', tone: 'ok', line: `${b.scams.length} possible mark${b.scams.length > 1 ? 's' : ''}.` } : { running: 0, badge: 'Nothing now', tone: 'lock', line: 'No obvious marks right now.' };
    case 'favours':
      return b.favours.length ? { running: 0, badge: 'Ready', tone: 'ok', line: `${b.favours.length} thing${b.favours.length > 1 ? 's' : ''} you could do.` } : { running: 0, badge: 'Nothing now', tone: 'lock', line: 'Nothing needs doing.' };
  }
}

const cardOf = (way: Way, st: Status) =>
  `<button class="way ${st.tone}" data-a="way:${way.id}"><span class="ico ${way.tone}">${svg(way.icon)}</span><span class="wt"><b>${esc(way.name)}<i class="wtag ${st.tone === 'run' ? '' : st.tone === 'ok' ? 'ok' : 'off'}">${esc(st.badge)}</i></b><span class="wp">${esc(way.pitch)}</span><span class="wl">${esc(st.line)}</span></span><svg class="go" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>`;

// The catalogue row: name and where it stands for you. The pitch and the details are one tap away (wayView).
const rowOf = (way: Way, st: Status) =>
  `<button class="way compact ${st.tone}" data-a="way:${way.id}"><span class="ico ${way.tone}">${svg(way.icon)}</span><span class="wt"><b>${esc(way.name)}</b><span class="wl">${esc(st.line)}</span></span><svg class="go" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>`;

// ---------------------------------------------------------------- the page
export function racketsView(): string {
  const w = W();
  const p = P();
  const b = bucket(w);
  const sts = new Map(WAYS.map((x) => [x.id, statusOf(w, x, b)] as const));
  let out = '';
  // what is running
  const live = WAYS.filter((x) => sts.get(x.id)!.tone === 'run');
  const jobsOut = w.jobs.filter((j) => j.status === 'active' && crew(w).some((c) => c.id === j.assignee));
  out += `<h2 class="ui-h">Your rackets<small>${live.length ? live.length + ' running' : 'nothing running'}</small></h2>`;
  if (!live.length && !jobsOut.length) out += `<p class="muted pad">Nothing is running yet. Pick a way to earn below and set it in motion.</p>`;
  out += live.map((x) => cardOf(x, sts.get(x.id)!)).join('');
  if (jobsOut.length) out += h('Crew out on jobs', String(jobsOut.length)) + rows(jobsOut.map((j): Row => ({ face: avatar(w.chars[j.assignee]), title: esc(j.title), sub: `${esc(w.chars[j.assignee].name)}${j.orders ? ' · ' + (j.orders === 'hard' ? 'by any means' : 'quietly') : ''}`, a: `job:${j.id}` })));

  // the catalogue: what you could start now, by kind; what is not open to you yet, folded away
  const ready = WAYS.filter((x) => sts.get(x.id)!.tone === 'ok');
  const locked = WAYS.filter((x) => sts.get(x.id)!.tone === 'lock');
  out += `<h2 class="ui-h">Ways to earn<small>${ready.length} open to you</small></h2>`;
  for (const cat of WAY_CATS) {
    const list = ready.filter((x) => x.cat === cat);
    if (list.length) out += `<h3 class="ui-h">${esc(cat)}</h3><div class="g-ways">${list.map((x) => rowOf(x, sts.get(x.id)!)).join('')}</div>`;
  }
  if (locked.length) out += `<details class="fold g-locked"><summary class="ui-btn ui-btn--quiet">Not open to you yet (${locked.length}) &rsaquo;</summary><div class="g-ways">${locked.map((x) => rowOf(x, sts.get(x.id)!)).join('')}</div></details>`;

  // beside it: the week's money (ui/money.ts, the same account Business › Money shows), and the money nobody else counts
  { const wk = week(w, p);
    let side = h('Your week') + `<p class="ui-note">${esc(weekLine(wk))}</p>`;
    side += rows(wk.comingIn.slice(0, 5).map((f): Row => ({ title: esc(f.label), sub: f.note ? esc(f.note) : '', end: `<span class="fig">+${esc(money(f.amt))}</span>`, tone: 'good' })));
    side += acts(btn('sub:business.money', 'The whole week', 'quiet'));
    const sideAmt = p.books.side ?? 0, known = !!p.books.sideKnown;
    const sidearr = powerOptions(w, p).find((o) => o.code === 'sidearr');
    side += h('Hidden racket', sideAmt ? `${money(Math.round(sideAmt))} a week` : 'none yet');
    side += `<p class="ui-note">${sideAmt ? `Side deals pay you about <b>${money(Math.round(sideAmt))}</b> a week, straight into your pocket and never into your envelope. ${known ? '<b>Your boss knows about it now.</b>' : 'Nobody upstairs knows. Each week there’s a small chance somebody finds out.'}` : 'A deal outside the family’s books: $800 in, about $120 a week out. It never counts in your envelope, and if your boss finds it you will have to explain.'}</p>`;
    if (sidearr && !sideAmt) side += sidearr.off ? `<p class="ui-note">${esc(sidearr.hint)}</p>` : acts(btn('power:sidearr', 'Make a side arrangement ($800)'));
    toSide(side); }
  return out;
}

// ---------------------------------------------------------------- one way
export function wayView(id: string, lines: string[] = []): string {
  const w = W();
  const p = P();
  const way = wayById(id);
  if (!way) return back() + `<p class="muted pad">No such thing.</p>`;
  const b = bucket(w);
  const st = statusOf(w, way, b);
  let out = back();
  out += `<div class="pers"><div class="avatar fx" style="border-radius:16px;width:56px;height:56px">${svg(way.icon, 26)}</div><div><h1>${esc(way.name)}</h1><div class="sub">${esc(way.cat)}</div></div></div>`;
  out += `<div class="tags"><span class="tag ${st.tone === 'run' ? 'green' : st.tone === 'ok' ? 'blue' : ''}">${esc(st.badge)}</span></div>`;
  if (lines.length) out += `<div class="ui-card">${lines.map((l) => `<p>${lk(l)}</p>`).join('')}</div>`;
  out += `<div class="ui-card"><h2>How it works</h2>${way.how.map((x) => `<p>${esc(x)}</p>`).join('')}</div>`;
  out += `<div class="ui-card"><ul class="ui-list"><li><span>Pays</span><span class="v">${esc(way.pays)}</span></li><li><span>You need</span><span class="v">${esc(way.needs)}</span></li><li><span>Goes wrong when</span><span class="v">${esc(way.risks)}</span></li></ul><div class="ui-callout"><b>Advice.</b> ${esc(way.tip)}</div></div>`;

  const optList = (xs: { o: OrderOpt; i: number }[], empty: string) =>
    xs.length ? choices(xs.map(({ o, i }) => ({ a: `plan:${i}`, label: o.label, hint: o.hint })), way.name) : (empty ? quiet(esc(empty)) : '');

  switch (way.kind) {
    case 'op': {
      const d = OPS[way.op!];
      const run = myOps(w, way.op!);
      if (run.length) {
        out += `<h2 class="ui-h">Running<small>${run.length}</small></h2>` + run.map((o) => opCard(w, o)).join('');
      }
      const dists = d.districts ?? [p.district];
      const err = canStart(w, p, way.op!, dists[0]);
      const fam = p.familyId ? w.fam[p.familyId] : undefined;
      const open = (d.districts ?? [p.district, ...(fam?.districts ?? [])]).some((x) => !canStart(w, p, way.op!, x));
      out += `<h2 class="ui-h">${run.length ? 'Open another' : 'Set it up'}</h2>`;
      out += open ? `<button class="ui-btn ui-btn--primary" data-a="opstart:${way.op}">${run.length ? 'Open another' : 'Set it up'}${d.cost ? ` (${money(d.cost)})` : ''}</button>` : `<div class="ui-callout is-bad">${esc(err ?? 'You already cover every district you can work.')}</div>`;
      break;
    }
    case 'protection': {
      const sh = protectedShops(w);
      if (sh.length) out += `<h2 class="ui-h">Shops paying you<small>${money(sh.reduce((a, x) => a + x.protection!.fee, 0))} a week</small></h2><div class="ui-card"><ul class="ui-list">${sh.map((x) => `<li><span>${bl(x.id)} <small class="muted">${lk(w.chars[x.ownerId].name)}</small></span><span class="v ${lateOf(x) ? 'warn' : ''}">${lateOf(x) ? 'late · ' : ''}${money(x.protection!.fee)}/wk · ${money(x.protection!.total ?? 0)} so far</span></li>`).join('')}</ul></div>`;
      if (b.shake.length) out += `<h2 class="ui-h">Late payers<small>${b.shake.length}</small></h2>` + optList(b.shake, '');
      out += `<h2 class="ui-h">Shops you could lean on<small>${b.lean.length}</small></h2>` + optList(b.lean, 'Nothing worth leaning on right now. Shops that already pay your family are off the table, and so are casinos.');
      break;
    }
    case 'loans': {
      const ds = myDebts(w);
      if (ds.length) out += `<h2 class="ui-h">Out on the street<small>${money(ds.reduce((a, d) => a + d.balance, 0))} owed</small></h2><div class="ui-card"><ul class="ui-list">${ds.map((d) => `<li><span>${lk(w.chars[d.debtor].name)}</span><span class="v ${d.missed ? 'warn' : ''}">${money(d.balance)} owed · ${money(d.paid ?? 0)} back so far${d.missed ? ` · ${d.missed} missed` : ''}</span></li>`).join('')}</ul></div>`;
      if (b.collect.length) out += `<h2 class="ui-h">Behind on payments<small>${b.collect.length}</small></h2>` + optList(b.collect, '');
      out += h('Lend some money') + choices([{ a: 'cat:lend', label: 'Find someone who needs a loan', hint: 'Men who are short, and what you’d lend them. You can also offer one in conversation.' }], 'Lend');
      break;
    }
    case 'cars':
      out += `<h2 class="ui-h">Do it</h2>` + optList(b.cars, 'Nothing to do.');
      if (p.cars) out += `<p class="muted pad">You’re holding ${p.cars} car${p.cars > 1 ? 's' : ''}. See “Selling stolen goods”.</p>`;
      break;
    case 'burglary':
      out += `<h2 class="ui-h">Places worth a look<small>${b.burglary.length}</small></h2>` + optList(b.burglary, 'No suitable target right now. Protected places and casinos are left out.');
      break;
    case 'scams':
      out += `<h2 class="ui-h">Possible marks<small>${b.scams.length}</small></h2>` + optList(b.scams, 'No obvious marks right now.');
      break;
    case 'favours':
      out += `<h2 class="ui-h">What you could do<small>${b.favours.length}</small></h2>` + optList(b.favours, 'Nothing needs doing.');
      break;
    case 'hijack': {
      const out2 = w.ops.filter((o) => o.owner === p.id && o.kind === 'hijack' && o.state === 'out');
      if (out2.length) out += `<h2 class="ui-h">Out now</h2>` + out2.map((o) => `<div class="ui-card"><p>${esc(o.note ?? '')}.</p><p class="muted">${(o.crew ?? []).map((cid) => lk(w.chars[cid].name)).join(', ')} · back ${esc(shortTime(o.due ?? w.now))}</p></div>`).join('');
      const free = crew(w).filter((c) => c.jailedUntil <= w.now && c.hurtUntil <= w.now);
      out += `<h2 class="ui-h">Plan one</h2>` + (free.length >= 2 ? `<button class="ui-btn ui-btn--primary" data-a="hijack:">Pick the crew</button>` : `<div class="ui-callout is-bad">You need two free men you trust. You have ${free.length}.</div>`);
      break;
    }
    case 'fence': {
      const mv = schemes(w, p).filter((s) => s.move);
      S.schemeMoves = mv;
      out += `<h2 class="ui-h">Your options<small>${mv.length}</small></h2>`;
      out += mv.length ? choices(mv.map((s, i) => ({ a: `scheme:${i}`, label: s.label, hint: s.hint })), 'Your options') : quiet('You’ve nothing to sell, and no buyer to sell to.');
      const v = ventureOf(w, p);
      if (v) out += `<div class="ui-card"><h2>Your chop shop</h2><p>${bl(v.bizId)}: ${v.stock} waiting, ${money(v.takings)} taken so far.</p></div>`;
      break;
    }
  }
  return out;
}

function opCard(w: World, o: Op): string {
  const d = OPS[o.kind as keyof typeof OPS];
  const r = o.runner ? w.chars[o.runner] : undefined;
  const state = o.state === 'raided' ? '<span class="tag red">raided</span>' : '';
  return `<button class="way run" data-a="op:${o.id}"><span class="wt"><b>${esc(d.label)} <small class="muted">${esc(o.district)}</small> ${state}</b><span class="wp">${r ? 'Run by ' + esc(r.name) : 'Run by you'} · week ${o.weeks + 1}</span><span class="wl">${money(o.last)} last week · ${money(o.total)} so far</span></span><svg class="go" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>`;
}
void ownerBiz; void pl; void ago; void isMade;
void (null as unknown as Id);

export function goalsView(): string {
  const w = W();
  const p = P();
  const all = progress(w, p);
  const band = bandOf(p.rank);
  const now = all.filter((x) => x.a.band === band && !x.done);
  const done = all.filter((x) => x.done);
  const row = (x: (typeof all)[number]) => {
    const unit = x.a.key.startsWith('cash') || x.a.key === 'earner' || x.a.key.startsWith('rich') || x.a.key === 'loans2k' ? money : (n: number) => String(Math.round(n));
    // V88: a row you can read at a glance (title, progress); the why, the how and the reward open beneath it.
    const reward = x.a.reward.cash || x.a.reward.standing ? `<p class="muted"><b>Reward:</b> ${[x.a.reward.cash ? money(x.a.reward.cash) : '', x.a.reward.standing ? 'standing +' + x.a.reward.standing : ''].filter(Boolean).join(', ')}</p>` : '';
    return `<details class="g-goal ${x.a.head ? 'headgoal' : ''}"${x.a.head ? ' open' : ''}><summary><span class="g-goal__t">${esc(x.a.title)}${x.a.head ? ' <i class="tag amber">the big one</i>' : ''}</span><span class="g-goal__n">${unit(Math.min(x.have, x.need))} of ${unit(x.need)}</span><span class="bar"><i style="width:${Math.round(x.pct * 100)}%"></i></span></summary><div class="g-goal__body"><p>${esc(x.a.why)}</p><p class="muted"><b>How:</b> ${esc(x.a.how)}</p>${reward}</div></details>`;
  };
  let out = back() + `<h2 class="ui-h">Milestones<small>${esc(p.rank)}</small></h2><p class="muted pad">What the family expects at your rank. They change as you rise, and meeting one pays a reward. Tap one to see what it takes.</p>`;
  out += now.filter((x) => x.a.head).map(row).join('') + now.filter((x) => !x.a.head).sort((a, b) => b.pct - a.pct).map(row).join('');
  if (done.length) out += `<h2 class="ui-h">Done<small>${done.length}</small></h2><div class="ui-card"><ul class="ui-list">${done.map((x) => `<li><span>${esc(x.a.title)}</span><span class="v good">&#10003;</span></li>`).join('')}</ul></div>`;
  return out;
}

// ---------------------------------------------------------------- disputes
import { Dispute, Character } from '../types';
import { disputePage, storyKnown, storyPage } from './stories';
import { disputesOf } from '../disputes';
import { famName } from '../core';

export const myDisputes = (w: World): Dispute[] => {
  const p = w.chars[w.playerId!];
  return (w.disputes ?? []).filter((d) => {
    if (d.status === 'dropped') return false;
    const a = w.chars[d.a], b = w.chars[d.b];
    const biz = d.biz ? w.biz[d.biz] : undefined;
    return d.a === p.id || d.b === p.id || a?.bossId === p.id || b?.bossId === p.id || biz?.protection?.collectorId === p.id;
  });
};
export const WORD: Record<string, string> = { open: 'Open', settled: 'Settled', violated: 'Broken', dropped: 'Dropped' };
const TONE: Record<string, string> = { open: 'amber', settled: 'green', violated: 'red', dropped: '' };

export function disputeView(id: string, lines: string[]): string {
  const w = W(), p = P();
  const d = (w.disputes ?? []).find((x) => x.id === id);
  if (!d) return back() + `<div class="ui-card"><p>That matter is closed.</p></div>`;
  // V89: laid out like every other story (stories.ts); the old card below is kept for a quarrel whose people are gone
  const page = disputePage(id, lines);
  if (page) return page;
  const a = w.chars[d.a], b = w.chars[d.b];
  const opp = d.a === p.id || a?.bossId === p.id ? b : a;
  const biz = d.biz ? w.biz[d.biz] : undefined;
  let out = back() + `<div class="ui-card"><h2>${biz ? esc(biz.name) : 'A quarrel'}<small><span class="tag ${TONE[d.status]}">${WORD[d.status]}</span></small></h2><p><b>Where it stands:</b> ${esc(stageOf(w, d))}.</p>`;
  const nm = (x: import('../types').Character) => (x.id === P().id ? (x === a ? 'You' : 'you') : pl(x));
  out += `<p class="muted">${nm(a)} (${esc(famName(w, a))}) against ${nm(b)} (${esc(famName(w, b))}). Started ${ago(w, d.created)} day${ago(w, d.created) > 1 ? 's' : ''} ago.</p>`;
  if (d.terms && d.status === 'settled') out += `<div class="ui-callout"><b>Agreed:</b> ${esc(d.terms.text)}. Good until ${shortTime(d.terms.by)}.</div>`;
  if (d.status === 'violated') out += `<div class="ui-callout is-bad"><b>The agreement has been broken.</b> It’s open again.</div>`;
  if (d.found) out += `<p>${d.older ? `What you found: ${esc(d.older)}.` : 'You looked into it and found no real claim behind it.'}</p>`;
  out += `</div>`;
  if (lines.length) out += `<div class="ui-card">${lines.map((l) => `<p>${lk(l)}</p>`).join('')}</div>`;
  out += `<h2 class="ui-h">The story so far<small>newest first</small></h2><div class="ui-card"><ul class="ui-list">${d.history.slice().reverse().map((h) => `<li><span>${esc(shortTime(h.t))}</span><span class="v" style="text-align:left;margin-left:12px">${lk(h.text)}</span></li>`).join('')}</ul></div>`;
  if ((d.status === 'open' || d.status === 'violated') && opp?.alive) {
    const picks: Pick[] = [{ a: `dv:talk|${d.id}`, label: `Find ${opp.name} and talk`, hint: 'Face to face. He’ll answer for himself.' }];
    if (!d.found) picks.push({ a: `dv:look|${d.id}`, label: 'Find out what’s behind it', hint: 'Ask around. It takes a couple of hours.' });
    if (opp.familyId !== p.familyId) picks.push({ a: `dv:sit|${d.id}`, label: `Call a sit-down with ${opp.name}`, hint: 'A formal meeting with terms. It takes a few days to arrange.' });
    picks.push({ a: `dv:settle|${d.id}`, label: 'Other ways: superiors, force, or letting it go', hint: 'Take it to a boss, send a message, or end it.' });
    if (!d.ignored) picks.push({ a: `dv:ignore|${d.id}`, label: 'Leave it alone for now', hint: 'It won’t go away by itself, but you stop pressing.' });
    out += h('What you can do') + choices(picks, 'What you can do');
  }
  return out;
}

export function disputesList(): string {
  const w = W();
  const list = myDisputes(w);
  if (!list.length) return '';
  return h('Quarrels', String(list.length)) + rows(list.map((d): Row => { const a = w.chars[d.a], b2 = w.chars[d.b]; return { mark: TONE[d.status] === 'red' ? 'red' : TONE[d.status] === 'amber' ? 'amber' : 'green', title: `${esc(d.biz ? w.biz[d.biz]?.name ?? 'A shop' : 'A quarrel')}: ${esc(a.name.split(' ')[0])} and ${esc(b2.name.split(' ')[0])}`, end: esc(WORD[d.status]), a: `dispute:${d.id}` }; }));
}
void disputesOf;

// ---------------------------------------------------------------- stories
// An ongoing matter you can follow: where it began, where it stands, what you can do next.
function seatQ(w: World, p: import('../types').Character) { return (w.pending ?? []).find((q) => q.kind === 'seat' && q.a === p.id); }
export function seatStoryKeys(w: World, p: import('../types').Character): string[] {
  const keys = new Set<string>();
  for (const [id] of Object.entries(p.known)) { const s = w.facts[id]?.story; if (s?.startsWith('seat:') && w.now - w.facts[id].t < 45 * DAY) keys.add(s); }
  const q = seatQ(w, p); if (q?.note) keys.add('seat:' + q.note);
  return [...keys];
}
export function storyExists(w: World, key: string): boolean {
  if (key.startsWith('seat:')) return true;
  if (key.startsWith('hunt:')) return !!w.fam[key.slice(5)]?.hunt;
  if (/^(sit|debt|man|threat|turf):/.test(key)) return storyKnown(w, key);
  return !!(w.disputes ?? []).find((d) => d.id === key);
}
// Who moved last. If it was you (you struck first, or you answered and he hasn't), it is not your move.
export function playerMoved(w: World, d: Dispute): boolean {
  const p = w.chars[w.playerId!];
  const last = d.history.at(-1)?.t ?? d.created;
  if (d.handled && d.handled >= last) return true;
  const f = d.fact ? w.facts[d.fact] : undefined;
  if (f && f.t >= last - 1 && (f.actor === p.id || w.chars[f.actor ?? '']?.bossId === p.id)) return true;
  const mine = Object.values(w.facts).some((x) => x.story === d.id && x.actor === p.id && x.t >= last - 1);
  return mine;
}
export function stageOf(w: World, d: Dispute): string {
  if (d.status === 'settled') return `Settled${d.terms ? ` until ${shortTime(d.terms.by)}` : ''}`;
  if (d.status === 'dropped') return 'Closed';
  const q = (w.pending ?? []).find((x) => (x.kind === 'dispute' || x.kind === 'intent') && (x.a === d.id || x.fact === d.id));
  if (d.status === 'violated') return 'Agreement broken. It’s open again';
  if (q) return 'Waiting on the other side';
  if (d.next && d.next > w.now && d.handled && w.now - d.handled < 5 * 1440) return 'Waiting on him to answer';
  if (d.ignored) return 'You’re letting it ride';
  if (playerMoved(w, d)) return 'You made the last move. Waiting on them';
  return 'Open. Your move';
}
export function seatStage(w: World, p: import('../types').Character, rank: string): string {
  const q = seatQ(w, p);
  if (q) return `You’ve asked. A decision is coming`;
  const f = Object.keys(p.known).map((id) => w.facts[id]).filter((x) => x?.story === 'seat:' + rank).sort((a, b) => b.t - a.t)[0];
  if (f && /opened/.test(f.text)) return 'A seat is open. He didn’t say for whom';
  if (f) return 'Turned down for now';
  return 'Open';
}
export function storyView(key: string, lines: string[] = []): string {
  if (/^d\d+$/.test(key)) return disputeView(key, lines);
  return storyPage(key, lines);
}
