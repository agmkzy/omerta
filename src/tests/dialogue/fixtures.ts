// Fixtures for the conversation checks (from the V77 and V78 suites; since Gate 4, on the one conversation: conv/visit.ts, its
// interactions conv/acts, carried through conv/run.ts).
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { advance, deserialize, serialize } from '../../engine';
import { createWorld } from '../../world';
import { DAY, World } from '../../types';
import { begin, choose, everything, type Visit } from '../../conv/visit';
import { ctx, newThread } from '../../conv/kit';
import { perform } from '../../conv/run';
import { P } from '../helpers';

/** The snapshots of what V76 offered, which the menu checks compare against. */
export const BASELINES = join(dirname(fileURLToPath(import.meta.url)), 'baselines');

let base: string | undefined;

/** World 3 run for 60 days, built once per file and cached as a save; each call returns a fresh copy. */
export const world60 = () => { if (!base) { const b = createWorld(3, 'Tony Marino'); advance(b, b.now + 60 * DAY); base = serialize(b); } return deserialize(base); };

export const men = (w: World, n = 40) => Object.values(w.chars).filter((c) => c.alive && !c.isPlayer).sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, n);

export const ARCHS = ['proud', 'bitter', 'schemer', 'earnest', 'hothead', 'cold', 'jovial', 'frightened'];

export const introAll = (w: World) => { for (const m of men(w)) (P(w).intro ??= {})[m.id] = w.now; };

/** A visit with nothing said yet, and the thing in hand (an event, a man, a haggle) set as the test needs it. */
export const visitAt = (w: World, id: string, th: Partial<Visit['th']> = {}): Visit => ({ npc: id, where: '', t0: w.now, lines: [], choices: [], relation: '', mem: { said: [], argued: [], pressed: 0, points: [], offered: {} }, th: { ...newThread(), ...th } });
/** One thing said to him (an interaction's code), carried through the conversation's rules, on this world: what he said and what follows. */
export function talk(w: World, id: string, code: string, th: Partial<Visit['th']> = {}, v = visitAt(w, id, th)) {
  const from = v.lines.length, r = perform(ctx(w, v), code, '…');
  return { lines: v.lines.slice(from).map((l) => l.text), minutes: r.minutes, next: (r.next ?? []).map((o) => o.code), r, v };
}

/** Everything the player can reach with a man through the screen: the headings, everything under them, and what each leads on to. */
export const reach = (w: World, id: string) => {
  const codes = new Set<string>(), v0 = begin(deserialize(serialize(w)), id);
  const ids = [...v0.choices, ...everything(deserialize(serialize(w)), begin(deserialize(serialize(w)), id))].map((c) => c.id);
  for (const x of ids) {
    if (x.startsWith('a:')) codes.add(x.slice(2));
    // (one step on: what it leads to, said on a copy of the world so nothing here changes the one being checked)
    if (/^a:(think|pick_member|pick_incident|pick_concern|amends|sit|mt_open|m|job|enc_open|tk)\b/.test(x)) {
      const w2 = deserialize(serialize(w)), v = begin(w2, id), r = choose(w2, v, x);
      for (const c of r.v.choices) if (c.id.startsWith('a:')) codes.add(c.id.slice(2));
    }
  }
  return codes;
};

/** Going to see him, as the screen does: the opening, and what the player knew before. */
export const arriveAt = (w: World, id: string) => {
  const p = P(w), x = w.chars[id]; (p.intro ??= {})[id] = w.now;
  const before = new Set(Object.keys(p.known));
  return { p, x, before, v: begin(w, id) };
};

/** "What's new?" asked of a man who stands with the player as given (the old "Heard anything?" is part of it). */
export const chatWith = (w: World, m0: ReturnType<typeof men>[number], rel: { trust: number; affection: number; grudge: number }) => {
  const p = P(w), m = w.chars[m0.id]; (p.intro ??= {})[m.id] = w.now; // (the man in this world, which may be a copy of the one he was found in)
  m.rels[p.id] = { trust: rel.trust, respect: 0.5, affection: rel.affection, grudge: rel.grudge, lastMet: w.now };
  delete p.cooldown[`chat:${m.id}`];
  const before = new Set(Object.keys(p.known));
  const v = begin(w, m.id), from = v.lines.length;
  choose(w, v, 'news');
  return { p, v, lines: v.lines.slice(from).map((l) => l.text), learned: Object.keys(p.known).filter((id) => !before.has(id)) };
};
