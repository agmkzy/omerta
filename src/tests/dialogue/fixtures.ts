// Fixtures for the conversation checks (from the V77 and V78 suites).
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { advance, deserialize, serialize } from '../../engine';
import { createWorld } from '../../world';
import { DAY, World } from '../../types';
import { options, say, startConvo, arrive, isNavCode, INTENTS, Convo } from '../../dialogue';
import { generate, perform } from '../../actions';
import { whereIs } from '../../where';
import { P } from '../helpers';

/** The snapshots of what V76 offered, which the menu checks compare against. */
export const BASELINES = join(dirname(fileURLToPath(import.meta.url)), 'baselines');

let base: string | undefined;

/** World 3 run for 60 days, built once per file and cached as a save; each call returns a fresh copy. */
export const world60 = () => { if (!base) { const b = createWorld(3, 'Tony Marino'); advance(b, b.now + 60 * DAY); base = serialize(b); } return deserialize(base); };

export const men = (w: World, n = 40) => Object.values(w.chars).filter((c) => c.alive && !c.isPlayer).sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, n);

export const ARCHS = ['proud', 'bitter', 'schemer', 'earnest', 'hothead', 'cold', 'jovial', 'frightened'];

export const CATS = INTENTS;

export const introAll = (w: World) => { for (const m of men(w)) (P(w).intro ??= {})[m.id] = w.now; };

export const reach = (w: World, id: string) => {
  const p = P(w), t = w.chars[id], codes = new Set<string>();
  const get = (more?: string[]) => { const c = startConvo(id); if (more) (c.ctx as { more?: string[] }).more = more; return options(w, p, t, c); };
  for (const o of get()) codes.add(o.code);
  for (const k of CATS) for (const o of get(['all', k])) codes.add(o.code);
  // and everything one or two steps further in through the menus of the conversation itself
  const dig = (c: Convo, depth: number, seen: Set<string>) => {
    for (const o of options(w, p, t, c)) {
      codes.add(o.code);
      if (depth > 0 && isNavCode(o.code) && o.code !== 'root' && !o.code.startsWith('more:back') && !o.code.startsWith('more:up') && !seen.has(c.node + o.code)) {
        seen.add(c.node + o.code);
        try { const r = say(w, p, t, c, o.code); if (r.convo) dig(r.convo, depth - 1, seen); } catch { /* not every code applies */ }
      }
    }
  };
  dig(startConvo(id), 3, new Set());
  return codes;
};

export const arriveAt = (w: World, id: string) => {
  const p = P(w), x = w.chars[id]; (p.intro ??= {})[id] = w.now;
  const act = generate(w, p, 'socialise').find((a) => a.target === id); if (!act) return undefined;
  const before = new Set(Object.keys(p.known)); const prev = x.rels[p.id]?.lastMet ?? -1e9; act.quiet = true; const r = perform(w, act);
  return { p, x, before, r, a: arrive(w, p, x, r, whereIs(w, p, x), prev) };
};

export const chatWith = (w: World, m: ReturnType<typeof men>[number], rel: { trust: number; affection: number; grudge: number }) => {
  const p = P(w); (p.intro ??= {})[m.id] = w.now;
  m.rels[p.id] = { trust: rel.trust, respect: 0.5, affection: rel.affection, grudge: rel.grudge, lastMet: w.now };
  delete p.cooldown[`chat:${m.id}`];
  const before = new Set(Object.keys(p.known));
  const r = say(w, p, m, startConvo(m.id), 'chat');
  return { p, r, learned: Object.keys(p.known).filter((id) => !before.has(id)) };
};
