// Blackjack at the family casinos. Every house runs its own table: different stakes, different shoe, different payout.
import { clamp, money } from './core';
import { bizMove } from './econ';
import { Business as Biz, Character, World } from './types';

export interface TableRules { label: string; min: number; max: number; decks: number; bj: number; h17: boolean; note: string }
const TIERS: TableRules[] = [
  { label: 'Back room', min: 10, max: 100, decks: 6, bj: 1.2, h17: true, note: 'Six decks, blackjack pays 6 to 5, dealer hits soft 17. Cheap, and the house likes it that way.' },
  { label: 'Social table', min: 25, max: 300, decks: 4, bj: 1.5, h17: true, note: 'Four decks, blackjack pays 3 to 2, dealer hits soft 17.' },
  { label: 'Card room', min: 50, max: 600, decks: 2, bj: 1.5, h17: false, note: 'Two decks, blackjack pays 3 to 2, dealer stands on soft 17.' },
  { label: 'High limit', min: 200, max: 3000, decks: 1, bj: 1.5, h17: false, note: 'A single deck and the best odds in town. Men lose houses here.' },
];
export const casinos = (w: World): Biz[] => Object.values(w.biz).filter((b) => b.kind === 'casino' && b.open).sort((a, b) => a.id.localeCompare(b.id));
export const rulesFor = (w: World, b: Biz): TableRules => TIERS[Math.max(0, casinos(w).findIndex((x) => x.id === b.id)) % TIERS.length];

export interface BJ { biz: string; bet: number; p: number[]; d: number[]; deck: number[]; done: boolean; msg: string[]; net: number; doubled?: boolean }
const val = (c: number) => { const r = c % 13; return r === 0 ? 11 : r >= 10 ? 10 : r + 1; };
export function total(h: number[]): { n: number; soft: boolean } {
  let n = h.reduce((a, c) => a + val(c), 0), aces = h.filter((c) => c % 13 === 0).length;
  while (n > 21 && aces > 0) { n -= 10; aces--; }
  return { n, soft: aces > 0 };
}
export const cardName = (c: number) => ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][c % 13] + ['♠', '♥', '♦', '♣'][Math.floor(c / 13) % 4];
const natural = (h: number[]) => h.length === 2 && total(h).n === 21;

export function deal(w: World, p: Character, b: Biz, bet: number): string[] {
  const r = rulesFor(w, b);
  if (w.bj && !w.bj.done) return ['Finish the hand you’re playing.'];
  if (bet < r.min || bet > r.max) return [`The table takes ${money(r.min)} to ${money(r.max)}.`];
  if (p.cash < bet) return ['You haven’t got that on you.'];
  const deck: number[] = [];
  for (let i = 0; i < 52 * r.decks; i++) deck.push(i);
  for (let i = deck.length - 1; i > 0; i--) { const j = w.rng.int(0, i); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  p.cash -= bet;
  w.bj = { biz: b.id, bet, p: [deck.pop()!, deck.pop()!], d: [deck.pop()!, deck.pop()!], deck, done: false, msg: [], net: 0 };
  if (natural(w.bj.p) || natural(w.bj.d)) finish(w, p, b);
  return [];
}
function pay(w: World, p: Character, b: Biz, back: number) { // back = what the house hands back on the stake (0 = lost)
  const g = w.bj!;
  p.cash += back; bizMove(w, b, -(back - g.bet), 'gamble');
  g.net = back - g.bet;
}
function finish(w: World, p: Character, b: Biz) {
  const g = w.bj!, r = rulesFor(w, b);
  const pt = total(g.p).n;
  if (pt <= 21 && !natural(g.p)) while (total(g.d).n < 17 || (r.h17 && total(g.d).n === 17 && total(g.d).soft)) g.d.push(g.deck.pop()!);
  const dt = total(g.d).n;
  g.done = true;
  if (natural(g.p) && natural(g.d)) { pay(w, p, b, g.bet); g.msg = ['Blackjack on both sides. A push.']; }
  else if (natural(g.p)) { const win = Math.round(g.bet * r.bj); pay(w, p, b, g.bet + win); g.msg = [`Blackjack. It pays ${r.bj === 1.5 ? '3 to 2' : '6 to 5'}: you win ${money(win)}.`]; }
  else if (natural(g.d)) { pay(w, p, b, 0); g.msg = ['The dealer has blackjack. You lose.']; }
  else if (pt > 21) { pay(w, p, b, 0); g.msg = [`You bust on ${pt}. The house takes ${money(g.bet)}.`]; }
  else if (dt > 21) { pay(w, p, b, g.bet * 2); g.msg = [`The dealer busts on ${dt}. You win ${money(g.bet)}.`]; }
  else if (pt > dt) { pay(w, p, b, g.bet * 2); g.msg = [`${pt} beats ${dt}. You win ${money(g.bet)}.`]; }
  else if (pt < dt) { pay(w, p, b, 0); g.msg = [`${dt} beats your ${pt}. You lose ${money(g.bet)}.`]; }
  else { pay(w, p, b, g.bet); g.msg = [`Both on ${pt}. A push.`]; }
  p.standing = clamp(p.standing, 0, 100);
}
export function act(w: World, p: Character, what: 'hit' | 'stand' | 'double'): string[] {
  const g = w.bj; const b = g ? w.biz[g.biz] : undefined;
  if (!g || g.done || !b) return [];
  if (what === 'double') {
    if (g.p.length !== 2) return ['You can only double on your first two cards.'];
    if (p.cash < g.bet) return ['Not enough on you to double.'];
    p.cash -= g.bet; g.bet *= 2; g.doubled = true; g.p.push(g.deck.pop()!); finish(w, p, b); return [];
  }
  if (what === 'hit') { g.p.push(g.deck.pop()!); if (total(g.p).n >= 21) finish(w, p, b); return []; }
  finish(w, p, b); return [];
}
