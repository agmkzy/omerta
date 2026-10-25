// The conversation screen (conv/visit.ts; the only one since Gate 4), drawn to the approved design: who he is at the top, with how he
// sees you and what you know of him beside it; what is being said in its own reading area; what stands between you in a context box,
// apart from speech; and what you can say as numbered choices, the way out last. It decides nothing: every line and every choice comes
// from the engine, and every fact in the context box from records the player is a party to (ui/between.ts).
// On a phone the screen is three fixed regions (ui/conversation.css): the man, the reading box, and the choices anchored at the bottom.
import type { Visit } from '../conv/visit';
import type { Choice } from '../conv/kit';
import { approaches } from '../conv/approach';
import { ownerBiz } from '../core';
import { avatar } from './common';
import { between, knownOf } from './between';
import { choices, context, label, type Pick } from './kit';
import { esc, famClass, P, S, W } from './links';
import { dayPart } from './when';

const DEBUG = 'omerta.debug';
const store = () => { try { return globalThis.localStorage; } catch { return undefined; } };
const debug = () => { try { const q = new URLSearchParams(globalThis.location?.search ?? '').get('debug'); if (q) store()?.setItem(DEBUG, q); return store()?.getItem(DEBUG) === '1'; } catch { return false; } };

// What each heading is for, said once under its name (the headings themselves are the engine's).
const HEAD_HINT: Record<string, string> = { business: 'Work, money, the family’s affairs.', personal: 'The man himself: how he is, what he thinks.', confront: 'What needs having out between you.' };
const RANK = (r: string) => (r === 'capo' ? 'captain' : r);
const ICON = {
  back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  about: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};

// The exchanges of this visit: each begins with what you said (the first, with his greeting, begins with nothing).
type Ex = Visit['lines'];
function exchanges(v: Visit): Ex[] {
  const xs: Ex[] = [[]];
  for (const l of v.lines) { if (l.who === 'you' && xs.at(-1)!.length) xs.push([]); xs.at(-1)!.push(l); }
  return xs.filter((x) => x.length);
}

// One exchange as it reads: your words quiet above, the room in italics, his words in the book face. The ▲▼ record of what changed
// is information, not speech, so it is kept apart (fx).
function exHtml(x: Ex, dbg: boolean): { said: string; fx: string[] } {
  let said = '';
  const fx: string[] = [];
  for (const l of x) {
    if (l.who === 'you') said += `<p class="cx-you"><span class="sr-only">You: </span>${esc(l.text)}</p>`;
    else if (l.who === 'him') said += `<p class="cx-say">${esc(l.text)}</p>${dbg && l.trace?.length ? `<details class="cx-dbg"><summary>why (developer view)</summary><pre>${esc(l.trace.join('\n'))}</pre></details>` : ''}`;
    else if (l.who === 'card') fx.push(esc(l.text));
    else said += `<p class="cx-narr">${esc(l.text)}</p>`;
  }
  return { said, fx };
}

// A figure to name before it is said: the amount, and for a loan the weekly rate; "Put it to him" says it.
function figure(c: Choice): string {
  const a = c.amount!;
  return `<label>$ <input type="number" id="t2fig:${esc(c.id)}" value="${a.value}" min="${a.min}" max="${a.max}" step="${a.step}" inputmode="numeric" aria-label="Amount"></label>`
    + (a.rate ? `<label><input type="number" id="t2figr:${esc(c.id)}" value="${Math.round(a.rate.value * 100)}" min="${Math.round(a.rate.min * 100)}" max="${Math.round(a.rate.max * 100)}" step="1" inputmode="numeric" aria-label="Weekly rate"> % a week</label>` : '')
    + `<button class="ui-btn" data-a="t2amt:${esc(c.id)}">Put it to him</button>`;
}

// What you can say now, in the order a man would weigh it: his answer or his request first, then the subjects in hand, then the
// headings, then a way on to more, and last the way out.
function picks(v: Visit): Pick[] {
  const rank = (c: Choice) => (c.group === 'reply' ? 0 : c.group === 'matter' ? 1 : c.group === 'social' ? 2 : c.group === 'intent' ? 3 : c.group === 'more' ? 4 : 5);
  const lead = v.choices.find((c) => c.group === 'reply' || c.group === 'matter');
  return [...v.choices].sort((a, b) => rank(a) - rank(b)).map((c) => ({
    a: 't2:' + c.id,
    label: c.label,
    hint: c.note ?? (c.group === 'intent' ? HEAD_HINT[c.id.slice(2)] : undefined),
    kind: c.group === 'leave' ? 'out' : c.group === 'more' ? 'more' : c === lead && v.approach ? 'lead' : '',
    fig: c.amount ? figure(c) : undefined,
  }));
}

export function talk2View(v: Visit): string {
  const w = W(), p = P(), t = w.chars[v.npc];
  if (!t || !t.alive) return `<section class="cx"><p class="ui-quiet">He’s gone.</p><button class="ui-btn" data-a="back:">Go on</button></section>`;
  const b = ownerBiz(w, t.id);
  const dbg = debug();
  const role = t.rank === 'civilian' ? (b ? b.name : '') : t.familyId ? `${w.fam[t.familyId]?.name ?? ''} family` : '';
  const meta = [role, v.where !== role ? v.where : '', dayPart(w.now)].filter(Boolean).map(esc).join(' · ');
  const chip = `<span class="ui-chip ${t.rank === 'civilian' ? '' : famClass(t.familyId)}">${esc(RANK(t.rank))}</span>`;
  // what stands between you: information, not speech (ui/between.ts), most pressing first
  const ties = between(w, p, t);
  const order = { waiting: 0, money: 1, place: 2, favour: 3, rank: 4, word: 5 } as const;
  const shown = ties.sort((a, c) => order[a.kind] - order[c.kind]).slice(0, 3).map((x) => x.text);
  if (v.approach && !ties.some((x) => x.kind === 'waiting') && approaches(w).some((a) => a.id === v.approach)) shown.unshift(`${esc(t.name.split(' ')[0])} came to you about this.`);
  // (on a short phone screen the context box moves in here, behind the ☰, so the choices keep their room)
  const about = `<div class="cx-know__part">${label('How he sees you')}<p>${esc(v.relation)}</p></div><div class="cx-know__part">${label('What you know')}<p>${knownOf(w, p, t)}</p></div>${shown.length ? `<div class="cx-know__part cx-know__ctx">${label('Between you')}${shown.map((x) => `<p>${x}</p>`).join('')}</div>` : ''}`;
  const aboutOpen = !!S.open.cxabout;

  let out = `<section class="cx${v.ended ? ' is-ended' : ''}" aria-label="Talking with ${esc(t.name)}">`;
  // ---- the man
  out += `<header class="cx-head">
    <div class="cx-bar"><button class="cx-leave" data-a="back:" aria-label="Leave the conversation">${ICON.back}<span>Leave</span></button><span class="cx-brand" aria-hidden="true">Omertà</span><button class="cx-aboutbtn" data-a="tog:cxabout" aria-expanded="${aboutOpen}" aria-controls="cx-about" aria-label="What you know of him">${ICON.about}</button></div>
    <div class="cx-who"><div class="cx-face">${avatar(t)}</div><div class="cx-id"><h1 class="cx-name"><a href="#" data-a="ent:${t.id}">${esc(t.name)}</a></h1><p class="cx-meta">${chip} <span>${meta}</span></p><p class="cx-where">${esc(t.district)}</p></div></div>
    <aside class="cx-know${aboutOpen ? ' is-open' : ''}" id="cx-about" aria-label="What you know of him">${about}</aside>
  </header>`;
  // ---- what is being said
  const xs = exchanges(v);
  const now = xs.at(-1) ?? [];
  const before = xs.slice(0, -1);
  const cur = exHtml(now, dbg);
  out += `<div class="cx-read" tabindex="-1" aria-label="The conversation">`;
  if (before.length) out += `<div class="cx-earlier" aria-label="Said earlier">${before.map((x) => `<div class="cx-ex">${exHtml(x, dbg).said}</div>`).join('')}</div>`;
  out += `<div class="cx-now" aria-live="polite">${cur.said || '<p class="cx-narr">He waits for you to speak.</p>'}</div>`;
  if (cur.fx.length) out += `<p class="cx-fx" aria-label="What changed">${cur.fx.join(' · ')}</p>`;
  out += `</div>`;
  // ---- what you can say
  out += `<div class="cx-act">${context(shown)}`;
  if (v.ended) out += choices([{ a: 'back:', label: 'Go on', hint: 'Back to where you were.' }, { a: `ent:${t.id}`, label: `${t.name.split(' ')[0]}’s page`, hint: 'Everything you know of him, and what is between you.' }], 'Where now');
  else {
    if (v.pane && !v.choices.some((c) => c.group === 'reply')) out += `<p class="cx-under">${esc(v.pane[0].toUpperCase() + v.pane.slice(1))}</p>`;
    out += choices(picks(v));
  }
  if (dbg) out += `<p class="cx-dbgnote">Developer view on.</p>`;
  out += `</div></section>`;
  return out;
}

// Who has come looking for you, for the top of the day
export function approachesBlock(): string {
  const w = W();
  const xs = approaches(w);
  if (!xs.length) return '';
  return `<section class="cx-looking" aria-label="Looking for you"><h2 class="ui-h">Looking for you</h2><ul class="ui-rows">${xs.map((a) => { const c = w.chars[a.who]; return `<li><button class="ui-row" data-a="see2:${a.id}"><span class="ui-row__face">${avatar(c)}</span><span class="ui-row__body"><span class="ui-row__title">${esc(a.line)}</span><span class="ui-row__sub">Go and see him</span></span></button></li>`; }).join('')}</ul></section>`;
}
