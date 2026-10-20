// Fixtures for the economy checks (from the V73 suite).
import assert from 'node:assert';
import { WEEK, Business, Character, World } from '../../types';
import { P } from '../helpers';

// A shop with an NPC collector who is not the player.
export function shop(w: World): Business {
  const b = Object.values(w.biz).find((x) => x.open && x.kind !== 'casino' && x.protection && x.protection.fee > 0 && x.protection.collectorId !== w.playerId && w.chars[x.protection.collectorId]?.alive);
  assert.ok(b, 'a protected shop exists');
  return b!;
}

// A made man with a living boss in another family from the player's.
export function man(w: World): { c: Character; boss: Character } {
  const c = Object.values(w.chars).find((x) => x.alive && !x.isPlayer && x.familyId !== P(w).familyId && x.rank === 'soldier' && x.bossId && w.chars[x.bossId]?.alive && !w.chars[x.bossId].isPlayer);
  assert.ok(c);
  return { c: c!, boss: w.chars[c!.bossId!] };
}

export function calm(c: Character, boss: Character, w: World) {
  c.traits.greed = 0; c.traits.ambition = 0; delete c.problem; c.cash = 5000; delete c.books.skim; delete c.books.hide;
  c.rels[boss.id] = { ...(c.rels[boss.id] ?? {}), trust: 1, respect: 1, grudge: 0, affection: 0.5 } as never;
  c.books.arrears = 0; c.books.missed = 0; c.books.history = []; c.books.flags = {}; c.books.side = 0; c.cooldown = {};
  boss.books.flags = {};
  void w;
}

export const week = (w: World) => { w.now += WEEK; };

export const kinds = (w: World, k: string, who: string) => Object.values(w.facts).filter((f) => f.kind === k && (f.actor === who || f.victim === who)).length;
