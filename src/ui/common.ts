import { portrait } from './portrait';
// Shared pieces for the views: banners, icons, the header strip, small formatters.
import { fmtTime, money } from '../core';
import { influence, influenceWord } from '../books';
import { standingWord, traitWords } from '../jobs';
import { skillWord, SKILLS, SKILL_LABEL } from '../people';
import { arch, ARCH_WORD } from '../voice';
import type { Character } from '../types';
import { esc, famClass, initials, P, S, W } from './links';

export const ICON: Record<string, string> = {
  car: '<path d="M4 16V12l2-5h12l2 5v4M4 16h16M4 16v2M20 16v2"/><circle cx="8" cy="14" r=".6"/><circle cx="16" cy="14" r=".6"/>',
  cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  shop: '<path d="M4 10l1-5h14l1 5M5 10v9h14v-9M4 10h16"/>',
  mask: '<path d="M4 8c3-2 13-2 16 0v4c0 4-3 7-8 7s-8-3-8-7z"/><circle cx="9" cy="11" r="1"/><circle cx="15" cy="11" r="1"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.5 0 4 1.7 4 4"/>',
  wrench: '<path d="M14 6a4 4 0 0 0-5 5l-6 6 3 3 6-6a4 4 0 0 0 5-5l-3 2-2-2z"/>',
};
export const svg = (name: string, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] ?? ''}</svg>`;
export const chevron = `<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;

export const sink: { on: string[] | null } = { on: null };
export function banner(id: string, icon: string, tone: 'g' | 'a' | 'b' | 'r', title: string, sub: string, body: string, mode: 'live' | 'avail' | '' = ''): string {
  const open = !!S.open[id];
  if (!mode) mode = id.startsWith('p:') || id.startsWith('o:') ? 'avail' : id === 'op:hijack' ? (sub.includes('out right now') ? 'live' : 'avail') : id.startsWith('op:') ? (sub.includes('running') ? 'live' : 'avail') : id.startsWith('r:') ? (/^(0 |none)/.test(sub) ? 'avail' : 'live') : '';
  const html = `<div class="banner ${mode} ${open ? 'open' : ''}"><button type="button" data-a="tog:${id}" aria-expanded="${open}"><span class="ico ${tone}">${svg(icon)}</span><span class="bt"><b>${esc(title)}${mode === 'live' ? '<i class="pill">running</i>' : mode === 'avail' ? '<i class="pill off">available</i>' : ''}</b><span>${esc(sub)}</span></span>${chevron}</button><div class="body">${body}</div></div>`;
  if (sink.on) { sink.on.push(html); return ''; }
  return html;
}

export const back = (label = 'Back') => `<button class="back" data-a="back:"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>${esc(label)}</button>`;

export function strip(): string {
  const w = W();
  const p = P();
  const heat = Math.min(1, p.heat);
  const heatWord = heat < 0.15 ? 'Quiet' : heat < 0.4 ? 'Noticed' : heat < 0.7 ? 'Hot' : 'Burning';
  const bits: string[] = [];
  if (p.cars) bits.push(`${p.cars} car${p.cars > 1 ? 's' : ''}`);
  if (p.goods) bits.push(`${money(p.goods)} in goods`);
  return `<div class="strip"><div><div class="when">${esc(fmtTime(w.now))}</div><div class="cash">${money(p.cash)}</div></div>
    <div class="meter"><span>Heat</span><div class="track"><i style="width:${Math.round(heat * 100)}%"></i></div><b class="${heat > 0.4 ? 'hurt' : 'good'}">${heatWord}</b></div></div>
    <div class="whoami">${esc(p.name)} &middot; ${esc(p.familyId ? w.fam[p.familyId].name : 'independent')} &middot; ${esc(p.district)}${p.hurtUntil > w.now ? ' &middot; <b class="hurt">hurt</b>' : ''}${bits.length ? ' &middot; carrying ' + bits.join(', ') : ''}</div>
    <div class="attrs"><span>Rank <b>${p.rank}</b></span><span>Reputation <b>${standingWord(p.standing)}</b></span><span>Influence <b>${influenceWord(influence(w, p))}</b></span></div>`;
}

export function skillBars(c: Character): string {
  return `<ul class="rows">${SKILLS.map((k) => `<li><span>${SKILL_LABEL[k]}</span><span class="v">${skillWord(c.skills[k])}</span></li>`).join('')}</ul>`;
}
export const skillLine = (c: Character) => SKILLS.map((k) => ({ k, v: c.skills[k] })).sort((a, b) => b.v - a.v).slice(0, 2).map(({ k, v }) => `${skillWord(v)} ${SKILL_LABEL[k].toLowerCase()}`).join(', ');

export function traitTags(c: Character): string {
  return `<span class="tag">${esc(ARCH_WORD[arch(c)])}</span><span class="tag">${esc(traitWords(c))}</span>`;
}

export const avatar = (c: Character) => `<div class="avatar pt">${portrait(c)}</div>`;

export function meterRow(label: string, word: string, v: number, tone: '' | 'brass' | 'red' = ''): string {
  return `<div class="stat"><div class="l"><span>${esc(label)}</span><b>${esc(word)}</b></div><div class="bar ${tone}"><i style="width:${Math.round(Math.max(3, Math.min(100, v * 100)))}%"></i></div></div>`;
}
