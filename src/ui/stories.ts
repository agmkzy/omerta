import { asker, askee, read as mRead, titleOf as mTitle } from '../matters';
import { money } from '../core';
// Stories: every ongoing matter in one place. Where it began, where it stands, what happened since, what you can do.
import { dangerLevel, LADDER_WORDS } from '../danger';
import { shortTime } from '../core';
import { PROBLEM_LABEL } from '../people';
import { DAY, Character, Dispute, Id, World } from '../types';
import { back } from './common';
import { movesFor, visibleTo, isParty, knownFacts } from '../sitmoves';
import { isOpen, titleOf } from '../situ';
import { esc, lk, P, pl, S, W } from './links';
import { myDisputes, seatStoryKeys, seatStage, stageOf, WORD } from './views_c';

type Tone = 'red' | 'amber' | 'blue' | 'green' | '';
export interface Story {
  key: string;
  kind: 'dispute' | 'seat' | 'debt' | 'crew' | 'threat' | 'hunt' | 'turf' | 'matter';
  title: string;
  stage: string;
  tone: Tone;
  closed?: boolean;
  last: number;
  lastText: string;
  timeline: { t: number; text: string }[];
  blurb?: string;
  why?: string; // why it is on your list at all
  actions?: { a: string; label: string; hint: string }[];
}

const known = (w: World, p: Character, f: (x: import('../types').Fact) => boolean) =>
  Object.keys(p.known).map((id) => w.facts[id]).filter((x) => x && f(x)).sort((a, b) => b.t - a.t);

function debtStories(w: World, p: Character): Story[] {
  const out: Story[] = [];
  for (const d of w.debts ?? []) {
    if (d.creditor !== p.id && d.debtor !== p.id) continue;
    if (d.status !== 'active' && d.status !== 'defaulted') continue;
    const mine = d.creditor === p.id;
    const other = w.chars[mine ? d.debtor : d.creditor];
    if (!other) continue;
    const facts = known(w, p, (f) => /^(loan|debt_)/.test(f.kind) && [f.actor, f.victim].includes(other.id) && [f.actor, f.victim].includes(p.id) && w.now - f.t < 120 * DAY);
    const stage = d.status === 'defaulted' ? 'Defaulted' : d.missed > 0 ? `${d.missed} payment${d.missed > 1 ? 's' : ''} missed` : 'Paying on time';
    const tl = facts.map((f) => ({ t: f.t, text: f.text }));
    out.push({
      key: 'debt:' + d.id, kind: 'debt', title: mine ? `${other.name.split(' ')[0]} owes you` : `You owe ${other.name.split(' ')[0]}`,
      stage, tone: d.status === 'defaulted' || d.missed > 1 ? 'red' : d.missed ? 'amber' : 'green',
      last: tl[0]?.t ?? d.nextDue - 7 * DAY, lastText: tl[0]?.text ?? d.reason,
      timeline: tl, blurb: `${mine ? 'Lent' : 'Borrowed'} $${Math.round(d.principal).toLocaleString()} (${d.reason}). Still owing $${Math.round(d.balance).toLocaleString()}; $${Math.round(d.weeklyPayment)} a week, next due ${shortTime(d.nextDue)}.`,
      actions: [{ a: `talk:${other.id}`, label: `Go and see ${other.name.split(' ')[0]}`, hint: mine ? 'Remind him, give him time, or lean on him.' : 'Talk terms before it gets worse.' }, { a: `ent:${other.id}`, label: 'Look at his record', hint: 'What he’s into, who he answers to.' }],
    });
  }
  return out;
}

function crewStories(w: World, p: Character): Story[] {
  const out: Story[] = [];
  for (const c of Object.values(w.chars)) {
    if (!c.alive || c.bossId !== p.id) continue;
    const prob = c.problem?.revealed ? c.problem : undefined;
    const flag = p.books.flags[c.id];
    const recent = !!c.cooldown.helped && w.now - c.cooldown.helped < 14 * DAY;
    if (!prob && !flag?.amt && !recent) continue;
    const settled = !prob && !flag?.amt;
    const facts = known(w, p, (f) => (f.actor === c.id || f.victim === c.id || f.story === 'man:' + c.id) && w.now - f.t < 90 * DAY && f.kind !== 'report' || f.story === 'man:' + c.id);
    const tl = facts.map((f) => ({ t: f.t, text: f.text }));
    const bits: string[] = [];
    if (prob) bits.push(`You know he’s ${PROBLEM_LABEL[prob.kind]}.`);
    if (flag?.amt) bits.push(`About $${Math.round(flag.amt).toLocaleString()} doesn’t add up in what he hands over.`);
    out.push({
      key: 'man:' + c.id, kind: 'crew', title: `Trouble with ${c.name.split(' ')[0]}`,
      closed: settled,
      stage: settled ? 'Resolved. He’s back on his feet' : flag?.amt ? 'Money is missing' : (c.cooldown.helped && w.now - c.cooldown.helped < 45 * DAY) ? (prob && prob.sev > 0.5 ? 'You helped. It’s still bad' : 'You helped. It’s easing') : 'You know. He may not know you know', tone: settled ? 'green' : flag?.amt ? 'red' : (c.cooldown.helped && w.now - c.cooldown.helped < 45 * DAY) ? 'blue' : 'amber',
      last: tl[0]?.t ?? (prob?.since ?? w.now), lastText: tl[0]?.text ?? bits[0], timeline: tl, blurb: bits.join(' '),
      actions: [{ a: `talk:${c.id}`, label: `Talk to ${c.name.split(' ')[0]}`, hint: 'Face to face. How you handle it sets what he does next.' }, { a: `ent:${c.id}`, label: 'Look at his record', hint: 'Earnings, jobs, who he runs with.' }],
    });
  }
  return out;
}

function threatStories(w: World, p: Character): Story[] {
  const dg = dangerLevel(w);
  if (dg.level < 1 || !dg.who) return [];
  const e = dg.who;
  const facts = known(w, p, (f) => f.actor === e.id && f.victim === p.id && w.now - f.t < 90 * DAY);
  const tl = facts.map((f) => ({ t: f.t, text: f.text }));
  return [{
    key: 'threat:' + e.id, kind: 'threat', title: `${e.name.split(' ')[0]} is after you`, stage: `${LADDER_WORDS[dg.level][0].toUpperCase()}${LADDER_WORDS[dg.level].slice(1)}`, tone: 'red',
    last: tl[0]?.t ?? w.threats[e.id]?.last ?? w.now, lastText: tl[0]?.text ?? `${e.name} wants you gone.`, timeline: tl,
    blurb: 'It doesn’t stop by itself. Each step on the ladder is closer to the last one.',
    actions: [{ a: `talk:${e.id}`, label: `Find ${e.name.split(' ')[0]} and talk`, hint: 'Make amends, or make it worse.' }, { a: `ent:${e.id}`, label: 'Look at him', hint: 'Where he is, who stands behind him.' }, { a: 'grudges:', label: 'Settle a score', hint: 'End it on your terms.' }],
  }];
}

function huntStories(w: World, p: Character): Story[] {
  const out: Story[] = [];
  for (const f of Object.values(w.fam)) {
    const h = f.hunt;
    if (!h || h.target !== p.id) continue;
    const hunters = Object.values(w.threats).map((t) => w.chars[t.enemy]).filter((c) => c?.alive && c.familyId === f.id && (w.threats[c.id]?.level ?? 0) > 0);
    const facts = known(w, p, (x) => x.story === 'hunt:' + f.id || (x.victim === p.id && hunters.some((c) => c.id === x.actor)));
    const tl = facts.map((x) => ({ t: x.t, text: x.text }));
    const sev = h.sev >= 4 ? 'They mean to kill you' : h.sev >= 2 ? 'They want you gone' : 'They want an answer';
    out.push({
      key: 'hunt:' + f.id, kind: 'hunt', title: `The ${f.name} family wants you`, stage: sev, tone: 'red',
      last: tl[0]?.t ?? h.since, lastText: tl[0]?.text ?? h.why, timeline: tl,
      blurb: `${h.why} ${hunters.length ? `Closest to you: ${hunters.map((c) => c.name.split(' ')[0]).join(', ')}.` : ''} It runs until it’s answered, bought off, or it finds you.`,
      actions: [
        ...(f.id !== p.familyId && p.bossId && w.chars[p.bossId]?.alive ? [{ a: `talk:${p.bossId}`, label: 'Go to your boss', hint: 'He may speak for you. It won’t be free.' }] : []),
        ...hunters.slice(0, 2).map((c) => ({ a: `talk:${c.id}`, label: `Face ${c.name.split(' ')[0]}`, hint: 'Make amends, buy time, or make it worse.' })),
        { a: 'grudges:', label: 'Move first', hint: 'Hurt them before they hurt you.' },
      ],
    });
  }
  return out;
}

function turfStories(w: World, p: Character): Story[] {
  const out: Story[] = [];
  for (const s of w.situations ?? []) {
    if (s.kind !== 'turf' || !s.biz || !s.fam) continue;
    const closed = s.stage === 'resolved';
    if (closed && w.now - (s.resolvedAt ?? 0) > 30 * DAY) continue;
    const b = w.biz[s.biz], rv = s.rivalMan ? w.chars[s.rivalMan] : undefined, fam = w.fam[s.fam];
    if (!b || !fam) continue;
    const facts = known(w, p, (f) => f.business === b.id && w.now - f.t < 60 * DAY && f.kind !== 'gambling_loss');
    const tl = facts.map((f) => ({ t: f.t, text: f.text }));
    const stage = closed ? (s.how === 'closed' ? `Lost to the ${fam.name} family` : s.how === 'helped' ? 'You held it' : 'Settled') : s.stage === 'asking' ? 'Waiting on your answer' : 'They’re testing the line';
    out.push({
      key: 'turf:' + s.id, kind: 'turf', title: `${b.name}: the ${fam.name} family`, stage, tone: closed ? '' : s.stage === 'asking' ? 'red' : 'amber', closed,
      last: tl[0]?.t ?? s.since, lastText: tl[0]?.text ?? s.cause, timeline: tl,
      blurb: `${s.cause.replace(/^./, (m) => m.toUpperCase())}. ${rv ? `The man doing it is ${rv.name}.` : ''}`,
      why: 'It’s a shop that pays you or your family, and someone is trying to take it.',
      actions: rv ? [{ a: `talk:${rv.id}`, label: `Find ${rv.name.split(' ')[0]} and talk`, hint: 'Parley, pay him off, or tell him what happens next.' }, { a: `ent:${b.ownerId}`, label: 'See the owner', hint: 'Keep him steady.' }] : [],
    });
  }
  return out;
}

// Matters between other people that you are in or have been told about. Only what you know is shown, never how it will end.
// V89: an ask (matters.ts) as the player sees it: where it stands in words, what he has learned of it, and the way back to the man.
function askStory(w: World, p: Character, s: import('../types').Situation, closed: boolean, tl: { t: number; text: string }[]): Story | undefined {
  const a = asker(w, s), t = askee(w, s);
  if (!a || !t) return undefined;
  const mine = a.id === p.id, his = t.id === p.id, other = mine ? t : his ? a : undefined;
  const S = s.st?.[mine ? t.id : a.id];
  const where = closed ? (s.out === 'agreed' || s.out === 'gave in' ? 'Settled' : 'Over')
    : his ? (s.ask ? 'Waiting on your answer' : 'He wants something from you')
    : mine ? (S?.last === 'counter' ? `He offered ${money(Number(s.m?.offer ?? 0))}` : S?.last === 'stall' ? 'He asked for time' : S?.last === 'no' ? 'He turned you down' : S?.last === 'help' || s.m?.help ? 'He went to someone' : 'Open')
    : 'You’ve heard about it';
  return {
    key: 'sit:' + s.id, kind: 'matter', title: mTitle(w, s), closed, stage: where,
    tone: closed ? '' : his || s.m?.help ? 'red' : 'amber', last: tl[0]?.t ?? s.since, lastText: tl[0]?.text ?? s.cause, timeline: tl,
    blurb: `${s.cause.replace(/^./, (m) => m.toUpperCase())}.${mine && !closed ? ` He is ${mRead(w, s, t.id)}.` : ''}${!mine && !his && !closed ? ' What you have is what people say.' : ''}`,
    why: mine ? 'You started it.' : his ? 'It is put to you.' : 'It concerns people around you.',
    actions: closed || !other ? [] : [{ a: `talk:${other.id}`, label: `Go and see ${other.name.split(' ')[0]}`, hint: mine ? 'Take it up with him again: better terms, an argument, pressure, or let it go.' : 'Hear him out.' }, { a: `ent:${other.id}`, label: 'Look at who he is', hint: 'What you know of him, and how he sees you.' }],
  };
}

function matterStories(w: World, p: Character): Story[] {
  const out: Story[] = [];
  for (const s of w.situations ?? []) {
    if (!s.kind || !s.key || s.kind === 'dispute' || s.kind === 'crew' || s.kind === 'turf' || s.kind === 'org' || !visibleTo(w, p, s)) continue;
    const closed = !isOpen(s);
    if (closed && w.now - (s.resolvedAt ?? 0) > 30 * DAY) continue;
    const facts = knownFacts(w, p, s), tl = facts.map((f) => ({ t: f.t, text: f.text }));
    if (!tl.length && closed) continue;
    const asking = s.stage === 'asking';
    const mine = isParty(s, p.id);
    if (s.kind === 'ask') { const st = askStory(w, p, s, closed, tl); if (st) out.push(st); continue; }
    out.push({
      key: 'sit:' + s.id, kind: 'matter', title: titleOf(w, s), closed,
      stage: closed ? 'Over' : asking ? 'Waiting on your answer' : mine ? 'You’re in it' : 'You’ve heard about it',
      tone: closed ? '' : asking ? 'red' : 'amber', last: tl[0]?.t ?? s.since, lastText: tl[0]?.text ?? s.cause, timeline: tl,
      blurb: `${s.cause.replace(/^./, (m) => m.toUpperCase())}.${s.claims?.length && !closed ? ' What you have is what people say, and people say what suits them.' : ''}`,
      why: mine ? 'You’re a party to it.' : 'You’ve heard about it, and it concerns people around you.',
      actions: closed ? [] : movesFor(w, p, s).map((m) => ({ a: `mv:${s.id}|${m.code}|${m.who ?? ''}`, label: m.label, hint: m.hint })),
    });
  }
  return out;
}

function disputeStories(w: World): Story[] {
  const p = P();
  const out: Story[] = [];
  const list = myDisputes(w).concat((w.disputes ?? []).filter((d) => d.status === 'dropped' && (d.a === p.id || w.chars[d.a]?.bossId === p.id) && w.now - (d.history.at(-1)?.t ?? 0) < 30 * DAY));
  for (const d of list) {
    const a = w.chars[d.a], b = w.chars[d.b];
    const closed = d.status === 'settled' || d.status === 'dropped';
    if (closed && w.now - (d.history.at(-1)?.t ?? 0) > 30 * DAY) continue;
    out.push({
      key: d.id, kind: 'dispute', title: `${d.biz ? w.biz[d.biz]?.name ?? 'A shop' : 'A quarrel'}: ${a.name.split(' ')[0]} and ${b.name.split(' ')[0]}`,
      stage: stageOf(w, d), tone: d.status === 'violated' ? 'red' : d.status === 'open' ? 'amber' : closed ? '' : 'green', closed,
      last: d.history.at(-1)?.t ?? d.created, lastText: d.history.at(-1)?.text ?? '', timeline: d.history.slice().reverse(),
    });
  }
  return out;
}

export function storiesOf(w: World): Story[] {
  const p = w.chars[w.playerId!];
  const out: Story[] = [...huntStories(w, p), ...threatStories(w, p), ...turfStories(w, p), ...disputeStories(w), ...crewStories(w, p), ...debtStories(w, p), ...matterStories(w, p)];
  for (const k of seatStoryKeys(w, p)) {
    const f = known(w, p, (x) => x.story === k)[0];
    out.push({ key: k, kind: 'seat', title: 'A seat at the table', stage: seatStage(w, p, k.slice(5)), tone: 'blue', last: f?.t ?? w.now, lastText: f?.text ?? 'You’ve asked for a seat.', timeline: [] });
  }
  // what you did about each one goes on its record, and until the other side answers the story says it is waiting
  for (const s of out) {
    const tagged = Object.values(w.facts).filter((f) => f.story === s.key && p.known[f.id] && f.t > w.now - 120 * DAY).sort((a, b) => b.t - a.t);
    if (!tagged.length) continue;
    const have = new Set(s.timeline.map((x) => x.t + x.text));
    for (const f of tagged) if (!have.has(f.t + f.text)) s.timeline.push({ t: f.t, text: f.text });
    s.timeline.sort((a, b) => b.t - a.t);
    s.last = Math.max(s.last, tagged[0].t);
    const mine = tagged.find((f) => f.actor === p.id && f.kind === 'favour');
    if (!mine || s.closed) continue;
    const theirs = Object.values(w.facts).some((f) => f.story !== s.key && f.t > mine.t && f.actor && f.actor !== p.id && s.timeline.some((x) => x.t === f.t && x.text === f.text));
    if (!theirs && w.now - mine.t < 21 * DAY && s.kind !== 'seat') { s.stage = `You acted ${ago(w, mine.t)}. Waiting on the other side`; if (s.tone === 'amber') s.tone = 'blue'; }
  }
  const WHY: Record<Story['kind'], string> = { dispute: 'It’s a quarrel you or your men are in.', seat: 'You asked for it, and it decides your future.', debt: 'Money is owed between you and him.', crew: 'He’s one of your men.', threat: 'He wants you gone.', hunt: 'They’re looking for you.', turf: 'A shop that pays you is being taken.', matter: 'You’ve heard about it.' };
  for (const s of out) { s.last = Math.min(s.last, w.now); s.why ??= WHY[s.kind]; }
  const rank = (s: Story) => (s.closed ? 3 : s.tone === 'red' ? 0 : s.tone === 'amber' ? 1 : 2);
  return out.sort((a, b) => rank(a) - rank(b) || b.last - a.last);
}
export const isNew = (s: Story) => s.last > (S.seen[s.key] ?? 0) && !s.closed;
// The tab badge counts running stories that moved since you last looked at the list or the story itself.
export const newStories = (w: World) => storiesOf(w).filter((s) => !s.closed && s.last > Math.max(S.seen[s.key] ?? 0, S.seenTab ?? 0)).length;

const ago = (w: World, t: number) => { const d = Math.floor((w.now - t) / DAY); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };
const KIND_WORD: Record<Story['kind'], string> = { turf: 'Territory', dispute: 'Dispute', seat: 'Standing', debt: 'Money', crew: 'Crew', threat: 'Danger', hunt: 'Manhunt', matter: 'Matter' };

export function storiesTab(): string {
  const w = W();
  const all = storiesOf(w);
  const seenBefore = S.seenTab ?? 0;
  void seenBefore;
  let out = `<h2 class="sect">Stories<small>${all.filter((s) => !s.closed).length} running</small></h2>`;
  if (!all.length) return out + `<p class="muted pad">Nothing is unfolding right now. Matters start when something happens to you, your men or your shops. They show up here, and you can follow each one from the beginning.</p>`;
  const row = (s: Story) => `<button class="need" data-a="story:${s.key}"><span class="dot ${s.tone || 'green'}"></span><span><span class="t">${esc(s.title)}${isNew(s) ? ' <span class="tag red">new</span>' : ''}</span><span class="s" style="display:block"><b>${esc(KIND_WORD[s.kind])}</b> &middot; ${esc(s.stage)}</span><span class="s" style="display:block;opacity:.8">${lk(s.lastText.length > 110 ? s.lastText.slice(0, 107) + '…' : s.lastText).replace(/<a [^>]*>(.*?)<\/a>/g, '$1')} <i>${esc(ago(w, s.last))}</i></span></span></button>`;
  const run = all.filter((s) => !s.closed), done = all.filter((s) => s.closed);
  out += run.map(row).join('');
  S.seenTab = w.now;
  if (done.length) out += `<h2 class="sect">Recently closed<small>${done.length}</small></h2>` + done.map(row).join('');
  return out;
}

export function storyPage(key: string): string {
  const w = W();
  const s = storiesOf(w).find((x) => x.key === key);
  if (!s) return back() + `<div class="card"><p>That matter is over. Nobody’s talking about it any more.</p></div>`;
  S.seen[key] = w.now;
  let out = back() + `<div class="card"><h2>${esc(s.title)}<small><span class="tag ${s.tone}">${esc(s.stage)}</span></small></h2>${s.blurb ? `<p>${lk(s.blurb)}</p>` : ''}${s.why ? `<p class="muted">Why you’re seeing this: ${esc(s.why)}</p>` : ''}</div>`;
  out += `<h2 class="sect">The story so far<small>newest first</small></h2><div class="card"><ul class="rows">${s.timeline.length ? s.timeline.map((h) => `<li><span>${esc(shortTime(h.t))}</span><span class="v" style="text-align:left;margin-left:12px">${lk(h.text)}</span></li>`).join('') : '<li><span class="muted">Nothing is on record yet.</span></li>'}</ul></div>`;
  if (s.actions?.length) out += `<h2 class="sect">What you can do</h2><div class="list">${s.actions.map((a) => `<button class="opt" data-a="${a.a}"><b>${esc(a.label)}</b><span class="because">${esc(a.hint)}</span></button>`).join('')}</div>`;
  void pl; void ({} as Id); void ({} as Dispute); void WORD;
  return out;
}
