// Where a man is right now. A pure function of the clock and the man, so it is stable between looks.
import { ownerBiz, travelTime } from './core';
import { PLACES, isOpen, present } from './places';
import { Character, DAY, World } from './types';
import { routine, spotById, travel } from './city';
import { clubPresent } from './clubdata';

export type WhereKind = 'club' | 'bar' | 'barber' | 'shop' | 'home' | 'jail' | 'hurt' | 'cafe' | 'church' | 'track';
export interface Where { kind: WhereKind; name: string; line: string; mins: number; placeId?: string }

export function whereIs(w: World, p: Character, c: Character): Where {
  const hr = (w.now % DAY) / 60;
  const trip = (district: string) => travelTime(p.district, district);
  if (c.jailedUntil > w.now) return { kind: 'jail', name: 'locked up', line: 'He’s locked up and out of reach.', mins: 0 };
  if (c.hurtUntil > w.now) return { kind: 'hurt', name: `laid up in ${c.district}`, line: 'He’s laid up at home, nursing it.', mins: trip(c.district) };
  // (his family's club, by the club's own reckoning, wherever it stands; then, in the district built properly, his routine: city.ts)
  const cl = c.familyId ? w.clubs?.[c.familyId] : undefined;
  if (cl && c.rank !== 'civilian' && clubPresent(w, cl).some((x) => x.c.id === c.id)) return { kind: 'club', name: cl.name, line: `He’s at ${cl.name}, ${cl.district}.`, mins: trip(cl.district), placeId: cl.district === 'Little Italy' ? 'li:club:' + cl.familyId : 'club' };
  const r = routine(w, c, w.now);
  if (r === 'home') return { kind: 'home', name: `home in ${c.district}`, line: `He’s at home in ${c.district}.`, mins: trip(c.district) };
  const s = r ? spotById(w, r) : undefined;
  if (s) return { kind: s.kind === 'biz' ? 'shop' : s.kind, name: s.name, line: `He’s at ${s.name}${s.kind === 'track' ? '' : `, ${s.district}`}.`, mins: travel(p.district, s), placeId: s.id };
  for (const pl of PLACES) {
    if (isOpen(w, pl.id) && present(w, p, pl.id).some((x) => x.id === c.id))
      return { kind: pl.id as WhereKind, name: pl.name, line: `He’s at ${pl.name}.`, mins: 15, placeId: pl.id };
  }
  const b = ownerBiz(w, c.id);
  if (b?.open && hr >= 9 && hr < 19) return { kind: 'shop', name: b.name, line: `He’s at ${b.name}, ${b.district}.`, mins: trip(b.district) };
  return { kind: 'home', name: `home in ${c.district}`, line: `He’s at home in ${c.district}.`, mins: trip(c.district) };
}
