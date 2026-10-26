// Authority (spec §6.2): what a man is entitled to do, read from the hierarchy as it stands. Objective: what others believe he may
// do is their perception, not this. Requests route by it: a man who cannot order the one causing the trouble takes it to the man who
// can (the chair), and a promise beyond a man's power is an overpromise, recorded as such.
import { crewGround } from '../econ';
import type { Character, Id, World } from '../types';

export type Power = 'order' | 'chair' | 'speakForFamily' | 'protect' | 'refer';
const RANK = ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'];
export const rankOf = (c: Character) => Math.max(0, RANK.indexOf(c.rank));
// the men above him, nearest first
export function superiors(w: World, c: Character): Character[] {
  const out: Character[] = [];
  let x = c.bossId ? w.chars[c.bossId] : undefined;
  for (let i = 0; i < 8 && x; i++) { out.push(x); x = x.bossId ? w.chars[x.bossId] : undefined; }
  return out;
}
export const captainOf = (w: World, c: Character) => superiors(w, c).find((x) => x.rank === 'capo');
// The lowest man with standing to settle a matter between `for` and `against`: for a civilian against a family man, that man's captain
// or above; between two men of one family, their lowest common superior; across families, the boss of the man complained of.
export function chairFor(w: World, against: Character, forC?: Character): Character | undefined {
  const up = superiors(w, against).filter((x) => x.alive);
  if (forC && forC.familyId && forC.familyId === against.familyId) {
    const theirs = new Set([forC.id, ...superiors(w, forC).map((x) => x.id)]);
    return up.find((x) => theirs.has(x.id));
  }
  if (forC && forC.familyId && forC.familyId !== against.familyId) return up.find((x) => x.rank === 'boss');
  return up.find((x) => rankOf(x) >= rankOf({ rank: 'capo' } as Character));
}
export function may(w: World, actor: Character, power: Power, over?: Character): boolean {
  if (!actor.alive) return false;
  switch (power) {
    case 'refer': return true;
    case 'order': return !!over && superiors(w, over).some((x) => x.id === actor.id);
    case 'chair': return !!over && chairFor(w, over)?.id === actor.id;
    case 'speakForFamily': return ['boss', 'underboss'].includes(actor.rank) || actor.rank === 'capo';
    case 'protect': {
      if (rankOf(actor) < 1 || !over) return false;
      const b = Object.values(w.biz).find((x) => x.ownerId === over.id && x.open);
      return !!b && crewGround(w, actor).has(b.district) && (!b.protection || b.protection.familyId === actor.familyId);
    }
  }
}
// What he would need to deliver a promise of a result against `against`: can he order it himself, or only ask someone who can?
export function reach(w: World, actor: Character, against: Character): { can: boolean; via?: Id } {
  if (may(w, actor, 'order', against)) return { can: true };
  return { can: false, via: chairFor(w, against)?.id };
}

// The shops the player could put protection to, the one list every screen reads (the coherence repair, phase 10): Rackets lists them,
// conversation offers the pitch to their owners, the guide points at them. A shop in his crew's ground that pays nobody, its owner a
// civilian, alive and open for business. (A shop paying a family, his own or another, is not a pitch: it is a matter between families.)
export function leanable(w: World, p: Character) {
  const ground = crewGround(w, p);
  return Object.values(w.biz).filter((b) => canLean(w, p, b, ground)).sort((a, b) => b.income - a.income || (a.id < b.id ? -1 : 1));
}
// one place, by the same rule (the list above is every place that passes it)
export function canLean(w: World, p: Character, b: World['biz'][string], ground = crewGround(w, p)): boolean {
  const o = w.chars[b.ownerId];
  return b.open && b.kind !== 'casino' && !b.protection && !!o?.alive && !o.isPlayer && o.rank === 'civilian' && rankOf(p) >= 1 && ground.has(b.district);
}
