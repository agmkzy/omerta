import { knowsProtection } from '../acquaint';
import { districtBar, narrow, streetMap, tradeOf } from './streetmap';
import { sundayDue } from './sunday';
import { acts, btn, choices, context, h, kv, meter, note, quiet, rows, title, type KV, type Pick, type Row } from './kit';
import type { Business, Character, World } from '../types';
// Rackets, crew, orders, jobs, talk, meetings, life.
import { owedOf, stakesOf } from '../econ';
import { grudgeWord } from '../actions';
import { RULINGS, SOURCE_LABEL, effectiveRate } from '../books';
import { bgLabel, bgOf } from '../background';
import { repLines } from '../crewlife';
import { careerLines, recommendable, recruitable, rewardOptions, standingTable } from '../career';
import { factText, famName, fmtTime, money, ownerBiz, shortTime } from '../core';
import { GIG_HELP, GIG_LABEL } from '../gigs';
import { KIND_HELP, activityOf, KIND_LABEL, approaches, canQuestion, crewMoves, jobChecks, schemes, summonsAt, traitWords, ventureOf } from '../jobs';
import { available, current as meetCurrent } from '../meetings';
import { PLACES, isOpen, present } from '../places';
import { SLICE, TRACK, openAt, regulars, spotById, spots, whoIsAt, type Spot } from '../city';
import { RECRUIT_COST, dayJobOptions, orderMenu, prospects, reliability } from '../orders';
import { PROBLEM_LABEL, aptitude, lateOf } from '../people';
import { DAY, Id, Job, Kind } from '../types';
import { arch, ARCH_WORD } from '../voice';
import { rel } from '../core';
import { influence, influenceWord } from '../books';
import { SPEC_LABEL, SPEC_PERK, TIER_WORD, specScores, tierOf, Spec } from '../specs';
import { standingWord } from '../jobs';
import { disputesList } from './views_c';
import { avatar, back, banner, sink, meterRow, skillBars, skillLine, traitTags } from './common';
import { bl, chip, esc, fl, known, lk, P, pl, S, statusOf, W, who } from './links';
import { bizView, justNow, treeView, wantsHere } from './views_a';
import { takeSide, toSide } from './layout';
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
  let out = back() + title(c?.label ?? 'Options');
  if (!S.opts.length) return out + quiet(esc(c?.empty ?? 'Nothing available right now.'));
  return out + choices(S.opts.map((o, i) => ({ a: `opt:${i}`, label: o.label })), c?.label ?? 'Options');
}
export interface WaitOpt { label: string; sub: string; mins: number; event?: boolean }
// Four ways to let time pass: the next morning, the next evening (business by day, the life by night), Sunday's reckoning, and a
// week that stops early when anything comes for the player. Anything set for an hour carries its own "Go at" on its card.
export function waitChoices(_full = false): WaitOpt[] {
  const now = W().now;
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const today = Math.floor(now / DAY);
  const when = (at: number) => { const d = Math.floor(at / DAY); return d === today ? 'today' : d === today + 1 ? 'tomorrow' : days[d % 7]; };
  const hhmm = (m: number) => `${String(Math.floor((m % DAY) / 60)).padStart(2, '0')}:${String((m % DAY) % 60).padStart(2, '0')}`;
  // (the next one: at least half an hour off, else the day after)
  const next = (h: number) => { let at = today * DAY + h * 60; if (at - now < 30) at += DAY; return at; };
  const morning = next(9), evening = next(19);
  // V89: the week ends on Sunday evening, just after the books are settled (the weekly reckoning runs at 20:00): envelopes fall due,
  // and you are there for it, with the rest of Sunday evening and Monday to hand yours over in person.
  const dow = today % 7; // 0 = Monday
  let sunday = (today + (6 - dow)) * DAY + 20 * 60 + 30;
  if (sunday - now < 60) sunday += 7 * DAY;
  return [
    { label: 'Morning', sub: `${hhmm(morning)} · ${when(morning)}`, mins: morning - now },
    { label: 'Evening', sub: `${hhmm(evening)} · ${when(evening)}`, mins: evening - now },
    { label: 'Sunday', sub: `the envelopes${sunday - now > 7 * 60 ? '' : ', tonight'}`, mins: sunday - now },
    { label: 'Next week', sub: 'or until something comes up', mins: 7 * DAY, event: true },
  ];
}
export function waitView(): string {
  return back() + title('Let time pass', esc(fmtTime(W().now))) + choices(waitChoices().map((o, i) => ({ a: `waitgo:${i}`, label: o.label, hint: o.sub })), 'How long');
}
export function timeBar(): string {
  return `<div class="timebar">${waitChoices().map((o, i) => `<button data-a="waitgo:${i}"><b>${esc(o.label)}</b><span>${esc(o.sub)}</span></button>`).join('')}</div>`;
}

// --------------------------------------------------------------- rackets

// ------------------------------------------------------------------ plan

export function planView(idx: number, whoId?: Id): string {
  const w = W();
  const o = S.planOpts[idx];
  if (!o) return back() + quiet('That moment has passed.');
  const crew = crewList();
  let out = back() + title(o.label, o.hint ? esc(o.hint) : '');
  const picks: Pick[] = [{ a: `doplan:${idx}|me|quiet`, label: 'Do it myself', hint: 'You’ll choose how to play it.' }];
  // or send a man: how he suits it, whether he turns up, and whether he is free; quietly or by any means
  for (const c of crew) {
    if (whoId && c.id !== whoId) continue;
    const ap = aptitude(c, o.group === 'Cars' ? 'boost' : o.group === 'Burglary' ? 'burgle' : o.group === 'Scams' ? 'scam' : o.group === 'Money' ? 'collect' : 'watch');
    const rl = reliability(w, c);
    const st = statusOf(w, c);
    const act = activityOf(w, c);
    const off = !!act || st.dot === 'red';
    const about = `${aptitudeWord(ap)} for this · ${rl > 0.7 ? 'dependable' : rl > 0.45 ? 'usually turns up' : 'unreliable'}${act ? ` · busy: ${act.why}, free ${shortTime(act.until)}` : ''}${!act && st.word !== 'free' ? ' · ' + st.word : ''}`;
    picks.push({ a: `doplan:${idx}|${c.id}|quiet`, label: `Send ${c.name}, quietly`, hint: about, off }, { a: `doplan:${idx}|${c.id}|hard`, label: `Send ${c.name}, by any means`, hint: 'More likely to work, more likely to go wrong.', off });
  }
  return out + choices(picks, 'Who does it');
}
const aptitudeWord = (v: number) => (v < 0.3 ? 'a poor fit' : v < 0.5 ? 'an ok fit' : v < 0.7 ? 'a good fit' : 'a natural');

export function ordersView(whoId: Id): string {
  const w = W();
  const p = P();
  if (!whoId) {
    const crew = crewList();
    return back() + title('Who do you send?') + (crew.length ? choices(crew.map((c) => { const act = activityOf(w, c); return { a: `orders:${c.id}`, label: c.name, hint: `${skillLine(c)}${act ? ` · busy: ${act.why}, free ${shortTime(act.until)}` : ''}`, off: !!act }; }), 'Who') : quiet('No crew. Find a man worth trusting.'));
  }
  const c = w.chars[whoId];
  S.planOpts = orderMenu(w, p);
  let out = back() + `<header class="pp-head">${avatar(c)}<div class="pp-id">${title(`Orders for ${c.name.split(' ')[0]}`, esc(skillLine(c)))}</div></header>`;
  const groups = ['Money', 'Cars', 'Burglary', 'Scams', 'Watch', 'Other'];
  for (const g of groups) {
    const list = S.planOpts.map((o, i) => [o, i] as const).filter(([o]) => o.group === g);
    if (list.length) out += banner('o:' + g, 'wrench', 'g', g, `${list.length}`, choices(list.map(([o, i]) => ({ a: `plan:${i}|${c.id}`, label: o.label, hint: o.hint })), g));
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
  const kind = j.kind === 'gig' ? GIG_LABEL[String(j.extra?.gig) as keyof typeof GIG_LABEL] ?? 'Opportunity' : KIND_LABEL[j.kind];
  out += `<p class="ui-label">${esc(kind)} · ${esc(VIA[j.via])}</p>${title(j.title)}<p class="jb-brief">${lk(j.brief)}</p>`;
  const help = j.kind === 'gig' ? GIG_HELP[String(j.extra?.gig) as keyof typeof GIG_HELP] ?? '' : KIND_HELP[j.kind] ?? '';
  if (help) out += note(esc(help));
  const facts: KV[] = [];
  if (g && g.id !== p.id) facts.push(['From', who(g)]);
  if (t) facts.push(['About', `${who(t)}${t.hurtUntil > w.now ? ' <b class="hurt">laid up</b>' : ''}`]);
  if (j.biz) facts.push(['Place', bl(j.biz)]);
  if (j.pay > 0) facts.push(['Pays', `<span class="fig">${esc(money(j.pay))}</span>`]);
  if (j.status === 'offered') facts.push(['Answer by', esc(shortTime(j.expires))]);
  out += kv(facts);
  if (j.notes?.length) out += j.notes.map((n) => `<p class="jb-note">${lk(n)}</p>`).join('');
  const picks: Pick[] = [];
  if (canQuestion(j) && (j.status === 'offered' || j.assignee === p.id)) {
    const c = jobChecks(j);
    if (c.ask) picks.push({ a: `jx:${j.id}|ask`, label: 'Ask why', hint: 'Make him explain it to your face.' });
    if (c.press) picks.push({ a: `jx:${j.id}|press`, label: 'Press him', hint: 'That’s not the real reason. Lean on it.' });
    if (c.inv) picks.push({ a: `jx:${j.id}|inv`, label: 'Check it out', hint: 'Takes time. You might not like what you find.' });
    if (c.around) picks.push({ a: `jx:${j.id}|around`, label: 'Ask around', hint: 'Someone you trust, not involved.' });
    if (c.haggle) picks.push({ a: `jx:${j.id}|haggle`, label: 'Push for more money' });
  }
  if (j.kind === 'summons') {
    if (j.status === 'offered') { const at = summonsAt(w, j); picks.push({ a: `attend:${j.id}`, label: at > w.now + 5 ? `Go at ${String(Math.floor((at % DAY) / 60)).padStart(2, '0')}:${String((at % DAY) % 60).padStart(2, '0')}${Math.floor(at / DAY) !== Math.floor(w.now / DAY) ? ' tomorrow' : ''}` : 'Go now', hint: at > w.now + 5 ? 'The time until then passes first.' : 'It takes time. Nobody’s going to fix this for you.' }); picks.push( { a: `excuse:${j.id}`, label: 'Make your excuses', hint: 'He will notice who didn’t come.' }); }
    else out += quiet(`This one is closed (${esc(j.status)}).`);
  } else if (j.status === 'offered' || (j.status === 'active' && j.assignee === p.id)) {
    picks.push({ a: `mine:${j.id}`, label: 'Do it myself', hint: 'You choose how to play it.' });
    if (crewList().length) picks.push({ a: `deleg:${j.id}`, label: 'Hand it to one of my men', hint: 'He does it his way, and reports back.' });
    picks.push(j.status === 'offered' ? { a: `pass:${j.id}`, label: 'Turn it down', hint: 'It goes to someone else.' } : { a: `drop:${j.id}`, label: 'Drop it', hint: 'Whoever was counting on it will remember.' });
  } else if (j.status === 'active') out += quiet(`${lk(w.chars[j.assignee].name)} is handling it${j.orders ? ` (${j.orders === 'hard' ? 'by any means' : 'quietly'})` : ''}. You’ll hear when it’s done.`);
  else out += quiet(`This one is closed (${esc(j.status)}).`);
  if (picks.length) out += h('What you do') + choices(picks, 'What you do');
  return out;
}
export function approachView(j: Job): string {
  return back() + title(j.title, 'How do you want to play it?') + choices(approaches(W(), j).map((a) => ({ a: `go:${j.id}|${a.code}`, label: a.label, hint: a.hint })), 'How you play it');
}
export function delegateView(j: Job): string {
  const w = W();
  return back() + title('Who gets it?', esc(j.title)) + choices(crewList().map((c) => { const act = activityOf(w, c); return { a: `who:${j.id}|${c.id}`, label: c.name, hint: `${skillLine(c)}${act ? ` · busy: ${act.why}, free ${shortTime(act.until)}` : ''}${!act && c.heat > 0.4 ? ' · running hot' : ''}`, off: !!act }; }), 'Who gets it');
}
export function sendView(j: Job, c: ReturnType<typeof W>['chars'][string]): string {
  return back() + title(`Orders for ${c.name}`, `${esc(c.name)} is ${esc(traitWords(c))}. He will report back in a day or two.`) + choices([
    { a: `send:${j.id}|${c.id}|quiet`, label: 'Keep it quiet', hint: 'Careful approach. Less take, less trouble.' },
    { a: `send:${j.id}|${c.id}|hard`, label: 'Get it done', hint: 'Whatever it takes. More likely to work, more likely to go wrong.' },
  ], 'How he does it');
}
export function reportView(j: Job, lines: string[]): string {
  const w = W();
  const rep = j.rep;
  if (!rep) return back() + quiet('Nothing to report.');
  const m = w.chars[rep.by];
  let out = back() + `<header class="pp-head">${avatar(m)}<div class="pp-id">${title(`${m.name} reports`, lk(j.title))}</div></header>`;
  out += `<div class="sc-said"><p class="sc-say">${lk(rep.text)}</p>${lines.map((l) => `<p class="sc-narr">${lk(l)}</p>`).join('')}</div>`;
  if (rep.found) out += context(['You got the truth out of him.']);
  const picks: Pick[] = [];
  if (!rep.found) picks.push({ a: `qrep:${j.id}`, label: 'Question him', hint: 'He may be telling you everything. He may not.' });
  if (w.chars[j.assignee]?.alive && !w.chars[j.assignee].isPlayer) picks.push({ a: `talk:${j.assignee}|tk:job:${j.id}`, label: 'Talk it over with him', hint: 'Face to face: who else was there, how it went, and what you make of it.' });
  picks.push({ a: `ack:${j.id}`, label: 'That’s all', kind: 'out' });
  return out + choices(picks, 'What you do');
}
// ------------------------------------------------------------------ crew

export function crewView(): string {
  const w = W();
  const p = P();
  const crew = crewList();
  if (!crew.length) return quiet('Nobody takes your orders. Yet.') + recruitRows(w, p);
  // the week, in a sentence: what they brought you on Sunday, what they owe, how many have nothing from you
  const last = crew.map((c) => c.books.history.at(-1)).filter(Boolean) as NonNullable<Character['books']['history'][number]>[];
  const brought = last.reduce((a, x) => a + x.paid, 0), owed = crew.reduce((a, c) => a + c.books.arrears, 0);
  const idle = crew.filter((c) => !activityOf(w, c)).length;
  let out = `<p class="cr-week">${last.length ? `Last Sunday your men brought you <b>${esc(money(brought))}</b>.` : 'No Sunday has come round yet.'}${owed ? ` They owe you <b class="hurt">${esc(money(owed))}</b>.` : ''} ${idle ? (idle === crew.length ? (crew.length === 1 ? 'He has no work from you.' : 'None of them has work from you.') : `${idle} of ${crew.length} have no work from you.`) : 'Every man has something to do.'}</p>`;
  // what is wrong, first: short money, a man not himself
  const trouble: Row[] = [];
  const cards: Row[] = [];
  for (const c of crew) {
    const fl_ = p.books.flags[c.id], act = activityOf(w, c), lastC = c.books.history.at(-1);
    const wrong = c.books.arrears > 0 ? `owes you ${money(c.books.arrears)}` : c.books.missed >= 2 ? `${c.books.missed} short Sundays running` : (fl_?.amt ?? 0) > 0 ? `${money(Math.round(fl_!.amt))} unaccounted for` : c.problem?.revealed ? PROBLEM_LABEL[c.problem.kind] : c.problem && c.problem.sev > 0.45 ? 'isn’t himself' : '';
    if (wrong) trouble.push({ face: avatar(c), title: esc(c.name), sub: esc(cap1(wrong)), tone: 'warn', a: wrong.startsWith('owes') || wrong.includes('Sunday') || wrong.includes('unaccounted') ? `talk:${c.id}|tk:earn` : `ent:${c.id}` });
    const tr = crewTrend(c);
    const sunday = !lastC ? 'nothing yet' : lastC.due <= 0 ? 'nothing due on Sunday' : lastC.paid <= 0 ? 'brought nothing' : `brought ${money(lastC.paid)}`;
    cards.push({ face: avatar(c), title: esc(c.name), sub: `${esc(act ? act.why : 'no work from you')} · ${esc(sunday)}${tr ? ` · ${esc(tr)}` : ''}`, end: esc(reliabWord(c)), a: `ent:${c.id}` });
  }
  if (trouble.length) out += h('Needs a word', String(trouble.length)) + rows(trouble);
  out += h('Your men', String(crew.length)) + rows(cards);
  // running the crew: numbered, like every decision
  const ps = prospects(w, p).length;
  const moves = crewMoves(w, p);
  S.moves = moves;
  out += h('Run the crew') + choices([
    { a: 'orders:', label: 'Give orders', hint: idle ? `${idle} ${idle === 1 ? 'man is' : 'men are'} free.` : 'Send a man out on a job.' },
    { a: 'meet:crew', label: 'Call a crew meeting', hint: 'The week, complaints, work.' },
    { a: 'meet:dinner', label: 'Host a dinner', hint: 'Bring people together at your table.' },
    ...(ps ? [{ a: 'recruit:', label: 'Take on a man', hint: `${ps} looking for a start.` }] : []),
    ...moves.map((m, i) => ({ a: `cmove:${i}`, label: m.label })),
  ], 'Run the crew');
  out += recruitRows(w, p);
  out += crewOverview(w, p, crew);
  return out;
}
function recruitRows(w: World, p: Character): string {
  const rc = recommendable(w, p), rk = recruitable(w, p);
  if (!rc.length && !rk.length) return '';
  return h('Build your crew') + rows([
    ...rc.map((c): Row => ({ face: avatar(c), title: `Put ${esc(c.name)} forward`, sub: 'Your name goes with his.', a: `rec:${c.id}` })),
    ...rk.map((c): Row => ({ face: avatar(c), title: `Take on ${esc(c.name)}`, sub: `${esc(c.district)}. He likes you and he wants in.`, a: `recr:${c.id}` })),
  ]);
}
// How a man pays, in a word (from the same record as the figures table)
const reliabWord = (c: Character) => ({ Solid: 'pays solid', Mostly: 'mostly pays', Patchy: 'patchy', Poor: 'poor payer' } as Record<string, string>)[reliab(c)] ?? '';

export function recruitView(): string {
  const w = W();
  const p = P();
  const ps = prospects(w, p);
  let out = back() + `<h2 class="ui-h">Looking for a start</h2><p class="muted pad">Taking a man on costs ${money(RECRUIT_COST)}, and what he does goes against your name.</p>`;
  if (!ps.length) return out + '<p class="muted pad">Nobody is lingering with a question. For now.</p>';
  // V88: one row per man: his face, his name and what he is, and the offer.
  out += `<div class="g-people">${ps.map(({ c, note, vouch }) => `<div class="g-person">${avatar(c)}<div class="g-person__t"><b>${pl(c)}</b><span>${esc(c.district)} &middot; ${note} &middot; ${esc(skillLine(c))}</span>${vouch ? '<span class="muted">Ambitious. He’ll want more than a corner.</span>' : ''}</div><button class="mini g-person__go" data-a="hire:${c.id}">Take him on</button></div>`).join('')}</div>`;
  return out;
}

export function dayjobView(): string {
  const w = W();
  const p = P();
  let out = back() + title('Legitimate work');
  if (p.job) {
    const b = p.job.biz ? w.biz[p.job.biz] : undefined;
    out += h('Your job') + `<p>${esc(p.job.kind)} ${b ? 'at ' + bl(b.id) : 'for ' + pl(w.chars[p.job.boss])}. ${p.job.shifts} shifts.</p>` + meter('Noticed', p.job.noticed > 0.6 ? 'well regarded' : p.job.noticed > 0.3 ? 'getting there' : 'a face', p.job.noticed);
    return out + choices([{ a: 'shift:', label: 'Work a shift', hint: 'A few hours, a little money, and the people who come in.' }, { a: 'quitjob:', label: 'Quit', hint: 'You lose the cover it gives you.', kind: 'danger' }], 'Your job');
  }
  const opts = dayJobOptions(w, p);
  out += note('A real job gets you in rooms nobody invited you into. It doesn’t make you rich.');
  S.jobOpts = opts;
  return out + (opts.length ? choices(opts.map((o, i) => ({ a: `takejob:${i}`, label: o.label, hint: o.hint })), 'Jobs going') : quiet('Nobody’s offering. Earn some trust first.'));
}
export function booksView(id: Id, lines: string[]): string {
  const w = W();
  const p = P();
  const c = w.chars[id];
  if (!c || !c.alive) return back() + quiet('He’s gone.');
  const fl_ = p.books.flags[c.id];
  const hist = c.books.history.slice(-4).reverse();
  let out = back() + `<header class="pp-head">${avatar(c)}<div class="pp-id">${title(`${c.name}'s books`, `Passes up ${Math.round(effectiveRate(w, c) * 100)}% · ${esc(traitWords(c))}`)}</div></header>`;
  const found = [...lines.map((l) => lk(l)), ...(c.books.arrears > 0 ? [`Owes <b>${esc(money(c.books.arrears))}</b>.`] : []), ...(c.books.missed ? [`${c.books.missed} short week${c.books.missed > 1 ? 's' : ''}.`] : []), ...(fl_ && fl_.amt > 0 ? [`<b>${esc(money(Math.round(fl_.amt)))}</b> unaccounted for. You have noticed ${fl_.n} time${fl_.n > 1 ? 's' : ''}.`] : [])];
  out += context(found, !!(fl_ && fl_.amt > 0));
  out += h('What he handed up') + (hist.length ? rows(hist.map((x): Row => ({ title: `Week ${x.week + 1}`, end: `declared <span class="fig">${esc(money(x.declared))}</span>, paid <span class="fig">${esc(money(x.paid))}</span>`, tone: x.due && x.paid < x.due * 0.92 ? 'warn' : '' }))) + note('What he actually earns is his own business until you look.') : quiet('No weeks on record yet.'));
  out += h('What you do') + choices([
    { a: `audit:${c.id}`, label: 'Go through his books', hint: 'Takes an hour. He may take it badly.' },
    ...rewardOptions(w, p, c).map((r): Pick => ({ a: `reward:${c.id}|${r.code}`, label: r.label, hint: r.hint })),
    ...RULINGS.map((r): Pick => ({ a: `rule:${c.id}|${r.code}`, label: r.label, hint: r.hint })),
  ], 'What you do');
  return out;
}
export function helpView(id: Id, lines: string[]): string {
  const w = W();
  const c = w.chars[id];
  if (!c) return back();
  let out = back() + `<header class="pp-head">${avatar(c)}<div class="pp-id">${title(c.name, c.problem?.revealed ? esc(PROBLEM_LABEL[c.problem.kind]) : 'Something is off')}</div></header>`;
  out += `<div class="sc-said">${lines.map((l) => `<p class="sc-narr">${lk(l)}</p>`).join('') || `<p class="sc-narr">${esc(c.name)} has not been right for a while. He will not say why unless you make him.</p>`}</div>`;
  return out + choices([
    { a: `helpdo:${id}|cash`, label: 'Put $400 in his hand', hint: 'Buys loyalty, takes the pressure off.' },
    { a: `helpdo:${id}|duties`, label: 'Take some weight off him', hint: 'Lighter share, less to handle.' },
    { a: `helpdo:${id}|leave`, label: 'Tell him it’s his to sort out', hint: 'He’ll take it as it sounds.' },
  ], 'What you do');
}
// ------------------------------------------------------------------ talk


export function peopleView(): string {
  const w = W();
  const p = P();
  const ids = new Set<Id>(Object.keys(p.rels));
  for (const c of Object.values(w.chars)) if (c.alive && c.bossId === p.id) ids.add(c.id);
  const groups = new Map<string, Row[]>();
  const list = [...ids].map((id) => w.chars[id]).filter((x) => x && x.alive && x.id !== p.id && (x.rank !== 'civilian' || ownerBiz(w, x.id))).sort((a, b) => (p.rels[b.id]?.trust ?? 0) - (p.rels[a.id]?.trust ?? 0)).slice(0, 30);
  for (const x of list) {
    const wh = whereIs(w, p, x);
    const key = wh.kind === 'shop' ? 'shop' : wh.kind;
    // (this screen is for finding a man: his row takes you to him; his page is a tap away from there)
    const r: Row = { face: avatar(x), title: esc(x.name), sub: `${esc(chipText(x.id))}${wh.mins ? ` · ${wh.mins} min away` : ''}`, end: wh.kind === 'jail' ? 'locked up' : esc(wh.name), a: wh.kind === 'jail' ? `ent:${x.id}` : `talk:${x.id}` };
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }
  const HEAD: Record<string, string> = { club: 'At the Social Club', bar: 'At the Corner Bar', barber: 'At the Barber Shop', shop: 'At work', home: 'At home', hurt: 'Laid up', jail: 'Out of reach' };
  let out = back() + title('Who’s where', esc(fmtTime(w.now))) + note('Tap a man to go and find him.');
  for (const k of ['club', 'bar', 'barber', 'shop', 'home', 'hurt', 'jail']) { const g = groups.get(k); if (g) out += h(HEAD[k], String(g.length)) + rows(g); }
  return out;
}
const chipText = (id: Id) => {
  const c = W().chars[id];
  return `${c.rank}${c.familyId ? ', ' + W().fam[c.familyId].name : ''}, ${c.district}`;
};

// ------------------------------------------------------------- club etc.

// Around town. In Little Italy (the district built properly, city.ts) the street's own places, open or shut, with how many men you
// know are in, and every shop on the street; Saturday afternoons, the track. The old rooms stand for everywhere else.
export function placesView(home = false): string {
  const w = W(), p = P();
  const dist = home ? S.sub.street || SLICE : SLICE;
  const sel = home && !narrow() ? S.streetSel : undefined;
  let out = home ? districtBar(dist) + streetMap(dist, sel) : back() + title(SLICE);
  // beside the drawing on a desktop: the place you picked, while the map stays put
  if (home && !narrow()) toSide(sel ? placePane(sel) : `<div class="st-pane st-pane--empty"><p class="pl-blurb">Pick a place on the map to see who’s in, and what you can do there.</p></div>`);
  // when a place keeps its hours, and who is in it, in a phrase: the first man you know by name, and how many more
  const hh = (n: number) => `${n % 24}:00`;
  const hours = (x: Spot) => (openAt(x, w.now) ? `Open till ${hh(x.open[1])}` : x.kind === 'track' ? 'Saturdays' : `Opens ${hh(x.open[0])}`);
  const inside = (x: Spot) => {
    if (!openAt(x, w.now)) return 'Shut';
    const here = whoIsAt(w, x.id), mine = here.filter((c) => (c.rels[p.id]?.known ?? 0) > 0 || c.familyId === p.familyId);
    if (!mine.length) return here.length ? 'Nobody you know' : 'Quiet';
    const first = mine.sort((a2, b2) => (b2.rels[p.id]?.trust ?? 0) - (a2.rels[p.id]?.trust ?? 0))[0];
    return mine.length > 1 ? `${first.name} and ${mine.length - 1} more you know` : `${first.name} is in`;
  };
  const kickOf = (x: Spot) => [x.kind === 'club' ? `The ${w.fam[x.famId!]?.name ?? ''} club` : '', x.on ?? ''].filter(Boolean).join(' · ');
  const act = (id: string) => (home ? `spot:${id}` : `place:${id}`);
  if (dist === SLICE) {
    const pub = spots(w).filter((x) => x.kind !== 'biz');
    if (openAt(TRACK, w.now)) pub.push(TRACK);
    out += h('Places') + rows(pub.map((x): Row => ({ kick: kickOf(x), title: esc(x.name), sub: esc(inside(x)), end: esc(hours(x)), mark: openAt(x, w.now) ? (x.kind === 'club' && x.famId === p.familyId ? 'red' : 'amber') : 'dead', tone: openAt(x, w.now) ? '' : 'dim', a: x.kind === 'track' ? `place:${x.id}` : act(x.id) })));
  } else {
    const clubs = Object.values(w.clubs ?? {}).filter((c) => c.district === dist);
    if (clubs.length) out += h('Clubs') + rows(clubs.map((c): Row => ({ kick: c.familyId === p.familyId ? 'Your family’s club' : `The ${w.fam[c.familyId]?.name ?? ''} club`, title: esc(c.name), mark: c.familyId === p.familyId ? 'red' : 'blue', a: home ? `spot:${c.familyId === p.familyId ? 'club' : 'club:' + c.familyId}` : `tree:${c.familyId}` })));
  }
  // the shops: the ones that pay you first, then your men's, then the rest, folded
  const slice = dist === SLICE;
  const shops = Object.values(w.biz).filter((b) => b.district === dist && b.open).map((b) => ({ b, x: slice ? spots(w).find((x) => x.biz === b.id) : undefined }));
  const payer = (b: Business) => (knowsProtection(w, p, b) && b.protection && b.protection.collectorId !== b.ownerId ? b.protection.collectorId : '');
  const shopRow = ({ x, b }: (typeof shops)[number]): Row => { const o = w.chars[b.ownerId], who = payer(b); return { title: esc(b.name), sub: `${esc(tradeOf(b.kind))}${o ? ` · ${esc(o.name)}` : ''}${who && who !== p.id && w.chars[who]?.bossId !== p.id ? ` · pays ${esc(w.chars[who]?.name ?? 'somebody')}` : ''}`, end: x ? esc(openAt(x, w.now) ? hours(x) : 'Shut') : '', tone: x && !openAt(x, w.now) ? 'dim' : '', a: x ? act(x.id) : home ? `spot:biz:${b.id}` : `biz:${b.id}` }; };
  const yours = shops.filter((s2) => payer(s2.b) === p.id), mens = shops.filter((s2) => payer(s2.b) && w.chars[payer(s2.b)]?.bossId === p.id), rest = shops.filter((s2) => !yours.includes(s2) && !mens.includes(s2));
  if (yours.length) out += h('Paying you', String(yours.length)) + rows(yours.map(shopRow));
  if (mens.length) out += h('Paying your men', String(mens.length)) + rows(mens.map(shopRow));
  if (rest.length) out += `<details class="pp-more"${yours.length + mens.length ? '' : ' open'}><summary>${yours.length + mens.length ? 'The other shops' : 'The shops'} (${rest.length})</summary>${rows(rest.map(shopRow))}</details>`;
  out += h('Elsewhere') + rows([...(home ? [{ title: 'A Card Table', sub: 'Blackjack at the family casinos. The house usually wins.', a: 'bj:' } as Row] : []), ...PLACES.filter((pl_) => !(pl_.id === 'club' && spots(w).some((x) => x.kind === 'club' && x.famId === p.familyId))).map((pl_): Row => ({ title: esc(pl_.name), sub: esc(pl_.blurb), end: isOpen(w, pl_.id) ? 'Open' : 'Shut', tone: isOpen(w, pl_.id) ? '' : 'dim', a: `place:${pl_.id}` }))]);
  return out;
}
// The place you picked on the map, in the pane beside it (desktop): the same page as on its own, without its way back.
export function placePane(id: string): string {
  const w = W();
  const before = takeSide();
  let html: string;
  if (id.startsWith('club:')) { const fam = w.fam[id.slice(5)], cl = Object.values(w.clubs ?? {}).find((c) => c.familyId === fam?.id); html = placeHead(`The ${fam?.name ?? ''} club · ${cl?.district ?? ''}`, cl?.name ?? 'A club', 'Another family’s club. You’d be noticed walking in, and nobody there owes you a word.') + rows([{ title: `The ${esc(fam?.name ?? '')} family`, sub: 'Who runs it, and who stands where.', a: `tree:${fam?.id}` }]); }
  else if (id.startsWith('biz:') && !spotById(w, id)) html = bizView(id.slice(4));
  else html = placeView(id);
  const theirs = takeSide();
  toSide(before);
  return `<div class="st-pane"><button class="st-pane__x" data-a="spot:" aria-label="Close">×</button>${html.replace(/<button class="ui-back"[^>]*>[\s\S]*?<\/button>/, '')}${theirs}</div>`;
}
export function placeView(id: string): string {
  const w = W();
  const p = P();
  const sp = spotById(w, id);
  if (sp) return spotView(sp);
  if (id === 'club') return clubView();
  const pl_ = PLACES.find((x) => x.id === id)!;
  let out = back() + title(pl_.name, esc(pl_.blurb)) + justNow('place:' + id);
  if (!isOpen(w, id)) return out + quiet(`It’s shut. Come back between ${pl_.open[0]}:00 and ${pl_.open[1] % 24}:00.`);
  if (id === 'barber') return out + choices([{ a: 'club:shave', label: 'Get a shave', hint: '$20. You’ll hear things.' }], 'What you do');
  if (id === 'bar') return out + choices([{ a: 'club:drink', label: 'Have a few drinks', hint: '$30. Strangers talk. So do you.' }], 'What you do');
  const here = present(w, p, id);
  out += choices([{ a: 'club:sit', label: 'Sit and listen', hint: 'An hour or two. Things find you here.' }], 'What you do');
  if (!here.length) return out + quiet('Nobody you know is in right now.');
  return out + h('Who’s in', String(here.length)) + rows(here.map((c): Row => ({ face: avatar(c), title: esc(c.name), sub: `${esc(c.rank)} · ${esc(ARCH_WORD[arch(c)])}`, a: `talk:${c.id}` })));
}
// A place on the street (the redesign): the place itself, who is in, and what you can do there. The people come first: the place
// gives the conversation a setting, the conversation is the play.
export const placeHead = (kick: string, name: string, blurb: string) => `<header class="pl-head"><span class="pl-kick">${esc(kick)}</span><h1 class="ui-title">${esc(name)}</h1>${blurb ? `<p class="pl-blurb">${esc(blurb)}</p>` : ''}</header>`;
const hhmmAt = (w: World, t: number) => `${String(Math.floor((t % DAY) / 60)).padStart(2, '0')}:${String((t % DAY) % 60).padStart(2, '0')}${Math.floor(t / DAY) !== Math.floor(w.now / DAY) ? ' tomorrow' : ''}`;
export const waitPicks = (w: World, p: Character, id: string): Pick[] => regulars(w, p, id).map((r) => ({ a: `waitfor:${id}|${r.c.id}`, label: `Wait for ${r.c.name}`, hint: `He usually comes in around ${hhmmAt(w, r.at)}.` }));
function spotView(sp: Spot): string {
  const w = W(), p = P();
  if (sp.kind === 'club' && sp.famId === p.familyId) return clubView();
  const b = sp.biz ? w.biz[sp.biz] : undefined, owner = b ? w.chars[b.ownerId] : undefined;
  const open = openAt(sp, w.now);
  const pays = b && knowsProtection(w, p, b) && b.protection && b.protection.collectorId !== b.ownerId ? (b.protection.collectorId === p.id ? 'pays you' : `pays ${w.chars[b.protection.collectorId]?.name ?? 'somebody'}`) : '';
  const kick = [sp.kind === 'club' ? `The ${w.fam[sp.famId!]?.name ?? ''} club` : b ? tradeOf(b.kind) : '', sp.on ?? (b ? b.district : ''), open ? `open till ${sp.open[1] % 24}:00` : 'shut'].filter(Boolean).join(' · ');
  const blurb = b ? `${owner ? `${owner.name}’s place` : 'A shop'}${pays ? `. It ${pays}` : ''}.` : sp.blurb;
  let out = back() + placeHead(kick, sp.name, blurb) + justNow('place:' + sp.id);
  const waits = sp.kind === 'biz' ? [] : waitPicks(w, p, sp.id);
  if (!open) return out + quiet(sp.kind === 'track' ? 'The track runs on Saturday afternoons.' : sp.kind === 'biz' ? `It keeps ${sp.open[0]}:00 to ${sp.open[1] % 24}:00.` : `It opens at ${sp.open[0]}:00.`) + (waits.length ? h('Who comes in') + choices(waits, 'Who comes in') : '');
  const here = whoIsAt(w, sp.id);
  const doing: Pick[] = [];
  if (sp.kind === 'biz' && owner?.alive && here.some((c) => c.id === owner.id)) doing.push({ a: `talk:${owner.id}`, label: `Talk to ${owner.name.split(' ')[0]}`, hint: 'He’s behind the counter.' });
  if (sp.kind === 'cafe' || sp.kind === 'bar') doing.push({ a: 'club:drink', label: sp.kind === 'cafe' ? 'Sit at the window with a coffee' : 'Have a few drinks', hint: sp.kind === 'cafe' ? '$30 with the pastries. The street goes past; so does what it’s saying.' : '$30. Strangers talk. So do you.' });
  if (sp.kind === 'barber') doing.push({ a: 'club:shave', label: 'Get a shave', hint: '$20. You’ll hear things.' });
  doing.push(...waits);
  out += wantsHere(new Set(here.map((c) => c.id)));
  const people = here.filter((c) => !(owner && c.id === owner.id && doing.some((d) => d.a === `talk:${owner.id}`)));
  if (people.length) out += h('Who’s in', String(people.length)) + rows(people.map((c): Row => ({ face: avatar(c), title: esc(c.name), sub: `${c.rank === 'civilian' ? 'civilian' : `${esc(c.rank === 'capo' ? 'captain' : c.rank)}${c.familyId && c.familyId !== p.familyId ? `, ${esc(famName(w, c))}` : ''}`} · ${esc(ARCH_WORD[arch(c)])}`, a: `talk:${c.id}` })));
  else out += quiet(sp.kind === 'church' ? 'Mass is over, or hasn’t started. An old woman lights a candle.' : 'Nobody you’d know is in right now.');
  if (sp.kind === 'club') out += note(`You’d be noticed walking in. Men here talk to you if they choose to.`);
  if (doing.length) out += h('What you do') + choices(doing, 'What you do');
  return out;
}
export function grudgesView(): string {
  const w = W();
  const p = P();
  const xs: { c: ReturnType<typeof W>['chars'][string]; why: string; sev: number }[] = [];
  for (const f of Object.values(w.facts)) {
    if (f.victim !== p.id || !f.actor || !p.known[f.id] || !['beating', 'robbery', 'vandalism', 'poach'].includes(f.kind)) continue;
    if (!p.known[f.id].knowsActor) continue;
    const c = w.chars[f.actor];
    if (!c || !c.alive || c.familyId === p.familyId) continue;
    xs.push({ c, why: factText(f, true), sev: p.rels[c.id]?.grudge ?? 0.3 });
  }
  for (const [id, r] of Object.entries(p.rels)) if (r.grudge >= 0.35 && w.chars[id]?.alive && !xs.some((x) => x.c.id === id)) xs.push({ c: w.chars[id], why: 'You haven’t forgotten him.', sev: r.grudge });
  xs.sort((a, b) => b.sev - a.sev);
  let out = back() + title('What you haven’t forgotten');
  if (!xs.length) return out + quiet('Nobody has crossed you. Yet.');
  // a made man cannot be touched on your own say-so: what you can do is ask
  return out + choices(xs.slice(0, 8).map((r): Pick => isMade(r.c) && !sanctioned(w, p, r.c)
    ? { a: `perm:${r.c.id}`, label: `Ask permission to deal with ${r.c.name}`, hint: `${r.why} He is a made man: you cannot touch him on your own say-so.` }
    : { a: `settle:${r.c.id}`, label: `Settle it with ${r.c.name}`, hint: r.why, kind: 'danger' }), 'Who');
}
// ----------------------------------------------------------- meetings

export function meetingView(v: Extract<typeof S.view, { t: 'meeting' }>): string {
  const w = W();
  const m = v.m;
  const it = meetCurrent(m);
  // a meeting is a scene: the room and the faces at the table, what is said, and then what you say
  const seat = (id: Id) => { const c = w.chars[id]; return c ? `<div class="g-seat">${avatar(c)}<span>${esc(c.name.split(' ')[0])}</span><small>${esc(c.rank)}</small></div>` : ''; };
  let out = `<header class="g-meet">${title(m.title)}<div class="g-table" aria-label="At the table">${m.attendees.map(seat).join('')}</div></header>`;
  if (v.lines.length) out += `<div class="sc-said">${v.lines.map((l) => `<p class="sc-narr">${lk(l)}</p>`).join('')}</div>`;
  if (!it) return out + h('The meeting is over') + `<div class="sc-said">${m.summary.map((l) => `<p class="sc-say">${lk(l)}</p>`).join('') || '<p class="sc-narr">That’s everything on the table.</p>'}</div>` + choices([{ a: 'mdone:', label: 'Leave', hint: 'Back to the street.' }], 'Where now');
  out += h(it.title) + `<div class="sc-said">${it.text.map((l) => `<p class="sc-say">${lk(l)}</p>`).join('')}</div>`;
  return out + choices([...it.opts.map((o, i): Pick => ({ a: `mopt:${i}`, label: o.label, hint: o.hint })), { a: 'mdone:', label: 'Leave early', kind: 'out' }], 'What you say');
}
export function guestsView(picked: Id[]): string {
  const w = W();
  const p = P();
  const kn = Object.entries(p.rels).map(([id, r]) => [w.chars[id], r] as const).filter(([c]) => c && c.alive && c.rank !== 'civilian' && c.id !== p.id).sort((a, b) => b[1].trust - a[1].trust).slice(0, 14);
  let out = back() + title('Who’s coming?', 'Pick up to four. Dinner costs $70 a head. People who dislike each other will sit at the same table, and that’s rarely quiet.');
  out += choices(kn.map(([c]) => ({ a: `gpick:${c.id}`, label: c.name, hint: `${c.rank}${available(w, c) ? '' : ' · not free'}`, sel: picked.includes(c.id) })), 'Guests');
  return out + acts(btn('ghost:', `Host dinner${picked.length ? ` (${money(70 * picked.length)})` : ''}`, 'primary', picked.length < 2 ? ' disabled' : ''));
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
  row('In the chair', r.leaderSince > 0 ? (years < 0.1 ? 'a few weeks' : `${years} year${years === 1 ? '' : 's'}`) : 'since before your time');
  if (r.hq) row('Headquarters', `${esc(r.hq.name)} <small class="muted">${esc(r.hq.district)}</small>`);
  row('Weight in the city', `${Math.round(r.standing)}<small class="muted">/100</small>`);
  if (mine && RANKS_SEE_FUND.includes(p.rank)) row('Family fund', money(r.treasury));
  const rel = Object.entries(r.relations).filter(([id, x]) => w.fam[id] && (x.deals.length || x.grievance > 0.25 || x.coop > 0.3)).slice(0, 3);
  for (const [id, x] of rel) row(`The ${esc(w.fam[id].name)}`, x.coop > x.comp + 0.15 && x.grievance < 0.3 ? 'friendly' : x.grievance > 0.3 ? 'a grievance' : x.comp > 0.3 ? 'rivals' : 'at ease');
  const hist = r.hist.slice(-3).reverse().map((e) => `<li class="muted"><small>${esc(e.text)}</small></li>`).join('');
  return `<div class="ui-card"><h2>The ${esc(r.name)} family${r.history && !/^The \w+ family\.?$/.test(r.history) ? `<small>${esc(r.history)}</small>` : ''}</h2><ul class="ui-list">${rows.join('')}${hist}</ul></div>`;
}
const RANKS_SEE_FUND = ['soldier', 'capo', 'underboss', 'boss'];
export function familyTab(): string {
  const w = W();
  const p = P();
  const fid = S.treeFam ?? p.familyId!;
  const mine = fid === p.familyId;
  // V88: the organisation is the page. Your own place in line lives in Life > Career; the record and the city's shops go beside it.
  let out = (mine ? huntBanner() : '') + treeView(fid);
  if (mine) out += h('The family and you') + rows([
    { title: 'Call on the family', sub: 'Hear what’s being decided.', a: 'meet:family' },
    { title: 'Your place in line', sub: 'Where you stand for the next rank, and what is holding you back.', a: 'career:' },
    ...(sundayDue() ? [{ title: 'Sunday at the social club', sub: 'The envelopes are coming in.', a: 'sunday:', mark: 'amber' } as Row] : []),
  ]);
  toSide(orgCard(fid));
  return out;
}
// The city's shops and who holds them, as far as you know (in More: reference, not play)
export function cityShops(): string {
  const w = W(), p = P();
  const shops = Object.values(w.biz).filter((b) => b.open).sort((a, b) => Number(b.district === p.district) - Number(a.district === p.district) || a.district.localeCompare(b.district) || a.name.localeCompare(b.name));
  return title('The city’s shops', 'Who holds each, as far as you know.') + rows(shops.slice(0, S.open['shops'] ? 200 : 25).map((b): Row => ({ title: esc(b.name), sub: esc(b.district), end: !knowsProtection(w, p, b) ? '' : b.protection ? esc(w.fam[b.protection.familyId].name) : 'nobody', a: `biz:${b.id}` }))) + (shops.length > 25 && !S.open['shops'] ? acts(btn('tog:shops', `All ${shops.length}`, 'quiet')) : '');
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
  let out = back() + title(d.label, esc(d.blurb));
  out += kv([['Start-up', d.cost ? `<span class="fig">${esc(money(d.cost))}</span>` : 'nothing'], ['Typical week', `about <span class="fig">${esc(money(d.base))}</span>`, 'good'], ['Attention', d.heat < 0 ? 'lowers heat' : d.heat > 0.03 ? 'high' : 'some', d.heat > 0.03 ? 'warn' : '']]);
  out += h('Where') + `<div class="ui-seg" role="group" aria-label="Where">${dists.map((x) => `<button class="ui-seg__b${S.opDist === x ? ' is-on' : ''}" data-a="opdist:${esc(x)}" aria-pressed="${S.opDist === x}">${esc(x)}</button>`).join('')}</div>`;
  out += h('Who runs it') + choices([{ a: 'oprun:me', label: 'You', hint: 'Nobody skims. But you’re the one they come for.', sel: S.opRunner === 'me' }, ...crewList().map((c) => ({ a: `oprun:${c.id}`, label: c.name, hint: `${skillLine(c)}${c.problem && c.problem.sev > 0.4 ? ' · has something on his mind' : ''}`, sel: S.opRunner === c.id }))], 'Who runs it');
  if (err) out += context([esc(err)], true);
  return out + acts(btn(`opgo:${kind}`, `Start it${d.cost ? ` (${money(d.cost)})` : ''}`, 'primary', err ? ' disabled' : ''));
}
export function opView(id: Id, lines: string[], found?: number): string {
  const w = W();
  const op = w.ops.find((o) => o.id === id);
  if (!op) return back() + quiet('It’s gone.');
  const d = OPS[op.kind as keyof typeof OPS];
  const r = op.runner ? w.chars[op.runner] : undefined;
  let out = back() + title(d?.label ?? 'Job');
  out += kv([['Where', esc(op.district)], ['Run by', r ? pl(r) : 'you'], ['Last week', `<span class="fig">${esc(money(op.last))}</span>`, op.last < 0 ? 'warn' : 'good'], ['Since you started', `<span class="fig">${esc(money(op.total))}</span> in ${op.weeks} weeks`], ['Status', op.state === 'raided' ? 'shut down by police' : op.state === 'closed' ? 'closed' : 'running', op.state === 'raided' ? 'warn' : '']]);
  if (lines.length) out += `<div class="sc-said">${lines.map((l) => `<p class="sc-narr">${lk(l)}</p>`).join('')}</div>`;
  if (op.state === 'closed') return out;
  const picks: Pick[] = [];
  if (r?.alive && !r.isPlayer) picks.push({ a: `talk:${r.id}|tk:earn`, label: `Talk to ${r.name.split(' ')[0]} about the take`, hint: 'He runs it. Ask him how it’s going, face to face.' });
  if (r) picks.push({ a: `opcount:${op.id}`, label: 'Go through the count', hint: 'An hour with the figures. He may not like being checked.' });
  if (found !== undefined && found > 30 && r) picks.push({ a: `oprule:${op.id}|repay|${found}`, label: 'Make him pay it back' }, { a: `oprule:${op.id}|warn|${found}`, label: 'Tell him it stops' }, { a: `oprule:${op.id}|fire|${found}`, label: 'Take it off him' });
  picks.push({ a: `opclose:${op.id}`, label: 'Shut it down', hint: 'It stops paying, and stops drawing attention.', kind: 'danger' });
  return out + h('What you do') + choices(picks, 'What you do');
}
export function hijackView(picked: Id[]): string {
  const w = W();
  const crew = crewList().filter((c) => c.jailedUntil <= w.now && c.hurtUntil <= w.now);
  let out = back() + title('Who goes?', 'Pick two or three. Drivers and muscle do best. They’ll tell you what happened, and you’ll have to decide if you believe them.');
  out += choices(crew.map((c) => ({ a: `hjpick:${c.id}`, label: c.name, hint: skillLine(c), sel: picked.includes(c.id) })), 'Who goes');
  return out + acts(btn('hjgo:', 'Send them', 'primary', picked.length < 2 ? ' disabled' : ''));
}
export function settleView(id: Id, lines: string[], kill = false): string {
  const w = W();
  const p = P();
  const x = w.chars[id];
  if (!x || !x.alive) return back() + quiet('That’s settled by other means.');
  const why = Object.values(w.facts).filter((f) => f.victim === p.id && f.actor === x.id && p.known[f.id]).sort((a, b) => b.t - a.t)[0];
  let out = back() + `<header class="pp-head">${avatar(x)}<div class="pp-id">${title(`Settle it with ${x.name}`)}</div></header>`;
  out += context([why ? lk(why.text) : 'There’s bad blood. Nothing specific you can point to.', `${esc(cap1(grudgeWord(rel(x, p.id)?.grudge ?? 0)))} grudge on his side, ${esc(grudgeWord(rel(p, x.id)?.grudge ?? 0))} on yours.`]);
  if (lines.length) out += `<div class="sc-said">${lines.map((l) => `<p class="sc-narr">${lk(l)}</p>`).join('')}</div>`;
  return out + choices(settleOptions(w, p, x, kill).map((o): Pick => ({ a: `sv:${o.code}|${x.id}`, label: o.label, hint: o.hint, kind: o.danger ? 'danger' : '' })), 'What you do');
}
const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
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
  void stat; void reported; void kicks; void owed; void ops; void working;
  let out = '';
  const rows = crew.map((c) => {
    const h = wk(c);
    const act = activityOf(w, c);
    const opsN = w.ops.filter((o) => o.runner === c.id && (o.state === 'running' || o.state === 'out')).length + (lineOf(w, c) && c.bossId === p.id && lineOf(w, c)!.runner !== c.id ? 1 : 0);
    const line = lineOf(w, c) ? ((lineOf(w, c)!.level ?? 1) > 1 ? 'a growing business' : 'a line of his own') : '';
    return `<tr><td><a href="#" class="nm" data-a="ent:${c.id}" style="text-decoration:none">${esc(c.name)}</a><small>${c.nick ? '“' + esc(c.nick) + '” · ' : ''}${act ? esc(act.why) : 'free'}</small></td><td>${h.length ? money(h.at(-1)!.declared) : '–'}</td><td>${h.length ? money(avg(h.map((x) => x.declared))) : '–'}</td><td>${h.length ? money(h.at(-1)!.paid) : '–'}</td><td>${reliab(c)}</td><td>${c.career && c.career.done + c.career.failed > 0 ? `${c.career.done}/${c.career.done + c.career.failed}` : '–'}</td><td title="${esc(line)}">${opsN}</td></tr>`;
  }).join('');
  out += `<details class="pp-more"><summary>The figures, side by side</summary><div class="ui-card tbl"><table class="crewt"><thead><tr><th>Man</th><th>Week</th><th>4-wk avg</th><th>Kick-up</th><th>Pays</th><th>Jobs</th><th>Lines</th></tr></thead><tbody>${rows}</tbody></table><p class="muted" style="margin:8px 0 0;font-size:12.5px">These are the numbers they hand you. Tap a name for the full picture.</p></div></details>`;
  return out;
}
