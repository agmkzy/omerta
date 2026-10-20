// The way in: the title screen (continue or begin) and the making of the man. V86's dark identity starts here; the
// styles live under .om in web/template.html and are meant to be reused as the rest of the game moves over.
import { fmtTime } from '../core';
import { BACKGROUNDS, bgLabel, bgOf } from '../background';
import { cleanName, rollFirst, rollName, rollSurname } from '../names';
import { KEY } from '../storage';
import type { Character, Look, World } from '../types';
import { esc, S } from './links';
import { HAIR_LIST, portrait, SKIN_LIST } from './portrait';

// ------------------------------------------------------------------ the saved game, read without opening it
export interface SaveSummary { name: string; place: string; when: string; days: number; ended: boolean; char: Character; w: Pick<World, 'fam' | 'now'> }
let cached: { raw: string; s: SaveSummary | null } | null = null;
const RANK: Record<string, string> = { associate: 'Associate', soldier: 'Soldier', capo: 'Capo', underboss: 'Underboss', boss: 'Boss', civilian: 'Out of the life' };
export function saveSummary(): SaveSummary | null {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { return null; }
  if (!raw) return null;
  if (cached?.raw === raw) return cached.s;
  let s: SaveSummary | null = null;
  try {
    const o = JSON.parse(raw);
    const p = o.chars?.[o.playerId] as Character | undefined;
    if (p) {
      const fam = p.familyId ? o.fam?.[p.familyId]?.name : undefined;
      s = {
        name: p.name, char: p, w: { fam: o.fam ?? {}, now: o.now ?? 0 },
        place: `${RANK[p.rank] ?? p.rank}${fam ? ` · ${fam} family` : ''}`,
        when: fmtTime(o.now ?? 0), days: Math.floor((o.now ?? 0) / 1440), ended: p.alive === false,
      };
    }
  } catch { s = null; }
  cached = { raw, s };
  return s;
}
export const forgetSummary = () => { cached = null; };

// The saved man's portrait, painted exactly as the game paints him: it reads the world for his family and his bruises.
function savedPortrait(s: SaveSummary): string {
  const was = S.w;
  try { S.w = s.w as World; return portrait(s.char); } catch { return ''; } finally { S.w = was; }
}

// ------------------------------------------------------------------ the draft
export const randomLook = (): Look => ({ skin: Math.floor(Math.random() * 6), hairColour: Math.floor(Math.random() * 6), style: Math.floor(Math.random() * 4), beard: Math.floor(Math.random() * 6), glasses: Math.random() < 0.7 ? 0 : 1 + Math.floor(Math.random() * 2), jaw: Math.floor(Math.random() * 3), seed: 'you' + Math.floor(Math.random() * 1e6) });
function freshDraft() {
  const n = rollName(Math.random);
  S.draft = { first: n.first, last: n.last, bg: BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)].id, sec: 'name' };
  S.look = randomLook();
}
const D = () => { if (!S.draft) freshDraft(); return S.draft!; };

// Typing goes straight into the draft, without a redraw, so the caret and the keyboard stay where they are.
export function typed(el: HTMLInputElement) {
  const d = D();
  const v = cleanName(el.value.replace(/^\s+/, ''));
  if (v !== el.value) el.value = v;
  if (el.id === 'om-first') d.first = v; else d.last = v;
  const t = document.getElementById(el.id === 'om-first' ? 'om-name-first' : 'om-name-last');
  if (t) t.textContent = v.trim() || ' ';
}

// Every tap on the opening screens comes through here (data-a="om:…").
export function openingAct(v: string): void {
  const [k, x] = v.split('|');
  switch (k) {
    case 'new': if (saveSummary() || hasRaw()) { S.confirmNew = true; return; } return enter();
    case 'keep': S.confirmNew = false; return;
    case 'create': return enter();
    case 'title': S.intro = 'title'; return;
    case 'sec': D().sec = x as 'name' | 'look' | 'history'; return;
    case 'both': { const d = D(); const n = rollName(Math.random, [`${d.first} ${d.last}`]); d.first = n.first; d.last = n.last; return; }
    case 'first': D().first = rollFirst(Math.random, D().first); return;
    case 'last': D().last = rollSurname(Math.random, D().last); return;
    case 'bg': if (bgOf(x)) D().bg = x; return;
    case 'shuffle': S.look = { ...randomLook() }; return;
    case 'look': { const [key, val] = x.split(':'); (S.look as Record<string, number | string>)[key] = Number(val); return; }
  }
}
function enter() { D(); S.intro = 'create'; }
const hasRaw = () => { try { return !!localStorage.getItem(KEY); } catch { return false; } };
export const draftName = () => { const d = D(); return { first: d.first.trim(), last: d.last.trim() }; };
export const draftBg = () => D().bg;
export function draftDone() { S.draft = null; S.intro = 'title'; S.confirmNew = false; forgetSummary(); }

// ------------------------------------------------------------------ pieces
const DICE = `<svg class="om-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/></svg>`;
const ARROW = `<svg class="om-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
const BACK = `<svg class="om-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>`;
const notice = (n: string) => (n ? `<div class="om-notice" role="alert">${esc(n)}</div>` : '');

// ------------------------------------------------------------------ title
function titleView(n: string): string {
  const s = saveSummary();
  const saved = s || hasRaw();
  const enterAnim = S.introPlayed ? '' : ' om-enter';
  S.introPlayed = true;
  const cont = saved
    ? `<button class="om-continue" data-a="continue:">
        ${s ? `<span class="om-continue__portrait">${savedPortrait(s)}</span>` : ''}
        <span class="om-continue__text">
          <span class="om-eyebrow">Continue</span>
          <span class="om-continue__name">${esc(s?.name ?? 'Your saved game')}</span>
          ${s ? `<span class="om-continue__meta">${esc(s.ended ? 'His story has ended' : s.place)}</span><span class="om-continue__meta">${esc(s.when)}${s.days ? ` · ${s.days} day${s.days === 1 ? '' : 's'} in` : ''}</span>` : ''}
        </span>
        <span class="om-continue__go">${ARROW}</span>
      </button>`
    : '';
  const begin = saved
    ? S.confirmNew
      ? `<div class="om-confirm" role="alert"><p><b>${esc(s?.name ?? 'Your game')} is still saved.</b> A new story replaces that game once you press Begin. Until then, nothing is lost.</p>
          <div class="om-row"><button class="om-btn" data-a="om:keep">Keep my game</button><button class="om-btn om-btn--danger" data-a="om:create">Make a new man</button></div></div>`
      : `<button class="om-btn om-btn--quiet om-btn--wide" data-a="om:new">Begin a new story</button>`
    : `<button class="om-btn om-btn--primary om-btn--wide" data-a="om:new">Begin</button>`;
  return `<div class="om om-title${enterAnim}">
    <div class="om-title__inner">
      <p class="om-eyebrow om-s1">New York City · March 1970</p>
      <h1 class="om-wordmark om-s2">Omertà</h1>
      <div class="om-rule om-s2"></div>
      <div class="om-prologue">
        <p class="om-prologue__lead om-s3">Everybody answers to somebody.</p>
        <p class="om-s4">You’re an associate of the Corrente family. Fifteen hundred dollars in your pocket, no crew, and a name that doesn’t mean much yet.</p>
        <p class="om-prologue__close om-s5">Nobody is going to hand you a story.</p>
      </div>
      ${notice(n)}
      <div class="om-actions om-s6">${cont}${begin}</div>
      <p class="om-footnote om-s6">Time only moves when you act. Everyone else keeps living while it does.</p>
    </div>
  </div>`;
}

// ------------------------------------------------------------------ the man
const LOOK_ROWS: { key: keyof Look; label: string; opts: string[] }[] = [
  { key: 'style', label: 'Hair', opts: ['Slicked', 'Long', 'Receding', 'Bald'] },
  { key: 'beard', label: 'Facial hair', opts: ['Clean', 'Moustache', 'Stubble', 'Goatee', 'Sideburns', 'Mutton chops'] },
  { key: 'glasses', label: 'Eyewear', opts: ['None', 'Spectacles', 'Dark glasses'] },
  { key: 'jaw', label: 'Jaw', opts: ['Square', 'Even', 'Lean'] },
];
const SKIN_NAMES = ['Fair', 'Light', 'Olive', 'Tan', 'Brown', 'Dark'];
const HAIR_NAMES = ['Black', 'Dark brown', 'Brown', 'Chestnut', 'Auburn', 'Grey'];
const radio = (on: boolean) => `role="radio" aria-checked="${on}"`;
const chips = (key: keyof Look, opts: string[]) => `<div class="om-chips" role="radiogroup">${opts.map((o, i) => `<button class="om-chip" ${radio(S.look[key] === i)} data-a="om:look|${key}:${i}">${o}</button>`).join('')}</div>`;
const swatches = (key: 'skin' | 'hairColour', list: string[], names: string[], label: string) =>
  `<div class="om-swatches" role="radiogroup" aria-label="${label}">${list.map((c, i) => `<button class="om-swatch" ${radio(S.look[key] === i)} style="--sw:${c}" data-a="om:look|${key}:${i}" aria-label="${names[i]}" title="${names[i]}"><i></i></button>`).join('')}</div>`;
const group = (label: string, inner: string) => `<div class="om-group"><div class="om-group__label">${label}</div>${inner}</div>`;
const next = (sec: string, label: string) => `<button class="om-next" data-a="om:sec|${sec}"><span>Next</span> ${label} ${ARROW}</button>`;

function namePanel(): string {
  const d = D();
  const field = (id: string, label: string, val: string, act: string, aria: string) => `<div class="om-field">
      <label class="om-field__label" for="${id}">${label}</label>
      <div class="om-field__row"><input id="${id}" class="om-input" type="text" value="${esc(val)}" autocomplete="off" autocapitalize="words" spellcheck="false" maxlength="20" enterkeyhint="done" />
      <button class="om-icon-btn" data-a="om:${act}" aria-label="${aria}" title="${aria}">${DICE}</button></div>
    </div>`;
  return `${field('om-first', 'First name', d.first, 'first', 'Another first name')}${field('om-last', 'Surname', d.last, 'last', 'Another surname')}
    <div class="om-row om-row--split"><button class="om-btn om-btn--ghost" data-a="om:both">${DICE}<span>Another name</span></button>${next('look', 'Appearance')}</div>`;
}
function lookPanel(): string {
  const r = (k: keyof Look) => LOOK_ROWS.find((x) => x.key === k)!;
  return `<div class="om-panel__head"><p class="om-panel__intro">How the neighbourhood will remember your face.</p><button class="om-btn om-btn--ghost om-btn--sm" data-a="om:shuffle">${DICE}<span>New face</span></button></div>
    ${group('Complexion', swatches('skin', SKIN_LIST, SKIN_NAMES, 'Complexion'))}
    ${group('Hair', swatches('hairColour', HAIR_LIST, HAIR_NAMES, 'Hair colour') + chips('style', r('style').opts))}
    ${group('Facial hair', chips('beard', r('beard').opts))}
    <div class="om-grid2">${group('Eyewear', chips('glasses', r('glasses').opts))}${group('Jaw', chips('jaw', r('jaw').opts))}</div>
    <div class="om-row om-row--end">${next('history', 'History')}</div>`;
}
function historyPanel(): string {
  const d = D();
  return `<p class="om-panel__intro">Where you came from. It’s who you were, not what you’re owed.</p>
    <div class="om-choices" role="radiogroup" aria-label="Background">${BACKGROUNDS.map((b) => `<button class="om-choice" ${radio(d.bg === b.id)} data-a="om:bg|${b.id}"><span class="om-choice__label">${esc(b.label)}</span><span class="om-choice__blurb">${esc(b.blurb)}</span></button>`).join('')}</div>`;
}

let lastSec = '';
function createView(n: string, saved: boolean): string {
  const d = D();
  const fade = lastSec !== d.sec ? ' om-fade' : '';
  lastSec = d.sec;
  const preview = { id: 'preview', name: esc(`${d.first} ${d.last}`.trim()), rank: 'associate', familyId: null, traits: { greed: 0.5, violence: 0.45, ambition: 0.7, caution: 0.5, sociability: 0.6, vice: 0.3, courage: 0.7 }, hurtUntil: 0, look: S.look } as unknown as Character;
  const tab = (id: typeof d.sec, label: string, n2: string) => `<button class="om-seg__tab" role="tab" aria-selected="${d.sec === id}" data-a="om:sec|${id}"><i>${n2}</i>${label}</button>`;
  const panel = d.sec === 'name' ? namePanel() : d.sec === 'look' ? lookPanel() : historyPanel();
  return `<div class="om om-create">
    <header class="om-bar"><button class="om-link" data-a="om:title">${BACK}<span>Back</span></button><span class="om-eyebrow">A new man</span><span class="om-bar__end"></span></header>
    <div class="om-create__grid">
      <section class="om-hero" aria-label="Your character">
        <figure class="om-portrait">${portrait(preview)}</figure>
        <div class="om-identity">
          <p class="om-eyebrow">Associate · Corrente family</p>
          <h1 class="om-name"><span id="om-name-first">${esc(d.first) || '&nbsp;'}</span><span id="om-name-last">${esc(d.last) || '&nbsp;'}</span></h1>
          <p class="om-identity__bg">${esc(bgLabel(d.bg) ?? '')}</p>
        </div>
      </section>
      <section class="om-builder">
        <nav class="om-seg" role="tablist" aria-label="Character">${tab('name', 'Name', 'I')}${tab('look', 'Appearance', 'II')}${tab('history', 'History', 'III')}</nav>
        ${notice(n)}
        <div class="om-panel${fade}" role="tabpanel">${panel}</div>
      </section>
    </div>
    <footer class="om-dock">
      ${saved ? '<p class="om-dock__warn">Beginning replaces your saved game.</p>' : ''}
      <button class="om-btn om-btn--primary om-btn--wide" data-a="new:">Begin</button>
    </footer>
  </div>`;
}

export function openingView(n: string, saved: boolean): string {
  return S.intro === 'create' ? createView(n, saved) : titleView(n);
}
