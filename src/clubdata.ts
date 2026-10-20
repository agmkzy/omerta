// The social club as a place in the world: it belongs to a family, has an owner and hours, remembers who comes in,
// and knows who is there at any moment. Who is there is a pure function of the clock and each man's circumstances,
// so every screen that asks gets the same answer. Nothing here talks; see club.ts for the scenes.
import { travelTime } from './core';
import { hash } from './voice';
import { Character, DAY, Id, World } from './types';

export const CLUB_HOURS: [number, number] = [11, 26];
export interface ClubMem { last: number; seen: Record<string, string>; note?: { text: string; until: number }; said?: string }
export interface Club {
  id: Id; name: string; district: string; familyId: Id; ownerId: Id;
  hostId?: Id; // V76: whoever leads the organisation holds court here (the club is the leader's seat)
  open: [number, number];
  mem: Record<Id, ClubMem>;
  visit?: number; // the slot in which somebody last approached the player, so a reload can't roll the dice again
}
export interface Scene { npc: Id; topic: string; node: string; data: Record<string, string | number>; log: string[]; mins: number; t: number; ended?: boolean }

const NAMES = ['Cafe Roma', 'Sorrento Social Club', 'Bella Napoli Social Club', 'Mulberry Street Club', 'Casa Calabria', 'Liberty Social Club'];
const RK = ['associate', 'soldier', 'capo', 'underboss', 'boss'];
const made = (c: Character) => RK.indexOf(c.rank) >= 1;

function pickOwner(w: World, famId: Id): Id | undefined {
  const members = Object.values(w.chars).filter((c) => c.alive && c.familyId === famId && !c.isPlayer && c.rank !== 'civilian');
  const capos = members.filter((c) => c.rank === 'capo').sort((a, b) => Object.values(w.chars).filter((x) => x.bossId === b.id).length - Object.values(w.chars).filter((x) => x.bossId === a.id).length);
  return (capos[0] ?? members.find((c) => c.rank === 'underboss') ?? members.find((c) => made(c)))?.id;
}
export function ensureClubs(w: World) {
  const clubs = (w.clubs ??= {});
  let i = 0;
  for (const f of Object.values(w.fam)) {
    let cl = clubs[f.id];
    if (!cl) {
      const owner = pickOwner(w, f.id);
      if (!owner) continue;
      cl = clubs[f.id] = { id: 'club:' + f.id, name: NAMES[i % NAMES.length], district: f.districts[0] ?? w.chars[owner].district, familyId: f.id, ownerId: owner, open: CLUB_HOURS, mem: {} };
    }
    i++;
    if (!w.chars[cl.ownerId]?.alive || w.chars[cl.ownerId].familyId !== f.id || w.chars[cl.ownerId].isPlayer) { const o = pickOwner(w, f.id); if (o) cl.ownerId = o; }
  }
}
export const clubOf = (w: World, famId: Id | null | undefined): Club | undefined => (famId ? w.clubs?.[famId] : undefined);

const hourNow = (w: World) => { const h = (w.now % DAY) / 60; return h < 4 ? h + 24 : h; };
export const clubOpen = (w: World, cl: Club) => { const h = hourNow(w); return h >= cl.open[0] && h < cl.open[1]; };
export const weekday = (w: World) => Math.floor(w.now / DAY) % 7; // the clock starts on a Monday

export interface Here { c: Character; role: 'owner' | 'regular' | 'boss'; doing: string }

function away(w: World, c: Character): boolean {
  if (c.jailedUntil > w.now || c.hurtUntil > w.now) return true;
  if (w.jobs.some((j) => j.status === 'active' && j.assignee === c.id)) return true;
  const h = (w.now % DAY) / 60; // asleep
  const wake = c.wake, sleep = c.sleep % 24;
  if (sleep > wake ? h >= sleep || h < wake : h >= sleep && h < wake) return true;
  return false;
}

// Who is in the club right now. Stable for a three-hour stretch.
export function clubPresent(w: World, cl: Club): Here[] {
  if (!clubOpen(w, cl)) return [];
  const slot = Math.floor(w.now / 180);
  const hr = hourNow(w) % 24;
  const evening = hr >= 18 || hr < 3;
  const dow = weekday(w);
  const p = w.chars[w.playerId!];
  const out: Here[] = [];
  for (const c of Object.values(w.chars)) {
    if (!c.alive || c.familyId !== cl.familyId || c.rank === 'civilian' || c.isPlayer) continue;
    if (c.jailedUntil > w.now || c.hurtUntil > w.now) continue;
    if (c.id === cl.ownerId) { if (!away(w, c) || c.jailedUntil <= w.now) out.push({ c, role: 'owner', doing: 'behind the counter' }); continue; }
    if (away(w, c)) continue;
    let pr = ({ associate: 0.14, soldier: 0.2, capo: 0.26, underboss: 0.12, boss: 0.05 } as Record<string, number>)[c.rank] ?? 0.3;
    if (c.rank === 'boss' || c.rank === 'underboss') { if (evening && (dow === 3 || dow === 6)) pr = 0.85; }
    if (c.job && !evening && dow < 5) pr *= 0.2; // working a day job
    if (c.hustle && !evening) pr *= 0.6;
    if (c.problem?.kind === 'gambling' && evening) pr += 0.3;
    if (c.bossId === cl.ownerId) pr += 0.15;
    const seat = p && cl.hostId === p.id && p.familyId === cl.familyId; // the club is the player's seat: the men who matter come to pay respects
    const wait = !!seat && (c.rank === 'capo' || c.rank === 'underboss');
    if (wait) pr = Math.max(pr, evening ? 0.6 : 0.4);
    if (p && c.bossId === p.id && w.sunday && dow === 6 && hr >= 12 && hr < 20) pr = 0.9; // envelope day
    if (p && travelTime(c.district, cl.district) > 20 && c.district !== cl.district) pr *= 0.75;
    if ((hash(c.id + ':' + slot) % 1000) / 1000 < pr) {
      const doing = c.rank === 'boss' || c.rank === 'underboss' ? 'at the back table' : c.problem?.kind === 'gambling' && evening ? 'in the card game' : c.bossId === p?.id ? 'waiting on a word from you' : wait ? 'waiting to be seen' : evening ? 'with a drink' : 'over an espresso';
      out.push({ c, role: c.rank === 'boss' || c.rank === 'underboss' ? 'boss' : 'regular', doing });
    }
  }
  const order = ['boss', 'underboss', 'capo', 'soldier', 'associate'];
  return out.sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : 0) || order.indexOf(a.c.rank) - order.indexOf(b.c.rank));
}

export const memOf = (cl: Club, id: Id): ClubMem => (cl.mem[id] ??= { last: -1e9, seen: {} });
