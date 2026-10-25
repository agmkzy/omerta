// The components every screen is built from (web/css/components.css styles them). A screen says what it shows; these say how.
// Nothing here reads the world: each takes what to draw, already decided by the view.
import { esc } from './links';

// ------------------------------------------------------------------ headings
export const title = (text: string, lede = '') => `<h1 class="ui-title">${esc(text)}</h1>${lede ? `<p class="ui-lede">${lede}</p>` : ''}`;
// A section: its name, and a quiet note at the end of the rule (a count, how often, how long).
export const h = (text: string, note = '') => `<h2 class="ui-h">${esc(text)}${note ? `<small>${esc(note)}</small>` : ''}</h2>`;
export const label = (text: string) => `<span class="ui-label">${esc(text)}</span>`;
export const quiet = (html: string) => `<p class="ui-quiet">${html}</p>`;

// ------------------------------------------------------------------ rows
export interface Row {
  title: string;          // html: the thing itself
  sub?: string;           // html: what it comes to
  kick?: string;          // plain: what kind of thing it is
  face?: string;          // html: a portrait, when a man is the subject
  mark?: string;          // a coloured mark (green, amber, red, blue, dead) when there is no face
  end?: string;           // html: a figure or a word at the end
  tone?: '' | 'good' | 'warn' | 'bad';
  a?: string;             // the action the whole row takes (data-a)
  label?: string;         // accessible name, when the row's text is not enough
}
const GO = '<svg class="ui-row__go" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
export function row(r: Row): string {
  const lead = r.face ? `<span class="ui-row__face">${r.face}</span>` : r.mark ? `<span class="ui-mark ${esc(r.mark)}" aria-hidden="true"></span>` : '';
  const body = `<span class="ui-row__body">${r.kick ? `<span class="ui-row__kick">${esc(r.kick)}</span>` : ''}<span class="ui-row__title">${r.title}</span>${r.sub ? `<span class="ui-row__sub">${r.sub}</span>` : ''}</span>`;
  const end = r.end ? `<span class="ui-row__end ${r.tone ?? ''}">${r.end}</span>` : '';
  return r.a
    ? `<li><button class="ui-row" data-a="${esc(r.a)}"${r.label ? ` aria-label="${esc(r.label)}"` : ''}>${lead}${body}${end}${GO}</button></li>`
    : `<li><div class="ui-row">${lead}${body}${end}</div></li>`;
}
export const rows = (rs: Row[]) => (rs.length ? `<ul class="ui-rows">${rs.map(row).join('')}</ul>` : '');

// ------------------------------------------------------------------ key / value
export type KV = [key: string, value: string, tone?: '' | 'good' | 'warn' | 'bad'];
export const kv = (xs: KV[]) => (xs.length ? `<dl class="ui-kv">${xs.map(([k, v, t]) => `<dt>${esc(k)}</dt><dd class="${t ?? ''}">${v}</dd>`).join('')}</dl>` : '');

// ------------------------------------------------------------------ choices
// One decision, numbered. `a` is the action; `n` is the number shown (and the key that picks it); `kind` says how it reads:
// the way out comes last and quieter, a way on to more subjects reads as such, a figure is named before it is said.
export interface Pick {
  a: string;
  label: string;          // plain
  hint?: string;          // plain
  kind?: '' | 'out' | 'more' | 'lead';
  fig?: string;           // html: the inputs for a figure, and the button that puts it
}
export function choices(ps: Pick[], aria = 'What you say'): string {
  const out = ps.map((p, i) => {
    const n = p.kind === 'out' ? OUT : `${i + 1}`;
    const cls = `ui-choice${p.kind ? ' is-' + p.kind : ''}${p.fig ? ' is-fig' : ''}`;
    const inner = `<span class="ui-choice__n" aria-hidden="true">${n}</span><span class="ui-choice__label">${esc(p.label)}</span>${p.hint ? `<span class="ui-choice__hint">${esc(p.hint)}</span>` : ''}`;
    // a figure is a group, not a button: its own inputs and its own "put it to him" (the number keys focus its first input)
    if (p.fig) return `<li><div class="${cls}" role="group" aria-label="${esc(p.label)}" data-n="${i + 1}">${inner}<div class="ui-figrow">${p.fig}</div></div></li>`;
    return `<li><button class="${cls}" data-a="${esc(p.a)}"${p.kind === 'out' ? ' data-out="1"' : ` data-n="${i + 1}"`}>${inner}${p.kind === 'out' ? '' : GO_C}</button></li>`;
  }).join('');
  return `<ol class="ui-choices" aria-label="${esc(aria)}">${out}</ol>`;
}
const GO_C = '<span class="ui-choice__go" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg></span>';
const OUT = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/></svg>';

// ------------------------------------------------------------------ context: information, never speech
const MARK = '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l7.5 3v6c0 4.6-3.1 8.4-7.5 10-4.4-1.6-7.5-5.4-7.5-10v-6z" fill="currentColor" opacity=".9"/><path d="M12 7v6" stroke="#0d0c0b" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="16.4" r="1.25" fill="#0d0c0b"/></svg>';
export const context = (lines: string[], bad = false) => (lines.length
  ? `<div class="ui-context${bad ? ' is-bad' : ''}" role="note"><span class="ui-context__mark">${MARK}</span><div class="ui-context__body">${lines.map((l) => `<p>${l}</p>`).join('')}</div></div>`
  : '');

// ------------------------------------------------------------------ small pieces
export const chipText = (text: string, cls = '') => `<span class="ui-chip ${cls}">${esc(text)}</span>`;
// A meter shows a word, and a bar only when there is something to show: "none" is not a sliver of red.
export function meter(name: string, word: string, v: number, bad = false): string {
  const bar = v > 0.02 ? `<span class="ui-meter__bar"><i style="width:${Math.round(Math.min(1, v) * 100)}%"></i></span>` : '';
  return `<div class="ui-meter${bad ? ' is-bad' : ''}"><div class="ui-meter__top"><span>${esc(name)}</span><b>${esc(word)}</b></div>${bar}</div>`;
}
export type BtnKind = '' | 'primary' | 'danger' | 'quiet';
export const btn = (a: string, text: string, kind: BtnKind = '', extra = '') => `<button class="ui-btn${kind ? ' ui-btn--' + kind : ''}" data-a="${esc(a)}"${extra}>${esc(text)}</button>`;
export const acts = (...bs: string[]) => { const xs = bs.filter(Boolean); return xs.length ? `<div class="ui-acts">${xs.join('')}</div>` : ''; };
const BACK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
export const backTo = (text = 'Back') => `<button class="ui-back" data-a="back:">${BACK}${esc(text)}</button>`;
