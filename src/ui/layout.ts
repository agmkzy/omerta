// The frame every in-game screen sits in (V88). One idea, two shapes:
// - phone: a slim status bar on top, one column, and five tabs along the bottom;
// - desktop: a left rail (who you are, where you stand, where you can go), the screen in the middle, and a context column
//   on the right for what supports it.
// The status (date, cash, heat, rank, reputation) lives here once, instead of at the top of every tab.
import { famName, fmtTime, money } from '../core';
import { influence, influenceWord } from '../books';
import { standingWord } from '../jobs';
import { avatar } from './common';
import { attentionCount } from './views_a';
import { newStories } from './stories';
import { esc, P, S, W } from './links';
import type { Tab, View } from './state';
import { LEGACY } from './sections';

// ------------------------------------------------------------------ the context column
// A view may put supporting material here. On desktop it stands beside the screen; on a phone it follows the screen.
const sideParts: string[] = [];
export const toSide = (html: string) => { if (html) sideParts.push(html); return ''; };
export const takeSide = () => sideParts.splice(0, sideParts.length).join('');

// ------------------------------------------------------------------ navigation
const IC: Partial<Record<Tab, string>> = {
  today: '<path d="M3 21h18M5 21V10l4-2v13M9 21V6l6-3v18M15 21V9l4 2v10"/><path d="M11.5 8h1M11.5 11h1M11.5 14h1M6.5 13h1M16.5 14h1"/>',
  people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="17" cy="9.5" r="2.4"/><path d="M16.5 14.2c2.8 0 4.5 2 4.5 5"/>',
  family: '<rect x="9" y="3" width="6" height="4.5" rx="1"/><rect x="3" y="16.5" width="6" height="4.5" rx="1"/><rect x="15" y="16.5" width="6" height="4.5" rx="1"/><path d="M12 7.5v4.5M6 16.5V12h12v4.5"/>',
  business: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  journal: '<path d="M4 4.5h12.5a2 2 0 0 1 2 2V19a1.5 1.5 0 0 0 3 0V9h-3M4 4.5V18a2 2 0 0 0 2 2h14.5"/><path d="M8 9h7M8 12.5h7M8 16h4"/>',
  life: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21c.6-4.4 3.6-7 7.5-7s6.9 2.6 7.5 7"/>',
};
const LABEL: Partial<Record<Tab, string>> = { today: 'World', people: 'People', family: 'Family', business: 'Business', journal: 'Journal', life: 'You' };
const SECTIONS: Tab[] = ['today', 'people', 'family', 'business', 'journal'];
const icon = (t: Tab, size = 22) => `<svg class="ti" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[t]}</svg>`;

// Which section each screen belongs to, so the right one is lit and a phone's tabs say where you are. Every screen is listed: a
// conversation and a man's page are People, his books and orders are Family, a racket is Business, a story is the Journal.
const HOME: Record<View['t'], Tab> = {
  tab: 'today', menu: 'today', wait: 'today', job: 'today', approach: 'today', delegate: 'today', sendorder: 'today', report: 'today', dayjob: 'today', brief: 'today', enc: 'today', place: 'today', places: 'today', bj: 'today',
  person: 'people', talk2: 'people', people: 'people', grudges: 'people', settle: 'people',
  manage: 'family', comm: 'family', tree: 'family', plan: 'family', orders: 'family', recruit: 'family', books: 'family', meeting: 'family', guests: 'family', sunday: 'family', help: 'family',
  biz: 'business', way: 'business', opstart: 'business', op: 'business', hijack: 'business',
  fact: 'journal', dispute: 'journal', story: 'journal',
  goals: 'life',
};
export function section(): Tab {
  const v = S.view;
  if (v.t === 'tab') return LEGACY[v.name]?.[0] ?? v.name;
  return HOME[v.t];
}

const badgeOf = (t: Tab) => (t === 'today' ? attentionCount() : t === 'journal' ? newStories(W()) : 0);
const badge = (n: number) => (n ? `<span class="badge">${n > 9 ? '9+' : n}</span>` : '');

// Phone: the five sections along the bottom; your own page is your portrait in the bar above.
export function bottomTabs(): string {
  const cur = section();
  const t = (id: Tab) => `<button class="${cur === id ? 'on' : ''}" data-a="tab:${id}" aria-current="${cur === id ? 'page' : 'false'}">${icon(id)}<span>${LABEL[id]}</span>${badge(badgeOf(id))}</button>`;
  return `<nav class="tabs" aria-label="Sections">${SECTIONS.map(t).join('')}</nav>`;
}

// ------------------------------------------------------------------ status
function heat(): { word: string; v: number; hot: boolean } {
  const v = Math.min(1, P().heat);
  return { v, word: v < 0.15 ? 'Quiet' : v < 0.4 ? 'Noticed' : v < 0.7 ? 'Hot' : 'Burning', hot: v > 0.4 };
}
const day = () => fmtTime(W().now);

// Phone: one slim, sticky line. Who (tap for your page), the money and the hour, where you are and the heat.
const short = (t: number) => fmtTime(t).replace(/^(\w{3}), (\d+ \w{3})\w* \d{4}, /, '$1 $2 · ');
export function topBar(): string {
  const p = P(), h = heat();
  return `<header class="g-top">
    <button class="g-top__me" data-a="tab:life" aria-label="Your page">${avatar(p)}</button>
    <div class="g-top__main"><b class="g-cash">${money(p.cash)}</b><span class="g-when">${esc(short(W().now))}</span></div>
    <div class="g-top__heat ${h.hot ? 'hot' : ''}" title="Police attention"><span>${esc(p.district)}</span><i style="--h:${Math.round(h.v * 100)}%"></i><span>${h.word}</span></div>
  </header>`;
}

// Desktop: the rail. The man, his standing, the money, and the way around.
export function rail(): string {
  const w = W(), p = P(), h = heat(), cur = section();
  const carrying = [p.cars ? `${p.cars} car${p.cars > 1 ? 's' : ''}` : '', p.goods ? `${money(p.goods)} in goods` : ''].filter(Boolean).join(', ');
  const nav = SECTIONS
    .map((t) => `<button class="g-nav__item ${cur === t ? 'on' : ''}" data-a="tab:${t}" aria-current="${cur === t ? 'page' : 'false'}">${icon(t, 20)}<span>${LABEL[t]}</span>${badge(badgeOf(t))}</button>`).join('');
  return `<aside class="g-rail">
    <div class="g-brand">Omertà</div>
    <button class="g-me ${cur === 'life' ? 'on' : ''}" data-a="tab:life" aria-label="Your page">
      ${avatar(p)}
      <span class="g-me__name">${esc(p.name)}</span>
      <span class="g-me__rank">${esc(p.rank)}${p.familyId ? ` · ${esc(famName(w, p))}` : ''}</span>
    </button>
    <div class="g-status">
      <div class="g-status__when">${esc(day())}<br><span>${esc(p.district)}${p.hurtUntil > w.now ? ' · <b class="hurt">hurt</b>' : ''}</span></div>
      <div class="g-status__cash">${money(p.cash)}</div>
      ${carrying ? `<div class="g-status__carry">Carrying ${esc(carrying)}</div>` : ''}
      <div class="g-heat ${h.hot ? 'hot' : ''}"><span>Heat</span><b>${h.word}</b><i style="--h:${Math.round(h.v * 100)}%"></i></div>
      <dl class="g-words"><dt>Reputation</dt><dd>${esc(standingWord(p.standing))}</dd><dt>Influence</dt><dd>${esc(influenceWord(influence(w, p)))}</dd></dl>
    </div>
    <nav class="g-nav" aria-label="Sections">${nav}</nav>
    <button class="g-save" data-a="save:">Save${S.saveGood ? `<small>Last saved ${esc(S.saveGood)}</small>` : ''}</button>
  </aside>`;
}
