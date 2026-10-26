// Places and routines (the made man's life, Phase 1.6: locations, as a slice: one district done properly before seven). Little Italy
// has its own places, each with its hours and its regulars, and every business in it can be walked into. Where a man who lives there
// is, at any hour, follows his life: his shop or the street by day, his family's club in the evening if he is made, the bar if he
// drinks, the track on a Saturday if he gambles, church on a Sunday morning if he is that kind of man, home late. It is a pure
// function of the man and the clock, so it is stable between looks, needs nothing saved, and changes nothing in the simulation
// (only the screens and the conversation's scene read where a man is). The other districts keep the old rooms until this plays well.
import { isAwake, ownerBiz, travelTime } from './core';
import { clubPresent } from './clubdata';
import { temper } from './temper';
import { DAY, type Character, type World } from './types';

export const SLICE = 'Little Italy';
const bizKind = new Map<string, string>(); // (filled as places are listed: what trade a business is, for its hours)
export type SpotKind = 'club' | 'cafe' | 'barber' | 'bar' | 'church' | 'track' | 'biz';
export interface Spot { id: string; name: string; kind: SpotKind; blurb: string; open: [number, number]; district: string; biz?: string; famId?: string; on?: string }

const FIXED: Omit<Spot, 'district'>[] = [
  { id: 'li:cafe', name: 'Ferrara’s Pastry Shop', on: 'Grand Street', kind: 'cafe', blurb: 'Espresso, cannoli and a window onto the whole street. Men who want to be seen sit at the front.', open: [8, 23] },
  { id: 'li:barber', name: 'Sal’s Barber Shop', on: 'Mott Street', kind: 'barber', blurb: 'Three chairs, a radio, and more gossip per square foot than the courthouse.', open: [8, 19] },
  { id: 'li:bar', name: 'The Grotto', on: 'Grand Street', kind: 'bar', blurb: 'Dark at noon, darker at midnight. Where men stop pretending to be anything but what they are.', open: [16, 28] },
  { id: 'li:church', name: 'Most Precious Blood', on: 'Baxter Street', kind: 'church', blurb: 'The feast starts from its steps. On Sunday mornings the men who matter stand at the back.', open: [7, 13] },
];
export const TRACK: Spot = { id: 'track', name: 'Aqueduct Racetrack', on: 'Queens', kind: 'track', blurb: 'Saturday afternoons, the horses, and every gambler in the city.', open: [12, 18], district: 'Queens' };

/** Every place in the slice's district: the family club (its headquarters), the fixed places, and every business. */
export function spots(w: World): Spot[] {
  const out: Spot[] = [];
  for (const cl of Object.values(w.clubs ?? {})) if (cl.district === SLICE) out.push({ id: 'li:club:' + cl.familyId, name: cl.name, on: 'Mulberry Street', kind: 'club', blurb: `The ${w.fam[cl.familyId]?.name ?? ''} family’s club. Espresso, a card table in the back, and the men who matter.`, open: [11, 26], district: SLICE, famId: cl.familyId });
  for (const s of FIXED) out.push({ ...s, district: SLICE });
  for (const b of Object.values(w.biz)) if (b.district === SLICE && b.open) bizKind.set(b.id, b.kind);
  for (const b of Object.values(w.biz)) if (b.district === SLICE && b.open) out.push({ id: 'biz:' + b.id, name: b.name, kind: 'biz', blurb: '', open: HOURS[b.kind] ?? [9, 19], district: SLICE, biz: b.id });
  return out;
}
// (a place keeps the hours of its trade: a tavern opens in the afternoon and shuts late; a bakery is up before dawn; the casino is a
// night's business; ordinary shops keep nine to seven and shut on Sundays)
const HOURS: Record<string, [number, number]> = { bar: [15, 27], restaurant: [11, 24], cafe: [7, 23], bakery: [6, 17], casino: [19, 28], funeral: [9, 20] };
const SUNDAY_OPEN = new Set(['bar', 'restaurant', 'cafe', 'bakery', 'casino', 'funeral']);
const hourOf = (t: number) => { const h = (t % DAY) / 60; return h < 4 ? h + 24 : h; };
export const openAt = (s: Spot, t: number) => { const h = hourOf(t), dow = Math.floor(t / DAY) % 7; if (s.kind === 'track') return dow === 5 && h >= 12 && h < 18; if (s.kind === 'biz' && dow === 6 && !SUNDAY_OPEN.has(bizKind.get(s.biz ?? '') ?? '')) return false; return h >= s.open[0] && h < s.open[1]; };

/** Where a man who lives in the slice's district is at time t: a place id, or 'home'. Undefined for anyone else. */
export function routine(w: World, c: Character, t: number): string | undefined {
  if (c.isPlayer) return undefined;
  const b = ownerBiz(w, c.id);
  // (who is in a family's club is the club's own reckoning, clubdata.clubPresent, read by whereIs first; a routine is the rest of a
  // man's day. A man with a shop on the street is in it by day wherever he lives; a man who lives here keeps his whole day here.)
  if (c.district !== SLICE) {
    if (!isAwake(c, t)) return undefined;
    if (b?.district === SLICE && b.open) { const sp = spots(w).find((x) => x.biz === b.id); if (sp && openAt(sp, t)) return sp.id; }
    return undefined;
  }
  if (c.rank === 'civilian' && !b) return undefined;
  if (!isAwake(c, t)) return 'home';
  const h = hourOf(t), dow = Math.floor(t / DAY) % 7, tp = temper(c), all = spots(w);
  // Sunday morning: church, for the men who go (the gentler, the older, the ones whose mothers ask)
  if (dow === 6 && h >= 9 && h < 12 && (1 - c.traits.violence + tp.empathy) / 2 > 0.5) return 'li:church';
  // Saturday afternoon: the track, for a gambler
  if (dow === 5 && h >= 12 && h < 18 && c.traits.vice >= 0.55) return 'track';
  // working hours: his own shop, if he has one
  if (b?.open && b.district === SLICE) { const sp = all.find((x) => x.biz === b.id); if (sp && openAt(sp, t)) return sp.id; }
  if (c.rank === 'civilian') return h >= 19 && c.traits.vice >= 0.6 ? 'li:bar' : 'home';
  // a man in the life by day: on the street (the café for a sociable man, the barber's for a talker, his club otherwise)
  if (h >= 9 && h < 19) return c.traits.sociability > 0.6 ? 'li:cafe' : c.traits.sociability > 0.4 && h < 13 ? 'li:barber' : 'li:cafe';
  // evening: a drinker at the bar, the rest at the café until it shuts, then home (the club, when he is there, is the club's own reckoning)
  if (h >= 19 && h < 26) return c.traits.vice >= 0.65 ? 'li:bar' : h < 23 ? 'li:cafe' : 'home';
  return 'home';
}
export const spotById = (w: World, id: string) => (id === 'track' ? TRACK : spots(w).find((s) => s.id === id));
/** Who is at a place now (men in the life and shop owners; the player sees everyone in a public place). */
export function whoIsAt(w: World, id: string): Character[] {
  if (id.startsWith('li:club:')) { const cl = Object.values(w.clubs ?? {}).find((x) => 'li:club:' + x.familyId === id); return cl ? clubPresent(w, cl).map((x) => x.c) : []; }
  return Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.jailedUntil <= w.now && c.hurtUntil <= w.now && routine(w, c, w.now) === id);
}
export const travel = (from: string, s: Spot) => (s.kind === 'track' ? 50 : travelTime(from, s.district));
/** When a man is next at a place, from t, within a day (half-hour steps): when the player could wait for him there. */
export function nextAt(w: World, c: Character, id: string, t: number): number | undefined {
  for (let x = t; x <= t + DAY; x += 30) if (routine(w, c, x) === id) return x;
  return undefined;
}
/** The men the player knows who come here in the coming day, and when (not those in now). */
export function regulars(w: World, p: Character, id: string): { c: Character; at: number }[] {
  return Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.jailedUntil <= w.now && ((c.rels[p.id]?.known ?? 0) > 0.1 || c.familyId === p.familyId) && routine(w, c, w.now) !== id)
    .map((c) => ({ c, at: nextAt(w, c, id, w.now) })).filter((x): x is { c: Character; at: number } => x.at !== undefined).sort((a, b) => a.at - b.at || (a.c.id < b.c.id ? -1 : 1)).slice(0, 6);
}
