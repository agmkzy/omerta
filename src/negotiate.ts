// What each side of a negotiation actually wants, taken from the books. Nobody rolls a die to decide whether a man "agrees":
// he looks at what he can bear, what the other man can do to him, and what refusing would cost, and answers with an offer.
import { rel } from './core';
import type { Business, Character, World } from './types';

export const r5 = (n: number) => Math.round(n / 5) * 5;

// What a shop can carry. A fee above this closes the place, so a sensible owner counters or refuses long before.
export function feePosition(b: Business): { cap: number; strained: boolean } {
  const profit = Math.max(0, b.income - b.expense);
  const strained = b.distress > 0 || (b.protection?.late ?? 0) > 0;
  return { cap: Math.max(10, r5(profit * 0.4 - (strained ? 10 : 0))), strained };
}

// Whether a man will lend, how much, and at what rate, from his cash and how far he trusts the borrower.
export function loanPosition(w: World, lender: Character, borrower: Character, ask: number): { can: number; rate: number; refuse?: 'cash' | 'trust' } {
  const tr = rel(lender, borrower.id).trust;
  const can = Math.max(0, r5(Math.min(ask, lender.cash * 0.45)));
  const rate = tr >= 0.7 ? 0.04 : tr >= 0.5 ? 0.05 : 0.06;
  return { can, rate, refuse: tr < 0.35 ? 'trust' : can < 150 ? 'cash' : undefined };
}

// How much of what he owes a man can put down today, if pressed for a sign of good faith.
export function goodFaith(balance: number, weekly: number): number {
  return Math.max(25, r5(Math.min(balance * 0.25, weekly)));
}
