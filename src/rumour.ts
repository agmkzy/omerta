// V89: news as claims. An event happens once (a Fact); what each man holds is his version of it, and the version is shaped by who
// told him and how that man saw it. A teller may leave out a name he means to protect, put a name to a thing he never saw because
// he already hated the man, or make a sum sound bigger than it was. A wrong name travels as far as a right one, and the men who
// believe it hold it against the wrong man. Nothing here changes what happened; it changes what people think happened.
//
// And a man passes on what matters to the man he is talking to: what touched him, his family, his crew, his street, before what
// some stranger lost at cards.
import { clamp, factText, learn, money, peek, rel } from './core';
import { closeKin, kinTie } from './kin';
import { tierOf } from './retain';
import type { Character, Fact, Id, Knowledge, World } from './types';
import { arch } from './voice';

// Kinds where who did it is the whole story, and so where a name can be held back or put on the wrong man.
const WHODUNIT = new Set(['beating', 'vandalism', 'robbery', 'burglary', 'theft', 'murder', 'poach', 'scam']);
export type Claim = Knowledge & { how?: 's' | 't' | 'h'; blame?: Id; big?: 1 };
const claim = (c: Character, id: Id) => c.known[id] as Claim | undefined;

// How much a piece of news matters to the man hearing it. Below zero, he isn't told at all.
export function salience(w: World, to: Character, f: Fact): number {
  const near = (id?: Id) => {
    if (!id) return 0;
    if (id === to.id) return 1;
    const c = w.chars[id];
    if (!c) return 0;
    if (kinTie(w, to, c)) return 0.8;
    if (c.id === to.bossId || c.bossId === to.id) return 0.7;
    if (to.bossId && c.bossId === to.bossId) return 0.5;
    if (peek(to, c.id).affection >= 0.5 || peek(to, c.id).grudge >= 0.3) return 0.45;
    if (to.familyId && c.familyId === to.familyId) return 0.25;
    return 0;
  };
  const touch = Math.max(near(f.actor), near(f.victim), f.business && w.biz[f.business]?.ownerId === to.id ? 1 : 0);
  // a stranger's bad night at cards is nobody's business unless it was a fortune
  if (f.kind === 'gambling_loss' && touch < 0.45 && (f.amount ?? 0) < 1000) return -1;
  const tier = tierOf(f.kind);
  const weight = tier === 'permanent' ? 0.6 : tier === 'significant' ? 0.4 : 0.1;
  const street = f.district === to.district ? 0.1 : 0;
  return touch + weight + street;
}

// One man tells another. Returns whether the listener now believes he knows who did it.
export function pass(w: World, from: Character, to: Character, f: Fact, knowsIn: boolean): boolean {
  const mine = claim(from, f.id);
  let knows = knowsIn;
  let blame: Id | undefined = mine?.blame;
  let big = mine?.big;
  const actor = f.actor ? w.chars[f.actor] : undefined;
  if (WHODUNIT.has(f.kind) && actor && knows && actor.id !== from.id) {
    // a man does not hand his own people to the street
    const own = closeKin(w, from, actor) || actor.id === from.bossId || from.bossId === actor.id || peek(from, actor.id).affection >= 0.6;
    if (own && !to.isPlayer || own && peek(from, to.id).trust < 0.7) { knows = false; blame = undefined; }
  }
  if (WHODUNIT.has(f.kind) && !knows && !blame && f.victim !== from.id) {
    // he didn't see it, but he knows who he'd like it to have been
    const hated = Object.entries(from.rels).filter(([id, r]) => r.grudge >= 0.4 && id !== f.victim && id !== to.id && w.chars[id]?.alive && w.chars[id].rank !== 'civilian').sort((a, b) => b[1].grudge - a[1].grudge)[0];
    const a = arch(from);
    const tendency = (a === 'bitter' || a === 'hothead' || a === 'schemer' ? 0.35 : 0.12) + (hated ? hated[1].grudge * 0.3 : 0);
    if (hated && w.rng.chance(tendency)) blame = hated[0];
  }
  if (!big && f.amount && f.amount >= 100) { const a = arch(from); if ((a === 'jovial' || a === 'proud' || a === 'hothead') && w.rng.chance(0.35)) big = 1; }
  learn(w, to.id, f, from.id, knows);
  const k = claim(to, f.id);
  if (k && k.from === from.id) {
    k.how = mine?.from === 'witness' || mine?.from === 'self' ? 't' : 'h';
    if (blame && !knows) k.blame = blame;
    if (big) k.big = 1;
    // believing a name is holding it against him, if it was done to you or yours
    if (blame && !knows) {
      const hurt = f.victim === to.id || (f.victim && (kinTie(w, to, w.chars[f.victim]) || w.chars[f.victim]?.bossId === to.id));
      const b = w.chars[blame];
      if (hurt && b) rel(to, b.id).grudge = clamp(rel(to, b.id).grudge + (f.kind === 'murder' ? 0.35 : 0.15));
    }
  }
  return knows;
}

// The player's version of an event: what he was told, as he was told it.
export function versionOf(w: World, viewer: Character, f: Fact): string {
  const k = claim(viewer, f.id);
  let s = factText(f, !!k?.knowsActor);
  if (k?.big && f.amount) s = s.split(money(f.amount)).join(money(Math.round(f.amount * 1.6 / 50) * 50));
  if (k && !k.knowsActor && k.blame && w.chars[k.blame]) s = s.replace(/\.$/, '') + `. ${k.how === 't' ? 'He says' : 'People say'} it was ${w.chars[k.blame].name}.`;
  return s;
}
// Where he had it from, in words.
export function sourceOf(w: World, viewer: Character, f: Fact): string {
  const k = claim(viewer, f.id);
  if (!k) return '';
  if (k.from === 'self') return 'you were there';
  if (k.from === 'witness') return 'you saw it';
  if (k.from === 'public') return 'it was all over the neighbourhood';
  const c = w.chars[k.from.replace(/^told:/, '')];
  if (!c) return 'word got round';
  return k.how === 't' ? `${c.name}, who saw it` : `${c.name}, who heard it somewhere`;
}
