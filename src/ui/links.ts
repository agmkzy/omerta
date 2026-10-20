// Every name is a door. Any person, business, family or incident that appears in text opens its own sheet.
import { fmtTime, money, ownerBiz } from '../core';
import type { Character, Id, World } from '../types';
import { P, S, W } from './state';

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const FAMCLASS = (w: World, id: Id | null) => (id ? 'f' + (Object.keys(w.fam).indexOf(id) % 5) : 'fx');

// Link a person, by name.
export const pl = (c: Character, label?: string) => `<a class="nm" href="#" data-a="ent:${c.id}">${esc(label ?? c.name)}</a>`;
export const bl = (id: Id, label?: string) => `<a class="nm" href="#" data-a="biz:${id}">${esc(label ?? W().biz[id].name)}</a>`;
export const fl = (id: Id, label?: string) => `<a class="nm" href="#" data-a="tree:${id}">${esc(label ?? W().fam[id].name)}</a>`;

// Replace every known name in a piece of text with a link. Longest names first so "Rocco Lucchese" wins over "Rocco".
let cache: { w: World; n: number; re: RegExp; map: Map<string, string> } | null = null;
function table() {
  const w = W();
  const n = Object.keys(w.chars).length + Object.keys(w.biz).length;
  if (cache && cache.w === w && cache.n === n) return cache;
  const map = new Map<string, string>();
  for (const c of Object.values(w.chars)) if (c.id !== w.playerId) map.set(esc(c.name), `ent:${c.id}`);
  for (const b of Object.values(w.biz)) map.set(esc(b.name), `biz:${b.id}`);
  for (const f of Object.values(w.fam)) map.set(esc(f.name) + ' family', `tree:${f.id}`);
  const names = [...map.keys()].sort((a, b) => b.length - a.length).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  cache = { w, n, re: new RegExp(`(${names.join('|')})`, 'g'), map };
  return cache;
}
// When the text names the player, it should say "you": nobody reads his own story in the third person.
export function youify(text: string): string {
  const w = W();
  const p = w.playerId ? w.chars[w.playerId] : undefined;
  if (!p || !text.includes(p.name)) return text;
  const n = p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let t = text.replace(new RegExp(`${n}[’']s`, 'g'), 'your').replace(new RegExp(n, 'g'), 'you');
  t = t.replace(/\b(you) (was|has|is|owes|wants|needs|gets|goes|says|asks|beats|lends|robs|pays)\b/g, (_m, y, v) => `${y} ${({ was: 'were', has: 'have', is: 'are' } as Record<string, string>)[v] ?? v.replace(/s$/, '')}`);
  return t.replace(/(^|[.!?:]\s+|["“]\s*)(you|your)\b/g, (_m, a, y) => a + y[0].toUpperCase() + y.slice(1));
}
export function lk(text: string): string {
  const t = table();
  return esc(youify(text)).replace(t.re, (m) => `<a class="nm" href="#" data-a="${t.map.get(m)}">${m}</a>`);
}

// -------------------------------------------------------------- small bits

export function chip(c: Character): string {
  const w = W();
  if (!c.familyId) return `<span class="chip fx">${c.rank === 'civilian' ? 'civilian' : 'independent'}</span>`;
  return `<span class="chip ${FAMCLASS(w, c.familyId)}">${esc(w.fam[c.familyId].name)}</span>`;
}
export const famClass = (id: Id | null) => FAMCLASS(W(), id);

export function who(c: Character): string {
  const w = W();
  const b = ownerBiz(w, c.id);
  const role = b ? `owns ${esc(b.name)}` : c.rank;
  return `${pl(c)} ${chip(c)} <span class="muted">${role}</span>`;
}

export const initials = (c: Character) => c.name.split(' ').map((s) => s[0]).slice(0, 2).join('');

export function statusOf(w: World, c: Character): { dot: string; word: string } {
  if (!c.alive) return { dot: 'dead', word: 'dead' };
  if (c.jailedUntil > w.now) return { dot: 'red', word: 'locked up' };
  if (c.hurtUntil > w.now) return { dot: 'red', word: 'laid up' };
  if (c.heat > 0.4) return { dot: 'amber', word: 'running hot' };
  return { dot: 'green', word: 'free' };
}

// Has the player any reason to know this man?
export function known(w: World, c: Character): boolean {
  const p = w.chars[w.playerId!];
  if (c.id === p.id || p.rels[c.id]) return true;
  if (c.familyId && c.familyId === p.familyId) return true;
  for (const k of Object.keys(p.known)) {
    const f = w.facts[k];
    if (f && (f.actor === c.id || f.victim === c.id)) return true;
  }
  return false;
}

export const stamp = (t: number) => fmtTime(t);
export { money, S, P, W };
