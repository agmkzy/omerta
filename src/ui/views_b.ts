import type { Character, World } from '../types';
// Rackets, crew, orders, jobs, talk, meetings, life.
import { owedOf, stakesOf } from '../econ';
import { grudgeWord } from '../actions';
import { RULINGS, SOURCE_LABEL, effectiveRate } from '../books';
import { bgLabel, bgOf } from '../background';
import { repLines } from '../crewlife';
import { careerLines, recommendable, recruitable, rewardOptions, standingTable } from '../career';
import { factText, famName, fmtTime, money, ownerBiz, shortTime } from '../core';
import { GIG_HELP, GIG_LABEL } from '../gigs';
import { KIND_HELP, activityOf, KIND_LABEL, approaches, canQuestion, crewMoves, jobChecks, schemes, traitWords, ventureOf } from '../jobs';
import { available, current as meetCurrent } from '../meetings';
import { PLACES, isOpen, present } from '../places';
import { RECRUIT_COST, dayJobOptions, orderMenu, prospects, reliability } from '../orders';
import { PROBLEM_LABEL, aptitude, lateOf } from '../people';
import { DAY, Id, Job, Kind } from '../types';
import { arch, ARCH_WORD } from '../voice';
import { rel } from '../core';
import { influence, influenceWord } from '../books';
import { SPEC_LABEL, SPEC_PERK, TIER_WORD, specScores, tierOf, Spec } from '../specs';
import { standingWord } from '../jobs';
import { disputesList } from './views_c';
import { avatar, back, banner, sink, meterRow, skillBars, skillLine, strip, traitTags } from './common';
import { bl, chip, esc, fl, known, lk, P, pl, S, statusOf, W, who } from './links';
import { treeView } from './views_a';
import { toSide } from './layout';
import { whereIs } from '../where';
import { kinWord, stageWord, warmthWord, DATES, datingPool } from '../life';
import { canStart, lineOf, OP_GROUPS, OPS } from '../rackets';
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
  // V89: the week ends on Sunday evening, just after the books are settled (the weekly reckoning runs at 20:00): envelopes fall due,
  // and you are there for it, with the rest of Sunday evening and Monday to hand yours over in person.
  const dow = Math.floor(now / DAY) % 7; // 0 = Monday
  let sunday = (Math.floor(now / DAY) + (6 - dow)) * DAY + 20 * 60 + 30;
  if (sunday - now < 60) sunday += 7 * DAY;
  out.push({ label: 'Until Sunday', sub: 'the envelopes, 20:30', mins: sunday - now });
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
  out += `<div class="list">${rep.found ? '' : `<button class="opt" data-a="qrep:${j.id}"><b>Question him</b><span class="because">He may be telling you everything. He may not.</span></button>`}${w.chars[j.assignee]?.alive && !w.chars[j.assignee].isPlayer ? `<button class="opt" data-a="talk:${j.assignee}|tk:job:${j.id}"><b>Talk it over with him</b><span class="because">Face to face: who else was there, how it went, and what you make of it.</span></button>` : ''}<button class="opt" data-a="ack:${j.id}"><b>That’s all</b></button></div>`;
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
    // (the overhaul: a man's row leads to what you would do about him: his money, face to face; his books; work)
    const short = c.books.arrears > 0 || c.books.missed > 0 || (fl_?.amt ?? 0) > 0;
    const acts = [short ? `<button class="go" data-a="talk:${c.id}|tk:earn">His money</button>` : `<button class="go" data-a="talk:${c.id}">See him</button>`, `<button class="go" data-a="books:${c.id}">His books</button>`, `<button class="go" data-a="orders:">Give him work</button>`];
    return `<div class="crewrow"><button class="need" data-a="ent:${c.id}"><span class="dot ${st.dot}"></span><span><span class="t">${esc(c.name)}</span><span class="s" style="display:block">${esc(skillLine(c))} &middot; passes up ${Math.round(effectiveRate(w, c) * 100)}%</span>${flags.length ? `<span style="display:block;margin-top:4px">${flags.join(' ')}</span>` : ''}</span></button><div class="crewrow__acts">${acts.join('')}</div></div>`;
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
  // V88: one row per man: his face, his name and what he is, and the offer.
  out += `<div class="g-people">${ps.map(({ c, note, vouch }) => `<div class="g-person">${avatar(c)}<div class="g-person__t"><b>${pl(c)}</b><span>${esc(c.district)} &middot; ${note} &middot; ${esc(skillLine(c))}</span>${vouch ? '<span class="muted">Ambitious. He’ll want more than a corner.</span>' : ''}</div><button class="mini g-person__go" data-a="hire:${c.id}">Take him on</button></div>`).join('')}</div>`;
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
  // V88: a meeting is a scene. The room and the faces at the table, what is said, and then what you say.
  const seat = (id: Id) => { const c = w.chars[id]; return c ? `<div class="g-seat">${avatar(c)}<span>${esc(c.name.split(' ')[0])}</span><small>${esc(c.rank)}</small></div>` : ''; };
  let out = `<header class="g-meet"><h1 class="page">${esc(m.title)}</h1><div class="g-table" aria-label="At the table">${m.attendees.map(seat).join('')}</div></header>`;
  if (v.lines.length) out += `<section class="g-just g-just--small">${v.lines.map((l) => `<p>${lk(l)}</p>`).join('')}</section>`;
  if (!it) return out + `<h2 class="sect">The meeting is over</h2><div class="him">${m.summary.map((l) => `<p class="say">${lk(l)}</p>`).join('') || '<p class="nar">That’s everything on the table.</p>'}</div><button class="btn primary" data-a="mdone:">Leave</button>`;
  out += `<h2 class="sect">${lk(it.title)}</h2><div class="him">${it.text.map((l) => `<p class="say">${lk(l)}</p>`).join('')}</div>`;
  out += `<div class="list">` + it.opts.map((o, i) => `<button class="opt" data-a="mopt:${i}"><b>${lk(o.label)}</b>${o.hint ? `<span class="because">${esc(o.hint)}</span>` : ''}</button>`).join('') + `<button class="opt nav" data-a="mdone:"><b>Leave early</b></button></div>`;
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
  const fid = S.treeFam ?? p.familyId!;
  const mine = fid === p.familyId;
  // V88: the organisation is the page. Your own place in line lives in Life > Career; the record and the city's shops go beside it.
  let out = (mine ? huntBanner() : '') + treeView(fid);
  if (mine) out += `<div class="list g-famact"><button class="opt" data-a="meet:family"><b>Call on the family</b><span class="because">Hear what’s being decided.</span></button><button class="opt" data-a="career:"><b>Your place in line</b><span class="because">Where you stand for the next rank, and what is holding you back.</span></button></div>`;
  let side = orgCard(fid);
  const shops = Object.values(w.biz).filter((b) => b.open).sort((a, b) => Number(b.district === p.district) - Number(a.district === p.district) || a.district.localeCompare(b.district)).slice(0, S.open['shops'] ? 60 : 8);
  side += `<h2 class="sect">Shops and places<small>${Object.keys(w.biz).length}</small></h2><div class="card"><ul class="rows">${shops.map((b) => `<li><span>${bl(b.id)}<small class="muted"> ${esc(b.district)}</small></span><span class="v">${b.protection ? esc(w.fam[b.protection.familyId].name) : 'unprotected'}</span></li>`).join('')}</ul>${S.open['shops'] ? '' : `<button class="btn" data-a="tog:shops">Show all</button>`}</div>`;
  toSide(side);
  return out;
}

// V89: the Life tab lives in lifeview.ts
export { lifeTab } from './lifeview';

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
  if (r?.alive && !r.isPlayer) out += `<button class="opt" data-a="talk:${r.id}|tk:earn"><b>Talk to ${esc(r.name.split(' ')[0])} about the take</b><span class="because">He runs it. Ask him how it’s going, face to face.</span></button>`;
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
    const opsN = w.ops.filter((o) => o.runner === c.id && (o.state === 'running' || o.state === 'out')).length + (lineOf(w, c) && c.bossId === p.id && lineOf(w, c)!.runner !== c.id ? 1 : 0);
    const line = lineOf(w, c) ? ((lineOf(w, c)!.level ?? 1) > 1 ? 'a growing business' : 'a line of his own') : '';
    return `<tr><td><a href="#" class="nm" data-a="ent:${c.id}" style="text-decoration:none">${esc(c.name.split(' ')[0])}</a><small>${c.nick ? '“' + esc(c.nick) + '” · ' : ''}${act ? esc(act.why) : 'free'}</small></td><td>${h.length ? money(h.at(-1)!.declared) : '–'}</td><td>${h.length ? money(avg(h.map((x) => x.declared))) : '–'}</td><td>${h.length ? money(h.at(-1)!.paid) : '–'}</td><td>${reliab(c)}</td><td>${c.career && c.career.done + c.career.failed > 0 ? `${c.career.done}/${c.career.done + c.career.failed}` : '–'}</td><td title="${esc(line)}">${opsN}</td></tr>`;
  }).join('');
  out += `<h2 class="sect">Side by side<small>declared figures</small></h2><div class="card tbl"><table class="crewt"><thead><tr><th>Man</th><th>Week</th><th>4-wk avg</th><th>Kick-up</th><th>Pays</th><th>Jobs</th><th>Lines</th></tr></thead><tbody>${rows}</tbody></table><p class="muted" style="margin:8px 0 0;font-size:12.5px">These are the numbers they hand you. Tap a name for the full picture.</p></div>`;
  return out;
}
