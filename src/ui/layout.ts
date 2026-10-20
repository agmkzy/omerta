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
import type { Tab } from './state';

// ------------------------------------------------------------------ the context column
// A view may put supporting material here. On desktop it stands beside the screen; on a phone it follows the screen.
const sideParts: string[] = [];
export const toSide = (html: string) => { if (html) sideParts.push(html); return ''; };
export const takeSide = () => sideParts.splice(0, sideParts.length).join('');

// ------------------------------------------------------------------ navigation
const IC: Record<Tab, string> = {
  today: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  rackets: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  crew: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="17" cy="9.5" r="2.4"/><path d="M16.5 14.2c2.8 0 4.5 2 4.5 5"/>',
  family: '<rect x="9" y="3" width="6" height="4.5" rx="1"/><rect x="3" y="16.5" width="6" height="4.5" rx="1"/><rect x="15" y="16.5" width="6" height="4.5" rx="1"/><path d="M12 7.5v4.5M6 16.5V12h12v4.5"/>',
  life: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21c.6-4.4 3.6-7 7.5-7s6.9 2.6 7.5 7"/>',
  stories: '<path d="M4 4.5h12.5a2 2 0 0 1 2 2V19a1.5 1.5 0 0 0 3 0V9h-3M4 4.5V18a2 2 0 0 0 2 2h14.5"/><path d="M8 9h7M8 12.5h7M8 16h4"/>',
};
const LABEL: Record<Tab, string> = { today: 'Today', rackets: 'Rackets', crew: 'Crew', family: 'Family', life: 'Life', stories: 'Stories' };
const icon = (t: Tab, size = 22) => `<svg class="ti" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[t]}</svg>`;

// Which section the current screen belongs to, so the right one is lit.
export function section(): Tab {
  const v = S.view;
  if (v.t === 'tab') return v.name;
  if (['books', 'meeting', 'guests', 'recruit', 'orders', 'sendorder', 'delegate', 'sunday'].includes(v.t)) return 'crew';
  if (['tree', 'manage', 'comm'].includes(v.t)) return 'family';
  if (['plan', 'opstart', 'op', 'hijack', 'way', 'dayjob'].includes(v.t)) return 'rackets';
  if (['story', 'brief'].includes(v.t)) return 'stories';
  if (['people', 'goals'].includes(v.t)) return 'life';
  return 'today';
}

const badgeOf = (t: Tab) => (t === 'today' ? attentionCount() : t === 'stories' ? newStories(W()) : 0);
const badge = (n: number) => (n ? `<span class="badge">${n > 9 ? '9+' : n}</span>` : '');

// Phone: five tabs. Stories lives inside Today there (its newest count joins Today's badge).
export function bottomTabs(): string {
  const cur = section();
  const lit = (t: Tab) => cur === t || (t === 'today' && cur === 'stories');
  const t = (id: Tab) => {
    const n = id === 'today' ? badgeOf('today') + badgeOf('stories') : badgeOf(id);
    return `<button class="${lit(id) ? 'on' : ''}" data-a="tab:${id}" aria-current="${lit(id) ? 'page' : 'false'}">${icon(id)}<span>${LABEL[id]}</span>${badge(n)}</button>`;
  };
  return `<nav class="tabs" aria-label="Sections">${(['today', 'rackets', 'crew', 'family', 'life'] as Tab[]).map(t).join('')}</nav>`;
}

// ------------------------------------------------------------------ status
function heat(): { word: string; v: number; hot: boolean } {
  const v = Math.min(1, P().heat);
  return { v, word: v < 0.15 ? 'Quiet' : v < 0.4 ? 'Noticed' : v < 0.7 ? 'Hot' : 'Burning', hot: v > 0.4 };
}
const day = () => fmtTime(W().now);

// Phone: one slim, sticky line. Who (tap for your page), money, the hour, and the heat when there is any.
export function topBar(): string {
  const p = P(), h = heat();
  return `<header class="g-top">
    <button class="g-top__me" data-a="tab:life" aria-label="Your page">${avatar(p)}</button>
    <div class="g-top__main"><b class="g-cash">${money(p.cash)}</b><span class="g-when">${esc(day())} · ${esc(p.district)}</span></div>
    <div class="g-top__heat ${h.hot ? 'hot' : ''}" title="Police attention"><i style="--h:${Math.round(h.v * 100)}%"></i><span>${h.word}</span></div>
  </header>`;
}

// Desktop: the rail. The man, his standing, the money, and the way around.
export function rail(): string {
  const w = W(), p = P(), h = heat(), cur = section();
  const carrying = [p.cars ? `${p.cars} car${p.cars > 1 ? 's' : ''}` : '', p.goods ? `${money(p.goods)} in goods` : ''].filter(Boolean).join(', ');
  const nav = (['today', 'rackets', 'crew', 'family', 'life', 'stories'] as Tab[])
    .map((t) => `<button class="g-nav__item ${cur === t ? 'on' : ''}" data-a="tab:${t}" aria-current="${cur === t ? 'page' : 'false'}">${icon(t, 20)}<span>${LABEL[t]}</span>${badge(badgeOf(t))}</button>`).join('');
  return `<aside class="g-rail">
    <div class="g-brand">Omertà</div>
    <button class="g-me" data-a="tab:life">
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
    <button class="g-save" data-a="save:">Save</button>
  </aside>`;
}
