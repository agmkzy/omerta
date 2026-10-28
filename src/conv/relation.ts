// What the man in front of the player is to him (the conversation overhaul, October 2026). One answer, read by every interaction to
// decide whether it can be said to this man at all: asking a man to speak for you is said upward, giving a man orders is said
// downward, small talk to anyone, warnings to another family. Before this each interaction tested ranks its own way, and a captain
// could ask his own soldier to put in a word for him, or the consigliere ask the boss who really runs the family.
import { isConsigliere, positionOf } from '../standing';
import type { Character, World } from '../types';

export type Tie =
  | 'superior' // the man he answers to directly
  | 'above'    // above him in his own family, not his direct superior (his captain's underboss, the boss, a captain of another crew)
  | 'mine'     // one of his own men
  | 'below'    // further down his own chain (his soldiers' men)
  | 'peer'     // the same family, neither above nor below him
  | 'rival'    // a man of another family
  | 'outside'; // not in the life
const RANK = ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'];
const seniority = (w: World, c: Character) => (isConsigliere(w, c) ? 3.5 : c.rank === 'boss' ? 5 : RANK.indexOf(c.rank));
function chainUp(w: World, c: Character): Set<string> {
  const out = new Set<string>();
  for (let x = c.bossId ? w.chars[c.bossId] : undefined, i = 0; x && i < 8; x = x.bossId ? w.chars[x.bossId] : undefined, i++) out.add(x.id);
  return out;
}
export function tieOf(w: World, p: Character, t: Character): Tie {
  if (t.rank === 'civilian' || !t.familyId) return 'outside';
  if (!p.familyId || t.familyId !== p.familyId) return 'rival';
  if (p.bossId === t.id) return 'superior';
  if (t.bossId === p.id) return 'mine';
  if (chainUp(w, t).has(p.id)) return 'below';
  if (chainUp(w, p).has(t.id)) return 'above';
  const a = seniority(w, t), b = seniority(w, p);
  return a > b ? 'above' : a < b && b >= 2 ? 'below' : 'peer';
}
export const upward = (w: World, p: Character, t: Character) => ['superior', 'above'].includes(tieOf(w, p, t));
export const downward = (w: World, p: Character, t: Character) => ['mine', 'below'].includes(tieOf(w, p, t));
export const isFamilyBoss = (w: World, t: Character) => !!t.familyId && w.fam[t.familyId]?.bossId === t.id;
// whether a man could speak for the player to someone above himself: a made man who is not the boss (the boss has no one to ask)
export const canSpeakUp = (w: World, t: Character) => ['soldier', 'capo', 'underboss'].includes(t.rank) && !isFamilyBoss(w, t);
export const seatOf = (w: World, c: Character) => positionOf(w, c);
