// V89: the conversation screen. A conversation is read like a scene: what he just said is the focus, your possible answers hang off
// it, what was said before stays above it, quieter, and what else there is to talk about waits below. Beside it (on a phone, in a
// drawer under his name), what you know about the man: only what you have seen or been told, never what the world knows privately.
import { openAsks, read as askRead, titleOf as askTitle } from '../asks';
import { money, ownerBiz, rel, shortTime } from '../core';
import { focusTitle, introduced, options as dialogueOptions } from '../dialogue';
import { kinOf } from '../kin';
import { matterStage, matterTitle } from '../matters';
import { PROBLEM_LABEL } from '../people';
import { isOpen } from '../situ';
import { isParty, knownFacts, visibleTo } from '../sitmoves';
import { notesOf } from '../talk';
import { sourceOf, versionOf } from '../rumour';
import type { Character, Situation, World } from '../types';
import { avatar, back } from './common';
import { viewOf, viewWords } from '../temper';
import { toSide } from './layout';
import { chip, esc, lk, P, pl, S, W } from './links';
import type { DOpt } from '../dialogue';

type TalkV = Extract<typeof S.view, { t: 'talk' }>;
const first = (c: Character) => c.name.split(' ')[0];
const ago = (now: number, t: number) => { const d = Math.floor(now / 1440) - Math.floor(t / 1440); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 14 ? `${d} days ago` : d < 60 ? `${Math.round(d / 7)} weeks ago` : `${Math.round(d / 30)} months ago`; };
const BAND = (t: number) => { const h = Math.floor((t % 1440) / 60); return h < 5 ? 'late at night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night'; };

// ------------------------------------------------------------------ how he takes it, in words
// The conversation engine marks what changed with a line of arrows; here it is said the way a narrator would say it.
const FX: Record<string, [string, string, string, string]> = { // up, up a lot, down, down a lot
  Trust: ['He trusts you a little more.', 'He trusts you a good deal more.', 'He trusts you a little less.', 'He trusts you a good deal less.'],
  Warmth: ['He warms to you.', 'He warms to you a good deal.', 'He cools toward you.', 'He goes cold on you.'],
  Respect: ['He thinks better of you.', 'He thinks a good deal better of you.', 'He thinks less of you.', 'He thinks a good deal less of you.'],
  Goodwill: ['Something between you eases.', 'Something between you is forgiven.', 'He’ll remember that.', 'He won’t forget that.'],
  Standing: ['Your name goes up a little.', 'Your name goes up.', 'Your name suffers for it.', 'Your name suffers for it.'],
  Heat: ['', '', 'The heat on you eases.', 'The heat on you eases.'],
};
function fxWords(line: string): string[] {
  const out: string[] = [];
  for (const bit of line.replace(/^⟡\s*/, '').split('·').map((x) => x.trim()).filter(Boolean)) {
    const m = bit.match(/^(\w+) (▲▲|▲|▼▼|▼)$/);
    if (m && FX[m[1]]) {
      if (m[1] === 'Heat') { out.push(m[2].startsWith('▲') ? 'The police will hear about this.' : FX.Heat[2]); continue; }
      out.push(FX[m[1]][{ '▲': 0, '▲▲': 1, '▼': 2, '▼▼': 3 }[m[2]]!]);
    } else if (/^[+−]\$/.test(bit)) out.push(bit.startsWith('+') ? `You are ${bit.slice(1)} better off.` : `It costs you ${bit.slice(1)}.`);
  }
  return [...new Set(out)];
}

// ------------------------------------------------------------------ one exchange
function exchange(q: string | undefined, ls: string[], now: boolean, t: Character): string {
  const said = ls.filter((l) => !l.startsWith('⟡'));
  const fx = ls.filter((l) => l.startsWith('⟡')).flatMap(fxWords);
  const lines = said.map((l) => {
    // his words: the speaker's name is set apart from what he says, so the line reads as speech
    const m = l.match(/^([^:“"]{2,40}):\s*([“"].*)$/);
    if (m) return `<p class="cv-say">${lk(m[2])}</p>`;
    return /^[“"]/.test(l) ? `<p class="cv-say">${lk(l)}</p>` : `<p class="cv-nar">${lk(l)}</p>`;
  }).join('');
  // his name goes just above the first thing he actually says, not above the narration that leads up to it
  const withWho = lines.replace('<p class="cv-say">', `<span class="cv-who">${esc(first(t))}</span><p class="cv-say">`);
  return `<div class="cv-ex${now ? ' cv-now' : ''}">${q ? `<p class="cv-you">${esc(q)}</p>` : ''}${said.length ? `<div class="cv-him">${withWho}${fx.length ? `<p class="cv-fx">${esc(fx.join(' '))}</p>` : ''}</div>` : ''}</div>`;
}

// ------------------------------------------------------------------ what is open between you
interface Open { title: string; stage: string; body: string[]; key: string }
function openBetween(w: World, p: Character, t: Character): Open[] {
  const out: Open[] = [];
  for (const s of openAsks(w)) {
    const mine = s.terms?.by === p.id && s.terms?.of === t.id, his = s.terms?.by === t.id && s.terms?.of === p.id;
    if (!mine && !his) continue;
    const S0 = s.st?.[t.id];
    const stage = mine ? (S0?.last === 'counter' ? `He offered ${money(Number(s.m?.offer ?? 0))}` : S0?.last === 'stall' ? 'He asked for time' : S0?.last === 'no' ? 'He said no, for now' : s.m?.help ? 'He went to someone' : 'Waiting on his answer') : 'He wants your answer';
    const body = [
      s.terms?.amt ? `On the table: ${money(s.terms.amt)}${s.ak === 'protect' ? ' a week' : ''}${s.terms.first && s.terms.first !== s.terms.amt ? ` (it started at ${money(s.terms.first)})` : ''}.` : '',
      mine ? `He is ${askRead(w, s, t.id)}.` : '',
      ...knownFacts(w, p, s).slice(0, 3).reverse().map((f) => `${ago(w.now, f.t).replace(/^./, (m) => m.toUpperCase())}: ${versionOf(w, p, f)}`),
    ].filter(Boolean);
    out.push({ title: askTitle(w, s), stage, body, key: s.id });
  }
  for (const d of w.debts) {
    if (d.status !== 'active') continue;
    if (d.creditor === p.id && d.debtor === t.id) out.push({ key: d.id, title: `He owes you ${money(d.balance)}`, stage: d.missed ? `${d.missed} payment${d.missed > 1 ? 's' : ''} missed` : 'Paying on time', body: [`${money(d.weeklyPayment)} a week.`] });
    if (d.debtor === p.id && d.creditor === t.id) out.push({ key: d.id, title: `You owe him ${money(d.balance)}`, stage: d.missed ? `You have missed ${d.missed}` : 'You are paying', body: [`${money(d.weeklyPayment)} a week. He will want it on time.`] });
  }
  for (const m of t.memos) if (m.other === p.id && !m.done && (m.kind === 'promise' || m.kind === 'agreement')) out.push({ key: m.id, title: m.kind === 'promise' ? 'Your word to him' : 'Agreed between you', stage: m.due ? (m.due > w.now ? `due ${ago(m.due, w.now).replace('ago', 'from now').replace('today', 'today').replace('yesterday', 'tomorrow')}` : 'overdue') : m.text.length > 46 ? m.text.slice(0, 44).replace(/\s+\S*$/, '') + '…' : m.text, body: [m.text] });
  for (const f of w.favours) if (!f.settled && ((f.from === p.id && f.to === t.id) || (f.from === t.id && f.to === p.id))) out.push({ key: f.id, title: f.from === p.id ? 'He owes you a favour' : 'You owe him a favour', stage: f.size >= 2 ? 'a big one' : 'a small one', body: [f.from === p.id ? `For ${f.what}.` : `He ${f.what}.`] });
  return out.slice(0, 6);
}

// ------------------------------------------------------------------ the man: what you know of him
// How he sees you (V90: from what he believes; fear, respect, trust and liking said apart, never as numbers)
function moodOf(w: World, p: Character, t: Character): string {
  if (!t.rels[p.id]) return 'He doesn’t know you.';
  const bits = viewWords(viewOf(w, t, p));
  if (!bits.length) return 'He hasn’t made up his mind about you.';
  return 'He ' + (bits.length > 1 ? bits.slice(0, -1).join(', ') + ' and ' + bits.at(-1) : bits[0]) + '.';
}
function aboutHim(w: World, p: Character, t: Character): string {
  const ins = p.insight?.[t.id] ?? [];
  const b = ownerBiz(w, t.id);
  const known: string[] = [];
  known.push(t.rank === 'civilian' ? (b ? `Runs ${esc(b.name)}, ${esc(b.district)}.` : `Lives in ${esc(t.district)}.`) : `${t.rank[0].toUpperCase() + t.rank.slice(1)}${t.familyId ? `, ${esc(w.fam[t.familyId].name)} family` : ''}${t.bossId && w.chars[t.bossId] ? `. Answers to ${pl(w.chars[t.bossId])}` : ''}.`);
  if (ins.includes('problem') && t.problem) known.push(`Has ${esc(PROBLEM_LABEL[t.problem.kind])}.`);
  const said = notesOf(p, t);
  // the people around him that you know of: each opens to say who they are to you, without leaving the conversation
  const ties = kinOf(w, t).filter((k) => ins.includes('tie:' + k.id) && w.chars[k.id]?.alive).map((k) => w.chars[k.id]);
  const person = (c: Character, how: string) => { const r = c.rels[p.id]; return `<details class="cv-d"><summary>${esc(c.name)} <span>${esc(how)}</span></summary><p>${c.rank === 'civilian' ? 'Not in the life.' : `${esc(c.rank)}, ${c.familyId ? esc(w.fam[c.familyId].name) : 'no family'}.`} ${!r ? 'He doesn’t know you.' : r.trust >= 0.5 ? 'He thinks well of you.' : r.grudge >= 0.3 ? 'He has no love for you.' : 'He knows your face.'}</p><button class="mini" data-a="talk:${c.id}">Go and see him</button></details>`; };
  // what is going on around him, as far as you know it: the stories he is in that you have heard of
  const near = (w.situations ?? []).filter((s: Situation) => isOpen(s) && isParty(s, t.id) && s.kind !== 'ask' && visibleTo(w, p, s)).slice(0, 4);
  const story = (s: Situation) => { const f = knownFacts(w, p, s)[0]; return `<details class="cv-d"><summary>${esc(matterTitle(w, s) ?? s.cause)} <span>${esc(matterStage(w, s, p) ?? '')}</span></summary>${f ? `<p>${esc(versionOf(w, p, f))} <span class="cv-src">${esc(sourceOf(w, p, f))}</span></p>` : ''}<button class="mini" data-a="story:sit:${s.id}">Open the story</button></details>`; };
  const shared = Object.keys(p.known).map((id) => w.facts[id]).filter((f) => f && !f.minor && ((f.actor === p.id && f.victim === t.id) || (f.actor === t.id && f.victim === p.id))).sort((a, b2) => b2.t - a.t).slice(0, 3);
  const met = p.intro?.[t.id];
  const sec = (h: string, body: string) => (body ? `<h3 class="cv-h">${h}</h3>${body}` : '');
  // what is open between you, in full (V90: the conversation names each matter; the detail of where it stands lives here)
  const open = openBetween(w, p, t).map((o) => `<details class="cv-d"><summary>${esc(o.title)} <span>${esc(o.stage)}</span></summary>${o.body.map((x) => `<p>${esc(x)}</p>`).join('')}</details>`).join('');
  return sec('How he sees you', `<p>${esc(moodOf(w, p, t))}</p>`) + sec('Between you', open)
    + sec('What you know', known.map((x) => `<p>${x}</p>`).join('') + ties.map((c) => person(c, `his ${kinOf(w, t).find((k) => k.id === c.id)?.role ?? 'family'}`)).join(''))
    + sec('What he has told you', said.map((x) => `<p class="cv-told">${esc(x)}</p>`).join(''))
    + sec('Going on around him', near.map(story).join(''))
    + sec('Your history', (met ? `<p>You first met ${ago(w.now, met)}.</p>` : '') + shared.map((f) => `<p>${esc(versionOf(w, p, f))}</p>`).join(''));
}

// ------------------------------------------------------------------ the screen
export function talkView(v: TalkV): string {
  const w = W(), t = w.chars[v.convo.id], p = P();
  if (!t || !t.alive) return back('Done') + `<p class="muted pad">He’s gone.</p>`;
  S.dopts = dialogueOptions(w, p, t, v.convo);
  const b = ownerBiz(w, t.id);
  let out = back('Leave');
  // who he is, where you are; on a phone, what you know of him opens from here
  const panel = aboutHim(w, p, t);
  out += `<header class="cv-head">${avatar(t)}<div><h1>${pl(t)}</h1><div class="sub">${chip(t)} ${esc(b && t.rank === 'civilian' ? b.name : t.district)} &middot; ${esc(BAND(w.now))}</div><details class="cv-drawer"><summary>What you know about him</summary><div class="cv-panel">${panel}</div></details></div></header>`;
  toSide(`<div class="cv-panel cv-side">${panel}</div>`);
  // what was said before: the last two exchanges stay readable, older ones fold away
  const hist = v.history ?? [];
  if (hist.length > 2) out += `<details class="cv-older"><summary>Earlier (${hist.length - 2})</summary>${hist.slice(0, -2).map((h) => exchange(h.q, h.lines, false, t)).join('')}</details>`;
  out += hist.slice(-2).map((h) => exchange(h.q, h.lines, false, t)).join('');
  if (v.lines.length || v.q) out += exchange(v.q, v.lines, true, t);
  out += choices(v, w, p, t);
  return out;
}

// Choices (V90). On the hub: what he brings up, what is between you (one row a matter, by name), the four everyday questions and the
// door to proposals, then leaving. In a subject: its name, only the answers that belong to it, and the way back. Nothing needs a
// legend: an answer with consequences says what they are.
function choices(v: TalkV, w: World, p: Character, t: Character): string {
  const all = S.dopts.map((o, i) => ({ o, i })).filter((x) => !x.o.done || x.o.code.startsWith('mv:'));
  const btn = ({ o, i }: { o: DOpt; i: number }, kind: 'reply' | 'topic' | 'quiet') => {
    const tag = ''; // (V90: no labels on what an answer does to a story: what he says next shows it)
    const weight = !o.done && (o.big || (!o.code.startsWith('mv:') && /hold you to it|remember|owe|costs?|notice|risk/i.test(o.hint ?? '')));
    return `<button class="cv-c cv-${kind}${weight ? ' cv-weight' : ''}${o.done ? ' cv-off' : ''}" data-a="say:${i}"${o.done ? ' disabled' : ''}><b>${lk(o.label)}</b>${tag ? `<em>${tag}</em>` : ''}${o.hint && !o.fixed && (weight || kind !== 'quiet') ? `<span>${esc(o.hint)}</span>` : ''}</button>`;
  };
  const away = (x: { o: DOpt }) => x.o.code === 'root' || x.o.code === 'f:' || (x.o.nav && /^(sub:back|deal:drop)$/.test(x.o.code));
  const quiet = (xs: typeof all) => `<div class="cv-away">${xs.map((x) => btn(x.o.code === 'root' && v.convo.node !== 'root' ? { ...x, o: { ...x.o, label: 'Talk about something else' } } : x, 'quiet')).join('')}</div>`;
  const grouped = all.some((x) => x.o.group);
  if (!grouped) {
    // a subject, or his answer still being followed up: these are answers to him; leaving the subject is quieter, at the end
    const title = introduced(w, p, t) ? focusTitle(w, p, t, v.convo) : undefined;
    return (title ? `<p class="cv-about">Talking about: <b>${esc(title)}</b></p>` : '') + `<div class="cv-replies">${all.filter((x) => !away(x)).map((x) => btn(x, 'reply')).join('')}</div>` + quiet(all.filter(away));
  }
  const g = (name: string) => all.filter((x) => x.o.group === name);
  const sec = (h: string, xs: typeof all, kind: 'reply' | 'topic' | 'quiet') => (xs.length ? `<h2 class="cv-g">${h}</h2><div class="cv-list">${xs.map((x) => btn(x, kind)).join('')}</div>` : '');
  return sec('He brings it up', g('He brings it up'), 'reply') + sec('On his mind', g('On his mind'), 'topic') + sec('Between you', g('Between you'), 'topic') + sec('Talk', g('Talk'), 'topic') + sec('You could put to him', g('Propose'), 'topic') + quiet(all.filter((x) => !x.o.group));
}
