// Every man has his own line of work. Associates and soldiers choose a hustle from what they are good at, what they can afford,
// what the neighbourhood already has too much of and how much heat they can stand. It pays, costs money, goes wrong, and feeds the weekly envelope.
import { addFact, clamp, earn, money, recordCareer } from './core';
import { askToInvest } from './reports';
import { Character, DAY, Hustle, HustleKind, Skill, World } from './types';

interface Def { label: string; base: number; cost: number; skill: Skill; skill2?: Skill; risk: number; stake: number; swing: number; src: string; bad: string[]; good: string[] }

export const HUSTLES: Record<HustleKind, Def> = {
  numbers: { label: 'a numbers book', base: 840, cost: 0.5, skill: 'charm', skill2: 'brains', risk: 0.015, stake: 150, swing: 0.15, src: 'numbers', bad: ['a runner skipped town with the slips', 'a big hit came in and he had to pay out', 'two of his corner shops stopped taking bets after a police visit'], good: ['the corner is busy and the slips are thick'] },
  bookie: { label: 'a bookmaking operation', base: 1080, cost: 0.4, skill: 'brains', skill2: 'nerve', risk: 0.02, stake: 450, swing: 0.45, src: 'bookie', bad: ['the favourite came in and the book took a beating', 'a regular welshed on a big bet', 'he laid off too much and ate it'], good: ['the book fell his way'] },
  loans: { label: 'a few loans out on the street', base: 0, cost: 0.12, skill: 'nerve', skill2: 'muscle', risk: 0.01, stake: 600, swing: 0.25, src: 'loans', bad: ['two borrowers went quiet and he couldn’t find them', 'one customer lost his job and paid nothing'], good: ['everybody paid on time'] },
  cars: { label: 'a car-stealing outfit', base: 1290, cost: 0.45, skill: 'driving', skill2: 'nerve', risk: 0.05, stake: 0, swing: 0.3, src: 'boost', bad: ['the chop shop was shut for a week', 'a car turned out to be a cop’s', 'the buyer cut his price'], good: ['a good run of cars'] },
  fence: { label: 'fencing stolen goods', base: 930, cost: 0.5, skill: 'charm', skill2: 'brains', risk: 0.025, stake: 225, swing: 0.25, src: 'scam', bad: ['his supplier dried up', 'a load turned out to be junk'], good: ['a rich shipment moved fast'] },
  vending: { label: 'jukeboxes and cigarette machines', base: 690, cost: 0.4, skill: 'brains', risk: 0.005, stake: 375, swing: 0.1, src: 'vending', bad: ['a machine was smashed and the repair cost him', 'a bar owner dropped him for a rival route'], good: ['the bars were full'] },
  shakedown: { label: 'a few small shops paying for peace', base: 870, cost: 0.15, skill: 'muscle', skill2: 'nerve', risk: 0.035, stake: 0, swing: 0.25, src: 'protection', bad: ['one shopkeeper called his bluff', 'a shop he leaned on closed down'], good: ['all of them paid on time'] },
  odd: { label: 'odd jobs for whoever pays', base: 285, cost: 0.2, skill: 'muscle', skill2: 'charm', risk: 0.005, stake: 0, swing: 0.25, src: 'odd', bad: ['no work to be had'], good: ['plenty of little jobs'] },
};

const sk = (c: Character, d: Def) => (c.skills[d.skill] + (d.skill2 ? c.skills[d.skill2] * 0.5 : 0)) / (d.skill2 ? 1.5 : 1);

function crowd(w: World, kind: HustleKind, c: Character): number {
  let n = 0;
  for (const o of Object.values(w.chars)) if (o.alive && o.id !== c.id && o.hustle?.kind === kind && o.district === c.district) n++;
  return n;
}

function netExpected(w: World, c: Character, k: HustleKind, level: number): number {
  const d = HUSTLES[k];
  const gross = k === 'loans' ? Math.min(c.cash * 0.6, 1200 * level) * 0.1 * 4 : d.base * (0.7 + sk(c, d) * 1.3) * (1 + (level - 1) * 0.55);
  return gross * (1 - d.cost) / (1 + Math.max(0, crowd(w, k, c) - 2) * 0.12);
}

function choose(w: World, c: Character): HustleKind {
  let best: HustleKind = 'odd';
  let bs = -1;
  for (const k of Object.keys(HUSTLES) as HustleKind[]) {
    const d = HUSTLES[k];
    if (c.cash < d.stake * 0.7 && d.stake > 0) continue;
    if (k === 'loans' && c.cash < 400) continue;
    const heatPen = 1 - clamp(c.heat, 0, 1) * d.risk * 8;
    const cautionPen = 1 - c.traits.caution * d.risk * 6;
    const want = (k === 'shakedown' || k === 'cars') ? 0.7 + c.traits.violence * 0.6 : (k === 'bookie' || k === 'loans') ? 0.7 + c.traits.greed * 0.5 : 1;
    const sc = netExpected(w, c, k, 1) * heatPen * cautionPen * want * w.rng.range(0.85, 1.15);
    if (sc > bs) { bs = sc; best = k; }
  }
  return best;
}

export function hustleWeek(w: World) {
  const rng = w.rng;
  for (const c of Object.values(w.chars)) {
    if (!c.alive || c.isPlayer || !c.familyId || (c.rank !== 'associate' && c.rank !== 'soldier')) continue;
    if (c.jailedUntil > w.now) continue;
    if (c.hustle?.lull && c.hustle.lull > w.now) continue;
    let h = c.hustle;
    if (!h) h = c.hustle = { kind: choose(w, c), level: 1, since: w.now, gross: 0, costs: 0, net: 0, total: 0, bad: 0, stake: 0 };
    // Change course after a run of bad weeks, or now and then if something else looks better.
    if (h.bad >= 3 || (rng.chance(0.02) && h.level === 1)) {
      const k = choose(w, c);
      if (k !== h.kind) { c.hustle = h = { kind: k, level: 1, since: w.now, gross: 0, costs: 0, net: 0, total: h.total, bad: 0, stake: 0 }; }
      else h.bad = 0;
    }
    const d = HUSTLES[h.kind];
    // Expansion: a man with spare money and ambition puts it to work.
    if (h.level < 3 && c.cash > 1200 * h.level + d.stake && c.traits.ambition > 0.45 && h.bad === 0 && rng.chance(0.07)) {
      const cost = 600 * h.level;
      const boss = c.bossId ? w.chars[c.bossId] : undefined;
      if (boss?.isPlayer && (w.expect?.invest ?? 'ask') === 'ask') askToInvest(w, c, cost, HUSTLES[h.kind].label);
      else { c.cash -= cost; h.stake += cost; h.level++; c.books.expenses += cost; }
    }
    const comp = 1 / (1 + Math.max(0, crowd(w, h.kind, c) - 2) * 0.12);
    let gross = h.kind === 'loans'
      ? Math.min(Math.max(0, c.cash) * 0.6, 1200 * h.level) * 0.1 * 4 * rng.range(0.85, 1.1)
      : d.base * (0.7 + sk(c, d) * 1.3) * (1 + (h.level - 1) * 0.55) * rng.range(1 - d.swing * 0.5, 1 + d.swing * 0.5);
    const dir = c.familyId ? w.fam[c.familyId]?.directive : undefined;
    gross *= comp * (c.rank === 'soldier' ? 1.3 : 1) * (dir && dir.until > w.now ? (dir.kind === 'push' ? 1.25 : 0.85) : 1) * (c.bossId && c.bossId === w.playerId && w.path?.life?.hq ? 1.1 : 1);
    let cause = rng.pick(d.good);
    // What can go wrong this week.
    const pBad = 0.12 + d.swing * 0.2 + (c.heat > 0.6 ? 0.1 : 0);
    if (rng.chance(pBad)) { gross *= rng.range(0.15, 0.55); cause = rng.pick(d.bad); h.bad++; }
    else { h.bad = Math.max(0, h.bad - 1); if (comp < 0.65) cause = 'too many men are working the same patch'; }
    if (h.kind === 'bookie' && rng.chance(0.12)) { gross = -rng.int(100, 400); cause = rng.pick(d.bad); h.bad++; }
    const costs = Math.round(Math.max(0, gross) * d.cost + (h.level > 1 ? 20 * h.level : 0));
    let net = Math.round(gross - costs);
    if (net < 0) net = Math.max(net, -c.cash);
    if (net >= 0) earn(c, net, d.src); else c.cash += net;
    c.books.expenses += costs;
    h.gross = Math.round(gross); h.costs = costs; h.net = net; h.total += net; h.cause = cause;
    // Being on the street has a price.
    if (rng.chance(d.risk * (1 + c.heat) * (1.2 - c.traits.caution * 0.6) * (dir && dir.until > w.now ? (dir.kind === 'push' ? 1.5 : 0.4) : 1))) {
      c.heat = clamp(c.heat + 0.12, 0, 1.5);
      if (rng.chance(0.35)) {
        c.jailedUntil = w.now + rng.int(2, 9) * DAY;
        h.bad++;
        recordCareer(w, c, 'Arrested on the street');
        addFact(w, { kind: 'arrest', actor: c.id, text: `${c.name} was arrested.`, district: c.district }, {});
      }
    }
  }
}

export const hustleLine = (c: Character): string | undefined => c.hustle ? `${HUSTLES[c.hustle.kind].label}${c.hustle.level > 1 ? ', grown to a real business' : ''}` : undefined;
export { money };
