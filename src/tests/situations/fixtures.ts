// Fixtures for the situation checks (from the V75 suite).
import assert from 'node:assert';
import { advance, deserialize, serialize } from '../../engine';
import { createWorld } from '../../world';
import { DAY, Situation, World } from '../../types';
import { rel } from '../../core';
import { isOpen, sitDay, skimNoticed, tell } from '../../situ';
import { P } from '../helpers';

export const sortKeys = (v: unknown): unknown => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as object).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, sortKeys(x)])) : v;

export const canon = (w: World) => JSON.stringify(sortKeys(JSON.parse(serialize(w))));

const baseCache = new Map<string, string>();

/** World `seed` run for `days` days (built once per file and cached as a save), with the keyed V75 situations removed
 * (disputes and crew matters kept) and the situation cooldowns cleared, so a check starts its own situations. */
export const situationWorld = (seed: number, days: number) => { const k = seed + ':' + days; if (!baseCache.has(k)) { const b = createWorld(seed, 'Tony Marino'); advance(b, b.now + days * DAY); baseCache.set(k, serialize(b)); } const w = deserialize(baseCache.get(k)!); w.situations = (w.situations ?? []).filter((s) => !s.key || s.kind === 'dispute' || s.kind === 'crew'); w.sitcool = {}; if (w.sitpace) { w.sitpace.lastMajor = -1e9; w.sitpace.lastVisible = -1e9; } return w; }; // (the pacing of the situations it has just cleared goes with them)

// A boss and a man who answers to him, both in the same family, neither the player.
export function pair(w: World, rank = 'soldier') {
  const c = Object.values(w.chars).find((x) => x.alive && !x.isPlayer && x.rank === rank && x.familyId && x.bossId && w.chars[x.bossId]?.alive && !w.chars[x.bossId].isPlayer && w.chars[x.bossId].rank !== 'civilian');
  assert.ok(c, 'a ' + rank);
  const boss = w.chars[c!.bossId!];
  c!.jailedUntil = 0; boss.jailedUntil = 0;
  return { boss, c: c! };
}

// two men of the player's own family, one resentful of the other, with the player as the man who decides
export function trio(w: World) {
  const p = P(w); const m = Object.values(w.chars).filter((q) => q.alive && !q.isPlayer && q.familyId === p.familyId && q.rank !== 'civilian');
  assert.ok(m.length >= 2, 'family members'); const [c, x] = m;
  c.jailedUntil = 0; x.jailedUntil = 0; c.traits.ambition = 0.9; c.traits.courage = 0.9; rel(c, x.id).grudge = 0.5; rel(c, p.id).trust = 0.5; rel(x, p.id).trust = 0.5;
  return { p, c, x };
}

export const parts = (s: Situation, role: string) => (s.parties ?? []).find((p) => p.role === role)!.id;

export function skimCase(w: World, guilty = true) {
  const { boss, c } = pair(w);
  if (guilty) (c.books as { skim?: unknown }).skim = { until: w.now + 60 * DAY, frac: 0.3 };
  const f = tell(w, { id: 'x', stage: 'handling', cause: '', since: w.now, knows: false, told: false } as Situation, 'placeholder', {});
  assert.ok(skimNoticed(w, boss, c, { amt: 300, n: 1 }, f.id), 'a situation took it over');
  const s = (w.situations ?? []).find((x) => x.kind === 'skim' && isOpen(x))!;
  return { boss, c, s };
}

// advance a situation by its own clock, nothing else in the world moving
export function run(w: World, s: Situation, steps = 30) {
  for (let i = 0; i < steps && isOpen(s) && s.stage !== 'asking'; i++) { w.now = Math.max(w.now, s.next ?? w.now); sitDay(w); }
}

export const phasesOf = (w: World, s: Situation) => (s.hist ?? []).length;
