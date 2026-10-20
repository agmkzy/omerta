// V89: family among the people of the city, not just the player's own. In 1970 Little Italy a shared surname is usually a shared
// family: men who carry the same name are brothers or cousins, and they look out for each other (or resent each other).
// Nothing is stored: ties are read from names (and, for the player, from his own kin record), the same way for a new game and for
// a save made long before V89, so no relatives are ever added to an existing game and the save does not grow.
import type { Character, Id, World } from './types';

export type KinRole = 'brother' | 'cousin' | 'mother' | 'sister' | 'son' | 'daughter' | 'father' | 'kin';
export interface Tie { id: Id; role: KinRole }

const surname = (c: Character) => c.name.split(' ').slice(1).join(' ');
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
// The families' own names are their bosses' names: a man called Corrente is not every Corrente boss's brother.
const FAMILY_NAMES = (w: World) => new Set(Object.values(w.fam).map((f) => f.name));

let cache: { w: World; n: number; by: Map<string, Id[]> } | undefined;
function index(w: World) {
  const n = Object.keys(w.chars).length;
  if (cache && cache.w === w && cache.n === n) return cache.by;
  const by = new Map<string, Id[]>();
  const fams = FAMILY_NAMES(w);
  for (const c of Object.values(w.chars)) {
    if (c.isPlayer) continue;
    const s = surname(c);
    if (!s || fams.has(s)) continue;
    (by.get(s) ?? by.set(s, []).get(s)!).push(c.id);
  }
  cache = { w, n, by };
  return by;
}

// Everyone a man counts as family. Brother or cousin is decided by the pair itself, so both men always agree on it.
export function kinOf(w: World, c: Character): Tie[] {
  const out: Tie[] = [];
  const pl = w.playerId ? w.chars[w.playerId] : undefined;
  // the player's own family, from his record, both ways
  if (c.isPlayer) for (const k of w.life?.kin ?? []) out.push({ id: k.id, role: k.role as KinRole });
  else if (pl) { const k = w.life?.kin.find((x) => x.id === c.id); if (k) out.push({ id: pl.id, role: k.role === 'mother' || k.role === 'father' ? 'son' : k.role === 'son' || k.role === 'daughter' ? 'father' : k.role === 'sister' ? 'brother' : (k.role as KinRole) }); }
  if (!c.isPlayer) {
    const same = index(w).get(surname(c)) ?? [];
    // A shared name is a hint, not a family: most men who carry it are no relation. Each man belongs to a line of the name (decided
    // by his own id, so it never changes); men of the same line are brothers, and now and then two lines are cousins.
    if (same.length <= 6) {
      const lines = Math.max(6, same.length * 4);
      const line = (id: string) => hash(surname(c) + '#' + id) % lines;
      for (const id of same) {
        if (id === c.id) continue;
        if (line(id) === line(c.id)) out.push({ id, role: 'brother' });
        else if (hash([c.id, id].sort().join(':')) % 100 < 7) out.push({ id, role: 'cousin' });
      }
    }
  }
  return out;
}
export const kinTie = (w: World, a: Character, b: Character): KinRole | undefined => kinOf(w, a).find((t) => t.id === b.id)?.role;
// The living men of his family who are in the life (they are the ones who can do something about it).
export const madeKin = (w: World, c: Character) => kinOf(w, c).map((t) => w.chars[t.id]).filter((x): x is Character => !!x?.alive && !x.isPlayer && x.rank !== 'civilian');

// Family a man would actually go to: a brother always; a cousin only if they are close (decided by the pair, so both agree), or if
// they have come to know each other in play.
export function closeKin(w: World, a: Character, b: Character): boolean {
  const role = kinTie(w, a, b);
  if (!role) return false;
  if (role !== 'cousin') return true;
  const r = a.rels[b.id];
  if (r && (r.affection >= 0.35 || r.trust >= 0.45)) return true;
  return hash([a.id, b.id].sort().join('~close')) % 4 === 0;
}
