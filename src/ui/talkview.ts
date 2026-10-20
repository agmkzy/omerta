// V89: the conversation screen. A conversation is read like a scene: what he just said is the focus, your possible answers hang off
// it, what was said before stays above it, quieter, and what else there is to talk about waits below. Beside it (on a phone, in a
// drawer under his name), what you know about the man: only what you have seen or been told, never what the world knows privately.
import { openAsks, read as askRead, titleOf as askTitle } from '../asks';
import { money, ownerBiz, rel, shortTime } from '../core';
import { options as dialogueOptions } from '../dialogue';
import { kinOf } from '../kin';
import { matterStage, matterTitle } from '../matters';
import { PROBLEM_LABEL } from '../people';
import { isOpen } from '../situ';
import { isParty, knownFacts, visibleTo } from '../sitmoves';
import { notesOf } from '../talk';
import type { Character, Situation, World } from '../types';
import { avatar, back } from './common';
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
  const speaks = said.some((l) => /[“"]/.test(l));
  return `<div class="cv-ex${now ? ' cv-now' : ''}">${q ? `<p class="cv-you">${esc(q)}</p>` : ''}${said.length ? `<div class="cv-him">${speaks ? `<span class="cv-who">${esc(first(t))}</span>` : ''}${lines}${fx.length ? `<p class="cv-fx">${esc(fx.join(' '))}</p>` : ''}</div>` : ''}</div>`;
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
      ...knownFacts(w, p, s).slice(0, 3).reverse().map((f) => `${shortTime(f.t)}: ${f.text}`),
    ].filter(Boolean);
    out.push({ title: askTitle(w, s), stage, body, key: s.id });
  }
  for (const d of w.debts) {
    if (d.status !== 'active') continue;
    if (d.creditor === p.id && d.debtor === t.id) out.push({ key: d.id, title: `He owes you ${money(d.balance)}`, stage: d.missed ? `${d.missed} payment${d.missed > 1 ? 's' : ''} missed` : 'Paying on time', body: [`${money(d.weeklyPayment)} a week.`] });
    if (d.debtor === p.id && d.creditor === t.id) out.push({ key: d.id, title: `You owe him ${money(d.balance)}`, stage: d.missed ? `You have missed ${d.missed}` : 'You are paying', body: [`${money(d.weeklyPayment)} a week. He will want it on time.`] });
  }
  for (const m of t.memos) if (m.other === p.id && !m.done && (m.kind === 'promise' || m.kind === 'agreement')) out.push({ key: m.id, title: m.kind === 'promise' ? 'Your word to him' : 'Agreed between you', stage: m.due ? (m.due > w.now ? `due ${shortTime(m.due)}` : 'overdue') : 'standing', body: [m.text] });
  for (const f of w.favours) if (!f.settled && ((f.from === p.id && f.to === t.id) || (f.from === t.id && f.to === p.id))) out.push({ key: f.id, title: f.from === p.id ? 'He owes you a favour' : 'You owe him a favour', stage: f.size >= 2 ? 'a big one' : 'a small one', body: [f.from === p.id ? `For ${f.what}.` : `He ${f.what}.`] });
  return out.slice(0, 6);
}

// ------------------------------------------------------------------ the man: what you know of him
function moodOf(w: World, p: Character, t: Character): string {
  const r = t.rels[p.id];
  if (!r) return 'He doesn’t know you.';
  const bits: string[] = [];
  if (r.grudge >= 0.5) bits.push('has a real grudge against you'); else if (r.grudge >= 0.25) bits.push('holds something against you');
  bits.push(r.trust >= 0.75 ? 'trusts you' : r.trust >= 0.5 ? 'mostly trusts you' : r.trust >= 0.3 ? 'is still making up his mind about you' : 'is wary of you');
  if (r.affection >= 0.6) bits.push('likes you'); else if (r.affection < 0.2 && r.grudge < 0.25) bits.push('is cool toward you');
  if (r.respect >= 0.65) bits.push('respects you');
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
  const story = (s: Situation) => { const f = knownFacts(w, p, s)[0]; return `<details class="cv-d"><summary>${esc(matterTitle(w, s) ?? s.cause)} <span>${esc(matterStage(w, s, p) ?? '')}</span></summary>${f ? `<p>${esc(f.text)}</p>` : ''}<button class="mini" data-a="story:sit:${s.id}">Open the story</button></details>`; };
  const shared = Object.keys(p.known).map((id) => w.facts[id]).filter((f) => f && !f.minor && ((f.actor === p.id && f.victim === t.id) || (f.actor === t.id && f.victim === p.id))).sort((a, b2) => b2.t - a.t).slice(0, 3);
  const met = p.intro?.[t.id];
  const sec = (h: string, body: string) => (body ? `<h3 class="cv-h">${h}</h3>${body}` : '');
  return sec('How he sees you', `<p>${esc(moodOf(w, p, t))}</p>`)
    + sec('What you know', known.map((x) => `<p>${x}</p>`).join('') + ties.map((c) => person(c, `his ${kinOf(w, t).find((k) => k.id === c.id)?.role ?? 'family'}`)).join(''))
    + sec('What he has told you', said.map((x) => `<p class="cv-told">${esc(x)}</p>`).join(''))
    + sec('Going on around him', near.map(story).join(''))
    + sec('Your history', (met ? `<p>You first met ${ago(w.now, met)}.</p>` : '') + shared.map((f) => `<p>${esc(f.text)}</p>`).join(''));
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
  // what is open between you stays in view, however long the conversation runs
  const open = openBetween(w, p, t);
  if (open.length) out += `<div class="cv-open">${open.map((o) => `<details class="cv-d"><summary>${esc(o.title)} <span>${esc(o.stage)}</span></summary>${o.body.map((x) => `<p>${esc(x)}</p>`).join('')}</details>`).join('')}</div>`;
  // what was said before: the last two exchanges stay readable, older ones fold away
  const hist = v.history ?? [];
  if (hist.length > 2) out += `<details class="cv-older"><summary>Earlier (${hist.length - 2})</summary>${hist.slice(0, -2).map((h) => exchange(h.q, h.lines, false, t)).join('')}</details>`;
  out += hist.slice(-2).map((h) => exchange(h.q, h.lines, false, t)).join('');
  if (v.lines.length || v.q) out += exchange(v.q, v.lines, true, t);
  out += choices(v, w, p, t);
  return out;
}

// Choices. Answers to what he just said hang off it; other subjects wait below, in plain groups. Nothing needs a legend: an answer
// with consequences says what they are, an answer that moves something on says so, and what has been said is in the record above.
function choices(v: TalkV, w: World, p: Character, t: Character): string {
  const all = S.dopts.map((o, i) => ({ o, i })).filter((x) => !x.o.done);
  // a matter that has just moved (he has just answered your terms) is answered here and now, under what he said
  const hot = new Set(openAsks(w).filter((s) => s.terms?.by === p.id && s.terms?.of === t.id && Number(s.m?.at ?? -1e9) >= w.now - 120).map((s) => s.id));
  const isHot = (code: string) => code.startsWith('mv:') && hot.has(code.split(':')[1]);
  const btn = ({ o, i }: { o: DOpt; i: number }, kind: 'reply' | 'topic' | 'quiet') => {
    // (a matter's own moves need no tag: the matter says where it stands, once, at the top)
    const tag = /^(mv|tk|mt):/.test(o.code) ? '' : o.story === 'go' ? 'moves it on' : o.story === 'end' ? 'settles it' : '';
    const weight = o.big || (!o.code.startsWith('mv:') && /hold you to it|remember|owe|costs?|notice|risk/i.test(o.hint ?? ''));
    return `<button class="cv-c cv-${kind}${weight ? ' cv-weight' : ''}" data-a="say:${i}"><b>${lk(o.label)}</b>${tag ? `<em>${tag}</em>` : ''}${o.hint && (weight || kind === 'reply') ? `<span>${esc(o.hint)}</span>` : ''}</button>`;
  };
  const grouped = all.some((x) => x.o.group);
  if (!grouped) {
    // in the middle of something: these are answers to him; leaving the subject is a quieter choice at the end
    const replies = all.filter((x) => !x.o.nav && x.o.code !== 'root' && !/^(sub:back|more:back|more:up|deal:drop)$/.test(x.o.code) && !/:end$/.test(x.o.code));
    const away = all.filter((x) => !replies.includes(x));
    return `<div class="cv-replies">${replies.map((x) => btn(x, 'reply')).join('')}</div>${away.length ? `<div class="cv-away">${away.map((x) => btn(x, 'quiet')).join('')}</div>` : ''}`;
  }
  const replies = all.filter((x) => isHot(x.o.code));
  const g = (name: string) => all.filter((x) => x.o.group === name && !isHot(x.o.code));
  const between = g('Between you'), talk = g('Talk'), other = all.filter((x) => !x.o.group || !['Between you', 'Talk'].includes(x.o.group));
  const mind = talk.filter((x) => x.o.code.startsWith('tk:')), say = talk.filter((x) => !x.o.code.startsWith('tk:') && !x.o.nav), more = talk.filter((x) => x.o.nav);
  const sec = (h: string, xs: typeof all, kind: 'reply' | 'topic' | 'quiet') => (xs.length ? `<h2 class="cv-g">${h}</h2><div class="cv-list">${xs.map((x) => btn(x, kind)).join('')}</div>` : '');
  // when the last thing he said invites an answer (a matter of yours, a request of his), those come first, as answers
  return (replies.length ? `<div class="cv-replies">${replies.map((x) => btn(x, 'reply')).join('')}</div>` : '') + `<div class="cv-rule"></div>` + sec('Between you', between, 'topic') + sec('On his mind', mind, 'topic') + sec('You could say', say, 'topic')
    + `<div class="cv-away">${[...more, ...other.filter((x) => x.o.code !== 'root'), ...other.filter((x) => x.o.code === 'root')].map((x) => btn(x, 'quiet')).join('')}</div>`;
}
