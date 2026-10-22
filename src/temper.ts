// V90: temperament, and how one man sees another.
//
// Temperament is why two men faced with the same demand answer differently. Six dimensions, each 0..1:
//   courage     standing up to threats and danger
//   caution     avoiding risk; complying quietly, and looking for protection afterwards
//   volatility  reacting on impulse; lashing out
//   pride       feeling disrespect; resenting being pushed
//   agreeable   looking for a deal; meeting a man halfway
//   empathy     being moved by another man's circumstances
// For the men of the city it is read from their traits and a signature of their own (nothing is stored, so every existing
// character and every old save has it, and a man is the same man every time he is read). Some men have one dimension that
// defines them; others are balanced.
//
// The player has no temperament at the start. His emerges from what he does (p.conduct), and never limits what he can do:
// it changes how the world reads him.
//
// How a man sees another is read from what he believes: their relationship (trust, respect, affection, grudge, and fear,
// which V90 keeps apart from respect), what he has seen and heard the other man do, their ranks, through his own temperament.
import { clamp, peek } from './core';
import type { Character, Id, World } from './types';

const VIOLENT = new Set(['beating', 'murder', 'vandalism', 'robbery']);

export interface Temper { courage: number; caution: number; volatility: number; pride: number; agreeable: number; empathy: number }
export type Dim = keyof Temper;
export const DIMS: Dim[] = ['courage', 'caution', 'volatility', 'pride', 'agreeable', 'empathy'];

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };
// -0.5..0.5, the same for the same man and dimension every time
const sig = (c: Character, k: string) => hash(c.id + '~' + k) - 0.5;

// What the player has done that shows what kind of man he is, counted as he acts and read in context (an act of violence against a
// man who wronged him is retribution, not a temper; standing up to a man above him is courage; backing down is caution). Optional
// and filled lazily, so old saves start at nothing. Whether he keeps his word is already recorded (Character.rep) and read from there.
export interface Conduct { threats: number; force: number; retribution: number; deals: number; generous: number; forgave: number; defied: number; yielded: number; lies: number }
const NOCONDUCT: Conduct = { threats: 0, force: 0, retribution: 0, deals: 0, generous: 0, forgave: 0, defied: 0, yielded: 0, lies: 0 };
export const conductOf = (p: Character): Conduct => {
  const x = p as Character & { conduct?: Partial<Conduct> };
  return (x.conduct = { ...NOCONDUCT, ...(x.conduct ?? {}) }) as Conduct;
};
export function noteConduct(p: Character, k: keyof Conduct, n = 1) { if (p.isPlayer) conductOf(p)[k] += n; }
// Violence or threats used by the player on a man: retribution if the man had wronged him, otherwise what it is.
export function noteHard(w: World, p: Character, t: Character, k: 'threats' | 'force', n = 1) {
  if (!p.isPlayer) return;
  const wronged = peek(p, t.id).grudge >= 0.3 || Object.keys(p.known).some((id) => { const f = w.facts[id]; return f && f.actor === t.id && f.victim === p.id && p.known[id].knowsActor && VIOLENT.has(f.kind); });
  noteConduct(p, wronged ? 'retribution' : k, wronged ? n * 0.7 : n);
}

export function temper(c: Character): Temper {
  const T = c.traits;
  if (c.isPlayer) {
    // the player's own: what he has done, around an even middle; the world needs a few deeds before it settles on a view
    const d = conductOf(c), k = (n: number) => 1 - Math.exp(-n / 6); // diminishing: the tenth threat says less than the first
    const rep = c.rep ?? { kept: 0, broken: 0 };
    return {
      courage: clamp(0.5 + k(d.defied) * 0.25 + k(d.retribution) * 0.1 + k(d.force) * 0.05 - k(d.yielded) * 0.2),
      caution: clamp(0.5 + k(d.yielded) * 0.15 + k(d.deals) * 0.1 - k(d.force) * 0.2 - k(d.defied) * 0.1),
      volatility: clamp(0.4 + k(d.force) * 0.4 + k(d.threats) * 0.2 + k(d.retribution) * 0.05 - k(d.deals) * 0.1),
      pride: clamp(0.5 + k(d.retribution) * 0.25 + k(d.defied) * 0.1 - k(d.forgave) * 0.15 - k(d.yielded) * 0.1),
      agreeable: clamp(0.5 + k(d.deals) * 0.25 + k(d.forgave) * 0.15 + k(rep.kept) * 0.05 - k(d.threats) * 0.2 - k(d.force) * 0.15),
      empathy: clamp(0.5 + k(d.generous) * 0.3 + k(d.forgave) * 0.15 - k(d.force) * 0.25),
    };
  }
  // Each dimension has one trait it leans on, and much of it is the man's own (a signature nobody else has): a sociable man is not
  // therefore kind, a brave one not therefore hot-headed, a careful one not therefore easy to deal with. Some men are one thing
  // above all, some are a bit of everything, and some are contradictions.
  const def = 0.7 + hash(c.id + '~def') * 0.9;
  const dim = (anchor: number, k: string, lean = 0.55) => clamp(0.5 + ((anchor - 0.5) * lean + sig(c, k) * 0.62) * def);
  return {
    courage: dim(T.courage, 'cou', 0.65),
    caution: dim(T.caution, 'cau', 0.65),
    volatility: dim(T.violence, 'vol'),
    pride: dim(T.ambition, 'pri', 0.45),
    agreeable: dim(1 - T.greed, 'agr', 0.35),
    empathy: dim(1 - T.violence, 'emp', 0.25),
  };
}
// The dimension that defines him, if one does (else undefined: a balanced man).
export function defining(t: Temper): Dim | undefined {
  const sorted = DIMS.map((d) => [d, t[d]] as const).sort((a, b) => b[1] - a[1]);
  return sorted[0][1] > 0.68 && sorted[0][1] - sorted[1][1] > 0.06 ? sorted[0][0] : undefined;
}

// ---------------------------------------------------------------- how he sees you
// How one man sees another, from what he believes. Four things kept apart: whether he trusts him, whether he respects him, whether
// he likes him, and whether he fears him. Fear is about himself: knowing a man is dangerous (danger) is not the same as believing
// he will hurt you (fear). Both are read from what this man has seen and heard (never from what the player has done unseen).
export interface View { trust: number; respect: number; affection: number; fear: number; danger: number; resent: number }
export function viewOf(w: World, me: Character, other: Character): View {
  const r = peek(me, other.id), t = temper(me);
  let fear = r.fear ?? 0, danger = 0;
  // what he has seen and heard the other man do: to anyone (he is dangerous), and to him or his own (he could do it to me)
  const near = (id?: Id) => !!id && (id === me.id || (me.rels[id]?.affection ?? 0) > 0.5);
  for (const id of Object.keys(me.known)) {
    const f = w.facts[id];
    if (!f || f.actor !== other.id || !me.known[id].knowsActor) continue;
    const v = VIOLENT.has(f.kind) ? (f.kind === 'murder' ? 2 : 1) : f.kind === 'threat' ? 0.4 : 0;
    if (!v) continue;
    danger += v * 0.08;
    if (near(f.victim)) fear += v * 0.1;
  }
  danger = Math.min(1, danger);
  fear += danger * 0.25; // a dangerous man is something to be careful of, even if he has never turned on you
  const rk = (c: Character) => ['civilian', 'associate', 'soldier', 'capo', 'underboss', 'boss'].indexOf(c.rank);
  fear += Math.max(0, rk(other) - rk(me)) * 0.05; // the power to hurt you, whatever he has done with it
  // through his own temperament: the cautious feel it more, the brave less; the proud turn fear into resentment
  fear *= 0.7 + t.caution * 0.45 - t.courage * 0.3;
  const resent = r.grudge + fear * t.pride * 0.45;
  return { trust: clamp(r.trust), respect: clamp(r.respect), affection: clamp(r.affection), fear: clamp(fear), danger: clamp(danger), resent: clamp(resent) };
}

// In words, for the player's eyes (never numbers).
export function viewWords(v: View): string[] {
  const out: string[] = [];
  if (v.fear >= 0.55) out.push('is afraid of you'); else if (v.fear >= 0.3) out.push('is wary of what you might do'); else if (v.danger >= 0.3) out.push('knows what you can do');
  if (v.respect >= 0.65) out.push('respects you'); else if (v.respect < 0.2) out.push('thinks little of you');
  if (v.trust >= 0.7) out.push('trusts you'); else if (v.trust >= 0.45) out.push('mostly trusts you'); else if (v.trust < 0.2) out.push('doesn’t trust you');
  if (v.resent >= 0.45) out.push('resents you'); else if (v.resent >= 0.25) out.push('holds something against you');
  if (v.affection >= 0.6) out.push('likes you');
  return out;
}
// Who the player has shown himself to be, in words (his own page). Not what any one man believes: that is in each man's view.
export function characterWords(p: Character): string[] {
  const d = conductOf(p), t = temper(p), rep = p.rep ?? { kept: 0, broken: 0 }, out: string[] = [];
  const n = d.threats + d.force + d.retribution + d.deals + d.generous + d.forgave + d.defied + d.yielded + rep.kept + rep.broken;
  if (n < 3) return ['You haven’t shown anyone who you are yet.'];
  if (t.volatility > 0.62) out.push('You reach for force quickly.');
  else if (d.threats > d.deals + 2) out.push('You lean on men more than you reason with them.');
  if (t.pride > 0.62) out.push('You don’t let a wrong go unanswered.');
  if (t.courage > 0.62) out.push('You stand up to men above you.'); else if (t.caution > 0.62) out.push('You pick your fights carefully.');
  if (t.agreeable > 0.62) out.push('You would rather make a deal than a war.');
  if (t.empathy > 0.62) out.push('You look after people, even when it costs you.');
  if (rep.broken > rep.kept && rep.broken >= 2) out.push('Your word has not been worth much.'); else if (rep.kept >= 4) out.push('You keep your word.');
  return out.length ? out : ['You are hard to read, which is not the worst thing to be.'];
}
