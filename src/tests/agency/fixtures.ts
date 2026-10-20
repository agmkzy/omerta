// Fixtures for the NPC-goal checks (from the V74 suite).
import assert from 'node:assert';
import { advance } from '../../engine';
import { createWorld } from '../../world';
import { DAY, Business, Character, Goal, World } from '../../types';
import { ownerBiz, rel } from '../../core';
import { agencyOf, begin, stepGoal } from '../../goals';

/** World `seed` run for `days` days, then with every NPC goal, cooldown and statistic cleared, so a check starts its own
 * goals from nothing. Not cached: each call simulates again. */
export const agencyWorld = (seed: number, days: number) => { const w = createWorld(seed, 'Tony Marino'); advance(w, w.now + days * DAY); const a = agencyOf(w); a.goals = []; a.cool = {}; a.stats = {}; a.ended = []; return w; };

// run one goal to its end (or `max` reviews) without moving the rest of the world
export function drive(w: World, g: Goal, max = 80): boolean {
  const a = agencyOf(w);
  for (let i = 0; i < max && a.goals.includes(g); i++) {
    w.now = Math.max(w.now, g.review);
    const c = w.chars[g.who]; if (!c) break;
    stepGoal(w, g, c);
  }
  return !a.goals.includes(g);
}

export const npcs = (w: World, rank: string) => Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank === rank && c.familyId && c.bossId && w.chars[c.bossId]?.alive);

// A buyer and a seller in the same family; the seller owns a plain shop.
export function pair(w: World) {
  const sellers = Object.values(w.biz).filter((b) => b.open && b.kind !== 'casino' && w.chars[b.ownerId]?.alive && !w.chars[b.ownerId].isPlayer);
  const b = sellers[0]; assert.ok(b, 'a shop owned by an NPC');
  const seller = w.chars[b.ownerId];
  const buyer = Object.values(w.chars).find((c) => c.alive && !c.isPlayer && c.id !== seller.id && c.rank === 'soldier' && !ownerBiz(w, c.id));
  assert.ok(buyer, 'a buyer');
  rel(buyer!, seller.id).trust = 0.5; rel(seller, buyer!.id).trust = 0.5; rel(seller, buyer!.id).grudge = 0;
  buyer!.cash = 50000; buyer!.jailedUntil = 0; buyer!.traits.caution = 0.5; buyer!.traits.greed = 0.3; buyer!.traits.violence = 0.2;
  seller.jailedUntil = 0;
  return { b, seller, buyer: buyer! };
}

export const aimed = (w: World, buyer: Character, b: Business, stage = 'approach') => {
  const g = begin(w, buyer, 'business', 'test', 0.8, { stage, target: b.id, owner: b.ownerId, mode: 'buy', need: 100, next: 'x' });
  g.deadline = w.now + 400 * DAY; return g;
};

export const LADDER_OK = (boss: Character) => ['soldier', 'capo', 'underboss', 'boss'].includes(boss.rank);
