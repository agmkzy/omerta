// Who you were before March 1970. It decides who already knows your name, not what you are allowed to become.
import { clamp, rel } from './core';
import { Character, Id, World } from './types';

export interface Background { id: string; label: string; blurb: string }
export const BACKGROUNDS: Background[] = [
  { id: 'hustler', label: 'Street hustler', blurb: 'You know the local bookmakers and a few small-time crooks. Quick with your head, short on cash.' },
  { id: 'boxer', label: 'Former boxer', blurb: 'You came up in the gyms. Men who work with their hands remember you. Heavy hitter, known face.' },
  { id: 'connected', label: 'Connected family', blurb: 'A relative is already in the Corrente family. Doors open, and people watch to see if you deserve it.' },
  { id: 'business', label: 'Small businessman', blurb: 'You ran a shop. You know the owners, you know the books, and you have a little money.' },
  { id: 'convict', label: 'Ex-convict', blurb: 'You did time. You have contacts inside and out, and the police have a file on you.' },
  { id: 'driver', label: 'Driver', blurb: 'You can drive anything. You know the garages and the men who move cars.' },
];
export const bgLabel = (id?: string) => BACKGROUNDS.find((b) => b.id === id)?.label;

function know(w: World, p: Character, c: Character | undefined, trust: number) {
  if (!c) return;
  rel(p, c.id).trust = Math.max(rel(p, c.id).trust, trust);
  rel(c, p.id).trust = Math.max(rel(c, p.id).trust, trust);
  (p.intro ??= {})[c.id] = w.now;
  rel(p, c.id).lastMet = w.now - 10 * 1440;
  rel(c, p.id).lastMet = w.now - 10 * 1440;
}
const some = <T,>(w: World, a: T[], n: number) => { const x = [...a]; const out: T[] = []; while (x.length && out.length < n) out.push(x.splice(w.rng.int(0, x.length - 1), 1)[0]); return out; };
const sk = (p: Character, k: keyof Character['skills'], d: number) => { p.skills[k] = clamp(p.skills[k] + d, 0, 1); };

export function applyBackground(w: World, p: Character, id: string) {
  p.bg = id;
  const all = Object.values(w.chars).filter((c) => c.alive && c.id !== p.id);
  const owners = (kinds: string[]) => Object.values(w.biz).filter((b) => b.open && kinds.includes(b.kind)).map((b) => w.chars[b.ownerId]).filter(Boolean);
  const made = all.filter((c) => c.familyId === p.familyId && c.rank !== 'civilian');
  const fam = (r: string) => made.filter((c) => c.rank === r);
  switch (id) {
    case 'hustler':
      some(w, owners(['bar', 'billiards', 'club', 'pawnshop']), 3).forEach((c) => know(w, p, c, 0.42));
      some(w, all.filter((c) => c.rank !== 'civilian' && c.traits.vice > 0.5 && c.id !== p.bossId), 2).forEach((c) => know(w, p, c, 0.35));
      sk(p, 'nerve', 0.1); sk(p, 'brains', 0.05); p.cash += 300;
      break;
    case 'boxer':
      some(w, all.filter((c) => c.rank !== 'civilian' && c.traits.violence > 0.55), 3).forEach((c) => know(w, p, c, 0.4));
      some(w, owners(['club', 'billiards']), 1).forEach((c) => know(w, p, c, 0.4));
      sk(p, 'muscle', 0.2); sk(p, 'nerve', 0.1); p.standing = clamp(p.standing + 3, 0, 100);
      break;
    case 'connected': {
      const cap = fam('capo')[0], sol = some(w, fam('soldier'), 1)[0];
      know(w, p, cap, 0.5); know(w, p, sol, 0.6);
      p.standing = clamp(p.standing + 5, 0, 100);
      break;
    }
    case 'business':
      some(w, owners(['restaurant', 'bakery', 'deli', 'grocer', 'butcher', 'tailor', 'cafe', 'barber']), 4).forEach((c) => know(w, p, c, 0.4));
      sk(p, 'brains', 0.2); p.cash += 1500;
      break;
    case 'convict':
      some(w, all.filter((c) => c.rank !== 'civilian' && c.traits.violence > 0.5), 2).forEach((c) => know(w, p, c, 0.4));
      some(w, all.filter((c) => c.rank === 'civilian'), 2).forEach((c) => know(w, p, c, 0.35));
      sk(p, 'nerve', 0.15); sk(p, 'muscle', 0.05); p.heat = clamp(p.heat + 0.25, 0, 1.5); p.standing = clamp(p.standing - 2, 0, 100);
      break;
    case 'driver':
      some(w, owners(['garage', 'pawnshop']), 2).forEach((c) => know(w, p, c, 0.42));
      sk(p, 'driving', 0.25); p.cars += 1; p.cash += 200;
      break;
  }
}
void (null as unknown as Id);
