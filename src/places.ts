import { clubTalk, sceneLines } from './sitmoves';
// Rooms where people actually are. Who is in is a pure function of the clock and the man, so it is stable between looks.
import { forceEncounter } from './encounters';
import { forceBossOffer } from './jobs';
import { clamp, feelOn, learn, money, rel } from './core';
import { hash, pick } from './voice';
import { DAY, Character, World } from './types';
import { clubOf, clubPresent } from './clubdata';

export interface Place {
  id: string;
  name: string;
  blurb: string;
  open: [number, number]; // hours
}
export const PLACES: Place[] = [
  { id: 'club', name: 'The Social Club', blurb: 'Espresso, a card table in the back, and the men who matter.', open: [11, 26] },
  { id: 'barber', name: 'The Barber Shop', blurb: 'Three chairs, a radio, and more gossip per square foot than the courthouse.', open: [8, 19] },
  { id: 'bar', name: 'The Corner Bar', blurb: 'Where men stop pretending to be anything but what they are, around the third drink.', open: [16, 28] },
];

export function present(w: World, p: Character, placeId: string): Character[] {
  if (placeId === 'club') {
    const cl = clubOf(w, p.familyId);
    return cl ? clubPresent(w, cl).map((x) => x.c) : [];
  }
  const pl = PLACES.find((x) => x.id === placeId)!;
  const hr = (w.now % DAY) / 60;
  const h = hr < 4 ? hr + 24 : hr;
  if (h < pl.open[0] || h >= pl.open[1]) return [];
  const slot = Math.floor(w.now / 240);
  const out: Character[] = [];
  for (const c of Object.values(w.chars)) {
    if (!c.alive || c.id === p.id || c.familyId !== p.familyId || c.rank === 'civilian') continue;
    if (c.jailedUntil > w.now || c.hurtUntil > w.now) continue;
    const key = (hash(c.id + ':' + slot) % 1000) / 1000;
    if (key < 0.3) out.push(c);
  }
  return out;
}

const hourNow = (w: World) => {
  const h = (w.now % DAY) / 60;
  return h < 4 ? h + 24 : h;
};
export const isOpen = (w: World, id: string) => {
  const pl = PLACES.find((x) => x.id === id)!;
  const h = hourNow(w);
  return h >= pl.open[0] && h < pl.open[1];
};

// The room as you sit down in it: the hour, and the men in it doing what men do at a club. Said once a visit, never the same way twice
// running (the hour and the men pick it, so the same afternoon reads the same).
function clubAir(w: World, p: Character, here: Character[]): string {
  const h = (w.now % 1440) / 60, k = String(w.now);
  const men = here.filter((c) => c.id !== p.id);
  const a = men[hash(k + 'a') % Math.max(1, men.length)], b = men.filter((c) => c !== a)[hash(k + 'b') % Math.max(1, men.length - 1)];
  const top = men.find((c) => c.rank === 'boss' || c.rank === 'underboss');
  const fn = (c: Character) => c.name.split(' ')[0];
  const plain = h < 12
    ? ['The morning crowd: espresso, the Daily News folded to the racing page, and nobody saying much before ten.', 'Somebody’s mother has sent over a tray of sfogliatelle. Nobody admits to being hungry. The tray is empty in ten minutes.', 'The shutters are half up. The men who are here this early are the ones who never really leave.']
    : h < 18
      ? ['Smoke, espresso, the click of a dominoes game. Nobody asks what you want. They already know.', 'A card game in the back, and a quiet table by the window where the older men sit. You nod at both.', 'The radio is on a ballgame. Nobody’s listening to it. Everybody is listening to everybody else.', 'Two men at the counter are arguing about Sinatra. It is not really about Sinatra.']
      : ['The lights are low and the talk is lower. This is the hour business gets done.', 'Anisette in small glasses, a pot of coffee nobody pays for, and the door watched without anyone seeming to watch it.', 'The card game has been going since supper. The pot in the middle is more than most men here make in a week.', 'A man comes in, says a name to the counter, and is shown to the back. Nobody turns round.'];
  const named = a && b ? [`${fn(a)} is losing at gin to ${fn(b)} and pretending he isn’t.`, `${fn(a)} and ${fn(b)} stop talking when you sit down, then start again, about something else.`, `${fn(a)} catches your eye across the room and lifts his cup an inch. It is not nothing.`, `${fn(b)} is telling a story about a truck and a priest. ${fn(a)} has heard it before and laughs anyway.`] : a ? [`${fn(a)} is alone at the counter with the paper. He folds it when you come in.`] : [];
  if (top && hash(k + 't') % 3 === 0) return `${top.name} is at the back table, and the whole room is quieter for it. Men lower their voices without being asked.`;
  const pool = [...plain, ...named];
  return pool[hash(k) % pool.length];
}
// An evening of sitting with the men. Things find you.
export function sitAtClub(w: World, p: Character): { lines: string[]; minutes: number } {
  const here = present(w, p, 'club');
  const lines: string[] = [];
  if (!here.length) return { lines: ['The club is quiet. A radio plays low, and the man behind the counter polishes the same cup for ten minutes.'], minutes: 60 };
  lines.push(clubAir(w, p, here));
  // overhear
  const talkers = here.filter((c) => c.rank !== 'boss');
  const t = talkers.length ? talkers[hash(String(w.now)) % talkers.length] : undefined;
  if (t) {
    const f = Object.keys(t.known).map((id) => w.facts[id]).find((q) => q && !q.minor && !p.known[q.id] && w.now - q.t < 30 * 1440);
    if (f && w.rng.chance(0.55)) {
      learn(w, p.id, f, t.id, true);
      lines.push(`You catch half of what ${t.name} is telling the man next to him. You put the rest together: ${f.text}`);
    }
  }
  lines.push(...sceneLines(w, p, here));
  lines.push(...clubTalk(w, p, here));
  // being seen at the club regularly is how a man becomes someone people talk in front of
  { const mate = here.filter((c) => c.id !== p.id)[hash(String(w.now) + 'm') % Math.max(1, here.length - 1)]; if (mate) { const r = rel(mate, p.id); feelOn(w, r, 'trust', 0.015); r.lastMet = w.now; } }
  // the boss is in
  const top = here.find((c) => c.id === p.bossId || c.rank === 'boss' || c.rank === 'underboss');
  if (top && w.rng.chance(0.3) && forceBossOffer(w)) lines.push(`${top.name} beckons you to the back table without a word. You go.`);
  // somebody wants a word
  if (w.rng.chance(0.55) && forceEncounter(w)) lines.push('Someone has been waiting for you to sit down.');
  return { lines, minutes: 90 };
}

export function shave(w: World, p: Character): { lines: string[]; minutes: number } {
  if (p.cash < 20) return { lines: ['You don’t have twenty dollars for a shave.'], minutes: 5 };
  p.cash -= 20;
  const lines = [pick(['The barber lays you back, puts a hot towel over your face, and says nothing, which is when the talking starts.', 'Hot lather, an open razor at your throat, and a man who has known three generations of your neighbourhood.'], String(w.now))];
  const f = Object.values(w.facts).filter((q) => !q.minor && q.district === p.district && !p.known[q.id] && w.now - q.t < 45 * 1440).sort((a, b) => b.t - a.t)[0];
  if (f) {
    learn(w, p.id, f, 'public', true);
    lines.push(`Between the towel and the powder you hear it, quietly, from the chair beside you: ${f.text}`);
  } else lines.push('Nothing worth repeating gets said. That, too, is a kind of news.');
  p.heat = Math.max(0, p.heat - 0.03);
  return { lines, minutes: 50 };
}

export function drinkAt(w: World, p: Character): { lines: string[]; minutes: number } {
  if (p.cash < 30) return { lines: ['You can’t afford a night out.'], minutes: 5 };
  p.cash -= 30;
  const lines = ['A few drinks at the end of the bar.'];
  const stranger = Object.values(w.chars).filter((c) => c.alive && c.id !== p.id && c.district === p.district && !p.rels[c.id] && w.rng.chance(0.2))[0];
  if (stranger) {
    p.rels[stranger.id] = { trust: 0.25, respect: 0.3, affection: 0.2, grudge: 0, lastMet: w.now };
    lines.push(`A man at the next stool starts a conversation about nothing. ${stranger.name}, ${stranger.rank === 'civilian' ? 'in the neighbourhood' : stranger.rank}. You’ll know each other's faces from now on.`);
  }
  if (w.rng.chance(0.35) && forceEncounter(w)) lines.push('Somebody catches your eye on the way out.');
  return { lines, minutes: 150 };
}
