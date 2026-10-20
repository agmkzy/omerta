import type { Character, World } from '../types';
// Rackets, crew, orders, jobs, talk, meetings, life.
import { owedOf, stakesOf } from '../econ';
import { grudgeWord } from '../actions';
import { RULINGS, SOURCE_LABEL, effectiveRate } from '../books';
import { bgLabel, bgOf } from '../background';
import { repLines } from '../crewlife';
import { careerLines, recommendable, recruitable, rewardOptions, standingTable } from '../career';
import { factText, famName, fmtTime, money, ownerBiz, shortTime } from '../core';
import { options as dialogueOptions } from '../dialogue';
import { GIG_HELP, GIG_LABEL } from '../gigs';
import { KIND_HELP, activityOf, KIND_LABEL, approaches, canQuestion, crewMoves, jobChecks, schemes, traitWords, ventureOf } from '../jobs';
import { available, current as meetCurrent } from '../meetings';
import { PLACES, isOpen, present } from '../places';
import { RECRUIT_COST, dayJobOptions, orderMenu, prospects, reliability } from '../orders';
import { PROBLEM_LABEL, aptitude, lateOf } from '../people';
import { DAY, Id, Job, Kind } from '../types';
import { arch, ARCH_WORD } from '../voice';
import { rel } from '../core';
import { readSnaps } from '../storage';
import { influence, influenceWord } from '../books';
import { SPEC_LABEL, SPEC_PERK, TIER_WORD, specScores, tierOf, Spec } from '../specs';
import { standingWord } from '../jobs';
import { disputesList } from './views_c';
import { avatar, back, banner, sink, meterRow, skillBars, skillLine, strip, traitTags } from './common';
import { bl, chip, esc, fl, known, lk, P, pl, S, statusOf, W, who } from './links';
import { favoursCard, treeView } from './views_a';
import { whereIs } from '../where';
import { kinWord, stageWord, warmthWord, DATES, datingPool } from '../life';
import { OPS, OP_GROUPS, canStart } from '../rackets';
import { isMade, sanctioned } from '../politics';
import { settleOptions } from '../revenge';
import { clubView } from './clubview';
import { orgRecord } from '../orgs';

export const VIA: Record<Job['via'], string> = {
  boss: 'Orders from above',
  tip: 'A man asks for help',
  contract: 'A contract',
  opportunity: 'A tip-off',
  scheme: 'Your own idea',
  order: 'Your orders',
};

const job = (id: Id) => W().jobs.find((j) => j.id === id);
export const crewList = () => Object.values(W().chars).filter((c) => c.alive && c.bossId === W().playerId);
const sentence = (s: string) => s;

// ---------------------------------------------------------------- menus

export const CATS: Partial<Record<Kind, { label: string; empty: string }>> = {
  socialise: { label: 'Talk to someone', empty: 'Nobody’s free.' },
  gamble: { label: 'Gamble', empty: 'Nowhere to play right now.' },
  work: { label: 'Lay low', empty: 'Nothing to do.' },
  retaliate: { label: 'Settle a score', empty: 'You’re not nursing a grudge against anyone outside your family. Yet.' },
  lend: { label: 'Lend money', empty: 'You need at least $700 and a shopkeeper who isn’t already in debt.' },
  collect: { label: 'Collect', empty: 'Nobody who owes you has missed a payment.' },
  shakedown: { label: 'Lean on a shop', empty: 'Every shop worth leaning on has been approached recently.' },
};

export function menuView(kind: Kind): string {
  const c = CATS[kind];
  let out = back() + `<h2 class="sect">${esc(c?.label ?? 'Options')}</h2>`;
  if (!S.opts.length) return out + `<p class="muted pad">${esc(c?.empty ?? 'Nothing available right now.')}</p>`;
  return out + `<div class="list">` + S.opts.map((o, i) => `<button class="opt" data-a="opt:${i}">${lk(o.label)}</button>`).join('') + `</div>`;
}

export interface WaitOpt { label: string; sub: string; mins: number; event?: boolean }
const SLOTS: [string, number][] = [['morning', 9], ['afternoon', 14], ['evening', 19], ['late tonight', 23.5]];
export function waitChoices(full = false): WaitOpt[] {
  const now = W().now;
  const tod = (now % DAY) / 60;
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayOf = (m: number) => days[Math.floor(m / DAY) % 7];
  const hhmm = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  const out: WaitOpt[] = [{ label: 'An hour', sub: 'keep watch', mins: 60 }];
  const up: { name: string; at: number }[] = [];
  for (let d = 0; d < 3 && up.length < 2; d++) for (const [name, h] of SLOTS) {
    const at = Math.floor(now / DAY) * DAY + d * DAY + h * 60;
    if (at - now >= 45 && up.length < 2) up.push({ name, at });
  }
  for (const u of up) out.push({ label: u.name[0].toUpperCase() + u.name.slice(1), sub: `until ${hhmm((u.at % DAY) / 60)}${Math.floor(u.at / DAY) !== Math.floor(now / DAY) ? ' ' + dayOf(u.at) : ''}`, mins: u.at - now });
  out.push({ label: 'Next event', sub: 'until something comes up', mins: 24 * 60, event: true });
  void tod;
  const dow = Math.floor(now / DAY) % 7;
  const monday = (Math.floor(now / DAY) + ((7 - dow) % 7 || 7)) * DAY + 9 * 60;
  out.push({ label: 'Next week', sub: 'until Monday 09:00', mins: monday - now });
  if (full) out.push({ label: 'Two days', sub: 'let things ripen', mins: 48 * 60 }, { label: 'A full week', sub: 'envelopes fall due Sunday', mins: 7 * 24 * 60 });
  return out;
}
export function waitView(): string {
  return back() + `<h2 class="sect">Let time pass<small>${esc(fmtTime(W().now))}</small></h2><div class="list">` + waitChoices(true).map((o, i) => `<button class="opt" data-a="waitgo:${i}"><b>${esc(o.label)}</b><span class="because">${esc(o.sub)}</span></button>`).join('') + `</div>`;
}
export function timeBar(): string {
  return `<div class="timebar">${waitChoices().map((o, i) => `<button data-a="waitgo:${i}"><b>${esc(o.label)}</b><span>${esc(o.sub)}</span></button>`).join('')}<button data-a="wait:"><b>More</b><span>two days, a week</span></button></div>`;
}

// --------------------------------------------------------------- rackets

export function racketsView(): string {
  const w = W();
  const p = P();
  let out = strip();
  const gross = Object.entries(p.books.gross).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = gross.reduce((a, [, v]) => a + v, 0);
  out += `<div class="card"><h2>Earning this week<small>${money(Math.round(total))}</small></h2><ul class="rows">${gross.map(([s, v]) => `<li><span>${esc(SOURCE_LABEL[s] ?? s)}</span><span class="v good">+${money(Math.round(v))}</span></li>`).join('') || '<li class="muted">Nothing yet.</li>'}</ul></div>`;

  sink.on = [];
  const prot = Object.values(w.biz).filter((b) => b.open && b.protection && (b.protection.collectorId === p.id || w.chars[b.protection.collectorId]?.bossId === p.id));
  const mine = prot.filter((b) => b.protection!.collectorId === p.id);
  const lateN = mine.filter((b) => lateOf(b) > 0).length;
  out += banner('r:prot', 'shop', lateN ? 'a' : 'g', 'Protection', `${mine.length} paying you${lateN ? `, ${lateN} late` : ''}`, mine.length
    ? `<ul class="rows">${mine.map((b) => `<li><span>${bl(b.id)} <small class="muted">${lk(w.chars[b.ownerId].name)}</small></span><span class="v ${lateOf(b) ? 'warn' : ''}">${lateOf(b) ? 'late ' : ''}${money(b.protection!.fee)}/wk</span></li>`).join('')}</ul>`
    : `<p class="muted">No shops pay you yet. Lean on one below.</p>`);

  const debts = w.debts.filter((d) => d.status === 'active' && d.creditor === p.id);
  out += banner('r:loans', 'cash', debts.some((d) => d.missed) ? 'a' : 'g', 'Loans', `${debts.length} out, ${money(debts.reduce((a, d) => a + d.balance, 0))}`, debts.length
    ? `<ul class="rows">${debts.map((d) => `<li><span>${lk(w.chars[d.debtor].name)}</span><span class="v ${d.missed ? 'warn' : ''}">${money(d.balance)}${d.missed ? ` &middot; ${d.missed} missed` : ''}</span></li>`).join('')}</ul>`
    : `<p class="muted">Nobody owes you. Lend to a man who’s short and you’ll be in his thoughts every week.</p>`);

  const v = ventureOf(w, p);
  out += banner('r:cars', 'car', 'b', 'Cars and goods', `${p.cars} cars, ${money(p.goods)} goods${v ? ' &middot; chop shop' : ''}`.replace('&middot;', '·'),
    `${v ? `<p>${bl(v.bizId)}: ${v.stock} waiting, ${money(v.takings)} taken.</p>` : ''}<p class="muted">${p.cars || p.goods ? 'You’re carrying stock. Get rid of it before it finds you.' : 'Nothing on hand.'}</p>`);

  const crew = crewList();
  const out_ = w.jobs.filter((j) => j.status === 'active' && crew.some((c) => c.id === j.assignee));
  out += banner('r:out', 'people', 'b', 'Out working', `${out_.length} job${out_.length === 1 ? '' : 's'}`, out_.length
    ? out_.map((j) => `<button class="opt" data-a="job:${j.id}"><b>${esc(j.title)}</b><span class="because">${esc(w.chars[j.assignee].name)}${j.orders ? ' &middot; ' + (j.orders === 'hard' ? 'by any means' : 'quietly') : ''}</span></button>`).join('')
    : `<p class="muted">Nobody’s out on your behalf.</p>`);

  // operations
  out += ``;
  const gtones: Record<string, 'g' | 'a' | 'b' | 'r'> = { Betting: 'a', 'Street trades': 'g', 'Waterfront and unions': 'b', Fronts: 'g' };
  const gicons: Record<string, string> = { Betting: 'cash', 'Street trades': 'shop', 'Waterfront and unions': 'box', Fronts: 'shop' };
  for (const g of OP_GROUPS) {
    const kinds = (Object.keys(OPS) as (keyof typeof OPS)[]).filter((k) => OPS[k].group === g);
    const mine_ = w.ops.filter((o) => o.owner === p.id && o.state !== 'closed' && kinds.includes(o.kind as keyof typeof OPS));
    const total = mine_.reduce((a, o) => a + o.last, 0);
    out += banner('op:' + g, gicons[g], gtones[g], g, mine_.length ? `${mine_.length} running, ${money(total)} last week` : 'none yet',
      (mine_.length ? `<ul class="rows">${mine_.map((o) => `<li><button class="rowbtn" data-a="op:${o.id}" style="display:flex;justify-content:space-between;width:100%;text-align:left"><span>${esc(OPS[o.kind as keyof typeof OPS].label)} <small class="muted">${esc(o.district)}</small></span><span class="v ${o.state === 'raided' ? 'warn' : o.last < 0 ? 'warn' : 'good'}">${o.state === 'raided' ? 'raided' : money(o.last) + '/wk'}</span></button></li>`).join('')}</ul>` : '') +
      `<div class="list">${kinds.map((k) => `<button class="opt" data-a="opstart:${k}"><b>Start: ${esc(OPS[k].label)}</b><span class="because">${esc(OPS[k].blurb)} ${OPS[k].cost ? money(OPS[k].cost) + '.' : ''}${OPS[k].rank === 'soldier' ? ' Made men only.' : ''}</span></button>`).join('')}</div>`);
  }
  const hj = w.ops.filter((o) => o.owner === p.id && o.kind === 'hijack' && o.state === 'out');
  out += banner('op:hijack', 'car', 'r', 'Hijackings', hj.length ? `${hj.length} out right now` : 'a night\'s work', `${hj.map((o) => `<p>${esc(o.note ?? '')}. ${(o.crew ?? []).map((id) => lk(w.chars[id].name)).join(', ')}.</p>`).join('')}<div class="list"><button class="opt" data-a="hijack:"><b>Plan a hijacking</b><span class="because">Two or three men and a truck that will not be missed for an hour. Big money, big heat, and a way to lose men.</span></button></div>`);

  // start something
  S.planOpts = orderMenu(w, p);
  const groups = ['Money', 'Cars', 'Burglary', 'Scams', 'Watch', 'Other'] as const;
  const gi: Record<string, string> = { Money: 'cash', Cars: 'car', Burglary: 'box', Scams: 'mask', Watch: 'eye', Other: 'wrench' };
  const gtone: Record<string, 'g' | 'a' | 'b' | 'r'> = { Money: 'g', Cars: 'b', Burglary: 'r', Scams: 'a', Watch: 'b', Other: 'g' };

  for (const g of groups) {
    const list = S.planOpts.map((o, i) => [o, i] as const).filter(([o]) => o.group === g);
    if (!list.length) continue;
    out += banner('p:' + g, gi[g], gtone[g], g === 'Money' ? 'Money and protection' : g === 'Other' ? 'Favours and guard work' : g, `${list.length} ways in`, `<div class="list">${list.map(([o, i]) => `<button class="opt" data-a="plan:${i}"><b>${lk(o.label)}</b>${o.hint ? `<span class="because">${esc(o.hint)}</span>` : ''}</button>`).join('')}</div>`);
  }
  const sc = schemes(w, p).filter((s) => s.move);
  S.schemeMoves = sc;
  if (sc.length) out += banner('p:sell', 'cash', 'b', 'Sell and move stock', `${sc.length} options`, `<div class="list">${sc.map((s, i) => `<button class="opt" data-a="scheme:${i}"><b>${esc(s.label)}</b>${s.hint ? `<span class="because">${esc(s.hint)}</span>` : ''}</button>`).join('')}</div>`);
  const all = sink.on ?? [];
  sink.on = null;
  const live = all.filter((h) => h.includes('banner live'));
  const rest = all.filter((h) => !h.includes('banner live') && !h.includes('data-a="tog:r:out"'));
  out += `<h2 class="sect">Running now<small>already earning or out on a job</small></h2>${live.join('') || '<p class="muted pad">Nothing running. Pick something below and set it in motion.</p>'}`;
  out += `<h2 class="sect">Ready to start<small>tap to see what it takes</small></h2>${rest.join('')}`;
  return out;
}

// ------------------------------------------------------------------ plan

export function planView(idx: number, whoId?: Id): string {
  const w = W();
  const o = S.planOpts[idx];
  if (!o) return back() + '<p class="muted pad">That moment has passed.</p>';
  const crew = crewList();
  let out = back() + `<h2 class="sect">${lk(o.label)}</h2>${o.hint ? `<p class="muted pad">${esc(o.hint)}</p>` : ''}`;
  out += `<div class="list"><button class="opt" data-a="doplan:${idx}|me|quiet"><b>Do it myself</b><span class="because">You’ll choose how to play it.</span></button></div>`;
  if (crew.length) {
    out += `<h2 class="sect">Or send someone</h2>`;
    for (const c of crew) {
      if (whoId && c.id !== whoId) continue;
      const ap = aptitude(c, o.group === 'Cars' ? 'boost' : o.group === 'Burglary' ? 'burgle' : o.group === 'Scams' ? 'scam' : o.group === 'Money' ? 'collect' : 'watch');
      const rel = reliability(w, c);
      const st = statusOf(w, c);
      const act = activityOf(w, c);
      const busy = !!act;
      out += `<div class="card"${busy ? ' style="opacity:.55"' : ''}><div class="pers" style="margin:0">${avatar(c)}<div><b>${pl(c)}</b><div class="sub">${esc(skillLine(c))}</div></div></div><p class="muted">${aptitudeWord(ap)} for this &middot; ${rel > 0.7 ? 'dependable' : rel > 0.45 ? 'usually turns up' : 'unreliable'}${busy ? ` &middot; busy: ${esc(act!.why)}, free ${esc(shortTime(act!.until))}` : ''}${!busy && st.word !== 'free' ? ' &middot; ' + st.word : ''}</p><div class="row2"><button class="btn" ${busy || st.dot === 'red' ? 'disabled' : `data-a="doplan:${idx}|${c.id}|quiet"`}>Quietly</button><button class="btn" ${busy || st.dot === 'red' ? 'disabled' : `data-a="doplan:${idx}|${c.id}|hard"`}>By any means</button></div></div>`;
    }
  }
  return out;
}
const aptitudeWord = (v: number) => (v < 0.3 ? 'a poor fit' : v < 0.5 ? 'an ok fit' : v < 0.7 ? 'a good fit' : 'a natural');

export function ordersView(whoId: Id): string {
  const w = W();
  const p = P();
  if (!whoId) {
    const crew = crewList();
    return back() + `<h2 class="sect">Who do you send?</h2><div class="list">` + (crew.map((c) => { const act = activityOf(w, c); return `<button class="opt" ${act ? 'disabled style="opacity:.5"' : `data-a="orders:${c.id}"`}><b>${esc(c.name)}</b><span class="because">${esc(skillLine(c))}${act ? ` &middot; busy: ${esc(act.why)}, free ${esc(shortTime(act.until))}` : ''}</span></button>`; }).join('') || '<p class="muted pad">No crew. Find a man worth trusting.</p>') + `</div>`;
  }
  const c = w.chars[whoId];
  S.planOpts = orderMenu(w, p);
  let out = back() + `<div class="pers">${avatar(c)}<div><h1>Orders for ${esc(c.name.split(' ')[0])}</h1><div class="sub">${esc(skillLine(c))}</div></div></div>`;
  const groups = ['Money', 'Cars', 'Burglary', 'Scams', 'Watch', 'Other'];
  for (const g of groups) {
    const list = S.planOpts.map((o, i) => [o, i] as const).filter(([o]) => o.group === g);
    if (list.length) out += banner('o:' + g, 'wrench', 'g', g, `${list.length}`, `<div class="list">${list.map(([o, i]) => `<button class="opt" data-a="plan:${i}|${c.id}"><b>${lk(o.label)}</b>${o.hint ? `<span class="because">${esc(o.hint)}</span>` : ''}</button>`).join('')}</div>`);
  }
  return out;
}

// ------------------------------------------------------------------ jobs

export function jobView(j: Job): string {
  const w = W();
  const p = P();
  const g = j.giver ? w.chars[j.giver] : undefined;
  const t = j.target ? w.chars[j.target] : undefined;
  let out = back();
  out += `<div class="card"><h2>${j.kind === 'gig' ? GIG_LABEL[String(j.extra?.gig) as keyof typeof GIG_LABEL] ?? 'Opportunity' : KIND_LABEL[j.kind]} &middot; ${VIA[j.via]}</h2><p class="say">${lk(j.title)}</p><p>${lk(j.brief)}</p><p class="muted">${esc(j.kind === 'gig' ? GIG_HELP[String(j.extra?.gig) as keyof typeof GIG_HELP] ?? '' : KIND_HELP[j.kind] ?? '')}</p>`;
  if (g && g.id !== p.id) out += `<p class="muted">From ${who(g)}</p>`;
  if (t) out += `<p class="muted">About ${who(t)}${t.hurtUntil > w.now ? ' <b class="hurt">laid up</b>' : ''}</p>`;
  if (j.biz) out += `<p class="muted">Place: ${bl(j.biz)}</p>`;
  if (j.pay > 0) out += `<p class="muted">Pays ${money(j.pay)}</p>`;
  if (j.status === 'offered') out += `<p class="muted">Needs an answer by ${esc(shortTime(j.expires))}.</p>`;
  if (j.notes?.length) out += j.notes.map((n) => `<div class="note">${lk(n)}</div>`).join('');
  out += `</div>`;
  if (canQuestion(j) && (j.status === 'offered' || j.assignee === p.id)) {
    const c = jobChecks(j);
    out += `<div class="list">` + (c.ask ? `<button class="opt" data-a="jx:${j.id}|ask"><b>Ask why</b><span class="because">Make him explain it to your face.</span></button>` : '') + (c.press ? `<button class="opt" data-a="jx:${j.id}|press"><b>Press him</b><span class="because">That’s not the real reason. Lean on it.</span></button>` : '') + (c.inv ? `<button class="opt" data-a="jx:${j.id}|inv"><b>Check it out</b><span class="because">Takes time. You might not like what you find.</span></button>` : '') + (c.around ? `<button class="opt" data-a="jx:${j.id}|around"><b>Ask around</b><span class="because">Someone you trust, not involved.</span></button>` : '') + (c.haggle ? `<button class="opt" data-a="jx:${j.id}|haggle"><b>Push for more money</b></button>` : '') + `</div>`;
  }
  if (j.kind === 'summons') {
    out += j.status === 'offered' ? `<div class="list"><button class="opt" data-a="attend:${j.id}"><b>Go</b><span class="because">It takes time. Nobody’s going to fix this for you.</span></button><button class="opt" data-a="excuse:${j.id}">Make your excuses</button></div>` : `<p class="muted pad">This one is closed (${j.status}).</p>`;
  } else if (j.status === 'offered' || (j.status === 'active' && j.assignee === p.id)) {
    out += `<div class="list"><button class="opt" data-a="mine:${j.id}"><b>Do it myself</b></button>`;
    if (crewList().length) out += `<button class="opt" data-a="deleg:${j.id}"><b>Hand it to one of my men</b></button>`;
    out += j.status === 'offered' ? `<button class="opt" data-a="pass:${j.id}">Turn it down</button>` : `<button class="opt" data-a="drop:${j.id}">Drop it</button>`;
    out += `</div>`;
  } else if (j.status === 'active') {
    out += `<p class="muted pad">${lk(w.chars[j.assignee].name)} is handling it${j.orders ? ` (${j.orders === 'hard' ? 'by any means' : 'quietly'})` : ''}. You’ll hear when it’s done.</p>`;
  } else out += `<p class="muted pad">This one is closed (${j.status}).</p>`;
  return out;
}

export function approachView(j: Job): string {
  return back() + `<h2 class="sect">${lk(j.title)}</h2><p class="muted pad">How do you want to play it?</p><div class="list">` +
    approaches(W(), j).map((a) => `<button class="opt" data-a="go:${j.id}|${a.code}"><b>${esc(a.label)}</b><span class="because">${esc(a.hint)}</span></button>`).join('') + `</div>`;
}

export function delegateView(j: Job): string {
  const w = W();
  return back() + `<h2 class="sect">Who gets it?</h2><div class="list">` +
    crewList().map((c) => { const act = activityOf(w, c); return `<button class="opt" ${act ? 'disabled style="opacity:.5"' : `data-a="who:${j.id}|${c.id}"`}><b>${esc(c.name)}</b><span class="because">${esc(skillLine(c))}${act ? ` &middot; busy: ${esc(act.why)}, free ${esc(shortTime(act.until))}` : ''}${!act && c.heat > 0.4 ? ' &middot; running hot' : ''}</span></button>`; }).join('') + `</div>`;
}
export function sendView(j: Job, c: ReturnType<typeof W>['chars'][string]): string {
  return back() + `<h2 class="sect">Orders for ${esc(c.name)}</h2><p class="muted pad">${esc(c.name)} is ${traitWords(c)}. He will report back in a day or two.</p><div class="list">
    <button class="opt" data-a="send:${j.id}|${c.id}|quiet"><b>Keep it quiet</b><span class="because">Careful approach. Less take, less trouble.</span></button>
    <button class="opt" data-a="send:${j.id}|${c.id}|hard"><b>Get it done</b><span class="because">Whatever it takes. More likely to work, more likely to go wrong.</span></button></div>`;
}

export function reportView(j: Job, lines: string[]): string {
  const w = W();
  const rep = j.rep;
  if (!rep) return back() + '<p class="muted pad">Nothing to report.</p>';
  const m = w.chars[rep.by];
  let out = back() + `<div class="pers">${avatar(m)}<div><h1>${esc(m.name)} reports</h1><div class="sub">${lk(j.title)}</div></div></div>`;
  out += `<div class="card"><p class="say">${lk(rep.text)}</p>${lines.map((l) => `<div class="note">${lk(l)}</div>`).join('')}</div>`;
  if (rep.found) out += `<div class="callout info">You got the truth out of him.</div>`;
  out += `<div class="list">${rep.found ? '' : `<button class="opt" data-a="qrep:${j.id}"><b>Question him</b><span class="because">He may be telling you everything. He may not.</span></button>`}<button class="opt" data-a="ack:${j.id}"><b>That’s all</b></button></div>`;
  return out;
}

// ------------------------------------------------------------------ crew

export function crewView(): string {
  const w = W();
  const p = P();
  const crew = crewList();
  let out = strip();
  out += crewOverview(w, p, crew);
  out += `<h2 class="sect">Your men<small>${crew.length}</small></h2>`;
  out += crew.map((c) => {
    const fl_ = p.books.flags[c.id];
    const act = activityOf(w, c);
    const st = statusOf(w, c);
    const flags: string[] = [];
    const tr = crewTrend(c);
    if (tr) flags.push(`<span class="tag amber">${esc(tr)}</span>`);
    if (c.books.arrears > 0) flags.push(`<span class="tag red">owes ${money(c.books.arrears)}</span>`);
    if (c.books.missed >= 2) flags.push(`<span class="tag red">${c.books.missed} short weeks running</span>`);
    if (fl_ && fl_.amt > 0) flags.push(`<span class="tag red">${money(Math.round(fl_.amt))} unaccounted</span>`);
    if (c.problem && c.problem.revealed) flags.push(`<span class="tag amber">${esc(PROBLEM_LABEL[c.problem.kind])}</span>`);
    else if (c.problem && c.problem.sev > 0.45) flags.push(`<span class="tag amber">not himself</span>`);
    if (act) flags.push(`<span class="tag blue">${esc(act.why)}</span>`);
    return `<button class="need" data-a="ent:${c.id}"><span class="dot ${st.dot}"></span><span><span class="t">${esc(c.name)}</span><span class="s" style="display:block">${esc(skillLine(c))} &middot; passes up ${Math.round(effectiveRate(w, c) * 100)}%</span>${flags.length ? `<span style="display:block;margin-top:4px">${flags.join(' ')}</span>` : ''}</span></button>`;
  }).join('') || '<p class="muted pad">Nobody takes your orders. Yet.</p>';

  const env = crew.map((c) => ({ c, h: c.books.history[c.books.history.length - 1] })).filter((x) => x.h);
  if (env.length) {
    out += `<h2 class="sect">Last Sunday's envelopes<small>week ${env[0].h.week + 1}</small></h2><div class="card"><ul class="rows">${env.map(({ c, h }) => { const short = h.due - h.paid; return `<li><button class="rowbtn" data-a="books:${c.id}" style="display:flex;justify-content:space-between;width:100%;text-align:left"><span>${esc(c.name)}</span><span class="v ${h.due <= 0 ? '' : h.paid <= 0 ? 'bad' : short > h.due * 0.08 ? 'warn' : 'good'}">${h.due <= 0 ? 'nothing to give' : h.paid <= 0 ? 'nothing (owed ' + money(h.due) + ')' : short > h.due * 0.08 ? money(h.paid) + ' of ' + money(h.due) : money(h.paid)}</span></button></li>`; }).join('')}</ul><p class="small-note">Tap a man to look at his books. A light envelope has a reason, and it’s not always the one he gives.</p></div>`;
  }
  out += `<h2 class="sect">Run the crew</h2><div class="grid">
    <button class="tile" data-a="orders:"><span class="t">Give orders</span><span class="s">Send a man out</span></button>
    <button class="tile" data-a="meet:crew"><span class="t">Crew meeting</span><span class="s">The week, complaints, work</span></button>
    <button class="tile" data-a="meet:dinner"><span class="t">Host a dinner</span><span class="s">Bring people together</span></button>
    <button class="tile" data-a="recruit:"><span class="t">Take on a man</span><span class="s">${prospects(w, p).length} looking for a start</span></button></div>`;
  const moves = crewMoves(w, p);
  S.moves = moves;
  if (moves.length) out += `<div class="list">${moves.map((m, i) => `<button class="opt" data-a="cmove:${i}">${esc(m.label)}</button>`).join('')}</div>`;
  const rc = recommendable(w, p);
  const rk = recruitable(w, p);
  if (rc.length || rk.length) out += `<h2 class="sect">Build your crew</h2><div class="list">` + rc.map((c) => `<button class="opt" data-a="rec:${c.id}"><b>Put ${esc(c.name)} forward</b><span class="because">Your name goes with his.</span></button>`).join('') + rk.map((c) => `<button class="opt" data-a="recr:${c.id}"><b>Take on ${esc(c.name)}</b><span class="because">${esc(c.district)}. He likes you and he wants in.</span></button>`).join('') + `</div>`;
  return out;
}

export function recruitView(): string {
  const w = W();
  const p = P();
  const ps = prospects(w, p);
  let out = back() + `<h2 class="sect">Looking for a start</h2><p class="muted pad">Taking a man on costs ${money(RECRUIT_COST)}, and what he does goes against your name.</p>`;
  if (!ps.length) return out + '<p class="muted pad">Nobody is lingering with a question. For now.</p>';
  out += ps.map(({ c, note, vouch }) => `<div class="card"><div class="pers" style="margin:0">${avatar(c)}<div><b>${pl(c)}</b><div class="sub">${esc(c.district)} &middot; ${note} &middot; ${esc(skillLine(c))}</div></div></div>${vouch ? '<p class="muted">Ambitious. He’ll want more than a corner.</p>' : ''}<button class="btn primary" data-a="hire:${c.id}">Take him on</button></div>`).join('');
  return out;
}

export function dayjobView(): string {
  const w = W();
  const p = P();
  let out = back() + `<h2 class="sect">Legitimate work</h2>`;
  if (p.job) {
    const b = p.job.biz ? w.biz[p.job.biz] : undefined;
    out += `<div class="card"><h2>Your job</h2><p>${esc(p.job.kind)} ${b ? 'at ' + bl(b.id) : 'for ' + pl(w.chars[p.job.boss])}. ${p.job.shifts} shifts.</p>${meterRow('Noticed', p.job.noticed > 0.6 ? 'well regarded' : p.job.noticed > 0.3 ? 'getting there' : 'a face', p.job.noticed)}</div><div class="row2"><button class="btn primary" data-a="shift:">Work a shift</button><button class="btn danger" data-a="quitjob:">Quit</button></div>`;
    return out;
  }
  const opts = dayJobOptions(w, p);
  out += `<p class="muted pad">A real job gets you in rooms nobody invited you into. It doesn’t make you rich.</p>`;
  S.jobOpts = opts;
  out += `<div class="list">` + (opts.map((o, i) => `<button class="opt" data-a="takejob:${i}"><b>${lk(o.label)}</b><span class="because">${esc(o.hint)}</span></button>`).join('') || '<p class="muted">Nobody’s offering. Earn some trust first.</p>') + `</div>`;
  return out;
}

export function booksView(id: Id, lines: string[]): string {
  const w = W();
  const p = P();
  const c = w.chars[id];
  if (!c || !c.alive) return back() + `<p class="muted pad">He’s gone.</p>`;
  const fl_ = p.books.flags[c.id];
  const h = c.books.history.slice(-4).reverse();
  let out = back() + `<div class="pers">${avatar(c)}<div><h1>${esc(c.name)}'s books</h1><div class="sub">Passes up ${Math.round(effectiveRate(w, c) * 100)}% &middot; ${traitWords(c)}</div></div></div>`;
  out += `<div class="card">${lines.map((l) => `<p>${lk(l)}</p>`).join('')}${c.books.arrears > 0 ? `<p>Owes ${money(c.books.arrears)}.</p>` : ''}${c.books.missed ? `<p>${c.books.missed} short week${c.books.missed > 1 ? 's' : ''}.</p>` : ''}`;
  if (fl_ && fl_.amt > 0) out += `<p><b class="hurt">${money(Math.round(fl_.amt))}</b> unaccounted for. You have noticed ${fl_.n} time${fl_.n > 1 ? 's' : ''}.</p>`;
  out += `</div><div class="card"><h2>What he handed up</h2>` + (h.length ? `<ul class="rows">${h.map((x) => `<li><span>Week ${x.week + 1}</span><span class="v">declared ${money(x.declared)}, paid ${money(x.paid)}</span></li>`).join('')}</ul><p class="muted">What he actually earns is his own business until you look.</p>` : `<p class="muted">No weeks on record yet.</p>`) + `</div>`;
  out += `<div class="list"><button class="opt" data-a="audit:${c.id}"><b>Go through his books</b><span class="because">Takes an hour. He may take it badly.</span></button>`;
  out += `</div><h2 class="sect">Reward him<small>keep the good ones</small></h2><div class="list">` + rewardOptions(w, p, c).map((r) => `<button class="opt" data-a="reward:${c.id}|${r.code}"><b>${esc(r.label)}</b><span class="because">${esc(r.hint)}</span></button>`).join('') + `</div><h2 class="sect">Or put him straight</h2><div class="list">`;
  out += RULINGS.map((r) => `<button class="opt" data-a="rule:${c.id}|${r.code}"><b>${esc(r.label)}</b><span class="because">${esc(r.hint)}</span></button>`).join('') + `</div>`;
  return out;
}

export function helpView(id: Id, lines: string[]): string {
  const w = W();
  const c = w.chars[id];
  if (!c) return back();
  let out = back() + `<div class="pers">${avatar(c)}<div><h1>${esc(c.name)}</h1><div class="sub">${c.problem?.revealed ? esc(PROBLEM_LABEL[c.problem.kind]) : 'Something is off'}</div></div></div>`;
  out += `<div class="card">${lines.map((l) => `<p>${lk(l)}</p>`).join('') || `<p>${esc(c.name)} has not been right for a while. He will not say why unless you make him.</p>`}</div>`;
  out += `<div class="list"><button class="opt" data-a="helpdo:${id}|cash"><b>Put $400 in his hand</b><span class="because">Buys loyalty, takes the pressure off.</span></button><button class="opt" data-a="helpdo:${id}|duties"><b>Take some weight off him</b><span class="because">Lighter share, less to handle.</span></button><button class="opt" data-a="helpdo:${id}|leave"><b>Tell him it’s his to sort out</b></button></div>`;
  return out;
}

// ------------------------------------------------------------------ talk

const NODE_TITLE: Record<string, string> = { root: '', personal: 'Personal', business: 'Business', family: 'Family business', disputes: 'Grievances', orders: 'Work and orders', memos: 'Unfinished business', incident: '', subject: 'About him', pick_incident: '', pick_member: 'Who?', pick_concern: 'Who worries you?' };

export function talkView(v: Extract<typeof S.view, { t: 'talk' }>): string {
  const w = W();
  const t = w.chars[v.convo.id];
  const p = P();
  if (!t || !t.alive) return back('Done') + `<p class="muted pad">He’s gone.</p>`;
  const r = t.rels[p.id];
  const mood = !r ? 'a stranger' : r.grudge >= 0.3 ? `${grudgeWord(r.grudge)} toward you` : r.trust > 0.6 ? 'trusts you' : r.trust > 0.35 ? 'knows you' : 'wary of you';
  S.dopts = dialogueOptions(w, p, t, v.convo);
  let out = back('Leave');
  out += `<div class="pers">${avatar(t)}<div><h1>${pl(t)}</h1><div class="sub">${chip(t)} ${esc(t.district)} &middot; ${esc(mood)}</div></div></div>`;
  // What was said earlier is there to be read, folded away; what was just said is the focus of the screen.
  const exch = (q: string | undefined, ls: string[]) => `${q ? `<div class="you-said">${esc(q)}</div>` : ''}${ls.length ? `<div class="him">${ls.map((l) => (l.startsWith('⟡') ? `<p class="fx">${esc(l)}</p>` : /["“]/.test(l) ? `<p class="say">${lk(l)}</p>` : `<p class="nar">${lk(l)}</p>`)).join('')}</div>` : ''}`;
  if (v.history?.length) out += `<details class="talk-hist"><summary>Earlier in this conversation (${v.history.length})</summary>${v.history.map((h) => exch(h.q, h.lines)).join('')}</details>`;
  if (v.lines.length || v.q) out += `<div class="talk-now">${exch(v.q, v.lines)}</div>`;
  const title = NODE_TITLE[v.convo.node];
  const flat = S.dopts.some((o) => o.group);
  const btn = (o: (typeof S.dopts)[number], i: number) => `<button class="opt ${o.story ? 'sg-' + o.story : ''}${flat && !o.big ? ' row' : ''}${o.nav ? ' nav' : ''}${o.done ? ' done' : ''}"${o.done ? ' disabled aria-disabled="true" title="Already covered. Nothing more to be had until next time."' : ` data-a="say:${i}"`}>${o.story ? `<i class="sg ${o.story}" title="${o.story === 'go' ? 'Moves a story on' : 'Can settle a story'}">${o.story === 'go' ? '!' : '&#10003;'}</i>` : ''}<b>${lk(o.label)}</b>${o.hint && (!flat || o.big || o.nav) ? `<span class="because">${esc(o.hint)}</span>` : ''}</button>`;
  if (S.dopts.some((o) => o.group)) {
    if (S.dopts.some((o) => o.story)) out += `<p class="small-note" style="margin:8px 0 0"><i class="sg go">!</i> moves a story on &nbsp; <i class="sg end">&#10003;</i> can settle one</p>`;
    let cur = '';
    S.dopts.forEach((o, i) => { if (o.group && o.group !== cur) { cur = o.group; out += `${i ? '</div>' : ''}<h2 class="sect">${esc(({ 'Between you': 'On the table', Talk: 'You could say' } as Record<string, string>)[cur] ?? cur)}</h2><div class="list">`; } else if (!o.group && cur) { cur = ''; out += `</div><div class="list">`; } out += btn(o, i); });
    out += `</div>`;
    return out;
  }
  const quiet = v.convo.node === 'incident' || v.convo.node === 'pick_incident';
  out += `${quiet ? '' : `<h2 class="sect">${title || 'Say or do'}</h2>`}${S.dopts.some((o) => o.story) ? `<p class="small-note" style="margin:0 0 6px"><i class="sg go">!</i> moves a story on &nbsp; <i class="sg end">&#10003;</i> can settle one</p>` : ''}<div class="list">` + S.dopts.map(btn).join('') + `</div>`;
  return out;
}

export function peopleView(): string {
  const w = W();
  const p = P();
  const ids = new Set<Id>(Object.keys(p.rels));
  for (const c of Object.values(w.chars)) if (c.alive && c.bossId === p.id) ids.add(c.id);
  const groups = new Map<string, { head: string; rows: string[] }>();
  const order: string[] = [];
  const put = (key: string, head: string, row: string) => {
    if (!groups.has(key)) { groups.set(key, { head, rows: [] }); order.push(key); }
    groups.get(key)!.rows.push(row);
  };
  const list = [...ids].map((id) => w.chars[id]).filter((x) => x && x.alive && x.id !== p.id && (x.rank !== 'civilian' || ownerBiz(w, x.id))).sort((a, b) => (p.rels[b.id]?.trust ?? 0) - (p.rels[a.id]?.trust ?? 0)).slice(0, 30);
  for (const x of list) {
    const wh = whereIs(w, p, x);
    const row = `<button class="need" data-a="ent:${x.id}"><span class="dot ${statusOf(w, x).dot}"></span><span><span class="t">${esc(x.name)}</span><span class="s" style="display:block">${esc(chipText(x.id))}${wh.mins ? ` &middot; ${wh.mins} min away` : ''}</span></span></button>`;
    const key = wh.kind === 'shop' ? 'shop' : wh.kind;
    put(key, { club: 'At the Social Club', bar: 'At the Corner Bar', barber: 'At the Barber Shop', shop: 'At work', home: 'At home', hurt: 'Laid up', jail: 'Out of reach' }[wh.kind], row);
  }
  let out = back() + `<h2 class="sect">Who’s where<small>${esc(fmtTime(w.now))}</small></h2><p class="muted pad">Tap a man to see where he is. Then go and find him.</p>`;
  for (const k of ['club', 'bar', 'barber', 'shop', 'home', 'hurt', 'jail']) {
    const g = groups.get(k);
    if (g) out += `<h2 class="sect">${esc(g.head)}<small>${g.rows.length}</small></h2>${g.rows.join('')}`;
  }
  return out;
}
const chipText = (id: Id) => {
  const c = W().chars[id];
  return `${c.rank}${c.familyId ? ', ' + W().fam[c.familyId].name : ''}, ${c.district}`;
};

// ------------------------------------------------------------- club etc.

export function placesView(): string {
  const w = W();
  return back() + `<h2 class="sect">Around town</h2><div class="list">${PLACES.map((pl_) => `<button class="opt" data-a="place:${pl_.id}"><b>${esc(pl_.name)}</b><span class="because">${esc(pl_.blurb)} ${isOpen(w, pl_.id) ? 'Open.' : 'Shut right now.'}</span></button>`).join('')}</div>`;
}

export function placeView(id: string): string {
  const w = W();
  const p = P();
  if (id === 'club') return clubView();
  const pl_ = PLACES.find((x) => x.id === id)!;
  let out = back() + `<div class="card"><h2>${esc(pl_.name)}</h2><p>${esc(pl_.blurb)}</p></div>`;
  if (!isOpen(w, id)) return out + `<p class="muted pad">It’s shut. Come back between ${pl_.open[0]}:00 and ${pl_.open[1] % 24}:00.</p>`;
  if (id === 'barber') return out + `<div class="list"><button class="opt" data-a="club:shave"><b>Get a shave</b><span class="because">$20. You’ll hear things.</span></button></div>`;
  if (id === 'bar') return out + `<div class="list"><button class="opt" data-a="club:drink"><b>Have a few drinks</b><span class="because">$30. Strangers talk. So do you.</span></button></div>`;
  const here = present(w, p, id);
  out += `<div class="list"><button class="opt" data-a="club:sit"><b>Sit and listen</b><span class="because">An hour or two. Things find you here.</span></button></div>`;
  if (!here.length) return out + `<p class="muted pad">Nobody you know is in right now.</p>`;
  out += `<h2 class="sect">Who’s in<small>${here.length}</small></h2>`;
  out += here.map((c) => `<button class="need" data-a="talk:${c.id}"><span class="dot ${statusOf(w, c).dot}"></span><span><span class="t">${esc(c.name)}</span><span class="s" style="display:block">${esc(c.rank)} &middot; ${esc(ARCH_WORD[arch(c)])}</span></span></button>`).join('');
  return out;
}

export function grudgesView(): string {
  const w = W();
  const p = P();
  const rows: { c: ReturnType<typeof W>['chars'][string]; why: string; sev: number }[] = [];
  for (const f of Object.values(w.facts)) {
    if (f.victim !== p.id || !f.actor || !p.known[f.id] || !['beating', 'robbery', 'vandalism', 'poach'].includes(f.kind)) continue;
    if (!p.known[f.id].knowsActor) continue;
    const c = w.chars[f.actor];
    if (!c || !c.alive || c.familyId === p.familyId) continue;
    rows.push({ c, why: factText(f, true), sev: p.rels[c.id]?.grudge ?? 0.3 });
  }
  for (const [id, r] of Object.entries(p.rels)) if (r.grudge >= 0.35 && w.chars[id]?.alive && !rows.some((x) => x.c.id === id)) rows.push({ c: w.chars[id], why: 'You haven’t forgotten him.', sev: r.grudge });
  rows.sort((a, b) => b.sev - a.sev);
  let out = back() + `<h2 class="sect">What you haven’t forgotten</h2>`;
  if (!rows.length) return out + `<p class="muted pad">Nobody has crossed you. Yet.</p>`;
  out += rows.slice(0, 8).map((r) => `<div class="card"><div class="pers" style="margin:0">${avatar(r.c)}<div><b>${pl(r.c)}</b><div class="sub">${chip(r.c)} ${esc(r.c.district)}</div></div></div><p>${lk(r.why)}</p>${isMade(r.c) && !sanctioned(w, p, r.c) ? `<p class="muted">He is a made man. You cannot touch him on your own say-so.</p><button class="btn" data-a="perm:${r.c.id}">Ask permission</button>` : `<button class="btn danger" data-a="settle:${r.c.id}">Settle it</button>`}</div>`).join('');
  return out;
}

// ----------------------------------------------------------- meetings

export function meetingView(v: Extract<typeof S.view, { t: 'meeting' }>): string {
  const w = W();
  const m = v.m;
  const it = meetCurrent(m);
  let out = `<div class="card"><h2>${esc(m.title)}</h2><p>${m.attendees.map((id) => who(w.chars[id])).join('<br>')}</p></div>`;
  if (v.lines.length) out += `<div class="card"><h2>What happened</h2>${v.lines.map((l) => `<p>${lk(l)}</p>`).join('')}</div>`;
  if (!it) return out + `<div class="card"><h2>Meeting over</h2>${m.summary.map((l) => `<p>${lk(l)}</p>`).join('') || '<p class="muted">That’s everything on the table.</p>'}</div><button class="btn primary" data-a="mdone:">Leave</button>`;
  out += `<div class="card"><h2>${lk(it.title)}</h2>${it.text.map((l) => `<p class="say">${lk(l)}</p>`).join('')}</div>`;
  out += `<div class="list">` + it.opts.map((o, i) => `<button class="opt" data-a="mopt:${i}"><b>${lk(o.label)}</b>${o.hint ? `<span class="because">${esc(o.hint)}</span>` : ''}</button>`).join('') + `<button class="opt" data-a="mdone:">Leave early</button></div>`;
  return out;
}

export function guestsView(picked: Id[]): string {
  const w = W();
  const p = P();
  const kn = Object.entries(p.rels).map(([id, r]) => [w.chars[id], r] as const).filter(([c]) => c && c.alive && c.rank !== 'civilian' && c.id !== p.id).sort((a, b) => b[1].trust - a[1].trust).slice(0, 14);
  let out = back() + `<h2 class="sect">Who’s coming?</h2><p class="muted pad">Pick up to four. Dinner costs $70 a head. People who dislike each other will sit at the same table, and that’s rarely quiet.</p><div class="list">`;
  out += kn.map(([c]) => `<button class="opt ${picked.includes(c.id) ? 'sel' : ''}" data-a="gpick:${c.id}">${picked.includes(c.id) ? '&#10003; ' : ''}${esc(c.name)} <span class="muted">${esc(c.rank)}</span>${available(w, c) ? '' : ' <span class="muted">(not free)</span>'}</button>`).join('') + `</div>`;
  out += `<button class="btn primary" data-a="ghost:" ${picked.length < 2 ? 'disabled' : ''}>Host dinner${picked.length ? ` (${money(70 * picked.length)})` : ''}</button>`;
  return out;
}

// ------------------------------------------------------------------ family & life

import { queueView } from './family';
function huntBanner(): string {
  const w = W(), p = P();
  const hs = Object.values(w.fam).filter((f) => f.hunt?.target === p.id);
  return hs.map((f) => `<button class="need" data-a="story:hunt:${f.id}"><span class="dot red"></span><span><span class="t">The ${esc(f.name)} family wants you</span><span class="s" style="display:block">${esc(f.hunt!.why)}</span></span></button>`).join('');
}
// V76: the organisation's own record, in the words of the street. Made men see the fund; everyone sees who leads and what has changed.
function orgCard(fid: string): string {
  const w = W(), p = P();
  const r = orgRecord(w, fid);
  const mine = fid === p.familyId;
  const years = Math.max(0, Math.round((w.now - r.leaderSince) / (52 * 7 * 1440) * 10) / 10);
  const rows: string[] = [];
  const row = (k: string, v: string) => rows.push(`<li><span>${k}</span><span class="v">${v}</span></li>`);
  row('Led by', r.leader ? `${esc(r.leader.name)}${r.acting ? ` <small class="muted">(${esc(r.acting.name)} is running things)</small>` : ''}` : 'nobody');
  row('At the head for', r.leaderSince > 0 ? (years < 0.1 ? 'a few weeks' : `${years} year${years === 1 ? '' : 's'}`) : 'years');
  if (r.hq) row('Headquarters', `${esc(r.hq.name)} <small class="muted">${esc(r.hq.district)}</small>`);
  row('Weight in the city', `${Math.round(r.standing)}<small class="muted">/100</small>`);
  if (mine && RANKS_SEE_FUND.includes(p.rank)) row('Family fund', money(r.treasury));
  const rel = Object.entries(r.relations).filter(([id, x]) => w.fam[id] && (x.deals.length || x.grievance > 0.25 || x.coop > 0.3)).slice(0, 3);
  for (const [id, x] of rel) row(`The ${esc(w.fam[id].name)}`, x.coop > x.comp + 0.15 && x.grievance < 0.3 ? 'friendly' : x.grievance > 0.3 ? 'a grievance' : x.comp > 0.3 ? 'rivals' : 'at ease');
  const hist = r.hist.slice(-3).reverse().map((e) => `<li class="muted"><small>${esc(e.text)}</small></li>`).join('');
  return `<div class="card"><h2>The ${esc(r.name)} family<small>${esc(r.history)}</small></h2><ul class="rows">${rows.join('')}${hist}</ul></div>`;
}
const RANKS_SEE_FUND = ['soldier', 'capo', 'underboss', 'boss'];
export function familyTab(): string {
  const w = W();
  const p = P();
  let out = strip() + ((S.treeFam ?? p.familyId) === p.familyId ? huntBanner() + queueView() : '') + treeView(S.treeFam ?? p.familyId!);
  out += orgCard(S.treeFam ?? p.familyId!);
  out += `<h2 class="sect">Family business</h2><div class="list"><button class="opt" data-a="meet:family"><b>Call on the family</b><span class="because">Hear what’s being decided.</span></button></div>`;
  const shops = Object.values(w.biz).filter((b) => b.open).sort((a, b) => Number(b.district === p.district) - Number(a.district === p.district) || a.district.localeCompare(b.district)).slice(0, S.open['shops'] ? 60 : 8);
  out += `<h2 class="sect">Shops and places<small>${Object.keys(w.biz).length}</small></h2><div class="card"><ul class="rows">${shops.map((b) => `<li><span>${bl(b.id)}<small class="muted"> ${esc(b.district)}</small></span><span class="v">${b.protection ? esc(w.fam[b.protection.familyId].name) : 'unprotected'}</span></li>`).join('')}</ul>${S.open['shops'] ? '' : `<button class="btn" data-a="tog:shops">Show all</button>`}</div>`;
  return out;
}

const snapList = (): { day: number; key: string; label: string }[] => { try { return readSnaps(localStorage); } catch { return []; } };
function statsCard(): string {
  const w = W(), p = P();
  const heat = Math.min(1, p.heat);
  const heatWord = heat < 0.15 ? 'Quiet' : heat < 0.4 ? 'Noticed' : heat < 0.7 ? 'Hot' : 'Burning';
  const men = crewList().length;
  const shops = Object.values(w.biz).filter((b) => b.protection?.collectorId === p.id);
  const fees = shops.reduce((a, b) => a + (b.protection?.fee ?? 0), 0);
  const stakes = stakesOf(w, p.id).length;
  const behind = shops.filter((b) => owedOf(b) > 0);
  const owed = (w.debts ?? []).filter((d) => d.creditor === p.id && d.status === 'active').reduce((a, d) => a + d.balance, 0);
  const owe = (w.debts ?? []).filter((d) => d.debtor === p.id && d.status === 'active').reduce((a, d) => a + d.balance, 0);
  const fOwed = (w.favours ?? []).filter((f) => f.from === p.id && !f.settled).length;
  const fOwe = (w.favours ?? []).filter((f) => f.to === p.id && !f.settled).length;
  const rep = p.rep;
  const row = (k: string, val: string, cls = '') => `<li><span>${k}</span><span class="v ${cls}">${val}</span></li>`;
  const rows = [
    row('Reputation', `${standingWord(p.standing)} <small class="muted">${Math.round(p.standing)}/100</small>`),
    row('Heat', `${heatWord} <small class="muted">${Math.round(heat * 100)}%</small>`, heat > 0.4 ? 'warn' : ''),
    row('Influence', `${influenceWord(influence(w, p))} <small class="muted">${Math.round(influence(w, p))}</small>`),
    row('Rank', esc(p.rank)),
    row('Cash', money(p.cash)),
    row('Made last week', money(p.weekIncome)),
    row('Passed up, all time', money(p.lifetimeKick)),
    row('Men under you', String(men)),
    row('Shops paying you', shops.length ? `${shops.length} &middot; ${money(fees)} a week` : 'none'),
    behind.length ? row('Shops behind', `${behind.length} &middot; ${money(behind.reduce((a, b) => a + owedOf(b), 0))} owed`, 'warn') : '',
    stakes ? row('Stakes in businesses', String(stakes)) : '',
    row('Owed to you', owed ? money(owed) : 'nothing'),
    row('You owe', owe ? money(owe) : 'nothing', owe ? 'warn' : ''),
    row('Favours owed to you', String(fOwed)),
    row('Favours you owe', String(fOwe), fOwe ? 'warn' : ''),
    rep ? row('Word kept / broken', `${rep.kept} / ${rep.broken}`, rep.broken > rep.kept ? 'warn' : '') : '',
    p.career ? row('Jobs done / failed', `${p.career.done} / ${p.career.failed}`) : '',
    p.hurtUntil > w.now ? row('Health', 'hurt', 'warn') : '',
    p.jailedUntil > w.now ? row('Status', 'locked up', 'warn') : '',
  ].join('');
  const sc = specScores(w, p);
  const specRows = (Object.keys(SPEC_LABEL) as Spec[]).sort((a, b) => sc[b] - sc[a]).map((s) => `<li><span>${SPEC_LABEL[s]}</span><span class="v ${tierOf(sc[s]) >= 2 ? 'good' : ''}">${TIER_WORD[tierOf(sc[s])]}</span></li>${tierOf(sc[s]) >= 2 ? `<li class="muted"><small>${SPEC_PERK[s]}</small></li>` : ''}`).join('');
  return `<div class="card"><h2>How you’re doing</h2><ul class="rows">${rows}</ul></div><div class="card"><h2>What you’re known as<small>from what you’ve done</small></h2><ul class="rows">${specRows}</ul></div>`;
}

export function lifeTab(): string {
  const w = W();
  const p = P();
  const sub = (id: typeof S.lifeSub, label: string) => `<button class="pill ${S.lifeSub === id ? 'on' : ''}" data-a="lsub:${id}">${label}</button>`;
  let out = strip() + `<div class="pills">${sub('me', 'Me')}${sub('people', 'People')}${sub('intel', 'Intel')}${sub('money', 'Money')}${sub('love', 'Romance')}${sub('more', 'More')}</div>`;
  if (S.lifeSub === 'intel') out += disputesList();
  if (S.lifeSub === 'me') {
    out += `<div class="pers">${avatar(p)}<div><h1>${esc(p.name)}</h1><div class="sub">${esc(p.rank)} &middot; ${esc(famName(w, p))} &middot; ${esc(p.district)}</div></div></div>`;
    out += statsCard() + `<div class="tags">${traitTags(p)}</div><div class="card"><h2>What you’re good at</h2>${skillBars(p)}</div>`;
    out += `<div class="card"><h2>Your standing</h2>${p.bg && bgLabel(p.bg) ? `<p class="muted"><b>${esc(bgLabel(p.bg)!)}.</b>${bgOf(p.bg) ? ' ' + esc(bgOf(p.bg)!.blurb) : ''}</p>` : ''}${careerLines(w, p).map((l) => `<p>${lk(l)}</p>`).join('')}</div>`;
    out += `<div class="card"><h2>What they say about you<small>don’t take it personally</small></h2>${repLines(w, p).map((l) => `<p class="say">${esc(l)}</p>`).join('')}</div>`;
    out += p.job ? `<button class="btn" data-a="dayjob:">Your job: ${esc(p.job.kind)}</button>` : `<button class="btn" data-a="dayjob:">Find legitimate work</button>`;
    const L = w.life;
    if (L) {
      const rows: string[] = [];
      const pr = L.partner;
      if (pr && pr.stage !== 'split') rows.push(`<li><button class="rowbtn" data-a="ent:${pr.id}" style="display:flex;justify-content:space-between;width:100%;text-align:left"><span>${esc(w.chars[pr.id].name)}</span><span class="v">${esc(stageWord[pr.stage])} &middot; ${warmthWord(pr.warmth)}</span></button></li>`);
      for (const k of L.kin) if (w.chars[k.id]?.alive) rows.push(`<li><button class="rowbtn" data-a="ent:${k.id}" style="display:flex;justify-content:space-between;width:100%;text-align:left"><span>${esc(w.chars[k.id].name)} <small class="muted">${esc(kinWord(k).replace('Your ', ''))}</small></span><span class="v ${k.sick ? 'warn' : ''}">${k.sick ? 'unwell' : warmthWord(k.warmth)}</span></button></li>`);
      out += `<div class="card"><h2>The people at home</h2><ul class="rows">${rows.join('') || '<li class="muted">Nobody’s waiting for you.</li>'}</ul>${pr && pr.stage !== 'split' ? '' : '<p class="muted">Somebody will introduce you to someone, sooner or later, if you let them.</p>'}</div>`;
    }
    const patron = p.bossId ? w.chars[p.bossId] : undefined;
    out += `<div class="card"><h2>Around you</h2><ul class="rows">${patron ? `<li><span>Answers to</span><span class="v">${pl(patron)}</span></li>` : ''}${p.sponsor ? `<li><span>Sponsor</span><span class="v">${pl(w.chars[p.sponsor])}</span></li>` : ''}${p.backer ? `<li><span>Backer</span><span class="v">${pl(w.chars[p.backer])}</span></li>` : ''}<li><span>Men</span><span class="v">${crewList().length}</span></li></ul></div>`;
  } else if (S.lifeSub === 'people') {
    const fam = S.worldFilter;
    const fil = (id: string, label: string) => `<button class="pill small ${fam === id ? 'on' : ''}" data-a="pf:${id}">${label}</button>`;
    out += `<div class="pills">${fil('all', 'All')}${Object.values(w.fam).map((f) => fil(f.id, esc(f.name))).join('')}${fil('pin', '&#9733; Pinned')}${fil('none', 'Civilians')}</div>`;
    const rows = Object.entries(p.rels).map(([id, r]) => [w.chars[id], r] as const).filter(([x]) => x && x.alive && (fam === 'all' || (fam === 'pin' ? !!p.notes?.[x.id]?.pin : fam === 'none' ? !x.familyId : x.familyId === fam))).sort((a, b) => Number(!!p.notes?.[b[0].id]?.pin) - Number(!!p.notes?.[a[0].id]?.pin) || b[1].trust - a[1].trust).slice(0, 40);
    out += `<div class="card"><ul class="rows">${rows.map(([x, r]) => `<li><span>${p.notes?.[x.id]?.pin ? '&#9733; ' : ''}${pl(x)} <small class="muted">${esc(x.rank)}${p.notes?.[x.id]?.tags.length ? ' &middot; ' + esc(p.notes[x.id].tags.join(', ')) : ''}</small></span><span class="v ${r.grudge >= 0.3 ? 'warn' : ''}">${r.grudge >= 0.3 ? grudgeWord(r.grudge) : r.trust > 0.6 ? 'close' : r.trust > 0.35 ? 'friendly' : 'known'}</span></li>`).join('') || '<li class="muted">Nobody you know fits.</li>'}</ul></div>`;
  } else if (S.lifeSub === 'intel') {
    const items = Object.entries(p.known).filter(([id]) => w.facts[id] && !w.facts[id].minor).sort((a, b) => w.facts[b[0]].t - w.facts[a[0]].t).slice(0, 25);
    out += items.length ? `<div class="card">${items.map(([id, k]) => `<div class="note"><a class="nm" href="#" data-a="fact:${id}" style="text-decoration:none">${lk(factText(w.facts[id], k.knowsActor))}</a><div class="src">${esc(shortTime(w.facts[id].t))}</div></div>`).join('')}</div>` : `<p class="muted pad">You know nothing. Go and be seen.</p>`;
  } else if (S.lifeSub === 'love') {
    out += loveView();
  } else if (S.lifeSub === 'money') {
    out += booksOwn() + lendingCard();
  } else {
    out += `<div class="list"><button class="opt" data-a="save:">Save now</button><button class="opt ${S.confirmReset ? 'danger' : ''}" data-a="reset:">${S.confirmReset ? 'Tap again to erase this game and start over' : 'Start a new game'}</button></div><div class="list"><button class="opt" data-a="dlsave:"><b>Download a backup file</b><span class="because">A copy you can keep outside the browser.</span></button><button class="opt" data-a="ulsave:"><b>Load a backup file</b><span class="because">Replaces the game you are playing.</span></button></div><input type="file" id="ulfile" accept=".json,application/json" hidden><p class="muted pad">${S.save ? (S.save.ok ? `Saved (${fmtTime(W().now)}). This game takes ${(S.save.bytes / 1e6).toFixed(2)} MB; with ${S.save.snapshots} earlier-day snapshot${S.save.snapshots === 1 ? '' : 's'} it is ${(S.save.used / 1e6).toFixed(2)} MB of roughly 5 MB available in this browser.` : 'NOT saved: ' + esc(S.save.error ?? '')) : 'The game saves itself after every action, in this browser only.'}</p>${(() => { const l = snapList(); return l.length ? `<h2 class="sect">Earlier days<small>if you need to undo</small></h2><div class="list">${l.map((x) => `<button class="opt" data-a="restore:${x.key}"><b>${esc(x.label)}</b><span class="because">Go back to this day. Everything since is lost.</span></button>`).join('')}</div>` : ''; })()}`;
  }
  return out;
}

function booksOwn(): string {
  const w = W();
  const p = P();
  const b = p.books;
  const boss = p.bossId ? w.chars[p.bossId] : undefined;
  const st = b.stance ?? 'honest';
  const pill = (id: string, label: string) => `<button class="pill small ${st === id ? 'on' : ''}" data-a="stance:${id}">${label}</button>`;
  let out = '';
  if (boss) {
    out += `<div class="card"><h2>What you owe ${pl(boss)}</h2><p>You pass up <b>${Math.round(effectiveRate(w, p) * 100)}%</b> of what you declare each Sunday.${b.arrears > 0 ? ` You are behind by <b class="hurt">${money(b.arrears)}</b>.` : ''}</p>`;
    out += `<p class="muted">How honest are you with him?</p><div class="pills">${pill('honest', 'Straight')}${pill('shave', 'Shave 30%')}${pill('stall', 'Stall')}</div>`;
    out += `<p class="muted">${st === 'honest' ? 'You declare everything. It builds your name.' : st === 'shave' ? 'You under-report. He may notice, and if he does, you’ll hear about it.' : 'You pay nothing this week. He’ll notice.'}</p></div>`;
  }
  const hist = b.history.slice(-6).reverse();
  if (hist.length) out += `<div class="card"><h2>Recent weeks</h2><ul class="rows">${hist.map((h) => `<li><span>Week ${h.week + 1}</span><span class="v">earned ${money(h.gross)}, paid ${money(h.paid)} of ${money(h.due)}${h.received ? `, got ${money(h.received)}` : ''}</span></li>`).join('')}</ul></div>`;
  out += favoursCard();
  const mine = w.debts.filter((d) => d.status === 'active' && (d.creditor === p.id || d.debtor === p.id));
  out += `<div class="card"><h2>Debts</h2>` + (mine.length ? `<ul class="rows">${mine.map((d) => `<li><span>${d.creditor === p.id ? pl(w.chars[d.debtor]) + ' owes you' : 'You owe ' + pl(w.chars[d.creditor])}</span><span class="v">${money(d.balance)}</span></li>`).join('')}</ul>` : '<p class="muted">No open debts.</p>') + `</div>`;
  return out;
}

void ownerBiz; void fl; void known; void standingTable;

export function opStartView(kind: string): string {
  const w = W();
  const p = P();
  const d = OPS[kind as keyof typeof OPS];
  if (!d) return back();
  const fam = p.familyId ? w.fam[p.familyId] : undefined;
  const dists = d.districts ?? [p.district, ...(fam?.districts.filter((x) => x !== p.district) ?? [])].slice(0, 3);
  if (!dists.includes(S.opDist)) S.opDist = dists[0];
  const err = canStart(w, p, kind as keyof typeof OPS, S.opDist);
  let out = back() + `<h2 class="sect">${esc(d.label)}</h2><div class="card"><p>${esc(d.blurb)}</p><ul class="rows"><li><span>Start-up</span><span class="v">${d.cost ? money(d.cost) : 'nothing'}</span></li><li><span>Typical week</span><span class="v good">about ${money(d.base)}</span></li><li><span>Attention</span><span class="v ${d.heat > 0.03 ? 'warn' : ''}">${d.heat < 0 ? 'lowers heat' : d.heat > 0.03 ? 'high' : 'some'}</span></li></ul></div>`;
  out += `<h2 class="sect">Where</h2><div class="pills">${dists.map((x) => `<button class="pill ${S.opDist === x ? 'on' : ''}" data-a="opdist:${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
  out += `<h2 class="sect">Who runs it</h2><div class="list"><button class="opt ${S.opRunner === 'me' ? 'sel' : ''}" data-a="oprun:me"><b>You</b><span class="because">Nobody skims. But you’re the one they come for.</span></button>${crewList().map((c) => `<button class="opt ${S.opRunner === c.id ? 'sel' : ''}" data-a="oprun:${c.id}"><b>${esc(c.name)}</b><span class="because">${esc(skillLine(c))}${c.problem && c.problem.sev > 0.4 ? ' &middot; has something on his mind' : ''}</span></button>`).join('')}</div>`;
  out += err ? `<div class="callout bad">${esc(err)}</div>` : '';
  out += `<button class="btn primary" data-a="opgo:${kind}" ${err ? 'disabled' : ''}>Start it${d.cost ? ` (${money(d.cost)})` : ''}</button>`;
  return out;
}

export function opView(id: Id, lines: string[], found?: number): string {
  const w = W();
  const op = w.ops.find((o) => o.id === id);
  if (!op) return back() + '<p class="muted pad">It’s gone.</p>';
  const d = OPS[op.kind as keyof typeof OPS];
  const r = op.runner ? w.chars[op.runner] : undefined;
  let out = back() + `<h2 class="sect">${esc(d?.label ?? 'Job')}</h2>`;
  out += `<div class="card"><ul class="rows"><li><span>Where</span><span class="v">${esc(op.district)}</span></li><li><span>Run by</span><span class="v">${r ? pl(r) : 'you'}</span></li><li><span>Last week</span><span class="v ${op.last < 0 ? 'warn' : 'good'}">${money(op.last)}</span></li><li><span>Since you started</span><span class="v">${money(op.total)} in ${op.weeks} weeks</span></li><li><span>Status</span><span class="v ${op.state === 'raided' ? 'warn' : ''}">${op.state === 'raided' ? 'shut down by police' : op.state === 'closed' ? 'closed' : 'running'}</span></li></ul>${lines.map((l) => `<div class="note">${lk(l)}</div>`).join('')}</div>`;
  if (op.state === 'closed') return out;
  out += `<div class="list">`;
  if (r) out += `<button class="opt" data-a="opcount:${op.id}"><b>Go through the count</b><span class="because">An hour with the figures. He may not like being checked.</span></button>`;
  if (found !== undefined && found > 30 && r) out += `<button class="opt" data-a="oprule:${op.id}|repay|${found}"><b>Make him pay it back</b></button><button class="opt" data-a="oprule:${op.id}|warn|${found}"><b>Tell him it stops</b></button><button class="opt" data-a="oprule:${op.id}|fire|${found}"><b>Take it off him</b></button>`;
  out += `<button class="opt danger" data-a="opclose:${op.id}"><b>Shut it down</b></button></div>`;
  return out;
}

export function hijackView(picked: Id[]): string {
  const w = W();
  const crew = crewList().filter((c) => c.jailedUntil <= w.now && c.hurtUntil <= w.now);
  let out = back() + `<h2 class="sect">Who goes?</h2><p class="muted pad">Pick two or three. Drivers and muscle do best. They’ll tell you what happened, and you’ll have to decide if you believe them.</p><div class="list">`;
  out += crew.map((c) => `<button class="opt ${picked.includes(c.id) ? 'sel' : ''}" data-a="hjpick:${c.id}">${picked.includes(c.id) ? '&#10003; ' : ''}<b>${esc(c.name)}</b> <span class="muted">${esc(skillLine(c))}</span></button>`).join('') + `</div>`;
  out += `<button class="btn primary" data-a="hjgo:" ${picked.length < 2 ? 'disabled' : ''}>Send them</button>`;
  return out;
}

export function settleView(id: Id, lines: string[], kill = false): string {
  const w = W();
  const p = P();
  const x = w.chars[id];
  if (!x || !x.alive) return back() + `<div class="card"><p>That’s settled by other means.</p></div>`;
  const why = Object.values(w.facts).filter((f) => f.victim === p.id && f.actor === x.id && p.known[f.id]).sort((a, b) => b.t - a.t)[0];
  let out = back() + `<div class="card"><h2>Settle it with ${pl(x)}</h2><p class="muted">${why ? lk(why.text) : 'There’s bad blood. Nothing specific you can point to.'}</p><p class="muted">${esc(grudgeWord(rel(x, p.id)?.grudge ?? 0))} grudge on his side, ${esc(grudgeWord(rel(p, x.id)?.grudge ?? 0))} on yours.</p></div>`;
  if (lines.length) out += `<div class="card">${lines.map((l) => `<p>${lk(l)}</p>`).join('')}</div>`;
  out += `<div class="list">${settleOptions(w, p, x, kill).map((o) => `<button class="opt ${o.danger ? 'danger' : ''}" data-a="sv:${o.code}|${x.id}"><b>${esc(o.label)}</b>${o.hint ? `<span class="because">${esc(o.hint)}</span>` : ''}</button>`).join('')}</div>`;
  return out;
}


// ---- the crew overview: what the men report, never what they hide
const wk = (c: Character) => c.books.history.slice(-4);
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
export function crewTrend(c: Character): string | undefined {
  const h = c.books.history.map((x) => x.paid);
  if (h.length < 4) return undefined;
  const last3 = avg(h.slice(-3)), prev = avg(h.slice(-6, -3));
  if (prev >= 40 && last3 < prev * 0.65) return `envelope down ${Math.round((1 - last3 / prev) * 100)}% over three weeks`;
  if (h.slice(-3).every((v) => v === 0) && c.jailedUntil <= W().now) return 'nothing for three weeks';
  return undefined;
}
const reliab = (c: Character) => {
  const h = c.books.history.slice(-8);
  if (h.length < 3) return '–';
  const ok = h.filter((x) => x.due === 0 || x.paid >= x.due * 0.9).length / h.length;
  return ok > 0.85 ? 'Solid' : ok > 0.6 ? 'Mostly' : ok > 0.35 ? 'Patchy' : 'Poor';
};
function crewOverview(w: World, p: Character, crew: Character[]): string {
  if (!crew.length) return '';
  const last = crew.map((c) => c.books.history.at(-1)).filter(Boolean) as NonNullable<Character['books']['history'][number]>[];
  const reported = last.reduce((a, h) => a + h.declared, 0);
  const kicks = last.reduce((a, h) => a + h.paid, 0);
  const owed = crew.reduce((a, c) => a + c.books.arrears, 0);
  const ops = w.ops.filter((o) => (o.state === 'running' || o.state === 'out') && (crew.some((c) => c.id === o.runner) || o.owner === p.id)).length;
  const working = crew.filter((c) => activityOf(w, c)).length;
  const stat = (k: string, v: string) => `<div class="cst"><b>${v}</b><span>${k}</span></div>`;
  let out = `<div class="card"><h2>The crew this week<small>what they tell you</small></h2><div class="cstats">${stat('Reported', money(reported))}${stat('Kicked up', money(kicks))}${stat('Outstanding', money(owed))}${stat('Rackets running', String(ops))}${stat('Busy', `${working} of ${crew.length}`)}</div></div>`;
  const rows = crew.map((c) => {
    const h = wk(c);
    const act = activityOf(w, c);
    const opsN = w.ops.filter((o) => o.runner === c.id && (o.state === 'running' || o.state === 'out')).length + (c.hustle && c.bossId === p.id ? 1 : 0);
    const line = c.hustle ? (c.hustle.level > 1 ? 'a growing business' : 'a line of his own') : '';
    return `<tr><td><a href="#" class="nm" data-a="ent:${c.id}" style="text-decoration:none">${esc(c.name.split(' ')[0])}</a><small>${c.nick ? '“' + esc(c.nick) + '” · ' : ''}${act ? esc(act.why) : 'free'}</small></td><td>${h.length ? money(h.at(-1)!.declared) : '–'}</td><td>${h.length ? money(avg(h.map((x) => x.declared))) : '–'}</td><td>${h.length ? money(h.at(-1)!.paid) : '–'}</td><td>${reliab(c)}</td><td>${c.career && c.career.done + c.career.failed > 0 ? `${c.career.done}/${c.career.done + c.career.failed}` : '–'}</td><td title="${esc(line)}">${opsN}</td></tr>`;
  }).join('');
  out += `<h2 class="sect">Side by side<small>declared figures</small></h2><div class="card tbl"><table class="crewt"><thead><tr><th>Man</th><th>Week</th><th>4-wk avg</th><th>Kick-up</th><th>Pays</th><th>Jobs</th><th>Lines</th></tr></thead><tbody>${rows}</tbody></table><p class="muted" style="margin:8px 0 0;font-size:12.5px">These are the numbers they hand you. Tap a name for the full picture.</p></div>`;
  return out;
}

function lendingCard(): string {
  const w = W();
  const p = P();
  const rows = Object.values(w.biz)
    .filter((b) => b.open && b.kind !== 'casino')
    .map((b) => ({ b, o: w.chars[b.ownerId] }))
    .filter(({ o }) => o?.alive && o.rank === 'civilian' && !w.debts.some((d) => d.status === 'active' && d.debtor === o.id))
    .sort((a, c) => Number(c.b.district === p.district) - Number(a.b.district === p.district) || c.b.distress - a.b.distress)
    .slice(0, 8);
  return `<h2 class="sect">Who could use a loan<small>owners with no debts</small></h2><div class="card"><ul class="rows">${rows.map(({ b, o }) => `<li><button class="rowbtn" data-a="talk:${o.id}" style="display:flex;justify-content:space-between;width:100%;text-align:left"><span>${esc(o.name)} <small class="muted">${esc(b.name)}, ${esc(b.district)}</small></span><span class="v ${b.distress > 0.4 ? 'warn' : ''}">${b.distress > 0.6 ? 'struggling' : b.distress > 0.25 ? 'tight' : 'steady'}</span></button></li>`).join('') || '<li class="muted">Everyone around has a lender already.</li>'}</ul><p class="small-note">Tap a name and offer him money. Struggling men take it more readily, and pay back less easily.</p></div>`;
}

function loveView(): string {
  const w = W();
  const p = P();
  const L = w.life;
  if (!L) return '<p class="muted pad">Nothing here yet.</p>';
  const pr = L.partner && L.partner.stage !== 'split' ? L.partner : undefined;
  let out = '';
  if (!pr) {
    const pool = datingPool(w, p);
    out += `<h2 class="sect">Meet someone<small>this week</small></h2><p class="muted pad">Ask a girl out and you spend a little money. The better your name and your manner, the better your odds. A no stays a no for a while.</p><div class="list">`;
    out += pool.list.filter((x) => w.chars[x.id]?.alive).map((x) => { const g = w.chars[x.id]; return `<button class="opt" data-a="askout:${g.id}"><b>${esc(g.name)}</b><span class="because">${esc(x.job)}, ${esc(g.district)}. You see her ${esc(x.where)}. Ask her out ($20).</span></button>`; }).join('');
    out += `</div>`;
    if (L.ex && w.chars[L.ex]) out += `<p class="muted pad">${esc(w.chars[L.ex].name)} is the one you let go.</p>`;
    return out;
  }
  const g = w.chars[pr.id];
  const kids = L.kin.filter((k) => (k.role === 'son' || k.role === 'daughter') && w.chars[k.id]?.alive);
  out += `<div class="card"><div class="pers" style="margin:0">${avatar(g)}<div><h1>${pl(g)}</h1><div class="sub">${esc(stageWord[pr.stage])} &middot; ${esc(warmthWord(pr.warmth))} &middot; ${pr.dates} evening${pr.dates === 1 ? '' : 's'} together</div></div></div>${meterRow('How she feels', warmthWord(pr.warmth), pr.warmth)}${pr.due ? `<p class="muted">She is expecting. ${Math.max(1, Math.ceil((pr.due - w.now) / DAY / 30))} month${Math.ceil((pr.due - w.now) / DAY / 30) > 1 ? 's' : ''} to go.</p>` : ''}</div>`;
  out += `<h2 class="sect">Time together</h2><div class="list">` + DATES.map((d) => `<button class="opt" data-a="dateplan:${d.code}"><b>${esc(d.label)} <small class="muted">$${d.cost}</small></b><span class="because">${esc(d.hint)}</span></button>`).join('') + `</div>`;
  out += `<h2 class="sect">Where this goes</h2><div class="list">`;
  if (pr.stage === 'seeing') out += `<button class="opt" data-a="steady:"><b>Ask her to be your girl</b><span class="because">${pr.dates >= 3 && pr.warmth >= 0.5 ? 'She might say yes.' : 'Too early. A few more evenings first.'}</span></button>`;
  if (pr.stage === 'steady') out += `<button class="opt" data-a="marryask:"><b>Ask her to marry you ($400 ring)</b><span class="because">${pr.dates >= 8 && pr.warmth >= 0.7 ? 'You are both ready.' : 'She isn’t there yet. More time, more evenings.'}</span></button>`;
  if (pr.stage === 'engaged') out += `<button class="opt" data-a="wed:"><b>Hold the wedding ($1,500)</b><span class="because">The whole family will come. They will bring envelopes.</span></button>`;
  if (pr.stage === 'married') out += `<button class="opt" data-a="baby:"><b>${pr.due ? 'She is expecting' : 'Talk about having a baby'}</b><span class="because">${pr.due ? 'Nothing to do but be there.' : 'A child changes what is at stake.'}</span></button>`;
  if (pr.stage !== 'married') out += `<button class="opt danger" data-a="breakoff:"><b>End it</b><span class="because">It is kinder done properly.</span></button>`;
  out += `</div>`;
  if (kids.length) out += `<h2 class="sect">Your children</h2><div class="card"><ul class="rows">${kids.map((k) => `<li><button class="rowbtn" data-a="ent:${k.id}" style="display:flex;justify-content:space-between;width:100%;text-align:left"><span>${esc(w.chars[k.id].name)}</span><span class="v">${esc(kinWord(k).replace('Your ', ''))}</span></button></li>`).join('')}</ul></div>`;
  return out;
}
