// Gate 3: the conversation screen for the new conversation engine (conv/visit.ts), behind a switch. It draws what the engine hands it:
// who he is to you, what has been said, and what you can say now. It decides nothing: every line and every choice comes from the engine.
// The old screen (ui/talkview.ts, dialogue.ts) is untouched and stays the default until the cut-over.
import type { Visit } from '../conv/visit';
import { approaches } from '../conv/approach';
import { ownerBiz } from '../core';
import { avatar, back } from './common';
import { chip, esc, pl, W } from './links';

const KEY = 'omerta.talk', DEBUG = 'omerta.debug';
const store = () => { try { return globalThis.localStorage; } catch { return undefined; } };
// the switch: ?talk=new or ?talk=old in the address sets it; otherwise what was set last; the old screen by default
export function newTalk(): boolean {
  try { const q = new URLSearchParams(globalThis.location?.search ?? '').get('talk'); if (q === 'new' || q === 'old') store()?.setItem(KEY, q); } catch { /* (no address bar: tests) */ }
  try { return store()?.getItem(KEY) === 'new'; } catch { return false; }
}
export function setNewTalk(on: boolean) { try { store()?.setItem(KEY, on ? 'new' : 'old'); } catch { /* (private window) */ } }
const debug = () => { try { const q = new URLSearchParams(globalThis.location?.search ?? '').get('debug'); if (q) store()?.setItem(DEBUG, q); return store()?.getItem(DEBUG) === '1'; } catch { return false; } };

const first = (n: string) => n.split(' ')[0];
export function talk2View(v: Visit): string {
  const w = W(), t = w.chars[v.npc];
  if (!t || !t.alive) return back('Done') + `<p class="muted pad">He’s gone.</p>`;
  const b = ownerBiz(w, t.id);
  let out = back('Leave');
  out += `<header class="cv-head">${avatar(t)}<div><h1>${pl(t)}</h1><div class="sub">${chip(t)} ${esc(b && t.rank === 'civilian' ? b.name : v.where)}</div><p class="cv-mood">${esc(v.relation)}</p></div></header>`;
  // the visit as it was said: his words, yours, what happened, and (in the developer view only) why he said it
  out += `<div class="cv-log">`;
  const dbg = debug();
  let ex = '';
  const flush = (now: boolean) => { if (ex) { out += `<div class="cv-ex${now ? ' cv-now' : ''}">${ex}</div>`; ex = ''; } };
  v.lines.forEach((l, i) => {
    const last = i === v.lines.length - 1;
    if (l.who === 'you') { flush(false); ex += `<p class="cv-you">${esc(l.text)}</p>`; }
    else if (l.who === 'him') ex += `<div class="cv-him"><span class="cv-who">${esc(first(t.name))}</span><p class="cv-say">${esc(l.text)}</p>${dbg && l.trace?.length ? `<details class="cv-d"><summary>why (developer view)</summary><pre class="cv-trace">${esc(l.trace.join('\n'))}</pre></details>` : ''}</div>`;
    else if (l.who === 'card') ex += `<p class="cv-fx">${esc(l.text)}</p>`;
    else ex += `<p class="cv-nar">${esc(l.text)}</p>`;
    if (last) flush(true);
  });
  flush(true);
  out += `</div>`;
  if (v.ended) return out + `<div class="cv-end"><div class="cv-endrow"><button class="btn primary" data-a="back:">Go on</button><button class="btn" data-a="ent:${t.id}">His page</button></div></div>`;
  // what you can say: his answer first, then the rest, then the way out; at most five, "Something else…" opens everything plausible
  const btn = (c: Visit['choices'][number]) => c.amount ? `<div class="cv-c cv-topic cv-fig"><b>${esc(c.label)}</b>${c.note ? `<span>${esc(c.note)}</span>` : ''}<div class="cv-figrow"><label>$ <input type="number" id="t2fig" value="${c.amount.value}" min="${c.amount.min}" max="${c.amount.max}" step="${c.amount.step}" inputmode="numeric" aria-label="Amount"></label>${c.amount.rate ? `<label><input type="number" id="t2figr" value="${Math.round(c.amount.rate.value * 100)}" min="${Math.round(c.amount.rate.min * 100)}" max="${Math.round(c.amount.rate.max * 100)}" step="1" inputmode="numeric" aria-label="Weekly rate"> % a week</label>` : ''}<button class="btn" data-a="t2amt:${esc(c.id)}">Put it to him</button></div></div>` : `<button class="cv-c cv-${c.group === 'reply' ? 'reply' : c.group === 'leave' || c.group === 'more' ? 'quiet' : 'topic'}" data-a="t2:${esc(c.id)}"><b>${esc(c.label)}</b>${c.note ? `<span>${esc(c.note)}</span>` : ''}</button>`;
  // the three headings (Business, Personal, Confront) are drawn as one row of plain words; what he raises himself sits above them
  const heads = v.choices.filter((c) => c.group === 'intent');
  const main = v.choices.filter((c) => c.group !== 'leave' && c.group !== 'more' && c.group !== 'intent'), away = v.choices.filter((c) => c.group === 'leave' || c.group === 'more');
  if (v.pane && !v.choices.some((c) => c.group === 'reply')) out += `<h2 class="cv-g">${esc(v.pane[0].toUpperCase() + v.pane.slice(1))}</h2>`;
  out += `<div class="cv-replies">${main.map(btn).join('')}</div>`;
  if (heads.length) out += `<div class="cv-ways">${heads.map((c) => `<button class="cv-way" data-a="t2:${esc(c.id)}">${esc(c.label)}</button>`).join('')}</div>`;
  out += `<div class="cv-away">${away.map(btn).join('')}</div>`;
  out += `<p class="muted small pad">New conversations (trial). <a href="#" data-a="talkmode:old">Use the old ones</a>${dbg ? ' · developer view on' : ''}</p>`;
  return out;
}
// Who has come looking for you (and the switch itself), for the top of the day
export function approachesBlock(): string {
  const w = W();
  const on = newTalk();
  if (!on) return `<p class="muted small pad">Trying something new: <a href="#" data-a="talkmode:new">the new conversations</a>.</p>`;
  const xs = approaches(w);
  const list = xs.map((a) => `<button class="cv-c cv-topic" data-a="see2:${a.id}"><b>${esc(a.line)}</b><span>Go and see him</span></button>`).join('');
  return (xs.length ? `<div class="card"><h2>Looking for you</h2><div class="cv-replies">${list}</div></div>` : '') + `<p class="muted small pad">New conversations are on. <a href="#" data-a="talkmode:old">Use the old ones</a></p>`;
}
